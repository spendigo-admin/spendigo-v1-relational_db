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
exports.triggerManualExport = exports.scheduledFirestoreExport = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const audit_1 = require("../utils/audit");
const errors_1 = require("../utils/errors");
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
exports.scheduledFirestoreExport = functions
    .runWith({ timeoutSeconds: 540, memory: '256MB' })
    .pubsub.schedule('0 2 * * *')
    .timeZone('America/Toronto')
    .onRun(async (_context) => {
    var _a, _b;
    const db = admin.firestore();
    const settingsDoc = await db.collection('settings').doc('platform').get();
    const scheduledExportsEnabled = (_b = (_a = settingsDoc.data()) === null || _a === void 0 ? void 0 : _a.scheduledExportsEnabled) !== null && _b !== void 0 ? _b : true;
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
        await (0, audit_1.logEvent)('SCHEDULED_FIRESTORE_EXPORT', { id: 'system', email: 'system@spendigo.local', ip: 'system' }, { date, outputUriPrefix: outputBase, collections: { critical: CRITICAL_COLLECTIONS, highValue: HIGH_VALUE_COLLECTIONS } }, 'backups/firestore-daily');
        functions.logger.info(`[ScheduledExport] Initiated exports to ${outputBase}`);
    }
    catch (error) {
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
        await (0, audit_1.logEvent)('SCHEDULED_FIRESTORE_EXPORT_FAILED', { id: 'system', email: 'system@spendigo.local', ip: 'system' }, { date, outputUriPrefix: outputBase, errorMessage: error.message }, 'backups/firestore-daily');
        throw error;
    }
    return null;
});
exports.triggerManualExport = functions
    .runWith({ timeoutSeconds: 540, memory: '256MB' })
    .https.onCall(async (_data, context) => {
    var _a, _b, _c;
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'App Check required.');
    }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated.');
    }
    const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    if (((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
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
        await (0, audit_1.logEvent)('MANUAL_FIRESTORE_EXPORT', { id: context.auth.uid, email: context.auth.token.email || '', ip: ((_b = context.rawRequest) === null || _b === void 0 ? void 0 : _b.ip) || '' }, { date, outputUriPrefix: outputBase }, 'backups/firestore-manual');
        return { success: true, outputUriPrefix: outputBase };
    }
    catch (error) {
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
        await (0, audit_1.logEvent)('MANUAL_FIRESTORE_EXPORT_FAILED', { id: context.auth.uid, email: context.auth.token.email || '', ip: ((_c = context.rawRequest) === null || _c === void 0 ? void 0 : _c.ip) || '' }, { date, outputUriPrefix: outputBase, errorMessage: error.message }, 'backups/firestore-manual');
        (0, errors_1.toHttpsError)(error, 'Export failed.');
    }
});
//# sourceMappingURL=scheduledFirestoreExport.js.map