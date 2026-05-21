import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { stripe } from '../config/stripe';
import { checkRateLimit } from '../utils/rateLimiter';
import { toHttpsError } from '../utils/errors';

const db = admin.firestore();

/**
 * Creates a Stripe Checkout Session for a shopper checkout flow.
 * Supports split payments via Destination Charges to the merchant account.
 */
export const createShopperCheckoutSession = functions
    .runWith({ secrets: ['STRIPE_SECRET_KEY'] })
    .https.onCall(async (data, context) => {
    // 1. Security & Auth check
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    // Rate Limit: Max 10 checkout sessions per minute per user
    await checkRateLimit(context.auth.uid, 'createShopperCheckoutSession', 10, 60 * 1000);

    const { amount, currency = 'cad', storeId, metadata } = data;

    if (!amount || amount <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Valid amount is required.');
    }
    if (!storeId) {
        throw new functions.https.HttpsError('invalid-argument', 'Store ID is required for checkout.');
    }
    if (!metadata || !metadata.orderId) {
        throw new functions.https.HttpsError('invalid-argument', 'Order ID metadata is required.');
    }

    try {
        // 2. Fetch Store's Stripe Account ID
        const storeSnap = await db.collection('stores').doc(storeId).get();
        const storeData = storeSnap.data();
        const stripeAccountId = storeData?.stripeAccountId;

        if (!stripeAccountId) {
            throw new functions.https.HttpsError('failed-precondition', 'Store is not set up for online payments yet.');
        }

        // 3. Fetch or Create Stripe Customer for the shopper to force Canadian configuration
        const userId = context.auth.uid;
        const userEmail = context.auth.token?.email || '';

        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        let customerId = userData?.stripeCustomerId;

        if (!customerId) {
            // Create new customer in Stripe with Canadian country defaulting to prevent US ZIP layout
            const customer = await stripe.customers.create({
                email: userEmail || undefined,
                address: {
                    country: 'CA'
                },
                metadata: {
                    firebaseUID: userId
                }
            });
            customerId = customer.id;
            await db.collection('users').doc(userId).set({ stripeCustomerId: customerId }, { merge: true });
        } else {
            // Ensure existing customer has country set to 'CA' for correct billing layout
            try {
                await stripe.customers.update(customerId, {
                    address: {
                        country: 'CA'
                    }
                });
            } catch (err) {
                functions.logger.warn(`Failed to update stripe customer address for ${customerId}:`, err);
            }
        }

        // 4. Calculate Application Fee (Spendigo's Cut: 5% + $0.30 fixed)
        const variableFee = Math.round(amount * 0.05); // 5%
        const fixedFee = 30; // $0.30
        const applicationFeeAmount = variableFee + fixedFee;

        // 5. Create Stripe Checkout Session with Destination Charge setup
        const appUrl = process.env.APP_URL || 'https://spendigo.ca';
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            customer: customerId,
            line_items: [
                {
                    price_data: {
                        currency: currency.toLowerCase(),
                        product_data: {
                            name: `Order from ${metadata.storeName || 'Spendigo Merchant'}`,
                        },
                        unit_amount: Math.round(amount),
                    },
                    quantity: 1,
                },
            ],
            payment_intent_data: {
                application_fee_amount: applicationFeeAmount,
                transfer_data: {
                    destination: stripeAccountId,
                },
                metadata: {
                    ...metadata,
                    storeId,
                    customerId: userId,
                    platformFee: applicationFeeAmount,
                },
            },
            success_url: `${appUrl}/checkout?session_id={CHECKOUT_SESSION_ID}&order_id=${metadata.orderId}`,
            cancel_url: `${appUrl}/checkout`,
            metadata: {
                storeId,
                orderId: metadata.orderId,
                customerId: userId,
            }
        });

        functions.logger.log(`Created Checkout Session ${session.id} for store ${storeId} (Amount: ${amount}, Fee: ${applicationFeeAmount}, Customer: ${customerId})`);

        return {
            url: session.url,
            sessionId: session.id
        };

    } catch (error: any) {
        toHttpsError(error, 'Failed to create shopper checkout session.');
    }
});
