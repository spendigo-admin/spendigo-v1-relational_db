import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { stripe } from '../config/stripe';
import { checkRateLimit } from '../utils/rateLimiter';

const db = admin.firestore();

// MAP YOUR STRIPE PRICE IDs HERE (From your Stripe Dashboard)
// Run `firebase functions:config:set stripe.price_core="price_..." stripe.price_growth="price_..."`
const corePrice = functions.config().stripe?.price_core;
const growthPrice = functions.config().stripe?.price_growth;
if (!corePrice || !growthPrice) {
    throw new Error('Missing Stripe price IDs in Firebase config. Run: firebase functions:config:set stripe.price_core="price_..." stripe.price_growth="price_..."');
}
const PRICE_IDS = {
    core: corePrice,
    growth: growthPrice,
};

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

    const { tier, promoCode } = data; // 'core' or 'growth'
    const userId = context.auth.uid;
    const userEmail = context.auth.token.email;

    if (!tier || !['core', 'growth'].includes(tier)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid subscription tier.');
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
        const appUrl = functions.config().app?.url || 'https://spendigo.ca';
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
        console.error('Stripe Checkout Error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
