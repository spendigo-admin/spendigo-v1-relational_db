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
const errors_1 = require("../utils/errors");
const db = admin.firestore();
exports.placeOrder = functions.runWith({ timeoutSeconds: 120, memory: '256MB' }).https.onCall(async (data, context) => {
    // 1. Security Check
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    // Rate Limit Check: Max 10 requests per minute per user (Increased for testing and better UX)
    await (0, rateLimiter_1.checkRateLimit)(context.auth.uid, 'placeOrder', 10, 60 * 1000);
    const { orders } = data; // Array of Order objects
    const userId = context.auth.uid;
    const userEmail = context.auth.token.email;
    const userName = context.auth.token.name || 'Valued Customer';
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'No orders provided.');
    }
    const orderIds = [];
    // Idempotency: skip orders whose paymentIntentId already has a committed order.
    // A network timeout after Stripe succeeds can cause the client to retry, which would
    // otherwise decrement stock and create a duplicate order against the same payment.
    const ordersToProcess = [];
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
        const auditEntries = [];
        await db.runTransaction(async (transaction) => {
            var _a, _b, _c, _d, _e;
            // PHASE 1: READS (Collect all product snapshots)
            const productChecks = [];
            for (const order of ordersToProcess) {
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
                    available_quantity: currentStock - item.quantity
                });
            }
            // PHASE 2.5: SERVER-SIDE PRICE VALIDATION
            // Client-supplied totals cannot be trusted — compute from authoritative snapshots.
            const TAX_RATE = 0.13; // Ontario HST — replace with settings/platform lookup later
            for (const orderData of ordersToProcess) {
                // Gather the product checks that belong to this order
                const orderChecks = productChecks.filter(pc => pc.storeId === orderData.storeId);
                const serverSubtotal = parseFloat(orderChecks.reduce((sum, { snap, item }) => { var _a, _b; return sum + (snap.exists ? ((_b = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a.price) !== null && _b !== void 0 ? _b : 0) * item.quantity : 0); }, 0).toFixed(2));
                const serverTax = parseFloat((serverSubtotal * TAX_RATE).toFixed(2));
                const deliveryFee = (_b = orderData.deliveryFee) !== null && _b !== void 0 ? _b : 0;
                if (typeof deliveryFee !== 'number' || deliveryFee < 0 || deliveryFee > 25) {
                    throw new functions.https.HttpsError('invalid-argument', 'Invalid delivery fee.');
                }
                const serverTotal = parseFloat((serverSubtotal + serverTax + deliveryFee).toFixed(2));
                if (Math.abs(serverTotal - ((_c = orderData.total) !== null && _c !== void 0 ? _c : 0)) > 0.02) {
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
                    createdAt: firestore_1.FieldValue.serverTimestamp(),
                    date: new Date().toISOString()
                };
                transaction.set(newOrderRef, finalOrder);
                auditEntries.push({
                    actor: { id: ((_d = context.auth) === null || _d === void 0 ? void 0 : _d.uid) || 'unknown', email: ((_e = context.auth) === null || _e === void 0 ? void 0 : _e.token.email) || 'unknown', ip: context.rawRequest.ip || '0.0.0.0' },
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
            await (0, audit_1.logEvent)('ORDER_PLACED', entry.actor, { orderId: entry.orderId, total: entry.total, storeId: entry.storeId, itemCount: entry.itemCount }, entry.orderId).catch((e) => functions.logger.error('Audit log failed for order', entry.orderId, e));
        }
        return { orderIds, success: true };
    }
    catch (error) {
        (0, errors_1.toHttpsError)(error, 'Transaction failed.', 'aborted');
    }
});
//# sourceMappingURL=placeOrder.js.map