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
exports.placeOrder = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const rateLimiter_1 = require("../utils/rateLimiter");
const stripe_1 = require("../config/stripe");
const audit_1 = require("../utils/audit");
const db = admin.firestore();
exports.placeOrder = functions.https.onCall(async (data, context) => {
    // 1. Security Check
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    // Rate Limit Check: Max 3 requests per minute per user
    await (0, rateLimiter_1.checkRateLimit)(context.auth.uid, 'placeOrder', 3, 60 * 1000);
    const { orders } = data; // Array of Order objects
    const userId = context.auth.uid;
    const userEmail = context.auth.token.email;
    const userName = context.auth.token.name || 'Valued Customer';
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'No orders provided.');
    }
    const orderIds = [];
    try {
        await db.runTransaction(async (transaction) => {
            var _a, _b, _c;
            // PHASE 1: READS (Collect all product snapshots)
            const productChecks = [];
            for (const order of orders) {
                if (!order.storeId)
                    throw new functions.https.HttpsError('invalid-argument', 'Order missing storeId');
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
                const currentStock = ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.available_quantity) || 0;
                if (currentStock < item.quantity) {
                    throw new functions.https.HttpsError('failed-precondition', `Insufficient stock for "${item.productName}". Only ${currentStock} left.`);
                }
                transaction.update(ref, {
                    available_quantity: firestore_1.FieldValue.increment(-item.quantity)
                });
            }
            // PHASE 3: CREATE ORDERS
            for (const orderData of orders) {
                const newOrderRef = db.collection('orders').doc();
                orderIds.push(newOrderRef.id);
                let paymentSucceeded = false;
                if (orderData.paymentIntentId) {
                    // Verify this intent was successful in Stripe
                    const intent = await stripe_1.stripe.paymentIntents.retrieve(orderData.paymentIntentId);
                    if (intent.status === 'succeeded') {
                        paymentSucceeded = true;
                    }
                    else {
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
                    createdAt: firestore_1.FieldValue.serverTimestamp(),
                    date: new Date().toISOString()
                };
                transaction.set(newOrderRef, finalOrder);
                // Audit: Order Placed
                await (0, audit_1.logEvent)('ORDER_PLACED', { id: ((_b = context.auth) === null || _b === void 0 ? void 0 : _b.uid) || 'unknown', email: ((_c = context.auth) === null || _c === void 0 ? void 0 : _c.token.email) || 'unknown', ip: context.rawRequest.ip || '0.0.0.0' }, {
                    orderId: newOrderRef.id,
                    total: orderData.total,
                    storeId: orderData.storeId,
                    itemCount: orderData.items.length
                }, newOrderRef.id);
            }
        });
        return { orderIds, success: true };
    }
    catch (error) {
        functions.logger.error('Place Order Transaction Failed:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('aborted', error.message || 'Transaction failed');
    }
});
//# sourceMappingURL=placeOrder.js.map