import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Reverts merchant_products.price back to original_price when discount_valid_until has passed.
 *
 * Without this, placeOrder's server-side price validation reads the stale deal price
 * from merchant_products even after the deal expires, causing checkout to fail with
 * "price mismatch" because the client already shows the reverted original price.
 *
 * Runs every 30 minutes. At most ~200 batch writes per run (Firestore batch limit).
 */
export const revertExpiredDeals = functions.pubsub
    .schedule('every 30 minutes')
    .timeZone('America/Toronto')
    .onRun(async () => {
        const now = admin.firestore.Timestamp.now();

        const expired = await db.collection('merchant_products')
            .where('on_sale', '==', true)
            .where('discount_valid_until', '<=', now.toDate().toISOString())
            .get();

        if (expired.empty) return;

        const BATCH_SIZE = 200;
        const docs = expired.docs;

        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
            const batch = db.batch();
            const chunk = docs.slice(i, i + BATCH_SIZE);

            chunk.forEach(doc => {
                const data = doc.data();
                const revertedPrice = data.original_price ?? data.price;
                batch.update(doc.ref, {
                    price: revertedPrice,
                    sale_price: null,
                    on_sale: false,
                    discount_label: null,
                    discount_valid_until: null,
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                });
            });

            await batch.commit();
        }

        functions.logger.info(`revertExpiredDeals: reverted ${docs.length} expired deal(s)`);
    });
