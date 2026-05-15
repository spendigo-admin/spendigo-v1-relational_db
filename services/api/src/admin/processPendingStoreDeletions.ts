import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { cascadeDeleteStore } from './storeCleanupUtils';

const GRACE_PERIOD_DAYS = 30;

export const processPendingStoreDeletions = functions
    .runWith({ timeoutSeconds: 540, memory: '256MB' })
    .pubsub.schedule('0 4 * * *')
    .timeZone('America/Toronto')
    .onRun(async (_context) => {
        const db = admin.firestore();
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - GRACE_PERIOD_DAYS);

        const pendingSnap = await db.collection('stores')
            .where('status', '==', 'pending_deletion')
            .where('deletionApprovedAt', '<=', admin.firestore.Timestamp.fromDate(cutoff))
            .get();

        functions.logger.info(`[StoreCleanup] Found ${pendingSnap.size} stores past grace period.`);

        for (const storeDoc of pendingSnap.docs) {
            const storeId = storeDoc.id;
            try {
                await cascadeDeleteStore(db, storeId, storeDoc.data());
                await storeDoc.ref.delete();
                functions.logger.info(`[StoreCleanup] Deleted store ${storeId} after ${GRACE_PERIOD_DAYS}-day grace period.`);
            } catch (err) {
                functions.logger.error(`[StoreCleanup] Failed to delete store ${storeId}:`, err);
                // Mark as failed so admin can investigate — leave data intact
                await storeDoc.ref.update({ status: 'deletion_failed', deletionError: String(err) });
            }
        }
    });
