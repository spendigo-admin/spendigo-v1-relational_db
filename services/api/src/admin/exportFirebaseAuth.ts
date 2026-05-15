import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { Storage } from '@google-cloud/storage';
import { logEvent } from '../utils/audit';

const storage = new Storage();

export const exportFirebaseAuth = functions
    .runWith({ timeoutSeconds: 540, memory: '512MB' })
    .pubsub.schedule('0 3 * * *')
    .timeZone('America/Toronto')
    .onRun(async (_context) => {
        const projectId = process.env.GCLOUD_PROJECT || admin.instanceId().app.options.projectId || 'spendigo-smartcart-prod';
        const bucketName = `${projectId}-firestore-backups`;
        const date = new Date().toISOString().slice(0, 10);
        const filename = `auth-exports/auth_users_${date}.ndjson`;
        const systemActor = { id: 'system', email: 'system@spendigo.local', ip: 'system' };

        try {
            const users: object[] = [];
            let pageToken: string | undefined;

            do {
                const listResult = await admin.auth().listUsers(1000, pageToken);
                listResult.users.forEach(user => {
                    // Retain what's needed for disaster recovery; skip password hashes (inaccessible via Admin SDK)
                    users.push({
                        uid: user.uid,
                        email: user.email,
                        emailVerified: user.emailVerified,
                        displayName: user.displayName,
                        phoneNumber: user.phoneNumber,
                        photoURL: user.photoURL,
                        disabled: user.disabled,
                        providerData: user.providerData,
                        customClaims: user.customClaims,
                        metadata: {
                            creationTime: user.metadata.creationTime,
                            lastSignInTime: user.metadata.lastSignInTime,
                        },
                    });
                });
                pageToken = listResult.pageToken;
            } while (pageToken);

            const ndjson = users.map(u => JSON.stringify(u)).join('\n');
            const bucket = storage.bucket(bucketName);

            await bucket.file(filename).save(ndjson, {
                contentType: 'application/x-ndjson',
                metadata: { userCount: String(users.length) },
            });

            await admin.firestore().collection('system_backups').add({
                type: 'auth_export',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                date,
                userCount: users.length,
                gcsPath: `gs://${bucketName}/${filename}`,
                status: 'completed',
            });

            await logEvent(
                'FIREBASE_AUTH_EXPORT',
                systemActor,
                { date, userCount: users.length, gcsPath: `gs://${bucketName}/${filename}` },
                'backups/firebase-auth'
            );

            functions.logger.info(`[AuthExport] Exported ${users.length} users to gs://${bucketName}/${filename}`);
        } catch (error: any) {
            functions.logger.error('[AuthExport] Export failed:', error);
            await admin.firestore().collection('system_backups').add({
                type: 'auth_export',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                date,
                status: 'failed',
                errorMessage: error.message,
            });
            await logEvent(
                'FIREBASE_AUTH_EXPORT_FAILED',
                systemActor,
                { date, errorMessage: error.message },
                'backups/firebase-auth'
            );
            throw error;
        }
    });
