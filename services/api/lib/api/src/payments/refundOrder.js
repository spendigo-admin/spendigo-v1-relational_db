"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.refundOrder = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = require("../config/stripe");
const audit_1 = require("../utils/audit");
const db = admin.firestore();
/**
 * Merchant-initiated refund for a specific order.
 * Verifies that the order exists and has a valid PaymentIntent before refunding via Stripe.
 */
exports.refundOrder = functions.https.onCall(async (data, context) => {
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
        const callerRole = (callerData === null || callerData === void 0 ? void 0 : callerData.role) || 'consumer';
        const callerStoreId = callerData === null || callerData === void 0 ? void 0 : callerData.storeId;
        const isStoreMerchant = callerRole === 'merchant' && orderStoreId === callerStoreId;
        const isAdmin = callerRole === 'admin';
        if (!isStoreMerchant && !isAdmin) {
            throw new functions.https.HttpsError('permission-denied', 'You do not have permission to refund this order.');
        }
        if (paymentStatus !== 'paid' || !paymentIntentId) {
            throw new functions.https.HttpsError('failed-precondition', 'Only paid orders can be refunded.');
        }
        // 3. Trigger Stripe Refund
        const refund = await stripe_1.stripe.refunds.create({
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
        await (0, audit_1.logEvent)('ORDER_REFUND_INITIATED', (0, audit_1.buildActorFromContext)(context), { orderId, refundId: refund.id, reason: reason || 'Merchant initiated', storeId: orderStoreId }, `orders/${orderId}`);
        return {
            success: true,
            refundId: refund.id
        };
    }
    catch (error) {
        functions.logger.error('Refund Error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to process refund.');
    }
});
//# sourceMappingURL=refundOrder.js.map