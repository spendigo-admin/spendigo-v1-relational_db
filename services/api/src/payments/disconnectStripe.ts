import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { toHttpsError } from '../utils/errors';

const db = admin.firestore();

/**
 * Disconnects / unlinks Stripe Connect account from a merchant store.
 * Only the store OWNER or an admin may call this.
 */
export const disconnectStripe = functions
    .runWith({ secrets: ['STRIPE_SECRET_KEY'] })
    .https.onCall(async (data, context) => {
    // 1. Authentication & Security Checks
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'App Check verification required.');
    }

    const { storeId } = data;
    if (!storeId) {
        throw new functions.https.HttpsError('invalid-argument', 'Store ID is required.');
    }

    try {
        // 2. Fetch Store Data
        const storeSnap = await db.collection('stores').doc(storeId).get();
        if (!storeSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Store not found.');
        }

        // 3. Ownership / Authorization Check
        const callerSnap = await db.collection('users').doc(context.auth.uid).get();
        if (!callerSnap.exists) {
            throw new functions.https.HttpsError('permission-denied', 'User record not found.');
        }
        const caller = callerSnap.data()!;
        const isAdmin = caller.role === 'admin';
        const isOwner = caller.role === 'merchant' && caller.storeId === storeId && caller.merchantRole === 'OWNER';

        if (!isAdmin && !isOwner) {
            throw new functions.https.HttpsError('permission-denied', 'Only the store owner may disconnect Stripe payouts.');
        }

        // 4. Unlink Stripe fields in Firestore using Admin SDK
        await db.collection('stores').doc(storeId).update({
            stripeAccountId: admin.firestore.FieldValue.delete(),
            stripeOnboardingStatus: admin.firestore.FieldValue.delete(),
            stripeConnectedAt: admin.firestore.FieldValue.delete()
        });

        functions.logger.log(`Unlinked Stripe Connect account for store ${storeId}`);

        return { success: true };

    } catch (error: any) {
        toHttpsError(error, 'Failed to disconnect Stripe account.');
    }
});
