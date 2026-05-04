import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { removeStaleTokens } from '../utils/fcm';

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
    const storeName = orderData.storeName || 'the store';
    const total = orderData.total || 0;
    const customerName = orderData.customerName || 'A customer';
    const rawStoreId = orderData.storeId;
    const storeId = typeof rawStoreId === 'string' ? rawStoreId.trim() : rawStoreId;

    functions.logger.info(`[OrderTrigger] Processing Order ${orderId} for StoreID: "${storeId}" (Type: ${typeof storeId})`);

    try {
        // 1. Create In-App Notification for Customer
        const customerNotifId = `notif_cust_${orderId}_${Date.now()}`;
        await db.collection('users').doc(customerId).collection('notifications').doc(customerNotifId).set({
            id: customerNotifId,
            type: 'order',
            title: 'Order Placed! 📋',
            message: `Your order from ${storeName} has been received.`,
            timestamp: new Date().toISOString(),
            read: false,
            orderId,
            link: `/order/${orderId}`
        });

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
                const ownerId = storeData?.ownerId;
                const merchantEmail = storeData?.merchantEmail;

                functions.logger.info(`[OrderTrigger] Store Doc found. OwnerId: ${ownerId}, MerchantEmail: ${merchantEmail}`);

                // Try by OwnerId
                if (ownerId) {
                    const ownerDoc = await db.collection('users').doc(ownerId).get();
                    if (ownerDoc.exists && ownerDoc.data()?.role === 'merchant') {
                        functions.logger.info(`[OrderTrigger] Found merchant via OwnerId: ${ownerId}`);
                        merchantDocs.push(ownerDoc as any);
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
            } else {
                functions.logger.error(`[OrderTrigger] CRITICAL: Store document "${storeId}" does not exist in 'stores' collection!`);
            }
        }
        // --- END FAIL-SAFE LOGIC ---

        // 3. Notify each Merchant User
        const notificationPromises = merchantDocs.map(async (doc) => {
            const merchantUid = doc.id;
            const merchantData = doc.data();
            const merchantNotifId = `notif_merch_${orderId}_${Date.now()}`;

            functions.logger.info(`[OrderTrigger] Dispatching to Merchant: ${merchantUid} (Tokens: ${merchantData.fcmTokens?.length || 0})`);

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
            const merchantTokens = merchantData?.fcmTokens as string[] | undefined;
            if (merchantTokens && merchantTokens.length > 0) {
                const validTokens = merchantTokens.filter(t => typeof t === 'string' && t.length > 0);
                const message: admin.messaging.MulticastMessage = {
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
                    await removeStaleTokens(merchantUid, validTokens, response.responses);
                } catch (fcmError) {
                    functions.logger.error(`[OrderTrigger] FCM Error for ${merchantUid}:`, fcmError);
                }
            }
            return null;
        });

        await Promise.all(notificationPromises);
        functions.logger.info(`[OrderTrigger] Successfully finished processing for order ${orderId}`);
    } catch (error) {
        functions.logger.error(`[OrderTrigger] Error for order ${orderId}:`, error);
    }

    return null;
  });
