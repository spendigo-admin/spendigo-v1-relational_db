import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue, DocumentReference, DocumentSnapshot } from 'firebase-admin/firestore';
import { checkRateLimit } from '../utils/rateLimiter';
import { stripe } from '../config/stripe';
import { logEvent } from '../utils/audit';
import { toHttpsError } from '../utils/errors';

const db = admin.firestore();

export const placeOrder = functions.runWith({ timeoutSeconds: 120, memory: '256MB', secrets: ['STRIPE_SECRET_KEY'] }).https.onCall(async (data, context) => {
    // 1. Security Check
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    // Rate Limit Check: Max 10 requests per minute per user (Increased for testing and better UX)
    await checkRateLimit(context.auth.uid, 'placeOrder', 10, 60 * 1000);

    const { orders } = data; // Array of Order objects
    const userId = context.auth.uid;
    const userEmail = context.auth.token.email;
    const userName = context.auth.token.name || 'Valued Customer';

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'No orders provided.');
    }

    const orderIds: string[] = [];

    // Idempotency: skip orders whose paymentIntentId already has a committed order.
    // A network timeout after Stripe succeeds can cause the client to retry, which would
    // otherwise decrement stock and create a duplicate order against the same payment.
    const ordersToProcess: any[] = [];
    for (const orderData of orders) {
        if (orderData.paymentIntentId) {
            const existing = await db.collection('orders')
                .where('paymentIntentId', '==', orderData.paymentIntentId).limit(1).get();
            if (!existing.empty) {
                orderIds.push(existing.docs[0].id);
                continue;
            }
        }
        ordersToProcess.push(orderData);
    }

    if (ordersToProcess.length === 0) {
        return { orderIds, success: true };
    }

    try {
        const auditEntries: Array<{
            actor: { id: string; email: string; ip: string };
            orderId: string;
            total: number;
            storeId: string;
            itemCount: number;
        }> = [];

        await db.runTransaction(async (transaction) => {
            // PHASE 1: READS (Collect all product snapshots + store province for tax rate)
            const productChecks: {
                ref: DocumentReference,
                snap: DocumentSnapshot,
                item: any,
                storeId: string
            }[] = [];
            const storeSnaps: Record<string, DocumentSnapshot> = {};

            for (const order of ordersToProcess) {
                if (!order.storeId) throw new functions.https.HttpsError('invalid-argument', 'Order missing storeId');

                if (!storeSnaps[order.storeId]) {
                    storeSnaps[order.storeId] = await transaction.get(db.collection('stores').doc(order.storeId));
                }

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
                    available_quantity: currentStock - item.quantity
                });
            }

            // PHASE 2.5: SERVER-SIDE PRICE VALIDATION
            // Must mirror Checkout.tsx exactly: per-province rates, item taxability, delivery fee in tax base.
            const TAX_RATES: Record<string, number> = {
                'ON': 0.13, 'BC': 0.12, 'QC': 0.14975, 'AB': 0.05,
                'NS': 0.15, 'NB': 0.15, 'MB': 0.12, 'SK': 0.11, 'PE': 0.15, 'NL': 0.15,
                'YT': 0.05, 'NT': 0.05, 'NU': 0.05
            };
            for (const orderData of ordersToProcess) {
                // Gather the product checks that belong to this order
                const orderChecks = productChecks.filter(pc => pc.storeId === orderData.storeId);

                let serverSubtotal = 0;
                let taxableSubtotal = 0;
                for (const { snap, item } of orderChecks) {
                    if (!snap.exists) continue;
                    const lineTotal = (snap.data()?.price ?? 0) * item.quantity;
                    serverSubtotal += lineTotal;
                    if (item.taxable !== false) taxableSubtotal += lineTotal;
                }
                serverSubtotal = parseFloat(serverSubtotal.toFixed(2));
                taxableSubtotal = parseFloat(taxableSubtotal.toFixed(2));

                const deliveryFee = orderData.deliveryFee ?? 0;
                if (typeof deliveryFee !== 'number' || deliveryFee < 0 || deliveryFee > 25) {
                    throw new functions.https.HttpsError('invalid-argument', 'Invalid delivery fee.');
                }

                // Province is read from Firestore — not trusted from the client
                const province = (storeSnaps[orderData.storeId]?.data()?.province || 'ON').toUpperCase();
                const taxRate = TAX_RATES[province] ?? 0.13;
                const serverTax = parseFloat(((taxableSubtotal + deliveryFee) * taxRate).toFixed(2));
                const serverTotal = parseFloat((serverSubtotal + serverTax + deliveryFee).toFixed(2));
                if (Math.abs(serverTotal - (orderData.total ?? 0)) > 0.02) {
                    functions.logger.warn(`Price mismatch store=${orderData.storeId} server=${serverTotal} client=${orderData.total} province=${province} rate=${taxRate} deliveryFee=${deliveryFee}`);
                    throw new functions.https.HttpsError('invalid-argument', 'Price mismatch. Please refresh and retry.');
                }
                // Attach server-computed values so Phase 3 can use them
                orderData._serverSubtotal = serverSubtotal;
                orderData._serverTax = serverTax;
                orderData._serverTotal = serverTotal;
                orderData._serverDeliveryFee = deliveryFee;
            }

            // PHASE 3: CREATE ORDERS
            for (const orderData of ordersToProcess) {
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
                    subtotal: orderData._serverSubtotal,
                    deliveryFee: orderData._serverDeliveryFee,
                    tax: orderData._serverTax,
                    total: orderData._serverTotal,
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

                auditEntries.push({
                    actor: { id: context.auth?.uid || 'unknown', email: context.auth?.token.email || 'unknown', ip: context.rawRequest.ip || '0.0.0.0' },
                    orderId: newOrderRef.id,
                    total: orderData._serverTotal,
                    storeId: orderData.storeId,
                    itemCount: orderData.items.length
                });
            }
        });

        // Audit logging runs after the transaction commits so logEvent's META_REF
        // read doesn't violate Firestore's "reads before writes" constraint.
        // Fire-and-forget: an audit failure must never roll back a committed order.
        for (const entry of auditEntries) {
            await logEvent(
                'ORDER_PLACED',
                entry.actor,
                { orderId: entry.orderId, total: entry.total, storeId: entry.storeId, itemCount: entry.itemCount },
                entry.orderId
            ).catch((e) => functions.logger.error('Audit log failed for order', entry.orderId, e));
        }

        return { orderIds, success: true };

    } catch (error: any) {
        toHttpsError(error, 'Transaction failed.', 'aborted');
    }
});
