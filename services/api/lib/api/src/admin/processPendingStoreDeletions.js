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
exports.processPendingStoreDeletions = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const storeCleanupUtils_1 = require("./storeCleanupUtils");
const GRACE_PERIOD_DAYS = 30;
exports.processPendingStoreDeletions = functions
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
            await (0, storeCleanupUtils_1.cascadeDeleteStore)(db, storeId, storeDoc.data());
            await storeDoc.ref.delete();
            functions.logger.info(`[StoreCleanup] Deleted store ${storeId} after ${GRACE_PERIOD_DAYS}-day grace period.`);
        }
        catch (err) {
            functions.logger.error(`[StoreCleanup] Failed to delete store ${storeId}:`, err);
            // Mark as failed so admin can investigate — leave data intact
            await storeDoc.ref.update({ status: 'deletion_failed', deletionError: String(err) });
        }
    }
});
//# sourceMappingURL=processPendingStoreDeletions.js.map