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
exports.onBackupJobResult = exports.onStoreUpdate = exports.onStoreCreate = exports.onStoreDelete = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = require("../config/stripe");
/**
 * Safety-net trigger for direct store deletions (e.g., via Firebase console or Admin SDK).
 * The normal deletion workflow goes through processPendingStoreDeletions (30-day grace period).
 * This trigger fires only when a store document is hard-deleted without the grace period flow.
 */
exports.onStoreDelete = functions.firestore
    .document('stores/{storeId}')
    .onDelete(async (snap, context) => {
    const storeId = context.params.storeId;
    const storeData = snap.data();
    const db = admin.firestore();
    // If deleted via the grace-period flow, processPendingStoreDeletions already ran the cascade.
    // This guard prevents double-deletion in that path.
    if ((storeData === null || storeData === void 0 ? void 0 : storeData.status) === 'pending_deletion' && (storeData === null || storeData === void 0 ? void 0 : storeData.deletionApprovedAt)) {
        functions.logger.info(`[onStoreDelete] Store ${storeId} was deleted via grace-period flow — cascade already handled.`);
        return;
    }
    functions.logger.warn(`[onStoreDelete] Direct deletion detected for store ${storeId} — running emergency cascade.`);
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
                storeId: admin.firestore.FieldValue.delete(),
                role: 'consumer',
                merchantRole: admin.firestore.FieldValue.delete(),
                subscriptionTier: 'free',
                subscriptionStatus: 'inactive',
                subscriptionEnd: null
            });
            if (userData.stripeCustomerId) {
                try {
                    const subscriptions = await stripe_1.stripe.subscriptions.list({
                        customer: userData.stripeCustomerId,
                        status: 'active'
                    });
                    for (const sub of subscriptions.data) {
                        await stripe_1.stripe.subscriptions.cancel(sub.id);
                        functions.logger.info(`Cancelled Stripe subscription ${sub.id} for user ${docSnap.id}`);
                    }
                }
                catch (stripeErr) {
                    functions.logger.error(`Error cancelling stripe subscriptions for user ${docSnap.id}:`, stripeErr);
                }
            }
        });
        await Promise.all(userUpdates);
        functions.logger.info(`Successfully deactivated ${usersSnapshot.size} users linked to store ${storeId}.`);
    }
    catch (error) {
        functions.logger.error(`Error during cascade delete for store ${storeId}:`, error);
    }
});
/**
 * Automatically geocodes a store's address when it is created or the address changes.
 */
exports.onStoreCreate = functions.firestore
    .document('stores/{storeId}')
    .onCreate(async (snap, context) => {
    const data = snap.data();
    if (!data.address)
        return;
    const fullAddress = `${data.address}, ${data.city || ''}, ${data.province || ''}, ${data.postalCode || ''}, Canada`.replace(/,,/g, ',');
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`);
        const results = await response.json();
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
    }
    catch (err) {
        functions.logger.error(`Failed to geocode new store ${context.params.storeId}:`, err);
    }
});
exports.onStoreUpdate = functions.firestore
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
            const results = await response.json();
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
        }
        catch (err) {
            functions.logger.error(`Failed to re-geocode store ${context.params.storeId}:`, err);
        }
    }
});
/**
 * Fires when a system_backups document is created.
 * Sends an email alert via the /mail collection when a backup job fails.
 */
exports.onBackupJobResult = functions.firestore
    .document('system_backups/{backupId}')
    .onCreate(async (snap) => {
    var _a;
    const data = snap.data();
    if ((data === null || data === void 0 ? void 0 : data.status) !== 'failed')
        return;
    try {
        await admin.firestore().collection('mail').add({
            to: ((_a = functions.config().admin) === null || _a === void 0 ? void 0 : _a.alert_email) || 'ops@spendigo.ca',
            message: {
                subject: `ALERT: Spendigo backup job failed (${data.type})`,
                text: `Backup job failed.\n\nType: ${data.type}\nDate: ${data.date}\nError: ${data.errorMessage || 'unknown'}\n\nCheck /admin/health in the Spendigo admin portal for details.`,
            },
        });
    }
    catch (err) {
        functions.logger.error('[onBackupJobResult] Failed to send alert email:', err);
    }
});
//# sourceMappingURL=storeTriggers.js.map