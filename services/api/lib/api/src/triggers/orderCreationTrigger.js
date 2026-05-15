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
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const fcm_1 = require("../utils/fcm");
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
    var _a;
    const orderData = snapshot.data();
    const orderId = context.params.orderId;
    const db = admin.firestore();
    const customerId = orderData.customerId;
    const storeName = orderData.storeName || 'the store';
    const total = orderData.total || 0;
    const customerName = orderData.customerName || 'A customer';
    const rawStoreId = orderData.storeId;
    const storeId = typeof rawStoreId === 'string' ? rawStoreId.trim() : rawStoreId;
    functions.logger.info(`[OrderTrigger] Processing Order ${orderId} for StoreID: "${storeId}" (Type: ${typeof storeId})`);
    try {
        // 1. Create In-App Notification for Customer
        const customerNotifId = `notif_cust_${orderId}_${Date.now()}`;
        const now = new Date().toISOString();
        await db.collection('users').doc(customerId).collection('notifications').doc(customerNotifId).set({
            id: customerNotifId,
            type: 'order',
            title: 'Order Placed! 📋',
            message: `Your order from ${storeName} has been received.`,
            timestamp: now,
            read: false,
            orderId,
            link: `/order/${orderId}`
        });
        // Update customer purchase metrics for segmentation
        await db.collection('users').doc(customerId).set({
            total_orders: admin.firestore.FieldValue.increment(1),
            total_spend: admin.firestore.FieldValue.increment(total),
            last_order_date: now,
            last_active: now,
        }, { merge: true });
        // 2. Find all Merchant Users for this store
        // Strategy: Query by storeId only first to avoid composite index requirements, then filter by role
        functions.logger.info(`[OrderTrigger] Querying users for storeId: "${storeId}"`);
        const usersSnapshot = await db.collection('users')
            .where('storeId', '==', storeId)
            .get();
        const merchantDocs = usersSnapshot.docs.filter(doc => doc.data().role === 'merchant');
        functions.logger.info(`[OrderTrigger] Found ${usersSnapshot.size} total users for this storeId, ${merchantDocs.length} are merchants.`);
        // --- NEW FAIL-SAFE LOGIC ---
        if (merchantDocs.length === 0) {
            functions.logger.warn(`[OrderTrigger] No merchant users found for storeId "${storeId}". Attempting Store Document lookup...`);
            const storeDoc = await db.collection('stores').doc(storeId).get();
            if (storeDoc.exists) {
                const storeData = storeDoc.data();
                const ownerId = storeData === null || storeData === void 0 ? void 0 : storeData.ownerId;
                const merchantEmail = storeData === null || storeData === void 0 ? void 0 : storeData.merchantEmail;
                functions.logger.info(`[OrderTrigger] Store Doc found. OwnerId: ${ownerId}, MerchantEmail: ${merchantEmail}`);
                // Try by OwnerId
                if (ownerId) {
                    const ownerDoc = await db.collection('users').doc(ownerId).get();
                    if (ownerDoc.exists && ((_a = ownerDoc.data()) === null || _a === void 0 ? void 0 : _a.role) === 'merchant') {
                        functions.logger.info(`[OrderTrigger] Found merchant via OwnerId: ${ownerId}`);
                        merchantDocs.push(ownerDoc);
                    }
                }
                // Try by Merchant Email (Case-insensitive-ish)
                if (merchantDocs.length === 0 && merchantEmail) {
                    const emailSnapshot = await db.collection('users')
                        .where('email', '==', merchantEmail)
                        .get();
                    const emailMerchants = emailSnapshot.docs.filter(d => d.data().role === 'merchant');
                    if (emailMerchants.length > 0) {
                        functions.logger.info(`[OrderTrigger] Found ${emailMerchants.length} merchants via email: ${merchantEmail}`);
                        merchantDocs.push(...emailMerchants);
                    }
                }
            }
            else {
                functions.logger.error(`[OrderTrigger] CRITICAL: Store document "${storeId}" does not exist in 'stores' collection!`);
            }
        }
        // --- END FAIL-SAFE LOGIC ---
        // 3. Notify each Merchant User
        const notificationPromises = merchantDocs.map(async (doc) => {
            var _a;
            const merchantUid = doc.id;
            const merchantData = doc.data();
            const merchantNotifId = `notif_merch_${orderId}_${Date.now()}`;
            functions.logger.info(`[OrderTrigger] Dispatching to Merchant: ${merchantUid} (Tokens: ${((_a = merchantData.fcmTokens) === null || _a === void 0 ? void 0 : _a.length) || 0})`);
            // A. In-App Notification
            await db.collection('users').doc(merchantUid).collection('notifications').doc(merchantNotifId).set({
                id: merchantNotifId,
                type: 'order',
                title: 'New Order! 🔔',
                message: `New order from ${customerName} for $${total.toFixed(2)}`,
                timestamp: new Date().toISOString(),
                read: false,
                orderId,
                link: '/merchant/orders'
            });
            // B. Push Notification (FCM)
            const merchantTokens = merchantData === null || merchantData === void 0 ? void 0 : merchantData.fcmTokens;
            if (merchantTokens && merchantTokens.length > 0) {
                const validTokens = merchantTokens.filter(t => typeof t === 'string' && t.length > 0);
                const message = {
                    tokens: validTokens,
                    notification: {
                        title: 'New Order Received! 🛍️',
                        body: `${customerName} placed an order for $${total.toFixed(2)}`
                    },
                    data: {
                        type: 'order',
                        orderId: orderId,
                        link: '/merchant/orders'
                    }
                };
                try {
                    const response = await admin.messaging().sendEachForMulticast(message);
                    functions.logger.info(`[OrderTrigger] FCM Success: ${response.successCount}, Failure: ${response.failureCount}`);
                    await (0, fcm_1.removeStaleTokens)(merchantUid, validTokens, response.responses);
                }
                catch (fcmError) {
                    functions.logger.error(`[OrderTrigger] FCM Error for ${merchantUid}:`, fcmError);
                }
            }
            return null;
        });
        await Promise.all(notificationPromises);
        functions.logger.info(`[OrderTrigger] Successfully finished processing for order ${orderId}`);
    }
    catch (error) {
        functions.logger.error(`[OrderTrigger] Error for order ${orderId}:`, error);
    }
    return null;
});
//# sourceMappingURL=orderCreationTrigger.js.map