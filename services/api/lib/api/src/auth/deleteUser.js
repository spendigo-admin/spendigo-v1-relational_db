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
exports.deleteUser = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
/**
 * Delete User Function (Admin Only)
 * Deletes a user from Firebase Authentication and Firestore.
 */
exports.deleteUser = functions.https.onCall(async (data, context) => {
    var _a;
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    // 1. Verify Authentication and Admin Role
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    // Check if the caller is an admin
    const callerUid = context.auth.uid;
    const callerDoc = await admin.firestore().collection('users').doc(callerUid).get();
    if (!callerDoc.exists || ((_a = callerDoc.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can delete users.');
    }
    const { targetUid } = data;
    if (!targetUid) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a targetUid.');
    }
    // Prevent deleting yourself
    if (callerUid === targetUid) {
        throw new functions.https.HttpsError('invalid-argument', 'You cannot delete your own account via this function.');
    }
    try {
        functions.logger.log(`Admin ${callerUid} deleting user ${targetUid}`);
        // 2. Fetch user data BEFORE deleting — needed for merchant store suspension below.
        const userDoc = await admin.firestore().collection('users').doc(targetUid).get();
        const userData = userDoc.data();
        // 3. Delete from Firebase Authentication
        await admin.auth().deleteUser(targetUid);
        // 4. Delete User Profile from Firestore
        await admin.firestore().collection('users').doc(targetUid).delete();
        // 5. If merchant, suspend their store to preserve order history but hide it publicly.
        if ((userData === null || userData === void 0 ? void 0 : userData.role) === 'merchant') {
            const storeId = userData === null || userData === void 0 ? void 0 : userData.storeId;
            if (storeId) {
                // Suspend the store instead of deleting it to preserve order history
                await admin.firestore().collection('stores').doc(storeId).update({
                    status: 'suspended',
                    suspendedAt: admin.firestore.FieldValue.serverTimestamp(),
                    suspensionReason: 'Owner account deleted by admin'
                });
            }
        }
        return { success: true, message: `User ${targetUid} deleted successfully.` };
    }
    catch (error) {
        functions.logger.error('Error deleting user:', error);
        throw new functions.https.HttpsError('internal', `Failed to delete user: ${error.message}`);
    }
});
//# sourceMappingURL=deleteUser.js.map