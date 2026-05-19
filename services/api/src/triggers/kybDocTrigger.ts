import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

const KYB_PATH_RE = /^stores\/[^/]+\/documents\//;

// Fires after every Storage object is finalised.
// For KYB documents, immediately strips the auto-generated download token so the
// file can no longer be accessed via a bare URL — only via a signed URL from
// getKybDocUrl (admin-only) or the Admin SDK.
export const onKybDocumentUploaded = functions.storage
    .object()
    .onFinalize(async (object) => {
        if (!object.name || !KYB_PATH_RE.test(object.name)) return;

        const bucket = admin.storage().bucket(object.bucket);
        const file = bucket.file(object.name);

        // Setting firebaseStorageDownloadTokens to null removes all download tokens,
        // making the object inaccessible without a signed URL or Admin SDK call.
        await file.setMetadata({
            metadata: { firebaseStorageDownloadTokens: null },
        });

        functions.logger.info(`Revoked download token for KYB document: ${object.name}`);
    });
