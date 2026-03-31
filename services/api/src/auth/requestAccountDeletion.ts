import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * DSAR: Request Account Deletion (Self-Service)
 * Allows an authenticated user to permanently delete their own account.
 * 
 * Compliance: PIPEDA (Canada), GDPR (EU) — Right to be Forgotten
 * 
 * Behavior:
 * 1. Deletes Firebase Auth record (login credentials).
 * 2. Deletes Firestore /users/{uid} document (PII).
 * 3. If merchant, suspends their store (preserves order history for accounting).
 * 4. Anonymizes order records — replaces customer PII with "[deleted]".
 */
export const requestAccountDeletion = functions.https.onCall(async (data, context) => {
    // 1. Must be authenticated
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be signed in to delete your account.');
    }

    const uid = context.auth.uid;

    try {
        functions.logger.info(`DSAR: User ${uid} requested account deletion.`);

        // 2. Fetch user document for role-specific cleanup
        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        const userData = userDoc.data();

        // 3. If merchant, suspend their store (don't delete — preserve order history)
        if (userData?.role === 'merchant' && userData?.storeId) {
            await admin.firestore().collection('stores').doc(userData.storeId).update({
                status: 'suspended',
                suspendedAt: admin.firestore.FieldValue.serverTimestamp(),
                suspensionReason: 'Owner deleted their account (DSAR)'
            });
            functions.logger.info(`DSAR: Suspended store ${userData.storeId}`);
        }

        // 4. Anonymize order records — remove PII but keep financial data
        const ordersSnapshot = await admin.firestore()
            .collection('orders')
            .where('customerId', '==', uid)
            .get();

        const batch = admin.firestore().batch();
        ordersSnapshot.docs.forEach(doc => {
            batch.update(doc.ref, {
                customerName: '[deleted]',
                customerEmail: '[deleted]',
                customerPhone: '[deleted]',
                deliveryAddress: null,
                deletedByUser: true,
                deletedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });
        await batch.commit();
        functions.logger.info(`DSAR: Anonymized ${ordersSnapshot.size} order(s).`);

        // 5. Delete user notifications subcollection
        const notifSnapshot = await admin.firestore()
            .collection('users').doc(uid).collection('notifications').get();
        const notifBatch = admin.firestore().batch();
        notifSnapshot.docs.forEach(doc => notifBatch.delete(doc.ref));
        await notifBatch.commit();

        // 6. Delete Firestore user document (PII)
        await admin.firestore().collection('users').doc(uid).delete();
        functions.logger.info(`DSAR: Deleted Firestore /users/${uid}`);

        // 7. Delete Firebase Auth record (credentials)
        await admin.auth().deleteUser(uid);
        functions.logger.info(`DSAR: Deleted Firebase Auth for ${uid}`);

        return { success: true, message: 'Your account has been permanently deleted.' };
    } catch (error: any) {
        functions.logger.error('DSAR deletion error:', error);
        throw new functions.https.HttpsError('internal', `Account deletion failed: ${error.message}`);
    }
});
