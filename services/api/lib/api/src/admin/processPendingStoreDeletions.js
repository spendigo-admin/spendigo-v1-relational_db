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
exports.processPendingStoreDeletions = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = require("../config/stripe");
const GRACE_PERIOD_DAYS = 30;
exports.processPendingStoreDeletions = functions
    .runWith({ timeoutSeconds: 540, memory: '256MB' })
    .pubsub.schedule('0 4 * * *')
    .timeZone('America/Toronto')
    .onRun(async (_context) => {
    const db = admin.firestore();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - GRACE_PERIOD_DAYS);
    const pendingSnap = await db.collection('stores')
        .where('status', '==', 'pending_deletion')
        .where('deletionApprovedAt', '<=', admin.firestore.Timestamp.fromDate(cutoff))
        .get();
    functions.logger.info(`[StoreCleanup] Found ${pendingSnap.size} stores past grace period.`);
    for (const storeDoc of pendingSnap.docs) {
        const storeId = storeDoc.id;
        try {
            await cascadeDeleteStore(db, storeId, storeDoc.data());
            await storeDoc.ref.delete();
            functions.logger.info(`[StoreCleanup] Deleted store ${storeId} after ${GRACE_PERIOD_DAYS}-day grace period.`);
        }
        catch (err) {
            functions.logger.error(`[StoreCleanup] Failed to delete store ${storeId}:`, err);
            // Mark as failed so admin can investigate — leave data intact
            await storeDoc.ref.update({ status: 'deletion_failed', deletionError: String(err) });
        }
    }
});
async function cascadeDeleteStore(db, storeId, storeData) {
    // 1. Delete merchant products
    const productsSnap = await db.collection('merchant_products')
        .where('merchant_id', '==', storeId).get();
    const productBatch = db.batch();
    productsSnap.docs.forEach(d => productBatch.delete(d.ref));
    await productBatch.commit();
    // 2. Delete subcollections (deals, flyers, analytics)
    const [dealsSnap, flyersSnap, analyticsSnap] = await Promise.all([
        db.collection(`stores/${storeId}/deals`).get(),
        db.collection(`stores/${storeId}/flyers`).get(),
        db.collection(`stores/${storeId}/analytics`).get(),
    ]);
    const subcollectionBatch = db.batch();
    [...dealsSnap.docs, ...flyersSnap.docs, ...analyticsSnap.docs].forEach(d => subcollectionBatch.delete(d.ref));
    await subcollectionBatch.commit();
    // 3. De-link users and cancel Stripe subscriptions
    const usersSnap = await db.collection('users').where('storeId', '==', storeId).get();
    await Promise.all(usersSnap.docs.map(async (docSnap) => {
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
                const subs = await stripe_1.stripe.subscriptions.list({
                    customer: userData.stripeCustomerId,
                    status: 'active',
                });
                for (const sub of subs.data) {
                    await stripe_1.stripe.subscriptions.cancel(sub.id);
                    functions.logger.info(`[StoreCleanup] Cancelled Stripe sub ${sub.id} for user ${docSnap.id}`);
                }
            }
            catch (stripeErr) {
                functions.logger.error(`[StoreCleanup] Stripe cancel failed for user ${docSnap.id}:`, stripeErr);
            }
        }
    }));
    // Log the final deletion via the store data we still have in memory
    functions.logger.info(`[StoreCleanup] Cascade complete for store ${storeId} (${storeData.name || 'unknown'})`);
}
//# sourceMappingURL=processPendingStoreDeletions.js.map