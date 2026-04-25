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
exports.purgeAuditLogs = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
/**
 * purgeAuditLogs
 * Securely deletes all audit logs.
 * Restricted to SUPER_ADMIN users only.
 * This is used to reset the ledger when the forensic chain is intentionally restarted.
 */
exports.purgeAuditLogs = functions.https.onCall(async (data, context) => {
    // 1. Verify caller is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }
    // 2. Verify caller is a SUPER_ADMIN
    const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    const userData = userDoc.data();
    if (!userData || userData.role !== 'admin' || userData.adminRole !== 'SUPER_ADMIN') {
        throw new functions.https.HttpsError('permission-denied', 'Only Super Admins can purge audit logs');
    }
    const db = admin.firestore();
    const collectionRef = db.collection('audit_logs');
    try {
        // Delete logs in batches to avoid timeout
        const snapshot = await collectionRef.limit(500).get();
        if (snapshot.empty) {
            return { success: true, count: 0, message: 'Ledger already empty' };
        }
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        functions.logger.info(`Super Admin ${context.auth.uid} purged ${snapshot.size} audit logs`);
        return {
            success: true,
            count: snapshot.size,
            message: `Successfully purged ${snapshot.size} logs. Re-run if more logs remain.`
        };
    }
    catch (error) {
        functions.logger.error('Purge failed:', error);
        throw new functions.https.HttpsError('internal', 'Failed to purge logs');
    }
});
//# sourceMappingURL=purgeAuditLogs.js.map