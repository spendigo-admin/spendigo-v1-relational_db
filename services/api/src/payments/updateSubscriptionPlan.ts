import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { stripe } from '../config/stripe';
import { logEvent, buildActorFromContext } from '../utils/audit';
import { toHttpsError } from '../utils/errors';

const db = admin.firestore();

export const updateSubscriptionPlan = functions
    .runWith({ secrets: ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_CORE', 'STRIPE_PRICE_GROWTH', 'STRIPE_PRICE_PRO'] })
    .https.onCall(async (data, context) => {
    const PRICE_IDS = {
        core: process.env.STRIPE_PRICE_CORE || 'price_123_test_core',
        growth: process.env.STRIPE_PRICE_GROWTH || 'price_456_test_growth',
        pro: process.env.STRIPE_PRICE_PRO || 'price_789_test_pro',
    };
    // 1. Security & Validation
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const { newTier } = data; // 'free', 'core', 'growth', 'pro'
    const userId = context.auth.uid;

    if (!['free', 'core', 'growth', 'pro'].includes(newTier)) {
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

        // 3. Determine change type (Upgrade vs Downgrade)
        // Assuming logical order: free < core < growth < pro
        const TIER_ORDER = { free: 0, core: 1, growth: 2, pro: 3 };
        const currentTier = userData?.subscriptionTier || 'free';
        const isUpgrade = TIER_ORDER[newTier as keyof typeof TIER_ORDER] > TIER_ORDER[currentTier as keyof typeof TIER_ORDER];
        const isDowngrade = TIER_ORDER[newTier as keyof typeof TIER_ORDER] < TIER_ORDER[currentTier as keyof typeof TIER_ORDER];

        if (isUpgrade) {
            // Upgrade: Charge prorated difference immediately (always_invoice)
            const newPriceId = PRICE_IDS[newTier as keyof typeof PRICE_IDS];
            const updatedSub = (await stripe.subscriptions.update(subscription.id, {
                items: [{
                    id: subscription.items.data[0].id,
                    price: newPriceId,
                }],
                proration_behavior: 'always_invoice',
            })) as any;

            // Calculate expiration date
            let expirationDate = '';
            if (updatedSub && updatedSub.current_period_end) {
                expirationDate = new Date(updatedSub.current_period_end * 1000).toISOString().split('T')[0];
            }

            // Update Firestore immediately
            const updatedStatus = 'active';
            await db.collection('users').doc(userId).update({
                subscriptionTier: newTier,
                subscriptionStatus: updatedStatus,
                subscriptionEnd: expirationDate
            });

            const storeId = userData?.storeId;
            if (storeId) {
                await db.collection('stores').doc(storeId).update({
                    subscriptionTier: newTier,
                    subscriptionStatus: updatedStatus
                });
            }
        } else if (isDowngrade) {
            // Downgrade: Calculate difference, issue immediate Stripe refund, update Stripe with proration none
            const TIER_PRICES: Record<string, number> = {
                core: 4900,
                growth: 9900,
                pro: 14900,
                free: 0
            };

            const sub = subscription as any;
            const now = Math.floor(Date.now() / 1000);
            const periodStart = sub.current_period_start;
            const periodEnd = sub.current_period_end;
            const totalSeconds = periodEnd - periodStart;
            const remainingSeconds = Math.max(0, periodEnd - now);
            const fractionRemaining = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;

            let oldPrice = TIER_PRICES[currentTier as keyof typeof TIER_PRICES] || 0;
            let newPrice = TIER_PRICES[newTier as keyof typeof TIER_PRICES] || 0;

            // Apply subscription discount coupon if present
            if (sub.discount?.coupon) {
                const percentOff = sub.discount.coupon.percent_off;
                const amountOff = sub.discount.coupon.amount_off;
                if (percentOff) {
                    oldPrice = Math.round(oldPrice * (1 - percentOff / 100));
                    newPrice = Math.round(newPrice * (1 - percentOff / 100));
                } else if (amountOff) {
                    oldPrice = Math.max(0, oldPrice - amountOff);
                    newPrice = Math.max(0, newPrice - amountOff);
                }
            }

            const priceDifference = oldPrice - newPrice;
            const refundAmount = Math.round(priceDifference * fractionRemaining);

            if (refundAmount > 0) {
                const latestInvoiceId = sub.latest_invoice;
                if (!latestInvoiceId) {
                    throw new functions.https.HttpsError('failed-precondition', 'No latest invoice found to issue refund.');
                }
                const latestInvoice = (await stripe.invoices.retrieve(latestInvoiceId as string)) as any;
                const chargeId = latestInvoice.charge as string;
                if (!chargeId) {
                    throw new functions.https.HttpsError('failed-precondition', 'No successful charge found on the latest invoice.');
                }

                // Process immediate Stripe Refund
                await stripe.refunds.create({
                    charge: chargeId,
                    amount: refundAmount,
                    reason: 'requested_by_customer',
                    metadata: {
                        subscriptionId: sub.id,
                        newTier,
                        originalInvoice: latestInvoiceId as string
                    }
                });
            }

            let expirationDate = '';
            if (newTier === 'free') {
                // Cancel subscription immediately
                await stripe.subscriptions.cancel(subscription.id);
            } else {
                // Update to new cheaper paid plan with proration_behavior = none
                const newPriceId = PRICE_IDS[newTier as keyof typeof PRICE_IDS];
                const updatedSub = (await stripe.subscriptions.update(subscription.id, {
                    items: [{
                        id: subscription.items.data[0].id,
                        price: newPriceId,
                    }],
                    proration_behavior: 'none',
                })) as any;
                if (updatedSub && updatedSub.current_period_end) {
                    expirationDate = new Date(updatedSub.current_period_end * 1000).toISOString().split('T')[0];
                }
            }

            // Update Firestore immediately
            const updatedStatus = newTier === 'free' ? 'inactive' : 'active';
            await db.collection('users').doc(userId).update({
                subscriptionTier: newTier,
                subscriptionStatus: updatedStatus,
                subscriptionEnd: expirationDate
            });

            const storeId = userData?.storeId;
            if (storeId) {
                await db.collection('stores').doc(storeId).update({
                    subscriptionTier: newTier,
                    subscriptionStatus: updatedStatus
                });
            }
        }

        await logEvent(
            'SUBSCRIPTION_CHANGE',
            buildActorFromContext(context),
            { fromTier: currentTier, toTier: newTier, changeType: isUpgrade ? 'upgrade' : 'downgrade' },
            `users/${userId}`
        );

        return { 
            success: true, 
            message: isUpgrade 
                ? 'Plan upgraded successfully.' 
                : newTier === 'free' 
                    ? 'Subscription cancelled immediately with prorated refund.' 
                    : 'Plan downgraded immediately with prorated refund.' 
        };

    } catch (error: any) {
        toHttpsError(error, 'Failed to update subscription plan.');
    }
});
