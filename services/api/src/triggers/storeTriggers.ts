import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { stripe } from '../config/stripe';
import { getDb } from '../db/client';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Helper to replicate store updates directly to PostgreSQL.
 */
async function syncStoreToPostgres(storeId: string, data: any) {
  const sqlDb = getDb();
  
  // Convert fees and thresholds to integer cents
  const deliveryFeeCents = (() => {
    const f = parseFloat(data.deliveryFee);
    return isNaN(f) ? 0 : Math.round(f * 100);
  })();
  
  const freeDeliveryThresholdCents = (() => {
    if (data.freeDeliveryThreshold === undefined || data.freeDeliveryThreshold === null) return null;
    const t = parseFloat(data.freeDeliveryThreshold);
    return isNaN(t) ? null : Math.round(t * 100);
  })();

  const lat = data.location?.lat ?? data.latitude ?? data.coordinates?.lat ?? null;
  const lng = data.location?.lng ?? data.longitude ?? data.coordinates?.lng ?? null;

  try {
    // If ownerId references a user that doesn't exist in PostgreSQL yet, 
    // we must insert a minimal stub user profile to satisfy the foreign key constraint
    if (data.ownerId) {
      const userExists = await sqlDb.select()
        .from(schema.users)
        .where(eq(schema.users.id, data.ownerId))
        .limit(1);

      if (userExists.length === 0) {
        functions.logger.info(`[Dual-Write] Store owner ${data.ownerId} not found in PostgreSQL. Creating stub user...`);
        await sqlDb.insert(schema.users).values({
          id: data.ownerId,
          email: `${data.ownerId}@unknown.com`,
          name: 'Merchant Owner',
          role: 'merchant',
          status: 'active',
          createdAt: new Date(),
          lastActive: new Date()
        }).onConflictDoNothing();
      }
    }

    await sqlDb.insert(schema.stores).values({
      id: storeId,
      name: data.name || 'Store Name',
      logo: data.logo || data.logoUrl || null,
      address: data.address || null,
      province: data.province || 'ON',
      postalCode: data.postalCode || null,
      latitude: lat != null ? parseFloat(lat) : null,
      longitude: lng != null ? parseFloat(lng) : null,
      deliveryFee: deliveryFeeCents,
      freeDeliveryThreshold: freeDeliveryThresholdCents,
      pickupEnabled: data.pickupEnabled ?? true,
      deliveryEnabled: data.deliveryEnabled ?? false,
      maxDeliveryRadiusKm: data.maxDeliveryRadiusKm != null ? parseFloat(data.maxDeliveryRadiusKm) : 10.0,
      subscriptionTier: data.subscriptionTier || 'starter',
      status: ['active', 'pending', 'suspended', 'pending_deletion'].includes(data.status) ? data.status as any : 'pending',
      ownerId: data.ownerId || null,
      stripeAccountId: data.stripeAccountId || null,
      stripeOnboardingStatus: data.stripeOnboardingStatus || null,
      kybStatus: data.kybStatus || 'not_submitted',
      kybDocuments: data.kybDocuments || [],
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: schema.stores.id,
      set: {
        name: data.name || 'Store Name',
        logo: data.logo || data.logoUrl || null,
        address: data.address || null,
        province: data.province || 'ON',
        postalCode: data.postalCode || null,
        latitude: lat != null ? parseFloat(lat) : null,
        longitude: lng != null ? parseFloat(lng) : null,
        deliveryFee: deliveryFeeCents,
        freeDeliveryThreshold: freeDeliveryThresholdCents,
        pickupEnabled: data.pickupEnabled ?? true,
        deliveryEnabled: data.deliveryEnabled ?? false,
        maxDeliveryRadiusKm: data.maxDeliveryRadiusKm != null ? parseFloat(data.maxDeliveryRadiusKm) : 10.0,
        subscriptionTier: data.subscriptionTier || 'starter',
        status: ['active', 'pending', 'suspended', 'pending_deletion'].includes(data.status) ? data.status as any : 'pending',
        ownerId: data.ownerId || null,
        stripeAccountId: data.stripeAccountId || null,
        stripeOnboardingStatus: data.stripeOnboardingStatus || null,
        kybStatus: data.kybStatus || 'not_submitted',
        kybDocuments: data.kybDocuments || [],
        updatedAt: new Date(),
      }
    });

    // Also update users.storeId if user exists
    if (data.ownerId) {
      await sqlDb.update(schema.users)
        .set({ storeId: storeId })
        .where(eq(schema.users.id, data.ownerId));
    }

    functions.logger.info(`[Dual-Write] Replicated store ${storeId} to PostgreSQL.`);
  } catch (pgError: any) {
    functions.logger.error(`[Dual-Write] PostgreSQL Store replication failed for ${storeId}:`, pgError.message);
  }
}

/**
 * Safety-net trigger for direct store deletions (e.g., via Firebase console or Admin SDK).
 * The normal deletion workflow goes through processPendingStoreDeletions (30-day grace period).
 * This trigger fires only when a store document is hard-deleted without the grace period flow.
 */
export const onStoreDelete = functions
  .runWith({ secrets: ['STRIPE_SECRET_KEY', 'DATABASE_URL'] })
  .firestore
  .document('stores/{storeId}')
  .onDelete(async (snap, context) => {
    const storeId = context.params.storeId;
    const db = admin.firestore();

    functions.logger.warn(`[onStoreDelete] Deletion detected for store ${storeId} — running cleanup cascade.`);

    // 0. Replicate deletion to PostgreSQL
    try {
      const sqlDb = getDb();
      await sqlDb.delete(schema.stores).where(eq(schema.stores.id, storeId));
      functions.logger.info(`[Dual-Write] Replicated deletion of store ${storeId} to PostgreSQL.`);
    } catch (pgError: any) {
      functions.logger.error(`[Dual-Write] PostgreSQL Store deletion failed for ${storeId}:`, pgError.message);
    }

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
export const onStoreCreate = functions.runWith({ secrets: ['DATABASE_URL'] }).firestore
  .document('stores/{storeId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const storeId = context.params.storeId;

    // Trigger replication
    await syncStoreToPostgres(storeId, data);

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
        functions.logger.info(`Automatically geocoded new store ${storeId}`);
      }
    } catch (err) {
      functions.logger.error(`Failed to geocode new store ${storeId}:`, err);
    }
  });

export const onStoreUpdate = functions.runWith({ secrets: ['DATABASE_URL'] }).firestore
  .document('stores/{storeId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const storeId = context.params.storeId;

    // Trigger replication
    await syncStoreToPostgres(storeId, after);

    // Re-geocode when address parts change
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
          functions.logger.info(`Re-geocoded updated store ${storeId}`);
        }
      } catch (err) {
        functions.logger.error(`Failed to re-geocode store ${storeId}:`, err);
      }
    }

    // Notify admins when a merchant submits KYB documents for review
    if (before.kybStatus !== 'pending_review' && after.kybStatus === 'pending_review') {
      const storeName = after.name || storeId;
      const docCount = (after.kybDocuments || []).length;
      try {
        await admin.firestore().collection('mail').add({
          to: process.env.ADMIN_ALERT_EMAIL || 'ops@spendigo.ca',
          message: {
            subject: `KYB Review Required: ${storeName}`,
            html: `
              <h2 style="color:#1a1a1a">New KYB Submission</h2>
              <p><strong>Store:</strong> ${storeName}</p>
              <p><strong>Store ID:</strong> ${storeId}</p>
              <p><strong>Documents submitted:</strong> ${docCount}</p>
              <p style="margin-top:16px">
                <a href="https://spendigo.ca/admin/stores" style="background:#0d9488;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">
                  Review in Admin Portal
                </a>
              </p>
            `,
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        functions.logger.info(`KYB review notification sent for store ${storeId}`);
      } catch (err) {
        functions.logger.error(`Failed to send KYB notification for store ${storeId}:`, err);
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
