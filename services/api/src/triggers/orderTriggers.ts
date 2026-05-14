import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { removeStaleTokens } from '../utils/fcm';

// Initialize admin app if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

export const onOrderStatusUpdated = functions.firestore
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
        title = 'Order Accepted! ✅';
        body = `Store is now preparing your items.`;
        break;
      case 'out_for_delivery': {
        const isDelivery = !!afterData.deliveryAddress;
        title = isDelivery ? 'Out for Delivery 🚚' : 'Ready for Pickup! 🛍️';
        body = isDelivery
          ? `Your order #${orderId.slice(-5)} is on its way!`
          : `Your items are ready. Visit the store to collect your order.`;
        break;
      }
      case 'delivered':
        title = 'Order Completed! ✨';
        body = `Your order #${orderId.slice(-5)} has been completed. Enjoy!`;
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
        return null;
    }

    try {
      // 1. Create Persistent In-App Notification
      const notifId = `notif_status_${orderId}_${newStatus}`;
      await admin.firestore().collection('users').doc(userId).collection('notifications').doc(notifId).set({
          id: notifId,
          type: 'order',
          title,
          message: body,
          timestamp: new Date().toISOString(),
          read: false,
          orderId,
          link: `/order/${orderId}`
      });

      // 2. Fetch FCM Tokens for Push Notification
      const userDoc = await admin.firestore().collection('users').doc(userId).get();
      if (!userDoc.exists) {
        functions.logger.warn(`User ${userId} not found for order ${orderId}.`);
        return null;
      }

      const userData = userDoc.data();
      const fcmTokens = userData?.fcmTokens as string[] | undefined;

      if (!fcmTokens || fcmTokens.length === 0) {
        functions.logger.info(`User ${userId} has no FCM tokens. Persistent notification created.`);
        return null;
      }

      // 3. Send Push Notification
      const payload: admin.messaging.MulticastMessage = {
        tokens: fcmTokens,
        notification: { title, body },
        data: {
          type: 'order',
          orderId: orderId,
          status: newStatus,
          link: `/order/${orderId}`
        },
        android: { priority: 'high', notification: { sound: 'default' } },
        apns: { payload: { aps: { sound: 'default' } } },
        webpush: {
          notification: {
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            // Tag deduplicates repeated status updates so the user sees only the latest
            tag: `order-${orderId}`,
          }
        }
      };

      const response = await admin.messaging().sendEachForMulticast(payload);

      if (response.failureCount > 0) {
        await removeStaleTokens(userId, fcmTokens, response.responses);
      }

      functions.logger.info(`Successfully processed order status notification for ${orderId} (${newStatus})`);
    } catch (error) {
      functions.logger.error(`Error processing status notification for order ${orderId}:`, error);
    }

    return null;
  });
