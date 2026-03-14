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
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
exports.cancelOrder = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const { orderId, reason } = data;
    const userId = context.auth.uid;
    if (!orderId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing orderId.');
    }
    try {
        await db.runTransaction(async (transaction) => {
            const orderRef = db.collection('orders').doc(orderId);
            const orderSnap = await transaction.get(orderRef);
            if (!orderSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'Order not found.');
            }
            const order = orderSnap.data();
            // Security: Only Owner can cancel via this endpoint
            if ((order === null || order === void 0 ? void 0 : order.customerId) !== userId) {
                throw new functions.https.HttpsError('permission-denied', 'You can only cancel your own orders.');
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
                cancelledAt: admin.firestore.FieldValue.serverTimestamp()
            });
            // 2. Restore Stock
            for (const { ref, quantity } of productsToRestore) {
                transaction.update(ref, {
                    available_quantity: admin.firestore.FieldValue.increment(quantity)
                });
            }
        });
        return { success: true };
    }
    catch (error) {
        functions.logger.error('Cancel Order Error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
//# sourceMappingURL=cancelOrder.js.map