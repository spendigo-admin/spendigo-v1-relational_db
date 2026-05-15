import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { cascadeDeleteStore } from './storeCleanupUtils';
import { toHttpsError } from '../utils/errors';

export const forceDeleteStore = functions
    .runWith({ timeoutSeconds: 540, memory: '256MB' })
    .https.onCall(async (data: { storeId: string }, context) => {
        if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
            throw new functions.https.HttpsError('failed-precondition', 'App Check required.');
        }
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated.');
        }

        const callerDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        if (callerDoc.data()?.role !== 'admin') {
            throw new functions.https.HttpsError('permission-denied', 'Admin only.');
        }

        const { storeId } = data;
        if (!storeId) {
            throw new functions.https.HttpsError('invalid-argument', 'storeId is required.');
        }

        const db = admin.firestore();
        const storeRef = db.collection('stores').doc(storeId);
        const storeSnap = await storeRef.get();

        if (!storeSnap.exists) {
            throw new functions.https.HttpsError('not-found', `Store ${storeId} not found.`);
        }

        const storeData = storeSnap.data()!;
        if (storeData.status !== 'pending_deletion') {
            throw new functions.https.HttpsError(
                'failed-precondition',
                `Store must be in 'pending_deletion' status. Current status: '${storeData.status}'.`
            );
        }

        functions.logger.warn(`[ForceDelete] Admin ${context.auth.uid} triggered force deletion of store ${storeId}`);

        try {
            await cascadeDeleteStore(db, storeId, storeData);
            await storeRef.delete();
            functions.logger.info(`[ForceDelete] Store ${storeId} permanently deleted by admin ${context.auth.uid}`);
            return { success: true, storeId };
        } catch (err) {
            functions.logger.error(`[ForceDelete] Failed to force-delete store ${storeId}:`, err);
            await storeRef.update({ status: 'deletion_failed', deletionError: String(err) });
            toHttpsError(err, 'Force deletion failed.');
        }
    });
