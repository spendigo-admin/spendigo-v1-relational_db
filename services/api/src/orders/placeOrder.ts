import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { FieldValue, DocumentReference, DocumentSnapshot } from 'firebase-admin/firestore';

const db = admin.firestore();

export const placeOrder = functions.https.onCall(async (data, context) => {
    // 1. Security Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { orders } = data; // Array of Order objects
    const userId = context.auth.uid;
    const userEmail = context.auth.token.email;
    const userName = context.auth.token.name || 'Valued Customer';

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'No orders provided.');
    }

    const orderIds: string[] = [];

    try {
        await db.runTransaction(async (transaction) => {
            // PHASE 1: READS (Collect all product snapshots)
            const productChecks: {
                ref: DocumentReference,
                snap: DocumentSnapshot,
                item: any,
                storeId: string
            }[] = [];

            for (const order of orders) {
                // Ensure storeId is present
                if (!order.storeId) throw new functions.https.HttpsError('invalid-argument', 'Order missing storeId');

                for (const item of order.items) {
                    const productRef = db.collection('merchant_products').doc(item.productId);
                    const productSnap = await transaction.get(productRef);
                    productChecks.push({
                        ref: productRef,
                        snap: productSnap,
                        item,
                        storeId: order.storeId
                    });
                }
            }

            // PHASE 2: WRITES (Check Logic & Update)
            // It is safe to perform updates now as long as we don't read again.

            for (const { ref, snap, item, storeId } of productChecks) {
                if (!snap.exists) {
                    // Heuristic: New System products likely start with "storeId_"
                    const isNewSystemProduct = item.productId.startsWith(`${storeId}_`);
                    if (isNewSystemProduct) {
                        throw new functions.https.HttpsError('failed-precondition', `Product "${item.productName}" is no longer available.`);
                    } else {
                        // Legacy Product - valid, but no stock tracking
                        continue;
                    }
                }

                const currentStock = snap.data()?.available_quantity || 0;
                if (currentStock < item.quantity) {
                    throw new functions.https.HttpsError('failed-precondition', `Insufficient stock for "${item.productName}". Only ${currentStock} left.`);
                }

                // Decrement Stock (Write)
                transaction.update(ref, {
                    available_quantity: FieldValue.increment(-item.quantity)
                });
            }

            // 3. Create Orders (Writes)
            for (const orderData of orders) {
                const newOrderRef = db.collection('orders').doc();
                orderIds.push(newOrderRef.id);

                // Explicit allowlist — never spread client-supplied data directly.
                // status and paymentStatus are always server-assigned to prevent
                // a client injecting { paymentStatus: 'paid', status: 'delivered' }.
                const finalOrder = {
                    storeId: orderData.storeId,
                    storeName: orderData.storeName,
                    items: orderData.items,
                    subtotal: orderData.subtotal,
                    deliveryFee: orderData.deliveryFee,
                    tax: orderData.tax,
                    total: orderData.total,
                    paymentMethod: orderData.paymentMethod,
                    deliveryAddress: orderData.deliveryAddress,
                    // Server-enforced fields:
                    customerId: userId,
                    customerName: userName,
                    customerEmail: userEmail,
                    status: 'placed',
                    paymentStatus: 'pending',
                    createdAt: FieldValue.serverTimestamp(),
                    date: new Date().toISOString()
                };

                transaction.set(newOrderRef, finalOrder);
            }
        });

        return { orderIds, success: true };

    } catch (error: any) {
        functions.logger.error('Place Order Transaction Failed:', error);
        // Re-throw HttpsErrors as-is to preserve the error code for the client
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('aborted', error.message || 'Transaction failed');
    }
});
