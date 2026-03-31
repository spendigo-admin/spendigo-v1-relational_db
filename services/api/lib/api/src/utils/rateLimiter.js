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
exports.checkRateLimit = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
/**
 * Enforces a rate limit for a specific user and action using a Firestore Sliding Window.
 * Throws a 'resource-exhausted' HttpsError if the limit is exceeded.
 *
 * @param uid The authenticated user ID performing the action
 * @param action The specific action identifier (e.g., 'placeOrder', 'createCheckout')
 * @param maxRequests The maximum number of requests allowed in the window
 * @param windowMs The time window in milliseconds (e.g., 60 * 1000 for 1 minute)
 */
const checkRateLimit = async (uid, action, maxRequests, windowMs) => {
    const db = admin.firestore();
    const docRef = db.collection('_rate_limits').doc(`${uid}_${action}`);
    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            const now = Date.now();
            if (!doc.exists) {
                // First request ever or TTL cleaned it up
                // Creating it with resetAt initialized at the end of the window
                transaction.set(docRef, {
                    count: 1,
                    resetAt: now + windowMs
                });
                return;
            }
            const data = doc.data();
            const resetAt = (data === null || data === void 0 ? void 0 : data.resetAt) || 0;
            if (now > resetAt) {
                // The time window has expired, reset the count for the next window
                transaction.set(docRef, {
                    count: 1,
                    resetAt: now + windowMs
                });
                return;
            }
            // We are within the active time window
            if ((data === null || data === void 0 ? void 0 : data.count) >= maxRequests) {
                // Rate limit exclusively exceeded
                throw new functions.https.HttpsError('resource-exhausted', `Rate limit exceeded for ${action}. Please wait before trying again.`);
            }
            // Valid request within limits, increment the counter natively
            transaction.update(docRef, {
                count: admin.firestore.FieldValue.increment(1)
            });
        });
    }
    catch (error) {
        if (error.code === 'resource-exhausted') {
            throw error; // Pass through the explicit logic
        }
        // If it's a generic Firestore contention error due to someone firing 100 concurrent
        // requests against a singular document locking it up, we explicitly drop them here too.
        functions.logger.warn(`Rate Limit Contention Error for ${uid}_${action}:`, error);
        throw new functions.https.HttpsError('resource-exhausted', `Server busy or too many concurrent requests. Please slow down.`);
    }
};
exports.checkRateLimit = checkRateLimit;
//# sourceMappingURL=rateLimiter.js.map