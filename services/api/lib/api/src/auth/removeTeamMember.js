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
exports.removeTeamMember = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const audit_1 = require("../utils/audit");
/**
 * Callable HTTPS Cloud Function to remove a team member
 * Removes the storeId and merchantRole from the target user
 */
exports.removeTeamMember = functions.https.onCall(async (data, context) => {
    var _a, _b, _c, _d, _e;
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    // 1. Verify Authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }
    const { targetUserId, storeId } = data;
    if (!targetUserId || !storeId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing fields');
    }
    // 2. Verify Caller is Owner/Manager of the store
    const callerDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    const callerData = callerDoc.data();
    if (!callerData || callerData.storeId !== storeId) {
        throw new functions.https.HttpsError('permission-denied', 'Not authorized for this store');
    }
    if (callerData.merchantRole !== 'OWNER' && callerData.merchantRole !== 'MANAGER') {
        throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
    }
    // 3. Verify Target belongs to this store
    const targetRef = admin.firestore().collection('users').doc(targetUserId);
    const targetDoc = await targetRef.get();
    if (!targetDoc.exists || ((_a = targetDoc.data()) === null || _a === void 0 ? void 0 : _a.storeId) !== storeId) {
        throw new functions.https.HttpsError('invalid-argument', 'Target user is not in this store');
    }
    // Prevent removing yourself (optional, but good practice)
    if (context.auth.uid === targetUserId) {
        throw new functions.https.HttpsError('invalid-argument', 'Cannot remove yourself');
    }
    // Role-rank guard: caller may only remove members strictly below their own rank.
    // Prevents a MANAGER from removing an OWNER (store takeover vector).
    const ROLE_RANK = { OWNER: 3, MANAGER: 2, STAFF: 1, MARKETING: 1 };
    const callerRank = (_b = ROLE_RANK[callerData.merchantRole]) !== null && _b !== void 0 ? _b : 0;
    const targetRank = (_d = ROLE_RANK[(_c = targetDoc.data()) === null || _c === void 0 ? void 0 : _c.merchantRole]) !== null && _d !== void 0 ? _d : 0;
    if (targetRank >= callerRank) {
        throw new functions.https.HttpsError('permission-denied', 'Cannot remove a member with equal or higher role');
    }
    // 4. Update Target User (Unlink from store)
    await targetRef.update({
        storeId: admin.firestore.FieldValue.delete(),
        merchantRole: admin.firestore.FieldValue.delete(),
        role: 'consumer', // Revert to consumer
        status: 'active' // Ensure they aren't stuck in pending
    });
    await (0, audit_1.logEvent)('TEAM_MEMBER_REMOVE', (0, audit_1.buildActorFromContext)(context), { removedUserId: targetUserId, removedRole: (_e = targetDoc.data()) === null || _e === void 0 ? void 0 : _e.merchantRole, storeId }, `stores/${storeId}`);
    return { success: true };
});
//# sourceMappingURL=removeTeamMember.js.map