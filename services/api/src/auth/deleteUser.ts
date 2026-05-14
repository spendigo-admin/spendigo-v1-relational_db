import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { logEvent, buildActorFromContext } from '../utils/audit';
import { toHttpsError } from '../utils/errors';
import { checkRateLimit } from '../utils/rateLimiter';

/**
 * Delete User Function (Admin Only)
 * Deletes a user from Firebase Authentication and Firestore.
 */
export const deleteUser = functions.https.onCall(async (data, context) => {
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    // 1. Verify Authentication and Admin Role
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    await checkRateLimit(context.auth.uid, 'deleteUser', 3, 15 * 60 * 1000);

    // Check if the caller is an admin
    const callerUid = context.auth.uid;
    const callerDoc = await admin.firestore().collection('users').doc(callerUid).get();

    if (!callerDoc.exists || callerDoc.data()?.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can delete users.');
    }

    const { targetUid } = data;

    if (!targetUid) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a targetUid.');
    }

    // Prevent deleting yourself
    if (callerUid === targetUid) {
        throw new functions.https.HttpsError('invalid-argument', 'You cannot delete your own account via this function.');
    }

    try {
        functions.logger.log(`Admin ${callerUid} deleting user ${targetUid}`);

        // 2. Fetch user data BEFORE deleting — needed for merchant store suspension below.
        const userDoc = await admin.firestore().collection('users').doc(targetUid).get();
        const userData = userDoc.data();

        // 3. Delete from Firebase Authentication
        await admin.auth().deleteUser(targetUid);

        // 4. Delete User Profile from Firestore
        await admin.firestore().collection('users').doc(targetUid).delete();

        // 5. If merchant, suspend their store to preserve order history but hide it publicly.
        if (userData?.role === 'merchant') {
            const storeId = userData?.storeId;
            if (storeId) {
                // Suspend the store instead of deleting it to preserve order history
                await admin.firestore().collection('stores').doc(storeId).update({
                    status: 'suspended',
                    suspendedAt: admin.firestore.FieldValue.serverTimestamp(),
                    suspensionReason: 'Owner account deleted by admin'
                });
            }
        }

        await logEvent(
            'USER_DELETE',
            buildActorFromContext(context),
            { deletedUid: targetUid, deletedRole: userData?.role, deletedEmail: userData?.email },
            `users/${targetUid}`
        );

        return { success: true, message: `User ${targetUid} deleted successfully.` };
    } catch (error: any) {
        toHttpsError(error, 'Failed to delete user.');
    }
});
