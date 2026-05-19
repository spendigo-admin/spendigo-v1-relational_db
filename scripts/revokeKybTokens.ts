/**
 * One-time script: revoke download tokens on all existing KYB documents.
 *
 * Firebase auto-generates a download token when a file is uploaded via the
 * client SDK. That token bypasses Storage Security Rules, making the file
 * publicly accessible to anyone with the URL. The onKybDocumentUploaded trigger
 * now revokes tokens on new uploads, but files uploaded before that trigger
 * was deployed still carry their original tokens.
 *
 * This script finds every object under stores/{storeId}/documents/ and sets
 * firebaseStorageDownloadTokens: null to strip the token. After running,
 * those URLs return 403 to unauthenticated callers.
 *
 * Run with:
 *   GOOGLE_APPLICATION_CREDENTIALS=scripts/service-account.json \
 *   npx tsx scripts/revokeKybTokens.ts
 */

import * as admin from 'firebase-admin';
import * as serviceAccount from './service-account.json';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
        storageBucket: 'spendigo-8540c.firebasestorage.app',
    });
}

const bucket = admin.storage().bucket();

async function revokeKybTokens() {
    console.log('Listing KYB documents in stores/*/documents/ ...');

    const [files] = await bucket.getFiles({ prefix: 'stores/' });

    const kybFiles = files.filter(f => /^stores\/[^/]+\/documents\//.test(f.name));

    if (kybFiles.length === 0) {
        console.log('No KYB documents found.');
        return;
    }

    console.log(`Found ${kybFiles.length} KYB document(s). Revoking tokens...\n`);

    let revoked = 0;
    let alreadyClean = 0;
    let failed = 0;

    for (const file of kybFiles) {
        try {
            const [metadata] = await file.getMetadata();
            const hasToken = !!(metadata.metadata?.firebaseStorageDownloadTokens);

            if (!hasToken) {
                console.log(`  [skip]  ${file.name} — no token present`);
                alreadyClean++;
                continue;
            }

            await file.setMetadata({
                metadata: { firebaseStorageDownloadTokens: null },
            });

            console.log(`  [ok]    ${file.name}`);
            revoked++;
        } catch (err: any) {
            console.error(`  [fail]  ${file.name} — ${err.message}`);
            failed++;
        }
    }

    console.log(`\nDone. Revoked: ${revoked} | Already clean: ${alreadyClean} | Failed: ${failed}`);

    if (failed > 0) {
        console.warn('\nSome files failed. Re-run the script to retry — it is safe to run multiple times.');
        process.exit(1);
    }
}

revokeKybTokens().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
