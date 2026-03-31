import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

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

    const userId = afterData.userId;
    if (!userId) {
      functions.logger.warn(`Order ${orderId} has no userId associated.`);
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
      const fcmTokens = userData?.fcmTokens as string[] | undefined;

      if (!fcmTokens || fcmTokens.length === 0) {
        functions.logger.info(`User ${userId} has no FCM tokens registered.`);
        return null;
      }

      // Construct the FCM payload
      const payload: admin.messaging.MulticastMessage = {
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
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const error = resp.error;
            if (
              error?.code === 'messaging/invalid-registration-token' ||
              error?.code === 'messaging/registration-token-not-registered'
            ) {
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
    } catch (error) {
      functions.logger.error(`Error sending push notification for order ${orderId}:`, error);
    }

    return null;
  });
