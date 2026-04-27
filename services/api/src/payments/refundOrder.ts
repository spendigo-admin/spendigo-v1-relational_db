import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { stripe } from '../config/stripe';

const db = admin.firestore();

/**
 * Merchant-initiated refund for a specific order.
 * Verifies that the order exists and has a valid PaymentIntent before refunding via Stripe.
 */
export const refundOrder = functions.https.onCall(async (data, context) => {
    // 1. Authentication Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { orderId, reason } = data;
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
        const { paymentIntentId, paymentStatus, storeId: orderStoreId } = orderData || {};

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
        if (paymentStatus !== 'paid' || !paymentIntentId) {
            throw new functions.https.HttpsError('failed-precondition', 'Only paid orders can be refunded.');
        }

        // 3. Trigger Stripe Refund
        const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
            reason: 'requested_by_customer', // Default reason
            metadata: {
                orderId,
                reason: reason || 'Merchant initiated refund'
            }
        });

        functions.logger.log(`🔄 Refund initiated for order ${orderId} (Refund ID: ${refund.id})`);

        // 4. Update Firestore Status
        // We set it to 'refunding' - the webhook will eventually set it to 'refunded'
        await db.collection('orders').doc(orderId).update({
            paymentStatus: 'refunding',
            refundId: refund.id,
            refundReason: reason || 'Merchant initiated',
            refundedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
            success: true,
            refundId: refund.id
        };

    } catch (error: any) {
        functions.logger.error('Refund Error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to process refund.');
    }
});
