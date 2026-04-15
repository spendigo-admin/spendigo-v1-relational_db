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
exports.onOrderStatusUpdated = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// Initialize admin app if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
exports.onOrderStatusUpdated = functions.firestore
    .document('orders/{orderId}')
    .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const orderId = context.params.orderId;
    const oldStatus = beforeData.status;
    const newStatus = afterData.status;
    // Only proceed if status has changed
    if (oldStatus === newStatus) {
        return null;
    }
    const userId = afterData.customerId;
    if (!userId) {
        functions.logger.warn(`Order ${orderId} has no customerId associated.`);
        return null;
    }
    // Determine notification title and body based on the new status
    let title = '';
    let body = '';
    switch (newStatus) {
        case 'preparing':
            title = 'Order Preparing 🍳';
            body = `Your order from ${afterData.storeName || 'the store'} is being prepared!`;
            break;
        case 'out_for_delivery':
            title = 'Out for Delivery 🚚';
            body = `Your order #${orderId.slice(-5)} is on its way to you!`;
            break;
        case 'delivered':
            title = 'Order Delivered! ✅';
            body = `Your order #${orderId.slice(-5)} has arrived. Enjoy!`;
            break;
        case 'placed':
            title = 'Order Confirmed 🎉';
            body = `We've received your order #${orderId.slice(-5)}!`;
            break;
        case 'cancelled':
            title = 'Order Cancelled ❌';
            body = `Your order #${orderId.slice(-5)} was cancelled.`;
            break;
        default:
            return null; // Not a status we notify for push
    }
    try {
        // Get the user document to fetch FCM tokens
        const userDoc = await admin.firestore().collection('users').doc(userId).get();
        if (!userDoc.exists) {
            functions.logger.warn(`User ${userId} not found for order ${orderId}.`);
            return null;
        }
        const userData = userDoc.data();
        const fcmTokens = userData === null || userData === void 0 ? void 0 : userData.fcmTokens;
        if (!fcmTokens || fcmTokens.length === 0) {
            functions.logger.info(`User ${userId} has no FCM tokens registered.`);
            return null;
        }
        // Construct the FCM payload
        const payload = {
            tokens: fcmTokens,
            notification: {
                title,
                body,
            },
            data: {
                type: 'order',
                orderId: orderId,
                status: newStatus,
                link: `/order/${orderId}`
            },
            android: {
                priority: 'high',
                notification: {
                    sound: 'default'
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default'
                    }
                }
            }
        };
        // Send the multicast message
        const response = await admin.messaging().sendEachForMulticast(payload);
        // Cleanup invalid/expired tokens
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const error = resp.error;
                    if ((error === null || error === void 0 ? void 0 : error.code) === 'messaging/invalid-registration-token' ||
                        (error === null || error === void 0 ? void 0 : error.code) === 'messaging/registration-token-not-registered') {
                        failedTokens.push(fcmTokens[idx]);
                    }
                }
            });
            if (failedTokens.length > 0) {
                functions.logger.info(`Removing ${failedTokens.length} stale FCM tokens for user ${userId}.`);
                await admin.firestore().collection('users').doc(userId).update({
                    fcmTokens: admin.firestore.FieldValue.arrayRemove(...failedTokens)
                });
            }
        }
        functions.logger.info(`Successfully sent ${response.successCount} push notifications for order ${orderId} (Status: ${newStatus}).`);
    }
    catch (error) {
        functions.logger.error(`Error sending push notification for order ${orderId}:`, error);
    }
    return null;
});
//# sourceMappingURL=orderTriggers.js.map