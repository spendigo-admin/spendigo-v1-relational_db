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
exports.triggerAnalyticsAggregation = exports.aggregateFlyerAnalytics = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const v1_1 = require("firebase-functions/v1");
function percentile(sorted, p) {
    if (sorted.length === 0)
        return 0;
    const idx = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper)
        return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}
/**
 * Build the doc ID for flyer_analytics.
 * Separator '::' is safe because normalizedKey contains only [a-z0-9%_] and
 * retailer names contain only alphanumerics and underscores after replacement.
 * Retailer 'ALL' is used for the cross-chain market aggregate.
 */
function analyticsDocId(normalizedKey, retailer) {
    return `${normalizedKey.substring(0, 200)}::${retailer.replace(/\s+/g, '_')}`;
}
async function computeAndSave(db, normalizedKey, retailer, docs) {
    const prices = docs
        .map(d => d.data().currentPrice)
        .filter(p => typeof p === 'number' && p > 0)
        .sort((a, b) => a - b);
    if (prices.length === 0)
        return;
    const originalPrices = docs
        .map(d => d.data().originalPrice)
        .filter(p => typeof p === 'number' && p > 0);
    const discountPcts = docs
        .filter(d => d.data().currentPrice > 0 && d.data().originalPrice > d.data().currentPrice)
        .map(d => ((d.data().originalPrice - d.data().currentPrice) / d.data().originalPrice) * 100);
    // Extract validFrom dates ordered ASC for sale cycle analysis
    const validFromDates = docs
        .map(d => {
        const vf = d.data().validFrom;
        if (typeof vf === 'string')
            return new Date(vf);
        if (vf && typeof vf.toDate === 'function')
            return vf.toDate();
        return null;
    })
        .filter((d) => d !== null)
        .sort((a, b) => a.getTime() - b.getTime());
    let avgWeeksBetweenSales = null;
    let predictedNextSaleDate = null;
    // Need at least 3 dates to estimate a reliable cycle
    if (validFromDates.length >= 3) {
        const gaps = [];
        for (let i = 1; i < validFromDates.length; i++) {
            const diffWeeks = (validFromDates[i].getTime() - validFromDates[i - 1].getTime()) /
                (1000 * 60 * 60 * 24 * 7);
            // Ignore gaps > 1 year — those are data collection gaps, not natural cycles
            if (diffWeeks > 0 && diffWeeks < 52)
                gaps.push(diffWeeks);
        }
        if (gaps.length > 0) {
            avgWeeksBetweenSales = gaps.reduce((a, b) => a + b, 0) / gaps.length;
            const lastDate = validFromDates[validFromDates.length - 1];
            const predicted = new Date(lastDate.getTime() + avgWeeksBetweenSales * 7 * 24 * 60 * 60 * 1000);
            predictedNextSaleDate = admin.firestore.Timestamp.fromDate(predicted);
        }
    }
    const lastSaleDate = validFromDates.length > 0
        ? admin.firestore.Timestamp.fromDate(validFromDates[validFromDates.length - 1])
        : null;
    // Count distinct ISO-week appearances as sale occurrences
    const weekKeys = new Set(docs.map(d => { var _a, _b; return `${(_a = d.data().year) !== null && _a !== void 0 ? _a : ''}_${(_b = d.data().isoWeek) !== null && _b !== void 0 ? _b : ''}`; }));
    await db
        .collection('flyer_analytics')
        .doc(analyticsDocId(normalizedKey, retailer))
        .set({
        normalizedKey,
        retailer,
        avgCurrentPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
        minCurrentPrice: prices[0],
        maxCurrentPrice: prices[prices.length - 1],
        avgOriginalPrice: originalPrices.length > 0
            ? originalPrices.reduce((a, b) => a + b, 0) / originalPrices.length
            : null,
        avgDiscountPct: discountPcts.length > 0
            ? discountPcts.reduce((a, b) => a + b, 0) / discountPcts.length
            : null,
        pricePercentiles: {
            p10: percentile(prices, 10),
            p25: percentile(prices, 25),
            p50: percentile(prices, 50),
            p75: percentile(prices, 75),
            p90: percentile(prices, 90),
        },
        saleOccurrences: weekKeys.size,
        avgWeeksBetweenSales,
        lastSaleDate,
        predictedNextSaleDate,
        sampleSize: prices.length,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: false });
}
async function runAggregation() {
    const db = admin.firestore();
    v1_1.logger.info('[aggregateFlyerAnalytics] Starting aggregation...');
    const snap = await db.collection('flyer_deal_index').get();
    if (snap.empty) {
        v1_1.logger.info('[aggregateFlyerAnalytics] flyer_deal_index is empty, skipping.');
        return;
    }
    // Group docs by (normalizedKey, retailer) AND by (normalizedKey, 'ALL')
    const groups = new Map();
    for (const docSnap of snap.docs) {
        const { normalizedKey, retailer } = docSnap.data();
        if (!normalizedKey || !retailer)
            continue;
        const specificKey = `${normalizedKey}||${retailer}`;
        if (!groups.has(specificKey))
            groups.set(specificKey, []);
        groups.get(specificKey).push(docSnap);
        // Cross-retailer aggregate for market baseline comparisons
        const allKey = `${normalizedKey}||ALL`;
        if (!groups.has(allKey))
            groups.set(allKey, []);
        groups.get(allKey).push(docSnap);
    }
    v1_1.logger.info(`[aggregateFlyerAnalytics] Processing ${groups.size} groups...`);
    for (const [key, docs] of groups) {
        const sepIdx = key.indexOf('||');
        const normalizedKey = key.substring(0, sepIdx);
        const retailer = key.substring(sepIdx + 2);
        try {
            await computeAndSave(db, normalizedKey, retailer, docs);
        }
        catch (err) {
            v1_1.logger.error(`[aggregateFlyerAnalytics] Failed for "${key}":`, err);
        }
    }
    v1_1.logger.info('[aggregateFlyerAnalytics] Aggregation complete.');
}
/**
 * Scheduled daily aggregation — runs at 6am Toronto time, after overnight ingestion jobs.
 */
exports.aggregateFlyerAnalytics = functions.pubsub
    .schedule('0 6 * * *')
    .timeZone('America/Toronto')
    .onRun(async () => {
    await runAggregation();
});
/**
 * Admin-only callable trigger for manual re-computation (e.g. after backfilling historical data).
 */
exports.triggerAnalyticsAggregation = functions.https.onCall(async (_data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');
    }
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    if (((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Admin only');
    }
    await runAggregation();
    return { success: true };
});
//# sourceMappingURL=aggregateFlyerAnalytics.js.map