import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { stripe } from '../config/stripe';
import { checkRateLimit } from '../utils/rateLimiter';
import { toHttpsError } from '../utils/errors';

const db = admin.firestore();

export const createCheckoutSession = functions.https.onCall(async (data, context) => {
    // 1. Security Check
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    // Rate Limit Check: Max 3 checkout sessions initialized per minute
    await checkRateLimit(context.auth.uid, 'createCheckoutSession', 3, 60 * 1000);

    const { tier, promoCode } = data; // 'core', 'growth', or 'pro'
    const userId = context.auth.uid;
    const userEmail = context.auth.token.email;

    if (!tier || !['core', 'growth', 'pro'].includes(tier)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid subscription tier.');
    }

    const PRICE_IDS = {
        core: process.env.STRIPE_PRICE_CORE,
        growth: process.env.STRIPE_PRICE_GROWTH,
        pro: process.env.STRIPE_PRICE_PRO,
    };
    if (!PRICE_IDS.core || !PRICE_IDS.growth || !PRICE_IDS.pro) {
        throw new functions.https.HttpsError('internal', 'Stripe price IDs not configured. Set STRIPE_PRICE_CORE, STRIPE_PRICE_GROWTH, and STRIPE_PRICE_PRO.');
    }

    try {
        // 2. Get or Create Stripe Customer
        // We check if the user already has a stripeCustomerId in Firestore
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        let customerId = userData?.stripeCustomerId;

        if (!customerId) {
            // Create new customer in Stripe
            const customer = await stripe.customers.create({
                email: userEmail,
                metadata: {
                    firebaseUID: userId
                }
            });
            customerId = customer.id;
            // Save ID for future
            await db.collection('users').doc(userId).set({ stripeCustomerId: customerId }, { merge: true });
        }

        // --- PROMO CODE LOGIC ---
        let subscriptionData: any = {};
        if (promoCode === 'FIRST100') {
            // Check if we are within the first 100 merchants
            const storesSnapshot = await db.collection('stores').count().get();
            const storeCount = storesSnapshot.data().count;

            if (storeCount < 100) {
                // Apply 3 Months Free Trial
                subscriptionData = {
                    trial_period_days: 90
                };
            }
        }

        // 3. Create Checkout Session
        const appUrl = process.env.APP_URL || 'https://spendigo.ca';
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription',
            customer: customerId,
            line_items: [
                {
                    price: PRICE_IDS[tier as keyof typeof PRICE_IDS],
                    quantity: 1,
                },
            ],
            subscription_data: subscriptionData,
            success_url: `${appUrl}/merchant/subscription?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${appUrl}/merchant/subscription`,
            metadata: {
                firebaseUID: userId,
                targetTier: tier,
                appliedPromo: promoCode || 'none'
            }
        });

        return { url: session.url };

    } catch (error: any) {
        toHttpsError(error, 'Failed to create checkout session.');
    }
});
