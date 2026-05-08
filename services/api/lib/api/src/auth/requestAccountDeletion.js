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
exports.requestAccountDeletion = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const audit_1 = require("../utils/audit");
/**
 * DSAR: Request Account Deletion (Self-Service)
 * Allows an authenticated user to permanently delete their own account.
 *
 * Compliance: PIPEDA (Canada), GDPR (EU) — Right to be Forgotten
 *
 * Behavior:
 * 1. Deletes Firebase Auth record (login credentials).
 * 2. Deletes Firestore /users/{uid} document (PII).
 * 3. If merchant, suspends their store (preserves order history for accounting).
 * 4. Anonymizes order records — replaces customer PII with "[deleted]".
 */
exports.requestAccountDeletion = functions.https.onCall(async (data, context) => {
    // 1. Must be authenticated
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be signed in to delete your account.');
    }
    const uid = context.auth.uid;
    try {
        functions.logger.info(`DSAR: User ${uid} requested account deletion.`);
        // 2. Fetch user document for role-specific cleanup
        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        const userData = userDoc.data();
        // 3. If merchant, suspend their store (don't delete — preserve order history)
        if ((userData === null || userData === void 0 ? void 0 : userData.role) === 'merchant' && (userData === null || userData === void 0 ? void 0 : userData.storeId)) {
            await admin.firestore().collection('stores').doc(userData.storeId).update({
                status: 'suspended',
                suspendedAt: admin.firestore.FieldValue.serverTimestamp(),
                suspensionReason: 'Owner deleted their account (DSAR)'
            });
            functions.logger.info(`DSAR: Suspended store ${userData.storeId}`);
        }
        // 4. Anonymize order records — remove PII but keep financial data
        const ordersSnapshot = await admin.firestore()
            .collection('orders')
            .where('customerId', '==', uid)
            .get();
        const batch = admin.firestore().batch();
        ordersSnapshot.docs.forEach(doc => {
            batch.update(doc.ref, {
                customerName: '[deleted]',
                customerEmail: '[deleted]',
                customerPhone: '[deleted]',
                deliveryAddress: null,
                deletedByUser: true,
                deletedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });
        await batch.commit();
        functions.logger.info(`DSAR: Anonymized ${ordersSnapshot.size} order(s).`);
        // 5. Delete user notifications subcollection
        const notifSnapshot = await admin.firestore()
            .collection('users').doc(uid).collection('notifications').get();
        const notifBatch = admin.firestore().batch();
        notifSnapshot.docs.forEach(doc => notifBatch.delete(doc.ref));
        await notifBatch.commit();
        // 6. Record forensic audit event BEFORE deletion
        await (0, audit_1.logEvent)('USER_SELF_DELETE', (0, audit_1.buildActorFromContext)(context), { role: userData === null || userData === void 0 ? void 0 : userData.role, email: userData === null || userData === void 0 ? void 0 : userData.email }, `users/${uid}`);
        // 7. Delete Firestore user document (PII)
        await admin.firestore().collection('users').doc(uid).delete();
        functions.logger.info(`DSAR: Deleted Firestore /users/${uid}`);
        // 8. Delete Firebase Auth record (credentials)
        await admin.auth().deleteUser(uid);
        functions.logger.info(`DSAR: Deleted Firebase Auth for ${uid}`);
        return { success: true, message: 'Your account has been permanently deleted.' };
    }
    catch (error) {
        functions.logger.error('DSAR deletion error:', error);
        throw new functions.https.HttpsError('internal', `Account deletion failed: ${error.message}`);
    }
});
//# sourceMappingURL=requestAccountDeletion.js.map