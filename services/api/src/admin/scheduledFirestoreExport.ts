import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { logEvent } from '../utils/audit';
import { toHttpsError } from '../utils/errors';

const CRITICAL_COLLECTIONS = [
    'orders',
    'audit_logs',
    'audit_logs_meta',
    'payments',
    'users',
    'stores',
];

const HIGH_VALUE_COLLECTIONS = [
    'merchant_products',
    'master_products',
];

export const scheduledFirestoreExport = functions
    .runWith({ timeoutSeconds: 540, memory: '256MB' })
    .pubsub.schedule('0 2 * * *')
    .timeZone('America/Toronto')
    .onRun(async (_context) => {
        const db = admin.firestore();

        const settingsDoc = await db.collection('settings').doc('platform').get();
        const scheduledExportsEnabled = settingsDoc.data()?.scheduledExportsEnabled ?? true;
        if (!scheduledExportsEnabled) {
            functions.logger.info('[ScheduledExport] Skipping — scheduled exports are paused.');
            return null;
        }

        // @google-cloud/firestore is a transitive dependency of firebase-admin — no extra install needed
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { v1: FirestoreAdmin } = require('@google-cloud/firestore');
        const client = new FirestoreAdmin.FirestoreAdminClient();

        const projectId = process.env.GCLOUD_PROJECT || admin.instanceId().app.options.projectId || 'spendigo-smartcart-prod';
        const databaseName = client.databasePath(projectId, '(default)');
        const bucketName = `${projectId}-firestore-backups`;
        const date = new Date().toISOString().slice(0, 10);
        const outputBase = `gs://${bucketName}/daily/${date}`;

        try {
            const [criticalOp] = await client.exportDocuments({
                name: databaseName,
                outputUriPrefix: `${outputBase}/critical`,
                collectionIds: CRITICAL_COLLECTIONS,
            });

            const [highValueOp] = await client.exportDocuments({
                name: databaseName,
                outputUriPrefix: `${outputBase}/high-value`,
                collectionIds: HIGH_VALUE_COLLECTIONS,
            });

            await db.collection('system_backups').add({
                type: 'scheduled_export',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                date,
                criticalOperationName: criticalOp.name,
                highValueOperationName: highValueOp.name,
                outputUriPrefix: outputBase,
                collections: { critical: CRITICAL_COLLECTIONS, highValue: HIGH_VALUE_COLLECTIONS },
                status: 'completed',
            });

            await logEvent(
                'SCHEDULED_FIRESTORE_EXPORT',
                { id: 'system', email: 'system@spendigo.local', ip: 'system' },
                { date, outputUriPrefix: outputBase, collections: { critical: CRITICAL_COLLECTIONS, highValue: HIGH_VALUE_COLLECTIONS } },
                'backups/firestore-daily'
            );

            functions.logger.info(`[ScheduledExport] Initiated exports to ${outputBase}`);
        } catch (error: any) {
            functions.logger.error('[ScheduledExport] Export failed:', error);
            await db.collection('system_backups').add({
                type: 'scheduled_export',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                date,
                outputUriPrefix: outputBase,
                collections: { critical: CRITICAL_COLLECTIONS, highValue: HIGH_VALUE_COLLECTIONS },
                status: 'failed',
                errorMessage: error.message,
            });
            await logEvent(
                'SCHEDULED_FIRESTORE_EXPORT_FAILED',
                { id: 'system', email: 'system@spendigo.local', ip: 'system' },
                { date, outputUriPrefix: outputBase, errorMessage: error.message },
                'backups/firestore-daily'
            );
            throw error;
        }
        return null;
    });

export const triggerManualExport = functions
    .runWith({ timeoutSeconds: 540, memory: '256MB' })
    .https.onCall(async (_data, context) => {
        if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
            throw new functions.https.HttpsError('failed-precondition', 'App Check required.');
        }
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated.');
        }

        const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
        if (userDoc.data()?.role !== 'admin') {
            throw new functions.https.HttpsError('permission-denied', 'Admin only.');
        }

        // Re-use the same export logic via a direct call
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { v1: FirestoreAdmin } = require('@google-cloud/firestore');
        const client = new FirestoreAdmin.FirestoreAdminClient();

        const projectId = process.env.GCLOUD_PROJECT || admin.instanceId().app.options.projectId || 'spendigo-smartcart-prod';
        const databaseName = client.databasePath(projectId, '(default)');
        const bucketName = `${projectId}-firestore-backups`;
        const date = new Date().toISOString().slice(0, 10);
        const ts = Date.now();
        const outputBase = `gs://${bucketName}/manual/${date}-${ts}`;
        const db = admin.firestore();

        try {
            const [op] = await client.exportDocuments({
                name: databaseName,
                outputUriPrefix: `${outputBase}/critical`,
                collectionIds: CRITICAL_COLLECTIONS,
            });

            await db.collection('system_backups').add({
                type: 'manual_export',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                date,
                criticalOperationName: op.name,
                outputUriPrefix: outputBase,
                collections: { critical: CRITICAL_COLLECTIONS },
                status: 'completed',
                triggeredBy: context.auth.uid,
            });

            await logEvent(
                'MANUAL_FIRESTORE_EXPORT',
                { id: context.auth.uid, email: context.auth.token.email || '', ip: context.rawRequest?.ip || '' },
                { date, outputUriPrefix: outputBase },
                'backups/firestore-manual'
            );

            return { success: true, outputUriPrefix: outputBase };
        } catch (error: any) {
            await db.collection('system_backups').add({
                type: 'manual_export',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                date,
                outputUriPrefix: outputBase,
                collections: { critical: CRITICAL_COLLECTIONS },
                status: 'failed',
                errorMessage: error.message,
                triggeredBy: context.auth.uid,
            });
            await logEvent(
                'MANUAL_FIRESTORE_EXPORT_FAILED',
                { id: context.auth.uid, email: context.auth.token.email || '', ip: context.rawRequest?.ip || '' },
                { date, outputUriPrefix: outputBase, errorMessage: error.message },
                'backups/firestore-manual'
            );
            toHttpsError(error, 'Export failed.');
        }
    });
