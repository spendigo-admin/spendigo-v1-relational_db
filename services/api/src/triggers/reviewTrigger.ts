import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp();
}

export const onReviewCreated = functions.firestore
    .document('reviews/{reviewId}')
    .onCreate(async (snapshot, context) => {
        const review = snapshot.data();
        if (!review) return;

        // Only notify merchants for store reviews
        if (review.targetType !== 'store') return;

        const storeId: string = review.targetId;
        const rating: number = review.rating || 0;
        const authorName: string = review.authorName || 'A customer';
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
        } catch (err) {
            functions.logger.error('[ReviewTrigger] Failed to send review notifications:', err);
        }
    });
