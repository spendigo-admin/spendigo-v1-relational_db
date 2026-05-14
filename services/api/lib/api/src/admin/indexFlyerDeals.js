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
exports.normalizeProductName = normalizeProductName;
exports.indexFlyerDeals = indexFlyerDeals;
const admin = __importStar(require("firebase-admin"));
const firebase_functions_1 = require("firebase-functions");
/**
 * Normalize a product name to a canonical token-sorted key for cross-retailer matching.
 * "Natrel Milk 2% 2L" and "2% Milk Natrel 2L" both produce "2%_2l_milk_natrel".
 *
 * CRITICAL: This function must produce identical output to the normalizeProductName
 * function in apps/web/src/hooks/useDealQuality.ts. Keep them in sync.
 */
function normalizeProductName(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s%]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(t => t.length > 0)
        .sort()
        .join('_');
}
function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
/**
 * Indexes all deals from a just-ingested flyer into the flat flyer_deal_index collection.
 * This enables time-series queries like "all prices for 'Natrel 2% Milk' at No Frills over 52 weeks"
 * without scanning every flyer's subcollection.
 *
 * Called fire-and-forget from runIngestion() — errors are logged but don't fail the parent job.
 * Idempotent: uses set({ merge: true }) so re-indexing the same flyer is safe.
 */
async function indexFlyerDeals(flyerId) {
    const db = admin.firestore();
    const dealsSnap = await db
        .collection('public_flyers')
        .doc(flyerId)
        .collection('deals')
        .get();
    if (dealsSnap.empty)
        return;
    const now = new Date();
    const isoWeek = getISOWeek(now);
    const year = now.getFullYear();
    const CHUNK_SIZE = 400;
    const docs = dealsSnap.docs;
    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const chunk = docs.slice(i, i + CHUNK_SIZE);
        const batch = db.batch();
        for (const dealDoc of chunk) {
            const deal = dealDoc.data();
            // Skip deals with no name or price — unusable for analytics
            if (!deal.name || deal.currentPrice == null)
                continue;
            const normalizedKey = normalizeProductName(deal.name);
            // Doc ID: {flyerId}_{dealId} prevents duplicates on re-index
            const docId = `${flyerId}_${deal.id}`;
            batch.set(db.collection('flyer_deal_index').doc(docId), Object.assign(Object.assign({}, deal), { normalizedKey,
                isoWeek,
                year,
                flyerId }), { merge: true });
        }
        await batch.commit();
    }
    firebase_functions_1.logger.info(`[indexFlyerDeals] Indexed ${docs.length} deals for flyer ${flyerId}`);
}
//# sourceMappingURL=indexFlyerDeals.js.map