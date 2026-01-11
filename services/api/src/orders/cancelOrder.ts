import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const cancelOrder = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { orderId, reason } = data;
    const userId = context.auth.uid;

    if (!orderId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing orderId.');
    }

    try {
        await db.runTransaction(async (transaction) => {
            const orderRef = db.collection('orders').doc(orderId);
            const orderSnap = await transaction.get(orderRef);

            if (!orderSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'Order not found.');
            }

            const order = orderSnap.data();

            // Security: Only Owner can cancel via this endpoint
            if (order?.customerId !== userId) {
                throw new functions.https.HttpsError('permission-denied', 'You can only cancel your own orders.');
            }

            if (order?.status === 'cancelled') {
                // Idempotent success or error? Let's error to be clear.
                throw new functions.https.HttpsError('failed-precondition', 'Order already cancelled.');
            }

            // PHASE 1: READS
            const productsToRestore: { ref: admin.firestore.DocumentReference, quantity: number }[] = [];

            if (order?.items && Array.isArray(order.items)) {
                for (const item of order.items) {
                    const productRef = db.collection('merchant_products').doc(item.productId);
                    const productSnap = await transaction.get(productRef);

                    // Only restore if product still exists in inventory system
                    if (productSnap.exists) {
                        productsToRestore.push({ ref: productRef, quantity: item.quantity });
                    }
                }
            }

            // PHASE 2: WRITES
            // 1. Update Status
            transaction.update(orderRef, {
                status: 'cancelled',
                rejectionReason: reason || 'Cancelled by user',
                cancelledAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 2. Restore Stock
            for (const { ref, quantity } of productsToRestore) {
                transaction.update(ref, {
                    available_quantity: admin.firestore.FieldValue.increment(quantity)
                });
            }
        });

        return { success: true };

    } catch (error: any) {
        console.error('Cancel Order Error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
