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
exports.scrapeFlyer = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const FLYERS_URL = 'https://flyers-ng.flippback.com/api/flipp/data?locale=en&postal_code={}&sid={}';
const FLYER_ITEMS_URL = 'https://flyers-ng.flippback.com/api/flipp/flyers/{}/flyer_items?locale=en&sid={}';
const GROCERY_STORES = new Set([
    'No Frills', 'FreshCo', 'Walmart', 'Loblaws', 'Real Canadian Superstore', 'Sobeys', 'Metro', 'Food Basics', 'Your Independent Grocer', 'Independent Grocers'
]);
function generateSid() {
    return Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join('');
}
// Helper to chunk arrays
function chunkArray(array, size) {
    const chunked_arr = [];
    let index = 0;
    while (index < array.length) {
        chunked_arr.push(array.slice(index, size + index));
        index += size;
    }
    return chunked_arr;
}
exports.scrapeFlyer = functions.https.onCall(async (data, context) => {
    var _a;
    // Basic Authentication Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    // Check Admin Role
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    if (((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can trigger ingestion.');
    }
    const { postalCode } = data;
    if (!postalCode || typeof postalCode !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Valid postal code is required.');
    }
    const cleanPostalCode = postalCode.replace(/\s+/g, '').toUpperCase();
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
            return GROCERY_STORES.has(merchant) && categories.includes('Groceries');
        });
        if (groceryFlyers.length === 0) {
            return { success: true, processedFlyers: 0, totalDealsSaved: 0, summaryData: [] };
        }
        let totalDealsSaved = 0;
        let processedFlyers = 0;
        const summaryData = [];
        // Iterate through all matched grocery flyers
        for (const flyer of groceryFlyers) {
            const flyerId = flyer.id.toString();
            const itemsUrl = FLYER_ITEMS_URL.replace('{}', flyerId).replace('{}', generateSid());
            const itemsResponse = await fetch(itemsUrl);
            if (!itemsResponse.ok) {
                console.warn(`Failed to fetch items for flyer ${flyerId}`);
                continue;
            }
            const itemsData = await itemsResponse.json();
            // Build Flyer Metadata
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
            // Prepare Deals data
            const dealsToWrite = itemsData
                .filter((item) => item.name) // Ensure it has a name
                .map((item) => {
                const dealId = item.id ? item.id.toString() : Math.random().toString(36).substring(7);
                const dealRef = flyerRef.collection('deals').doc(dealId);
                return {
                    ref: dealRef,
                    data: {
                        id: dealId,
                        flyerId: flyerId,
                        retailer: flyer.merchant,
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
            // Write to Firestore in chunks (max 400 operations per batch to be safe)
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
            summaryData.push({
                retailer: flyer.merchant,
                dealsCount: dealsToWrite.length
            });
        }
        return {
            success: true,
            processedFlyers,
            totalDealsSaved,
            summaryData
        };
    }
    catch (error) {
        console.error('Error fetching flyers:', error);
        throw new functions.https.HttpsError('internal', 'Failed to fetch flyers: ' + error.message);
    }
});
//# sourceMappingURL=scrapeFlyer.js.map