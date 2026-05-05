"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportFirebaseAuth = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const storage_1 = require("@google-cloud/storage");
const storage = new storage_1.Storage();
exports.exportFirebaseAuth = functions
    .runWith({ timeoutSeconds: 540, memory: '512MB' })
    .pubsub.schedule('0 3 * * *')
    .timeZone('America/Toronto')
    .onRun(async (_context) => {
    const projectId = process.env.GCLOUD_PROJECT || admin.instanceId().app.options.projectId || 'spendigo-smartcart-prod';
    const bucketName = `${projectId}-firestore-backups`;
    const date = new Date().toISOString().slice(0, 10);
    const filename = `auth-exports/auth_users_${date}.ndjson`;
    const users = [];
    let pageToken;
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
    functions.logger.info(`[AuthExport] Exported ${users.length} users to gs://${bucketName}/${filename}`);
});
//# sourceMappingURL=exportFirebaseAuth.js.map