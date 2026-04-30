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
exports.syncMerchantProductToAlgolia = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const algoliasearch_1 = require("algoliasearch");
const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY;
// We now sync to a new index: merchant_products
const ALGOLIA_INDEX_NAME = process.env.ALGOLIA_MERCHANT_INDEX_NAME || 'merchant_products';
// Initialize Algolia client
const algoliaClient = (ALGOLIA_APP_ID && ALGOLIA_API_KEY)
    ? (0, algoliasearch_1.algoliasearch)(ALGOLIA_APP_ID, ALGOLIA_API_KEY)
    : null;
exports.syncMerchantProductToAlgolia = functions.firestore
    .document('merchant_products/{merchantProductId}')
    .onWrite(async (change, context) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (!algoliaClient) {
        functions.logger.warn('Algolia Sync skipped: ALGOLIA_APP_ID or ALGOLIA_API_KEY is not set.');
        return null;
    }
    const { merchantProductId } = context.params;
    // Handle document deletion
    if (!change.after.exists) {
        try {
            await algoliaClient.deleteObject({
                indexName: ALGOLIA_INDEX_NAME,
                objectID: merchantProductId
            });
            functions.logger.info(`Deleted ${merchantProductId} from Algolia index ${ALGOLIA_INDEX_NAME}.`);
        }
        catch (error) {
            functions.logger.error(`Error deleting ${merchantProductId} from Algolia:`, error);
        }
        return null;
    }
    const data = change.after.data();
    // If it's no longer active, remove it from search
    if ((data === null || data === void 0 ? void 0 : data.is_active) === false || (data === null || data === void 0 ? void 0 : data.available_quantity) <= 0) {
        try {
            await algoliaClient.deleteObject({
                indexName: ALGOLIA_INDEX_NAME,
                objectID: merchantProductId
            });
            functions.logger.info(`Removed inactive/out-of-stock ${merchantProductId} from Algolia index ${ALGOLIA_INDEX_NAME}.`);
        }
        catch (error) {
            functions.logger.error(`Error removing ${merchantProductId} from Algolia:`, error);
        }
        return null;
    }
    // We only proceed if we have valid references
    if (!(data === null || data === void 0 ? void 0 : data.merchant_id) || !(data === null || data === void 0 ? void 0 : data.master_product_id)) {
        functions.logger.warn(`Missing merchant_id or master_product_id for ${merchantProductId}`);
        return null;
    }
    try {
        const db = admin.firestore();
        // Fetch the Master Product and Store concurrently
        const [masterDoc, storeDoc] = await Promise.all([
            db.collection('master_products').doc(data.master_product_id).get(),
            db.collection('stores').doc(data.merchant_id).get()
        ]);
        if (!masterDoc.exists || !storeDoc.exists) {
            functions.logger.warn(`Could not sync ${merchantProductId}: Missing Master Product or Store document.`);
            return null;
        }
        const masterData = masterDoc.data();
        const storeData = storeDoc.data();
        // Only add GPS data if store has location coordinates
        let geoloc = null;
        if (((_a = storeData === null || storeData === void 0 ? void 0 : storeData.coordinates) === null || _a === void 0 ? void 0 : _a.lat) && ((_b = storeData === null || storeData === void 0 ? void 0 : storeData.coordinates) === null || _b === void 0 ? void 0 : _b.lng)) {
            geoloc = {
                lat: storeData.coordinates.lat,
                lng: storeData.coordinates.lng
            };
        }
        else if (((_c = storeData === null || storeData === void 0 ? void 0 : storeData.location) === null || _c === void 0 ? void 0 : _c.lat) && ((_d = storeData === null || storeData === void 0 ? void 0 : storeData.location) === null || _d === void 0 ? void 0 : _d.lng)) {
            geoloc = {
                lat: storeData.location.lat,
                lng: storeData.location.lng
            };
        }
        else if (((_e = storeData === null || storeData === void 0 ? void 0 : storeData.geoloc) === null || _e === void 0 ? void 0 : _e.latitude) && ((_f = storeData === null || storeData === void 0 ? void 0 : storeData.geoloc) === null || _f === void 0 ? void 0 : _f.longitude)) {
            // Some schemas use .latitude instead of .lat
            geoloc = {
                lat: storeData.geoloc.latitude,
                lng: storeData.geoloc.longitude
            };
        }
        let displayPrice = Number(data.price || 0);
        let discountLabel = data.discount_label;
        const validUntil = data.discount_valid_until;
        if (validUntil && new Date(validUntil) < new Date()) {
            // Revert to original_price if expired
            if (data.original_price && Number(data.original_price) > 0) {
                displayPrice = Number(data.original_price);
                discountLabel = null;
            }
        }
        const algoliaPayload = {
            objectID: merchantProductId,
            merchant_product_id: merchantProductId,
            merchant_id: data.merchant_id,
            master_product_id: data.master_product_id,
            // Merchant Specific Data
            price: displayPrice,
            original_price: displayPrice < Number(data.original_price || 0) ? data.original_price : null,
            available_quantity: data.available_quantity || 0,
            merchant_sku: data.merchant_sku || '',
            discount_label: discountLabel || '',
            discount_valid_until: validUntil || null,
            // Master Catalog Normalized Data
            product_name: (masterData === null || masterData === void 0 ? void 0 : masterData.product_name) || '',
            brand_name: (masterData === null || masterData === void 0 ? void 0 : masterData.brand_name) || '',
            short_description: (masterData === null || masterData === void 0 ? void 0 : masterData.short_description) || '',
            category_id: (masterData === null || masterData === void 0 ? void 0 : masterData.category_id) || '',
            dietary_tags: (masterData === null || masterData === void 0 ? void 0 : masterData.dietary_tags) || [],
            upc_gtin: (masterData === null || masterData === void 0 ? void 0 : masterData.upc_gtin) || '',
            barcode: (masterData === null || masterData === void 0 ? void 0 : masterData.barcode) || '',
            primary_image_url: (masterData === null || masterData === void 0 ? void 0 : masterData.primary_image_url) || '',
            // Geo-Spatial Data
            _geoloc: geoloc,
            // Highlighting
            is_canadian_local: (_h = (_g = data === null || data === void 0 ? void 0 : data.is_canadian_local) !== null && _g !== void 0 ? _g : masterData === null || masterData === void 0 ? void 0 : masterData.is_canadian_local) !== null && _h !== void 0 ? _h : false,
            // Meta
            updated_at: Date.now()
        };
        await algoliaClient.saveObject({
            indexName: ALGOLIA_INDEX_NAME,
            body: algoliaPayload
        });
        functions.logger.info(`Saved ${merchantProductId} to Algolia index ${ALGOLIA_INDEX_NAME} with Geoloc.`);
    }
    catch (error) {
        functions.logger.error(`Error saving ${merchantProductId} to Algolia:`, error);
    }
    return null;
});
//# sourceMappingURL=algoliaMerchantTriggers.js.map