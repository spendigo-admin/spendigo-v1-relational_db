import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize admin app if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

/**
 * Triggered when a new order is created.
 * Sends notifications to both the customer and the merchant.
 */
export const onOrderCreated = functions.firestore
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
    } catch (error) {
        functions.logger.error(`Error creating order notifications for order ${orderId}:`, error);
    }

    return null;
  });
