import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue, DocumentReference } from 'firebase-admin/firestore';
import { checkRateLimit } from '../utils/rateLimiter';
import { logEvent } from '../utils/audit';
import { toHttpsError } from '../utils/errors';
import { stripe } from '../config/stripe';

const db = admin.firestore();

export const cancelOrder = functions
    .runWith({ secrets: ['STRIPE_SECRET_KEY'] })
    .https.onCall(async (data, context) => {
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    // Rate Limit Check: Max 5 requests per minute per user
    await checkRateLimit(context.auth.uid, 'cancelOrder', 5, 60 * 1000);

    const { orderId } = data;
    const rawReason: string | undefined = typeof data.reason === 'string' ? data.reason : undefined;
    const reason = rawReason ? rawReason.trim().slice(0, 500) : undefined;
    const userId = context.auth.uid;

    if (!orderId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing orderId.');
    }

    try {
        // Fetch caller's user data for role-based permission check
        const callerSnap = await db.collection('users').doc(userId).get();
        const callerData = callerSnap.data();
        const callerRole = callerData?.role || 'consumer';
        const callerStoreId = callerData?.storeId;

        await db.runTransaction(async (transaction) => {
            const orderRef = db.collection('orders').doc(orderId);
            const orderSnap = await transaction.get(orderRef);

            if (!orderSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'Order not found.');
            }

            const order = orderSnap.data();

            // Security: Allowed if Shopper (Owner), Merchant of this store, or Admin
            const isOwner = order?.customerId === userId;
            const isStoreMerchant = callerRole === 'merchant' && order?.storeId === callerStoreId;
            const isAdmin = callerRole === 'admin';

            if (!isOwner && !isStoreMerchant && !isAdmin) {
                throw new functions.https.HttpsError('permission-denied', 'You do not have permission to cancel this order.');
            }

            if (order?.status === 'cancelled') {
                // Idempotent success or error? Let's error to be clear.
                throw new functions.https.HttpsError('failed-precondition', 'Order already cancelled.');
            }

            // PHASE 1: READS
            // 1. Get latest audit log hash for atomic transaction serialization
            const auditMetaSnap = await transaction.get(db.collection('audit_logs_meta').doc('latest'));
            const preFetchedPrevHash = auditMetaSnap.exists 
                ? auditMetaSnap.data()?.latestHash 
                : '0000000000000000000000000000000000000000000000000000000000000000';

            // 2. Fetch products to restore
            const productsToRestore: { ref: DocumentReference, quantity: number }[] = [];

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

            // PHASE 2: STRIPE INTEGRATION (Executed between reads and writes)
            let refundId: string | undefined = undefined;
            if (order?.paymentMethod === 'card' && order?.paymentStatus === 'paid' && order?.paymentIntentId) {
                try {
                    const refund = await stripe.refunds.create({
                        payment_intent: order.paymentIntentId,
                        refund_application_fee: true,
                        reason: 'requested_by_customer',
                        metadata: {
                            orderId,
                            cancelledBy: userId,
                            reason: reason || 'Cancelled by user/merchant'
                        }
                    });
                    refundId = refund.id;
                } catch (stripeErr: any) {
                    throw new functions.https.HttpsError('internal', `Stripe refund failed: ${stripeErr.message}`);
                }
            }

            // PHASE 3: WRITES
            // 1. Update Status
            transaction.update(orderRef, {
                status: 'cancelled',
                rejectionReason: reason || 'Cancelled by user',
                cancelledAt: FieldValue.serverTimestamp(),
                ...(refundId && { paymentStatus: 'refunding', refundId })
            });

            // 2. Restore Stock
            for (const { ref, quantity } of productsToRestore) {
                transaction.update(ref, {
                    available_quantity: FieldValue.increment(quantity)
                });
            }

            // 3. Atomic, retry-safe Audit logging
            const xForwardedFor = context.rawRequest.headers['x-forwarded-for'];
            const clientIp = typeof xForwardedFor === 'string'
                ? xForwardedFor.split(',')[0].trim()
                : context.rawRequest.ip || '0.0.0.0';

            await logEvent(
                'ORDER_CANCELLED',
                { id: context.auth?.uid || 'unknown', email: context.auth?.token.email || 'unknown', ip: clientIp },
                { 
                    orderId,
                    reason: reason || 'Cancelled by user',
                    ...(refundId && { refundId })
                },
                orderId,
                transaction,
                preFetchedPrevHash
            );
        });

        return { success: true };

    } catch (error: any) {
        toHttpsError(error, 'Failed to cancel order.');
    }
});
