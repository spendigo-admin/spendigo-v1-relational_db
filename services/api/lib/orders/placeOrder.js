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
const db = admin.firestore();
exports.placeOrder = functions.https.onCall(async (data, context) => {
    // 1. Security Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
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
            var _a;
            // PHASE 1: READS (Collect all product snapshots)
            const productChecks = [];
            for (const order of orders) {
                // Ensure storeId is present
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
            // PHASE 2: WRITES (Check Logic & Update)
            // It is safe to perform updates now as long as we don't read again.
            for (const { ref, snap, item, storeId } of productChecks) {
                if (!snap.exists) {
                    // Heuristic: New System products likely start with "storeId_"
                    const isNewSystemProduct = item.productId.startsWith(`${storeId}_`);
                    if (isNewSystemProduct) {
                        throw new functions.https.HttpsError('failed-precondition', `Product "${item.productName}" is no longer available.`);
                    }
                    else {
                        // Legacy Product - valid, but no stock tracking
                        continue;
                    }
                }
                const currentStock = ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.available_quantity) || 0;
                if (currentStock < item.quantity) {
                    throw new functions.https.HttpsError('failed-precondition', `Insufficient stock for "${item.productName}". Only ${currentStock} left.`);
                }
                // Decrement Stock (Write)
                transaction.update(ref, {
                    available_quantity: admin.firestore.FieldValue.increment(-item.quantity)
                });
            }
            // 3. Create Orders (Writes)
            for (const orderData of orders) {
                const newOrderRef = db.collection('orders').doc();
                orderIds.push(newOrderRef.id);
                const finalOrder = Object.assign(Object.assign({}, orderData), { customerId: userId, customerName: userName, customerEmail: userEmail, createdAt: admin.firestore.FieldValue.serverTimestamp(), date: new Date().toISOString() });
                transaction.set(newOrderRef, finalOrder);
            }
        });
        return { orderIds, success: true };
    }
    catch (error) {
        console.error('Place Order Transaction Failed:', error);
        // Re-throw HttpsErrors as-is to preserve the error code for the client
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('aborted', error.message || 'Transaction failed');
    }
});
//# sourceMappingURL=placeOrder.js.map