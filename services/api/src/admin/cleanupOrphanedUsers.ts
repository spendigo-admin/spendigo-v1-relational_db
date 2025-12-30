import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Cleanup Orphaned Users
 * 
 * Scans Firestore 'users' collection and checks if the corresponding user exists in Firebase Auth.
 * If the user is missing from Auth, the Firestore document is deleted.
 * 
 * Protected: Requires Admin Authentication.
 */
export const cleanupOrphanedUsers = functions.https.onCall(async (data, context) => {
    // 1. Verify Authentication & Role
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const callerUid = context.auth.uid;
    const callerDoc = await admin.firestore().collection('users').doc(callerUid).get();
    const callerData = callerDoc.data();

    if (!callerData || callerData.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can perform this cleanup.');
    }

    try {
        const usersRef = admin.firestore().collection('users');
        const snapshot = await usersRef.get();

        let deletedCount = 0;
        let checkedCount = 0;

        const batchSize = 500;
        let batch = admin.firestore().batch();
        let operationCounter = 0;

        for (const doc of snapshot.docs) {
            const uid = doc.id;
            checkedCount++;

            try {
                // Check if user exists in Auth
                await admin.auth().getUser(uid);
            } catch (error: any) {
                if (error.code === 'auth/user-not-found') {
                    // User does not exist in Auth, delete from Firestore
                    console.log(`Deleting orphan user: ${uid} (${doc.data().email})`);
                    batch.delete(doc.ref);
                    deletedCount++;
                    operationCounter++;
                } else {
                    console.error(`Error checking user ${uid}:`, error);
                }
            }

            // Commit batch if full
            if (operationCounter >= batchSize) {
                await batch.commit();
                batch = admin.firestore().batch();
                operationCounter = 0;
            }
        }

        // Commit remaining
        if (operationCounter > 0) {
            await batch.commit();
        }

        return {
            success: true,
            checked: checkedCount,
            deleted: deletedCount,
            message: `Cleanup complete. Deleted ${deletedCount} orphaned profiles out of ${checkedCount} total users.`
        };

    } catch (error: any) {
        console.error("Cleanup failed:", error);
        throw new functions.https.HttpsError('internal', `Cleanup failed: ${error.message}`);
    }
});
