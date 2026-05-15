import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { stripe } from '../config/stripe';

/**
 * Safety-net trigger for direct store deletions (e.g., via Firebase console or Admin SDK).
 * The normal deletion workflow goes through processPendingStoreDeletions (30-day grace period).
 * This trigger fires only when a store document is hard-deleted without the grace period flow.
 */
export const onStoreDelete = functions.firestore
  .document('stores/{storeId}')
  .onDelete(async (snap, context) => {
    const storeId = context.params.storeId;
    const db = admin.firestore();

    // Removed the guard that previously skipped cleanup for stores in 'pending_deletion' status.
    // This ensures that even if a store was approved for deletion but deleted early/manually,
    // the associated merchants are still correctly reverted to consumer status.

    functions.logger.warn(`[onStoreDelete] Deletion detected for store ${storeId} — running cleanup cascade.`);

    try {
      // 1. Delete Merchant Products
      const productsSnapshot = await db.collection('merchant_products')
        .where('merchant_id', '==', storeId)
        .get();

      const productDeletes = productsSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(productDeletes);
      functions.logger.info(`Deleted ${productsSnapshot.size} merchant_products for store ${storeId}.`);

      // 2. Wipe subcollections
      const dealsSnapshot = await db.collection(`stores/${storeId}/deals`).get();
      const dealDeletes = dealsSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(dealDeletes);

      const flyersSnapshot = await db.collection(`stores/${storeId}/flyers`).get();
      const flyerDeletes = flyersSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(flyerDeletes);

      const analyticsSnapshot = await db.collection(`stores/${storeId}/analytics`).get();
      await Promise.all(analyticsSnapshot.docs.map(doc => doc.ref.delete()));

      functions.logger.info(`Deleted ${dealsSnapshot.size} deals and ${flyersSnapshot.size} flyers.`);

      // 3. De-link Users & Cancel Stripe Subscriptions
      const usersSnapshot = await db.collection('users').where('storeId', '==', storeId).get();

      const userUpdates = usersSnapshot.docs.map(async (docSnap) => {
        const userData = docSnap.data();

        await docSnap.ref.update({
          role: 'consumer',
          storeId: admin.firestore.FieldValue.delete(),
          merchantRole: admin.firestore.FieldValue.delete(),
          storeName: admin.firestore.FieldValue.delete(),
          businessRegistrationNumber: admin.firestore.FieldValue.delete(),
          manualOverride: admin.firestore.FieldValue.delete(),
          subscriptionStatus: 'inactive',
          subscriptionTier: 'free',
          subscriptionEnd: null,
          lastAdminEdit: admin.firestore.FieldValue.delete()
        });

        if (userData.stripeCustomerId) {
          try {
            const subscriptions = await stripe.subscriptions.list({
              customer: userData.stripeCustomerId,
              status: 'active'
            });

            for (const sub of subscriptions.data) {
              await stripe.subscriptions.cancel(sub.id);
              functions.logger.info(`Cancelled Stripe subscription ${sub.id} for user ${docSnap.id}`);
            }
          } catch (stripeErr) {
            functions.logger.error(`Error cancelling stripe subscriptions for user ${docSnap.id}:`, stripeErr);
          }
        }
      });

      await Promise.all(userUpdates);
      functions.logger.info(`Successfully deactivated ${usersSnapshot.size} users linked to store ${storeId}.`);

    } catch (error) {
      functions.logger.error(`Error during cascade delete for store ${storeId}:`, error);
    }
  });


/**
 * Automatically geocodes a store's address when it is created or the address changes.
 */
export const onStoreCreate = functions.firestore
  .document('stores/{storeId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    if (!data.address) return;

    const fullAddress = `${data.address}, ${data.city || ''}, ${data.province || ''}, ${data.postalCode || ''}, Canada`.replace(/,,/g, ',');
    
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`);
      const results = await response.json() as any[];

      if (results && results.length > 0) {
        const { lat, lon } = results[0];
        await snap.ref.update({
          coordinates: {
            lat: parseFloat(lat),
            lng: parseFloat(lon)
          }
        });
        functions.logger.info(`Automatically geocoded new store ${context.params.storeId}`);
      }
    } catch (err) {
      functions.logger.error(`Failed to geocode new store ${context.params.storeId}:`, err);
    }
  });

export const onStoreUpdate = functions.firestore
  .document('stores/{storeId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Only re-geocode if the address parts changed
    const addressChanged = before.address !== after.address || 
                           before.city !== after.city || 
                           before.postalCode !== after.postalCode;

    if (addressChanged && after.address) {
      const fullAddress = `${after.address}, ${after.city || ''}, ${after.province || ''}, ${after.postalCode || ''}, Canada`.replace(/,,/g, ',');
      
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`);
        const results = await response.json() as any[];

        if (results && results.length > 0) {
          const { lat, lon } = results[0];
          await change.after.ref.update({
            coordinates: {
              lat: parseFloat(lat),
              lng: parseFloat(lon)
            }
          });
          functions.logger.info(`Re-geocoded updated store ${context.params.storeId}`);
        }
      } catch (err) {
        functions.logger.error(`Failed to re-geocode store ${context.params.storeId}:`, err);
      }
    }
  });

/**
 * Fires when a system_backups document is created.
 * Sends an email alert via the /mail collection when a backup job fails.
 */
export const onBackupJobResult = functions.firestore
  .document('system_backups/{backupId}')
  .onCreate(async (snap) => {
    const data = snap.data();
    if (data?.status !== 'failed') return;

    try {
      await admin.firestore().collection('mail').add({
        to: process.env.ADMIN_ALERT_EMAIL || 'ops@spendigo.ca',
        message: {
          subject: `ALERT: Spendigo backup job failed (${data.type})`,
          text: `Backup job failed.\n\nType: ${data.type}\nDate: ${data.date}\nError: ${data.errorMessage || 'unknown'}\n\nCheck /admin/health in the Spendigo admin portal for details.`,
        },
      });
    } catch (err) {
      functions.logger.error('[onBackupJobResult] Failed to send alert email:', err);
    }
  });
