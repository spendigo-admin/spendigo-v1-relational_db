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
exports.onMerchantProductPriceChange = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
/**
 * Captures price changes on merchant_products updates into a price_history subcollection.
 * Stores one snapshot per day per product — lightweight for trend indicators.
 */
exports.onMerchantProductPriceChange = functions.firestore
    .document('merchant_products/{productId}')
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const productId = context.params.productId;
    if (!before || !after)
        return;
    const oldPrice = before.price;
    const newPrice = after.price;
    // Only track actual price changes
    if (oldPrice === newPrice)
        return;
    if (typeof newPrice !== 'number' || newPrice <= 0)
        return;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const historyRef = db
        .collection('merchant_products')
        .doc(productId)
        .collection('price_history')
        .doc(today);
    await historyRef.set({
        price: newPrice,
        previousPrice: oldPrice,
        date: today,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        merchant_id: after.merchant_id || null,
        master_product_id: after.master_product_id || null,
    }, { merge: true });
    // Cleanup: keep only last 30 days of history
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const oldDateStr = thirtyDaysAgo.toISOString().split('T')[0];
    const oldDocs = await db
        .collection('merchant_products')
        .doc(productId)
        .collection('price_history')
        .where('date', '<', oldDateStr)
        .limit(10)
        .get();
    const batch = db.batch();
    oldDocs.docs.forEach(doc => batch.delete(doc.ref));
    if (!oldDocs.empty)
        await batch.commit();
});
//# sourceMappingURL=priceHistoryTrigger.js.map