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
exports.runIngestion = runIngestion;
const admin = __importStar(require("firebase-admin"));
const v1_1 = require("firebase-functions/v1");
const indexFlyerDeals_1 = require("../admin/indexFlyerDeals");
const FLYERS_URL = 'https://flyers-ng.flippback.com/api/flipp/data?locale=en&postal_code={}&sid={}';
const FLYER_ITEMS_URL = 'https://flyers-ng.flippback.com/api/flipp/flyers/{}/flyer_items?locale=en&sid={}';
// Stores to ingest per Flipp category. Add new categories here as they become active.
// Only 'Groceries' is active for analytics today; other categories are ready to enable.
const CATEGORY_STORES = {
    'Groceries': [
        'No Frills', 'FreshCo', 'Walmart', 'Loblaws', 'Real Canadian Superstore',
        'Sobeys', 'Metro', 'Food Basics', 'Your Independent Grocer', 'Independent Grocers',
        'Giant Tiger', 'Farm Boy', 'Wholesale Club',
    ],
    // 'Home & Garden': ['Canadian Tire', 'Home Depot', 'Rona', 'Home Hardware', 'IKEA'],
    // 'Electronics':   ['Best Buy', 'Staples', 'The Source', 'London Drugs'],
    // 'Pets':          ['PetSmart', 'Pet Valu', "Ren's Pets"],
    // 'Fashion':       ["Mark's", 'Sport Chek', 'Old Navy', 'H&M', 'Gap'],
};
// Derived lookup: store name → which category it belongs to (for tagging ingested deals)
const STORE_TO_CATEGORY = new Map(Object.entries(CATEGORY_STORES).flatMap(([cat, stores]) => stores.map(s => [s, cat])));
function generateSid() {
    return Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join('');
}
function chunkArray(array, size) {
    const chunked_arr = [];
    let index = 0;
    while (index < array.length) {
        chunked_arr.push(array.slice(index, size + index));
        index += size;
    }
    return chunked_arr;
}
/**
 * Recursively deletes a collection and its subcollections (limited for flyers)
 */
async function clearFlyerData(db) {
    const flyersSnap = await db.collection('public_flyers').get();
    for (const doc of flyersSnap.docs) {
        // Delete deals subcollection first
        const dealsSnap = await doc.ref.collection('deals').get();
        const dealChunks = chunkArray(dealsSnap.docs, 400);
        for (const chunk of dealChunks) {
            const batch = db.batch();
            chunk.forEach(deal => batch.delete(deal.ref));
            await batch.commit();
        }
        // Delete the flyer doc
        await doc.ref.delete();
    }
}
async function runIngestion(postalCode, resetData = false) {
    const db = admin.firestore();
    const cleanPostalCode = postalCode.replace(/\s+/g, '').toUpperCase();
    if (resetData) {
        v1_1.logger.info("Resetting existing flyer data...");
        await clearFlyerData(db);
    }
    try {
        const sid = generateSid();
        const url = FLYERS_URL.replace('{}', cleanPostalCode).replace('{}', sid);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Flipp API Error: ${response.statusText}`);
        }
        const jsonResponse = await response.json();
        if (!jsonResponse.flyers) {
            return { success: true, processedFlyers: 0, totalDealsSaved: 0, summaryData: [] };
        }
        const groceryFlyers = jsonResponse.flyers.filter((flyer) => {
            const merchant = flyer.merchant;
            let categories = flyer.categories || [];
            if (typeof categories === 'string') {
                categories = categories.split(',').map((c) => c.trim());
            }
            const assignedCategory = STORE_TO_CATEGORY.get(merchant);
            return assignedCategory !== undefined && categories.includes(assignedCategory);
        });
        if (groceryFlyers.length === 0) {
            return { success: true, processedFlyers: 0, totalDealsSaved: 0, summaryData: [] };
        }
        let totalDealsSaved = 0;
        let processedFlyers = 0;
        const summaryData = [];
        for (const flyer of groceryFlyers) {
            const flyerId = flyer.id.toString();
            const itemsUrl = FLYER_ITEMS_URL.replace('{}', flyerId).replace('{}', generateSid());
            const itemsResponse = await fetch(itemsUrl);
            if (!itemsResponse.ok) {
                v1_1.logger.warn(`Failed to fetch items for flyer ${flyerId}`);
                continue;
            }
            const itemsData = await itemsResponse.json();
            const flyerRef = db.collection('public_flyers').doc(flyerId);
            const flyerMetadata = {
                id: flyerId,
                title: flyer.name || 'Weekly Savings',
                retailer: flyer.merchant,
                validFrom: flyer.valid_from ? flyer.valid_from.split('T')[0] : null,
                validTo: flyer.valid_to ? flyer.valid_to.split('T')[0] : null,
                pages: flyer.pages || 0,
                dealsCount: itemsData.length,
                ingestedAt: admin.firestore.FieldValue.serverTimestamp(),
                postalCode: cleanPostalCode
            };
            const dealsToWrite = itemsData
                .filter((item) => item.name)
                .map((item) => {
                var _a;
                const dealId = item.id ? item.id.toString() : Math.random().toString(36).substring(7);
                const dealRef = flyerRef.collection('deals').doc(dealId);
                return {
                    ref: dealRef,
                    data: {
                        id: dealId,
                        flyerId: flyerId,
                        retailer: flyer.merchant,
                        category: (_a = STORE_TO_CATEGORY.get(flyer.merchant)) !== null && _a !== void 0 ? _a : 'Groceries',
                        name: item.name,
                        description: item.description || null,
                        brand: item.brand || null,
                        currentPrice: item.price || item.current_price || null,
                        originalPrice: item.original_price || null,
                        prePriceText: item.pre_price_text || null,
                        postPriceText: item.post_price_text || null,
                        priceText: item.price_text || null,
                        validFrom: item.valid_from || flyer.valid_from,
                        validTo: item.valid_to || flyer.valid_to,
                        imageUrl: item.cutout_image_url || null,
                        ingestedAt: admin.firestore.FieldValue.serverTimestamp()
                    }
                };
            });
            const operations = [{ ref: flyerRef, data: flyerMetadata }, ...dealsToWrite];
            const chunks = chunkArray(operations, 400);
            for (const chunk of chunks) {
                const batch = db.batch();
                for (const op of chunk) {
                    batch.set(op.ref, op.data, { merge: true });
                }
                await batch.commit();
            }
            processedFlyers++;
            totalDealsSaved += dealsToWrite.length;
            summaryData.push({ retailer: flyer.merchant, dealsCount: dealsToWrite.length });
            // Fire-and-forget: index deals into flat time-series collection for predictive analytics
            (0, indexFlyerDeals_1.indexFlyerDeals)(flyerId).catch(err => v1_1.logger.error(`[indexFlyerDeals] Failed for flyer ${flyerId}:`, err));
        }
        // Generate static JSON export of all active deals for zero-read client comparison
        v1_1.logger.info("Generating static JSON export of all active deals...");
        const flyersSnapshot = await db.collection('public_flyers').get();
        const allDeals = [];
        for (const flyerDoc of flyersSnapshot.docs) {
            const dealsSnapshot = await flyerDoc.ref.collection('deals').get();
            dealsSnapshot.forEach(doc => {
                allDeals.push(Object.assign(Object.assign({}, doc.data()), { flyerId: flyerDoc.id }));
            });
        }
        try {
            const bucket = admin.storage().bucket('spendigo-8540c.firebasestorage.app');
            const file = bucket.file('public/active_deals.json');
            await file.save(JSON.stringify(allDeals), {
                contentType: 'application/json',
                metadata: {
                    cacheControl: 'public, max-age=60' // Reduced from 3600s to 60s for faster updates
                }
            });
            await file.makePublic();
            v1_1.logger.info(`Successfully exported ${allDeals.length} deals to Storage.`);
        }
        catch (storageError) {
            v1_1.logger.error("Failed to upload active_deals.json to storage:", storageError);
            // Non-fatal error, we still want to return success for ingestion
        }
        return {
            success: true,
            processedFlyers,
            totalDealsSaved,
            summaryData
        };
    }
    catch (error) {
        v1_1.logger.error('Error in runIngestion:', error);
        throw error;
    }
}
//# sourceMappingURL=flippScraper.js.map