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
exports.onOrderCreated = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// Initialize admin app if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
/**
 * Triggered when a new order is created.
 * Sends notifications to both the customer and the merchant.
 */
exports.onOrderCreated = functions.firestore
    .document('orders/{orderId}')
    .onCreate(async (snapshot, context) => {
    const orderData = snapshot.data();
    const orderId = context.params.orderId;
    const db = admin.firestore();
    const customerId = orderData.customerId;
    const storeId = orderData.storeId;
    const storeName = orderData.storeName || 'the store';
    const total = orderData.total || 0;
    const customerName = orderData.customerName || 'A customer';
    const timestamp = new Date().toISOString();
    try {
        // 1. Create In-App Notification for Customer
        const customerNotifId = `notif_cust_${Date.now()}`;
        await db.collection('users').doc(customerId).collection('notifications').doc(customerNotifId).set({
            id: customerNotifId,
            type: 'order',
            title: 'Order Placed! 📋',
            message: `Your order from ${storeName} has been received.`,
            timestamp,
            read: false,
            orderId
        });
        // 2. Create In-App Notification for Merchant
        const merchantNotifId = `notif_merch_${Date.now()}`;
        await db.collection('users').doc(storeId).collection('notifications').doc(merchantNotifId).set({
            id: merchantNotifId,
            type: 'order',
            title: 'New Order! 🔔',
            message: `New order from ${customerName} for $${total.toFixed(2)}`,
            timestamp,
            read: false,
            orderId
        });
        functions.logger.info(`Successfully created order notifications for order ${orderId}`);
    }
    catch (error) {
        functions.logger.error(`Error creating order notifications for order ${orderId}:`, error);
    }
    return null;
});
//# sourceMappingURL=orderCreationTrigger.js.map