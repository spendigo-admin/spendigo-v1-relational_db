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
exports.cancelOrder = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const rateLimiter_1 = require("../utils/rateLimiter");
const audit_1 = require("../utils/audit");
const errors_1 = require("../utils/errors");
const db = admin.firestore();
exports.cancelOrder = functions.https.onCall(async (data, context) => {
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    // Rate Limit Check: Max 5 requests per minute per user
    await (0, rateLimiter_1.checkRateLimit)(context.auth.uid, 'cancelOrder', 5, 60 * 1000);
    const { orderId, reason } = data;
    const userId = context.auth.uid;
    if (!orderId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing orderId.');
    }
    try {
        // Fetch caller's user data for role-based permission check
        const callerSnap = await db.collection('users').doc(userId).get();
        const callerData = callerSnap.data();
        const callerRole = (callerData === null || callerData === void 0 ? void 0 : callerData.role) || 'consumer';
        const callerStoreId = callerData === null || callerData === void 0 ? void 0 : callerData.storeId;
        await db.runTransaction(async (transaction) => {
            var _a, _b;
            const orderRef = db.collection('orders').doc(orderId);
            const orderSnap = await transaction.get(orderRef);
            if (!orderSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'Order not found.');
            }
            const order = orderSnap.data();
            // Security: Allowed if Shopper (Owner), Merchant of this store, or Admin
            const isOwner = (order === null || order === void 0 ? void 0 : order.customerId) === userId;
            const isStoreMerchant = callerRole === 'merchant' && (order === null || order === void 0 ? void 0 : order.storeId) === callerStoreId;
            const isAdmin = callerRole === 'admin';
            if (!isOwner && !isStoreMerchant && !isAdmin) {
                throw new functions.https.HttpsError('permission-denied', 'You do not have permission to cancel this order.');
            }
            if ((order === null || order === void 0 ? void 0 : order.status) === 'cancelled') {
                // Idempotent success or error? Let's error to be clear.
                throw new functions.https.HttpsError('failed-precondition', 'Order already cancelled.');
            }
            // PHASE 1: READS
            const productsToRestore = [];
            if ((order === null || order === void 0 ? void 0 : order.items) && Array.isArray(order.items)) {
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
                cancelledAt: firestore_1.FieldValue.serverTimestamp()
            });
            // 2. Restore Stock
            for (const { ref, quantity } of productsToRestore) {
                transaction.update(ref, {
                    available_quantity: firestore_1.FieldValue.increment(quantity)
                });
            }
            // Audit: Order Cancelled
            await (0, audit_1.logEvent)('ORDER_CANCELLED', { id: ((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid) || 'unknown', email: ((_b = context.auth) === null || _b === void 0 ? void 0 : _b.token.email) || 'unknown', ip: context.rawRequest.ip || '0.0.0.0' }, {
                orderId,
                reason: reason || 'Cancelled by user'
            }, orderId);
        });
        return { success: true };
    }
    catch (error) {
        (0, errors_1.toHttpsError)(error, 'Failed to cancel order.');
    }
});
//# sourceMappingURL=cancelOrder.js.map