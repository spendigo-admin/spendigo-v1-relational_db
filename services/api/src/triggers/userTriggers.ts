import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * TRIGGER: onUserUpdate
 * Syncs critical user profile data (subscriptionTier, name, avatar) 
 * to the public 'stores' document to ensure consistency.
 */
export const onUserUpdate = functions.firestore
    .document('users/{userId}')
    .onUpdate(async (change, context) => {
        const newData = change.after.data();
        const previousData = change.before.data();

        // Critical fields to monitor
        const fieldsToSync = ['subscriptionTier', 'name', 'avatar', 'email'];

        // Check if any critical field changed
        const hasChanged = fieldsToSync.some(field => newData[field] !== previousData[field]);

        if (!hasChanged || newData.role !== 'merchant' || !newData.storeId) {
            return null;
        }

        functions.logger.log(`Syncing user data to store ${newData.storeId}...`);

        try {
            await db.collection('stores').doc(newData.storeId).set({
                subscriptionTier: newData.subscriptionTier,
                // Only update these if they exist on user profile, fallback handled by store settings usually
                merchantEmail: newData.email,
                // We typically don't overwrite store Name with User Name, but subscriptionTier is critical.
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            functions.logger.log(`Successfully synced subscriptionTier='${newData.subscriptionTier}' to store/${newData.storeId}`);
        } catch (error) {
            functions.logger.error('Error syncing user data to store:', error);
        }
        return null;
    });
