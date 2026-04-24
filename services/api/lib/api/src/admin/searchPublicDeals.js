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
exports.searchPublicDeals = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// In-memory cache for the Cloud Function instance
// This persists across invocations as long as the instance stays warm, saving Firestore reads
let cachedDeals = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour TTL
exports.searchPublicDeals = functions.https.onCall(async (data, context) => {
    const db = admin.firestore();
    const now = Date.now();
    // Refresh cache if it's empty or TTL has expired
    if (!cachedDeals.length || (now - lastFetchTime) > CACHE_TTL_MS) {
        try {
            const flyersSnapshot = await db.collection('public_flyers').get();
            let allDeals = [];
            // Note: This reads all flyer deals, but only ONCE per instance lifecycle.
            for (const flyerDoc of flyersSnapshot.docs) {
                const dealsSnapshot = await db.collection('public_flyers').doc(flyerDoc.id).collection('deals').get();
                dealsSnapshot.forEach(doc => {
                    allDeals.push(Object.assign(Object.assign({}, doc.data()), { flyerId: flyerDoc.id }));
                });
            }
            cachedDeals = allDeals;
            lastFetchTime = now;
            functions.logger.info(`Refreshed public deals cache. Loaded ${cachedDeals.length} deals.`);
        }
        catch (error) {
            functions.logger.error('Error refreshing deals cache:', error);
            throw new functions.https.HttpsError('internal', 'Failed to fetch public deals');
        }
    }
    const { searchTerm, filters, listTerms } = data;
    const lowerSearch = (searchTerm || '').toLowerCase().trim();
    const activeFilters = filters || [];
    const activeListTerms = (listTerms || []).map((t) => t.toLowerCase().trim());
    const filteredDeals = cachedDeals.filter(deal => {
        const lowerName = (deal.name || '').toLowerCase();
        // Exact substring match for the search term
        const matchesSearch = lowerSearch === '' || lowerName.includes(lowerSearch);
        // At least one category filter must match if any are active
        const matchesCategories = activeFilters.length === 0 || activeFilters.some((f) => lowerName.includes(f.toLowerCase()));
        // List terms matching (Wishlist support)
        let matchesList = activeListTerms.length === 0;
        if (activeListTerms.length > 0) {
            matchesList = activeListTerms.some((term) => {
                // If the term is long, we split it to find meaningful overlap, or do a direct includes
                // e.g. "Seedless Cucumbers" -> matches "Cucumbers"
                return lowerName.includes(term) || term.includes(lowerName) ||
                    term.split(' ').some(word => word.length > 3 && lowerName.includes(word));
            });
        }
        return matchesSearch && matchesCategories && matchesList;
    });
    // Return up to 3000 results to support showing all comparisons on load
    const maxResults = 3000;
    return {
        deals: filteredDeals.slice(0, maxResults),
        totalCached: cachedDeals.length,
        returnedCount: Math.min(filteredDeals.length, maxResults)
    };
});
//# sourceMappingURL=searchPublicDeals.js.map