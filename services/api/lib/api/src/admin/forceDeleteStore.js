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
exports.forceDeleteStore = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const storeCleanupUtils_1 = require("./storeCleanupUtils");
const errors_1 = require("../utils/errors");
exports.forceDeleteStore = functions
    .runWith({ timeoutSeconds: 540, memory: '256MB' })
    .https.onCall(async (data, context) => {
    var _a;
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'App Check required.');
    }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated.');
    }
    const callerDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    if (((_a = callerDoc.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
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
    const storeData = storeSnap.data();
    if (storeData.status !== 'pending_deletion') {
        throw new functions.https.HttpsError('failed-precondition', `Store must be in 'pending_deletion' status. Current status: '${storeData.status}'.`);
    }
    functions.logger.warn(`[ForceDelete] Admin ${context.auth.uid} triggered force deletion of store ${storeId}`);
    try {
        await (0, storeCleanupUtils_1.cascadeDeleteStore)(db, storeId, storeData);
        await storeRef.delete();
        functions.logger.info(`[ForceDelete] Store ${storeId} permanently deleted by admin ${context.auth.uid}`);
        return { success: true, storeId };
    }
    catch (err) {
        functions.logger.error(`[ForceDelete] Failed to force-delete store ${storeId}:`, err);
        await storeRef.update({ status: 'deletion_failed', deletionError: String(err) });
        (0, errors_1.toHttpsError)(err, 'Force deletion failed.');
    }
});
//# sourceMappingURL=forceDeleteStore.js.map