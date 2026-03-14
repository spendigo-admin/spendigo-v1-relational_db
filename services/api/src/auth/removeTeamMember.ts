import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Callable HTTPS Cloud Function to remove a team member
 * Removes the storeId and merchantRole from the target user
 */
export const removeTeamMember = functions.https.onCall(async (data, context) => {
    // 1. Verify Authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { targetUserId, storeId } = data;

    if (!targetUserId || !storeId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing fields');
    }

    // 2. Verify Caller is Owner/Manager of the store
    const callerDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    const callerData = callerDoc.data();

    if (!callerData || callerData.storeId !== storeId) {
        throw new functions.https.HttpsError('permission-denied', 'Not authorized for this store');
    }

    if (callerData.merchantRole !== 'OWNER' && callerData.merchantRole !== 'MANAGER') {
        throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
    }

    // 3. Verify Target belongs to this store
    const targetRef = admin.firestore().collection('users').doc(targetUserId);
    const targetDoc = await targetRef.get();

    if (!targetDoc.exists || targetDoc.data()?.storeId !== storeId) {
        throw new functions.https.HttpsError('invalid-argument', 'Target user is not in this store');
    }

    // Prevent removing yourself (optional, but good practice)
    if (context.auth.uid === targetUserId) {
        throw new functions.https.HttpsError('invalid-argument', 'Cannot remove yourself');
    }

    // Role-rank guard: caller may only remove members strictly below their own rank.
    // Prevents a MANAGER from removing an OWNER (store takeover vector).
    const ROLE_RANK: Record<string, number> = { OWNER: 3, MANAGER: 2, STAFF: 1, MARKETING: 1 };
    const callerRank = ROLE_RANK[callerData.merchantRole] ?? 0;
    const targetRank = ROLE_RANK[targetDoc.data()?.merchantRole] ?? 0;
    if (targetRank >= callerRank) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'Cannot remove a member with equal or higher role'
        );
    }

    // 4. Update Target User (Unlink from store)
    await targetRef.update({
        storeId: admin.firestore.FieldValue.delete(),
        merchantRole: admin.firestore.FieldValue.delete(),
        role: 'consumer', // Revert to consumer
        status: 'active' // Ensure they aren't stuck in pending
    });

    return { success: true };
});
