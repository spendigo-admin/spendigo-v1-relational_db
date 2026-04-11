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
exports.syncMasterProductToAlgolia = void 0;
const functions = __importStar(require("firebase-functions"));
const algoliasearch_1 = require("algoliasearch");
const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY;
const ALGOLIA_INDEX_NAME = process.env.ALGOLIA_INDEX_NAME || 'master_products';
// Initialize Algolia client only if credentials are provided
const algoliaClient = (ALGOLIA_APP_ID && ALGOLIA_API_KEY)
    ? (0, algoliasearch_1.algoliasearch)(ALGOLIA_APP_ID, ALGOLIA_API_KEY)
    : null;
exports.syncMasterProductToAlgolia = functions.firestore
    .document('master_products/{productId}')
    .onWrite(async (change, context) => {
    if (!algoliaClient) {
        functions.logger.warn('Algolia Sync skipped: ALGOLIA_APP_ID or ALGOLIA_API_KEY is not set.');
        return null;
    }
    const { productId } = context.params;
    // Handle document deletion
    if (!change.after.exists) {
        try {
            await algoliaClient.deleteObject({
                indexName: ALGOLIA_INDEX_NAME,
                objectID: productId
            });
            functions.logger.info(`Deleted ${productId} from Algolia index ${ALGOLIA_INDEX_NAME}.`);
        }
        catch (error) {
            functions.logger.error(`Error deleting ${productId} from Algolia:`, error);
        }
        return null;
    }
    // Handle document creation or update
    const data = change.after.data();
    // Select the fields we want to index
    const algoliaPayload = {
        objectID: productId,
        product_name: (data === null || data === void 0 ? void 0 : data.product_name) || '',
        brand: (data === null || data === void 0 ? void 0 : data.brand) || '',
        description: (data === null || data === void 0 ? void 0 : data.description) || '',
        category: (data === null || data === void 0 ? void 0 : data.category) || '',
        tags: (data === null || data === void 0 ? void 0 : data.tags) || [],
        barcode: (data === null || data === void 0 ? void 0 : data.barcode) || '',
        upc_gtin: (data === null || data === void 0 ? void 0 : data.upc_gtin) || '',
        primary_image_url: (data === null || data === void 0 ? void 0 : data.primary_image_url) || '',
        age_restricted: (data === null || data === void 0 ? void 0 : data.age_restricted) || false,
        is_canadian_local: (data === null || data === void 0 ? void 0 : data.is_canadian_local) || false,
        // Optional: Add a timestamp field for sorting
        updated_at: Date.now()
    };
    try {
        await algoliaClient.saveObject({
            indexName: ALGOLIA_INDEX_NAME,
            body: algoliaPayload
        });
        functions.logger.info(`Saved ${productId} to Algolia index ${ALGOLIA_INDEX_NAME}.`);
    }
    catch (error) {
        functions.logger.error(`Error saving ${productId} to Algolia:`, error);
    }
    return null;
});
//# sourceMappingURL=algoliaTriggers.js.map