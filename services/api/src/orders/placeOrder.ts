import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { FieldValue, DocumentReference, DocumentSnapshot } from 'firebase-admin/firestore';
import { checkRateLimit } from '../utils/rateLimiter';
import { stripe } from '../config/stripe';
import { logEvent } from '../utils/audit';

const db = admin.firestore();

export const placeOrder = functions.https.onCall(async (data, context) => {
    // 1. Security Check
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    // Rate Limit Check: Max 3 requests per minute per user
    await checkRateLimit(context.auth.uid, 'placeOrder', 3, 60 * 1000);

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

            // PHASE 2: WRITES (Stock Updates)
            for (const { ref, snap, item, storeId } of productChecks) {
                if (!snap.exists) {
                    const isNewSystemProduct = item.productId.startsWith(`${storeId}_`);
                    if (isNewSystemProduct) {
                        throw new functions.https.HttpsError('failed-precondition', `Product "${item.productName}" is no longer available.`);
                    }
                    continue;
                }

                const currentStock = snap.data()?.available_quantity || 0;
                if (currentStock < item.quantity) {
                    throw new functions.https.HttpsError('failed-precondition', `Insufficient stock for "${item.productName}". Only ${currentStock} left.`);
                }

                transaction.update(ref, {
                    available_quantity: FieldValue.increment(-item.quantity)
                });
            }

            // PHASE 3: CREATE ORDERS
            for (const orderData of orders) {
                const newOrderRef = db.collection('orders').doc();
                orderIds.push(newOrderRef.id);

                let paymentSucceeded = false;
                if (orderData.paymentIntentId) {
                     // Verify this intent was successful in Stripe
                     const intent = await stripe.paymentIntents.retrieve(orderData.paymentIntentId);
                     if (intent.status === 'succeeded') {
                         paymentSucceeded = true;
                     } else {
                         functions.logger.error(`Checkout abort: Payment Intent ${orderData.paymentIntentId} status is ${intent.status}`);
                         throw new functions.https.HttpsError('failed-precondition', 'Payment verification failed.');
                     }
                }

                const finalOrder = {
                    storeId: orderData.storeId,
                    storeName: orderData.storeName,
                    items: orderData.items,
                    subtotal: orderData.subtotal,
                    deliveryFee: orderData.deliveryFee,
                    tax: orderData.tax,
                    total: orderData.total,
                    paymentMethod: orderData.paymentMethod || 'card',
                    deliveryAddress: orderData.deliveryAddress,
                    customerId: userId,
                    customerName: userName,
                    customerEmail: userEmail,
                    paymentIntentId: orderData.paymentIntentId || null,
                    status: 'placed',
                    paymentStatus: paymentSucceeded ? 'paid' : (orderData.paymentMethod === 'in_store' ? 'pending' : 'unpaid'),
                    createdAt: FieldValue.serverTimestamp(),
                    date: new Date().toISOString()
                };

                transaction.set(newOrderRef, finalOrder);

                // Audit: Order Placed
                await logEvent(
                    'ORDER_PLACED',
                    { id: context.auth?.uid || 'unknown', email: context.auth?.token.email || 'unknown', ip: context.rawRequest.ip || '0.0.0.0' },
                    { 
                        orderId: newOrderRef.id,
                        total: orderData.total,
                        storeId: orderData.storeId,
                        itemCount: orderData.items.length
                    },
                    newOrderRef.id
                );
            }
        });

        return { orderIds, success: true };

    } catch (error: any) {
        functions.logger.error('Place Order Transaction Failed:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('aborted', error.message || 'Transaction failed');
    }
});
