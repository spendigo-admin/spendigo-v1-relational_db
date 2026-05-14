import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { stripe } from '../config/stripe';
import { checkRateLimit } from '../utils/rateLimiter';
import { toHttpsError } from '../utils/errors';

const db = admin.firestore();

/**
 * Creates a Stripe PaymentIntent for a specific order (or batch of orders).
 * Supports Split Payments (Direct Charges to the Merchant with Application Fee).
 */
export const createPaymentIntent = functions.https.onCall(async (data, context) => {
    // 1. Security Check
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    // Rate Limit: Max 10 intents per minute per user (Increased for testing)
    await checkRateLimit(context.auth.uid, 'createPaymentIntent', 10, 60 * 1000);

    const { amount, currency = 'cad', storeId, metadata } = data;

    if (!amount || amount <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Valid amount is required.');
    }
    if (!storeId) {
        throw new functions.https.HttpsError('invalid-argument', 'Store ID is required for split payments.');
    }

    try {
        // 2. Fetch Store's Stripe Account ID
        const storeSnap = await db.collection('stores').doc(storeId).get();
        const storeData = storeSnap.data();
        const stripeAccountId = storeData?.stripeAccountId;

        if (!stripeAccountId) {
            throw new functions.https.HttpsError('failed-precondition', 'Store is not set up for online payments yet.');
        }

        // 3. Calculate Application Fee (Spendigo's Cut)
        // Example: 5% + $0.30 fixed
        // amount is in cents
        const variableFee = Math.round(amount * 0.05); // 5%
        const fixedFee = 30; // $0.30
        const applicationFeeAmount = variableFee + fixedFee;

        // 4. Create the PaymentIntent using the 'On Behalf Of' / 'Direct Charges' approach
        // We use Destination Charges here: Charge the customer on Spendigo's platform, 
        // then transfer funds to the merchant MINUS the fee.
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount),
            currency: currency.toLowerCase(),
            payment_method_types: ['card'],
            application_fee_amount: applicationFeeAmount,
            transfer_data: {
                destination: stripeAccountId,
            },
            metadata: {
                ...metadata,
                storeId,
                customerId: context.auth.uid,
                platformFee: applicationFeeAmount
            },
            // Specify capturing mode (automatic by default)
            capture_method: 'automatic',
        });

        functions.logger.log(`Created PaymentIntent ${paymentIntent.id} for store ${storeId} (Amount: ${amount}, Fee: ${applicationFeeAmount})`);

        return {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        };

    } catch (error: any) {
        toHttpsError(error, 'Failed to create payment intent.');
    }
});
