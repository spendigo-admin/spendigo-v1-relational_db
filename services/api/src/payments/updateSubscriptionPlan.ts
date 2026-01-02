import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { stripe } from '../config/stripe';

const db = admin.firestore();

const PRICE_IDS = {
    core: functions.config().stripe?.price_core || 'price_123_test_core',
    growth: functions.config().stripe?.price_growth || 'price_456_test_growth',
};

export const updateSubscriptionPlan = functions.https.onCall(async (data, context) => {
    // 1. Security & Validation
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const { newTier } = data; // 'free', 'core', 'growth'
    const userId = context.auth.uid;

    if (!['free', 'core', 'growth'].includes(newTier)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid tier.');
    }

    try {
        // 2. Get User & Subscription Info
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        const stripeCustomerId = userData?.stripeCustomerId;

        if (!stripeCustomerId) {
            throw new functions.https.HttpsError('failed-precondition', 'No customer record found.');
        }

        // Find active subscription
        const subs = await stripe.subscriptions.list({
            customer: stripeCustomerId,
            status: 'active',
            limit: 1
        });

        if (subs.data.length === 0) {
            // No active subscription found. If trying to switch to paid, use Checkout instead.
            // If trying to switch to Free, it's already done effectively.
            if (newTier === 'free') return { success: true, message: 'Already free.' };
            throw new functions.https.HttpsError('failed-precondition', 'No active subscription to update. Please use checkout.');
        }

        const subscription = subs.data[0];
        // const currentPriceId = subscription.items.data[0].price.id; // Unused

        // 3. Handle Downgrade to Free (Cancellation)
        if (newTier === 'free') {
            await stripe.subscriptions.update(subscription.id, {
                cancel_at_period_end: true
            });
            return { success: true, message: 'Subscription set to cancel at period end.' };
        }

        // 4. Handle Paid Tier Change
        const newPriceId = PRICE_IDS[newTier as keyof typeof PRICE_IDS];

        // Determine if Upgrade or Downgrade
        // We need a way to know price value or just compare tier logical order
        // Assuming logical order: free < core < growth
        const TIER_ORDER = { free: 0, core: 1, growth: 2 };
        const currentTier = userData?.subscriptionTier || 'free';

        const isUpgrade = TIER_ORDER[newTier as keyof typeof TIER_ORDER] > TIER_ORDER[currentTier as keyof typeof TIER_ORDER];

        // Per rules:
        // Upgrade: Charge difference (Default proration: always_invoice)
        // Downgrade: No refund (No proration: 'none')
        const prorationBehavior = isUpgrade ? 'always_invoice' : 'none';

        await stripe.subscriptions.update(subscription.id, {
            items: [{
                id: subscription.items.data[0].id,
                price: newPriceId,
            }],
            proration_behavior: prorationBehavior,
        });

        // Update Firestore immediately (Optimistic, webhook will confirm)
        await db.collection('users').doc(userId).update({
            subscriptionTier: newTier,
            subscriptionStatus: 'active' // Ensure it stays active
        });

        return { success: true, message: isUpgrade ? 'Plan upgraded.' : 'Plan downgraded (effective next cycle).' };

    } catch (error: any) {
        console.error('Update Subscription Error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
