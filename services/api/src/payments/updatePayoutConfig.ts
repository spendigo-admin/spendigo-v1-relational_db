import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { stripe } from '../config/stripe';
import { checkRateLimit } from '../utils/rateLimiter';
import { toHttpsError } from '../utils/errors';

const db = admin.firestore();

const INTERVAL_MAP: Record<string, object> = {
    daily:  { interval: 'daily' },
    weekly: { interval: 'weekly', weekly_anchor: 'monday' },
    manual: { interval: 'manual' },
};

/**
 * Persists payout schedule and statement descriptor to both Firestore and the
 * merchant's Stripe Connect account. Only the store OWNER or an admin may call this.
 */
export const updatePayoutConfig = functions
    .runWith({ secrets: ['STRIPE_SECRET_KEY'] })
    .https.onCall(async (data, context) => {
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'App Check verification required.');
    }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    await checkRateLimit(context.auth.uid, 'updatePayoutConfig', 5, 60_000);

    const { storeId, payoutSchedule, statementDescriptor } = data;

    if (!storeId) {
        throw new functions.https.HttpsError('invalid-argument', 'storeId is required.');
    }
    if (!INTERVAL_MAP[payoutSchedule]) {
        throw new functions.https.HttpsError('invalid-argument', 'payoutSchedule must be daily, weekly, or manual.');
    }
    const descriptor = String(statementDescriptor || '').trim().substring(0, 22);
    if (descriptor.length < 5) {
        throw new functions.https.HttpsError('invalid-argument', 'Statement descriptor must be at least 5 characters.');
    }

    try {
        // Ownership check — OWNER or admin only
        const callerSnap = await db.collection('users').doc(context.auth.uid).get();
        if (!callerSnap.exists) {
            throw new functions.https.HttpsError('permission-denied', 'User record not found.');
        }
        const caller = callerSnap.data()!;
        const isAdmin = caller.role === 'admin';
        const isOwner = caller.role === 'merchant' && caller.storeId === storeId && caller.merchantRole === 'OWNER';
        if (!isAdmin && !isOwner) {
            throw new functions.https.HttpsError('permission-denied', 'Only the store owner may update payout configuration.');
        }

        const storeSnap = await db.collection('stores').doc(storeId).get();
        if (!storeSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Store not found.');
        }
        const { stripeAccountId } = storeSnap.data()!;
        if (!stripeAccountId) {
            throw new functions.https.HttpsError('failed-precondition', 'Store is not connected to Stripe.');
        }

        await stripe.accounts.update(stripeAccountId, {
            settings: { payouts: { schedule: INTERVAL_MAP[payoutSchedule] as any } },
            business_profile: { name: descriptor },
        });

        await db.collection('stores').doc(storeId).update({
            payoutSchedule,
            statementDescriptor: descriptor,
            payoutConfigUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        functions.logger.log(`Updated payout config for store ${storeId}: schedule=${payoutSchedule}, descriptor=${descriptor}`);

        return { success: true };

    } catch (error: any) {
        toHttpsError(error, 'Failed to update payout configuration.');
    }
});
