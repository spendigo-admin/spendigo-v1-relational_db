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
exports.onReviewCreated = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length) {
    admin.initializeApp();
}
exports.onReviewCreated = functions.firestore
    .document('reviews/{reviewId}')
    .onCreate(async (snapshot, context) => {
    const review = snapshot.data();
    if (!review)
        return;
    // Only notify merchants for store reviews
    if (review.targetType !== 'store')
        return;
    const storeId = review.targetId;
    const rating = review.rating || 0;
    const authorName = review.authorName || 'A customer';
    const db = admin.firestore();
    functions.logger.info(`[ReviewTrigger] New review for store ${storeId} by ${authorName}`);
    try {
        // Find all merchant users for this store
        const usersSnap = await db.collection('users')
            .where('storeId', '==', storeId)
            .where('role', '==', 'merchant')
            .get();
        if (usersSnap.empty) {
            functions.logger.warn(`[ReviewTrigger] No merchants found for store ${storeId}`);
            return;
        }
        const stars = '⭐'.repeat(Math.min(Math.max(rating, 1), 5));
        const notifId = `notif_review_${context.params.reviewId}`;
        const timestamp = new Date().toISOString();
        const writes = usersSnap.docs.map(userDoc => {
            const notifRef = db.doc(`users/${userDoc.id}/notifications/${notifId}`);
            return notifRef.set({
                id: notifId,
                type: 'review',
                title: `New Review ${stars}`,
                message: `${authorName} left a ${rating}-star review for your store.`,
                timestamp,
                read: false,
                link: '/merchant/orders',
            });
        });
        await Promise.all(writes);
        functions.logger.info(`[ReviewTrigger] Notified ${writes.length} merchant(s) for store ${storeId}`);
    }
    catch (err) {
        functions.logger.error('[ReviewTrigger] Failed to send review notifications:', err);
    }
});
//# sourceMappingURL=reviewTrigger.js.map