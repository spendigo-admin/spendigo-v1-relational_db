import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

interface InviteData {
    email: string;
    name: string;
    merchantRole: 'OWNER' | 'MANAGER' | 'STAFF' | 'MARKETING';
    storeId: string;
    tempPassword: string;
}

/**
 * Callable HTTPS Cloud Function to invite team members
 * Creates both Firebase Auth account and Firestore user record
 */
export const inviteTeamMember = functions.https.onCall(
    async (data: InviteData, context) => {
        // 1. Verify caller is authenticated
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'Must be authenticated to invite team members'
            );
        }

        // 2. Validate input
        const { email, name, merchantRole, storeId, tempPassword } = data;

        if (!email || !name || !merchantRole || !storeId || !tempPassword) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Missing required fields'
            );
        }

        // 3. Verify caller is a merchant (not consumer/admin)
        const callerDoc = await admin.firestore()
            .collection('users')
            .doc(context.auth.uid)
            .get();

        const callerData = callerDoc.data();

        if (!callerData || callerData.role !== 'merchant') {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Only merchants can invite team members'
            );
        }

        // 4. Verify caller is from the same store (owners/managers only)
        if (callerData.storeId !== storeId) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Can only invite members to your own store'
            );
        }

        // 5. Verify caller has sufficient permissions (OWNER or MANAGER)
        const callerRole = callerData.merchantRole || 'STAFF';
        if (callerRole !== 'OWNER' && callerRole !== 'MANAGER') {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Only store owners and managers can invite team members'
            );
        }

        // 5b. Role-rank guard: caller may only assign roles strictly below their own.
        // Prevents a MANAGER from inviting a new OWNER (store takeover vector).
        const ROLE_RANK: Record<string, number> = { OWNER: 3, MANAGER: 2, STAFF: 1, MARKETING: 1 };
        if ((ROLE_RANK[merchantRole] ?? 0) >= (ROLE_RANK[callerRole] ?? 0)) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Cannot assign a role equal to or higher than your own'
            );
        }

        try {
            // 6. Create Firebase Auth user with temporary password
            const authUser = await admin.auth().createUser({
                email: email,
                password: tempPassword,
                displayName: name,
                emailVerified: false,
            });

            functions.logger.info(`Created Auth user: ${authUser.uid} for ${email}`);

            // 7. Create Firestore user document
            await admin.firestore().collection('users').doc(authUser.uid).set({
                email: email,
                name: name,
                role: 'merchant',
                merchantRole: merchantRole,
                storeId: storeId,
                status: 'pending_invite',
                invitedAt: admin.firestore.FieldValue.serverTimestamp(),
                invitedBy: context.auth.uid,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            functions.logger.info(`Created Firestore user doc for ${email}`);

            // 8. Return success
            return {
                success: true,
                uid: authUser.uid,
                message: `Successfully invited ${email} to join your team`,
            };

        } catch (error: any) {
            // Handle specific Firebase errors
            if (error.code === 'auth/email-already-exists') {
                throw new functions.https.HttpsError(
                    'already-exists',
                    `User with email ${email} already exists`
                );
            }

            // Log and throw generic error
            functions.logger.error('Error inviting team member:', error);
            throw new functions.https.HttpsError(
                'internal',
                'Failed to create team member account'
            );
        }
    }
);
