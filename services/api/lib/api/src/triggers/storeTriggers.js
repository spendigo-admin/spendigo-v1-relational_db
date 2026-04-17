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
exports.onStoreDelete = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = require("../config/stripe");
/**
 * Triggered when a Store document is deleted.
 * Performs cascade deletions for orphaned data and cleans up third-party services.
 */
exports.onStoreDelete = functions.firestore
    .document('stores/{storeId}')
    .onDelete(async (snap, context) => {
    const storeId = context.params.storeId;
    const db = admin.firestore();
    // We cannot use a single batch because we might exceed 500 operations, 
    // but typically a store won't have more than 500 products. 
    // To be safe and thorough, we will execute deletes directly or in small batches.
    functions.logger.info(`Starting cascade deletion for Store: ${storeId}`);
    try {
        // 1. Delete Merchant Products
        // Note: Deleting these will inherently trigger algoliaMerchantTriggers via rules
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
            // Check for active Stripe subscriptions to cancel
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
        /**
         * Automatically geocodes a store's address when it is created or the address changes.
         */
        export const onStoreCreate = functions.firestore
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
    }
    finally {
    }
});
//# sourceMappingURL=storeTriggers.js.map