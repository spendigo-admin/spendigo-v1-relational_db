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
exports.removeStaleTokens = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const STALE_TOKEN_ERRORS = new Set([
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered',
]);
/**
 * Removes FCM tokens that failed with permanent errors from the user's document.
 * Call after sendEachForMulticast to keep the token list clean.
 */
const removeStaleTokens = async (userId, tokens, responses) => {
    const staleTokens = responses
        .map((res, i) => (!res.success && res.error && STALE_TOKEN_ERRORS.has(res.error.code)) ? tokens[i] : null)
        .filter((t) => t !== null);
    if (staleTokens.length > 0) {
        await admin.firestore().collection('users').doc(userId).update({
            fcmTokens: admin.firestore.FieldValue.arrayRemove(...staleTokens)
        });
        functions.logger.info(`Removed ${staleTokens.length} stale FCM tokens for user ${userId}`);
    }
};
exports.removeStaleTokens = removeStaleTokens;
//# sourceMappingURL=fcm.js.map