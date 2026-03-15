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
exports.cleanupOrphanedUsers = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
/**
 * Cleanup Orphaned Users
 *
 * Scans Firestore 'users' collection and checks if the corresponding user exists in Firebase Auth.
 * If the user is missing from Auth, the Firestore document is deleted.
 *
 * Protected: Requires Admin Authentication.
 */
exports.cleanupOrphanedUsers = functions.https.onCall(async (data, context) => {
    // 1. Verify Authentication & Role
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const callerUid = context.auth.uid;
    const callerDoc = await admin.firestore().collection('users').doc(callerUid).get();
    const callerData = callerDoc.data();
    if (!callerData || callerData.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can perform this cleanup.');
    }
    try {
        const usersRef = admin.firestore().collection('users');
        const snapshot = await usersRef.get();
        let deletedCount = 0;
        let checkedCount = 0;
        const batchSize = 500;
        let batch = admin.firestore().batch();
        let operationCounter = 0;
        for (const doc of snapshot.docs) {
            const uid = doc.id;
            checkedCount++;
            try {
                // Check if user exists in Auth
                await admin.auth().getUser(uid);
            }
            catch (error) {
                if (error.code === 'auth/user-not-found') {
                    // User does not exist in Auth, delete from Firestore
                    functions.logger.log(`Deleting orphan user: ${uid} (${doc.data().email})`);
                    batch.delete(doc.ref);
                    deletedCount++;
                    operationCounter++;
                }
                else {
                    functions.logger.error(`Error checking user ${uid}:`, error);
                }
            }
            // Commit batch if full
            if (operationCounter >= batchSize) {
                await batch.commit();
                batch = admin.firestore().batch();
                operationCounter = 0;
            }
        }
        // Commit remaining
        if (operationCounter > 0) {
            await batch.commit();
        }
        return {
            success: true,
            checked: checkedCount,
            deleted: deletedCount,
            message: `Cleanup complete. Deleted ${deletedCount} orphaned profiles out of ${checkedCount} total users.`
        };
    }
    catch (error) {
        functions.logger.error("Cleanup failed:", error);
        throw new functions.https.HttpsError('internal', `Cleanup failed: ${error.message}`);
    }
});
//# sourceMappingURL=cleanupOrphanedUsers.js.map