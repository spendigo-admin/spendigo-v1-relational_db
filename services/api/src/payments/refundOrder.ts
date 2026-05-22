import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { stripe } from '../config/stripe';
import { logEvent, buildActorFromContext } from '../utils/audit';
import { toHttpsError } from '../utils/errors';
import { checkRateLimit } from '../utils/rateLimiter';

const db = admin.firestore();

/**
 * Merchant-initiated refund for a specific order.
 * Verifies that the order exists and has a valid PaymentIntent before refunding via Stripe.
 */
export const refundOrder = functions
    .runWith({ secrets: ['STRIPE_SECRET_KEY'] })
    .https.onCall(async (data, context) => {
    // 1. Authentication Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'App Check verification required.');
    }

    await checkRateLimit(context.auth.uid, 'refundOrder', 5, 5 * 60 * 1000);

    const { orderId, reason, amount } = data; // amount is optional for partial refunds
    if (!orderId) {
        throw new functions.https.HttpsError('invalid-argument', 'Order ID is required.');
    }

    try {
        // 2. Fetch Order Data
        const orderSnap = await db.collection('orders').doc(orderId).get();
        if (!orderSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Order not found.');
        }

        const orderData = orderSnap.data();
        const { paymentIntentId, paymentStatus, storeId: orderStoreId, paymentMethod, total } = orderData || {};

        // Security check: Verify that context.auth.uid has permissions for storeId
        const callerSnap = await db.collection('users').doc(context.auth.uid).get();
        const callerData = callerSnap.data();
        const callerRole = callerData?.role || 'consumer';
        const callerStoreId = callerData?.storeId;

        const isStoreMerchant = callerRole === 'merchant' && orderStoreId === callerStoreId;
        const isAdmin = callerRole === 'admin';

        if (!isStoreMerchant && !isAdmin) {
            throw new functions.https.HttpsError('permission-denied', 'You do not have permission to refund this order.');
        }
        if (paymentStatus !== 'paid') {
            throw new functions.https.HttpsError('failed-precondition', 'Only paid orders can be refunded.');
        }

        // --- IN-STORE PAYMENT REFUND FLOW ---
        if (paymentMethod === 'in_store') {
            await db.collection('orders').doc(orderId).update({
                paymentStatus: 'refunded',
                status: 'cancelled',
                refundReason: reason || 'Merchant in-store refund',
                refundedAt: admin.firestore.FieldValue.serverTimestamp(),
                ...(amount && { refundedAmount: amount })
            });

            await logEvent(
                'ORDER_REFUNDED',
                buildActorFromContext(context),
                { orderId, reason: reason || 'Merchant in-store refund', amount: amount || total, storeId: orderStoreId },
                `orders/${orderId}`
            );

            return {
                success: true,
                message: 'In-store order marked as refunded.'
            };
        }

        // --- ONLINE STRIPE PAYMENT REFUND FLOW ---
        if (!paymentIntentId) {
            throw new functions.https.HttpsError('failed-precondition', 'Missing PaymentIntent ID for online card order.');
        }

        const refundParams: any = {
            payment_intent: paymentIntentId,
            refund_application_fee: true,
            reverse_transfer: true,
            reason: 'requested_by_customer',
            metadata: {
                orderId,
                reason: reason || 'Merchant initiated refund'
            }
        };

        if (amount != null && amount > 0) {
            if (amount > total) {
                throw new functions.https.HttpsError('invalid-argument', `Refund amount ($${amount}) cannot exceed order total ($${total}).`);
            }
            refundParams.amount = Math.round(amount * 100); // Stripe expects amount in cents
        }

        // 3. Trigger Stripe Refund
        let refund;
        try {
            refund = await stripe.refunds.create(refundParams);
        } catch (stripeErr: any) {
            functions.logger.error("Stripe refund call failed", stripeErr);
            throw new functions.https.HttpsError(
                'internal',
                `Stripe refund failed: ${stripeErr.message || 'Unknown Stripe error'}`
            );
        }

        functions.logger.log(`🔄 Refund initiated for order ${orderId} (Refund ID: ${refund.id})`);

        const currentRefunded = orderData?.refundedAmount || 0;
        const newRefundedTotal = amount ? (currentRefunded + amount) : total;
        const isFullyRefunded = newRefundedTotal >= total;
        const finalPaymentStatus = isFullyRefunded ? 'refunded' : 'partially_refunded';

        // 4. Update Firestore Status Immediately
        await db.collection('orders').doc(orderId).update({
            paymentStatus: finalPaymentStatus,
            refundId: refund.id,
            refundReason: reason || 'Merchant initiated',
            refundedAt: admin.firestore.FieldValue.serverTimestamp(),
            refundedAmount: newRefundedTotal
        });

        await logEvent(
            'ORDER_REFUNDED',
            buildActorFromContext(context),
            { 
                orderId, 
                refundId: refund.id, 
                reason: reason || 'Merchant initiated', 
                storeId: orderStoreId,
                amount: amount || total
            },
            `orders/${orderId}`
        );

        return {
            success: true,
            refundId: refund.id
        };

    } catch (error: any) {
        toHttpsError(error, 'Failed to process refund.');
    }
});
