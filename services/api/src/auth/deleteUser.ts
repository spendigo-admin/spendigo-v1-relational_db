import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Delete User Function (Admin Only)
 * Deletes a user from Firebase Authentication and Firestore.
 */
export const deleteUser = functions.https.onCall(async (data, context) => {
    // 1. Verify Authentication and Admin Role
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

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
        console.log(`Admin ${callerUid} deleting user ${targetUid}`);

        // 2. Delete from Firebase Authentication
        await admin.auth().deleteUser(targetUid);

        // 3. Delete User Profile from Firestore
        await admin.firestore().collection('users').doc(targetUid).delete();

        // 4. (Optional) Cleanup other data:
        // - Orders: Keep for records? Or anonymize? usually keep for records.
        // - Stores: If merchant, suspend store?

        // Check if user was a merchant
        const userDoc = await admin.firestore().collection('users').doc(targetUid).get();
        if (userDoc.exists && userDoc.data()?.role === 'merchant') {
            const storeId = userDoc.data()?.storeId;
            if (storeId) {
                // Suspend the store instead of deleting it to preserve order history
                await admin.firestore().collection('stores').doc(storeId).update({
                    status: 'suspended',
                    suspendedAt: admin.firestore.FieldValue.serverTimestamp(),
                    suspensionReason: 'Owner account deleted by admin'
                });
            }
        }

        return { success: true, message: `User ${targetUid} deleted successfully.` };
    } catch (error: any) {
        console.error('Error deleting user:', error);
        throw new functions.https.HttpsError('internal', `Failed to delete user: ${error.message}`);
    }
});
