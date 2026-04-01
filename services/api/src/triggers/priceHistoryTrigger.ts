import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Captures price changes on merchant_products updates into a price_history subcollection.
 * Stores one snapshot per day per product — lightweight for trend indicators.
 */
export const onMerchantProductPriceChange = functions.firestore
    .document('merchant_products/{productId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        const productId = context.params.productId;

        if (!before || !after) return;

        const oldPrice = before.price;
        const newPrice = after.price;

        // Only track actual price changes
        if (oldPrice === newPrice) return;
        if (typeof newPrice !== 'number' || newPrice <= 0) return;

        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        const historyRef = db
            .collection('merchant_products')
            .doc(productId)
            .collection('price_history')
            .doc(today);

        await historyRef.set({
            price: newPrice,
            previousPrice: oldPrice,
            date: today,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            merchant_id: after.merchant_id || null,
            master_product_id: after.master_product_id || null,
        }, { merge: true });

        // Cleanup: keep only last 30 days of history
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const oldDateStr = thirtyDaysAgo.toISOString().split('T')[0];

        const oldDocs = await db
            .collection('merchant_products')
            .doc(productId)
            .collection('price_history')
            .where('date', '<', oldDateStr)
            .limit(10)
            .get();

        const batch = db.batch();
        oldDocs.docs.forEach(doc => batch.delete(doc.ref));
        if (!oldDocs.empty) await batch.commit();
    });
