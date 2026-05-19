import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

const KYB_PATH_RE = /^stores\/[^/]+\/documents\//;

export const getKybDocUrl = functions.https.onCall(async (data: { storagePath: string }, context) => {
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

    const { storagePath } = data;
    if (!storagePath || !KYB_PATH_RE.test(storagePath)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid document path.');
    }

    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);

    const [exists] = await file.exists();
    if (!exists) {
        throw new functions.https.HttpsError('not-found', 'Document not found.');
    }

    const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    });

    return { url };
});
