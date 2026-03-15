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
exports.buildSmartCartCacheKey = buildSmartCartCacheKey;
exports.getCachedOptimizationResult = getCachedOptimizationResult;
exports.setCachedOptimizationResult = setCachedOptimizationResult;
const admin = __importStar(require("firebase-admin"));
const crypto_1 = require("crypto");
const db = admin.firestore();
const CACHE_COLLECTION = 'smartcart_optimizer_cache';
const CACHE_TTL_MS = 10 * 60 * 1000;
function buildSmartCartCacheKey(shoppingList, storeIds) {
    const normalizedShoppingList = [...shoppingList].sort();
    const normalizedStoreIds = storeIds ? [...storeIds].sort() : ['ALL_STORES'];
    const payload = JSON.stringify({
        shopping_list: normalizedShoppingList,
        store_ids: normalizedStoreIds,
    });
    return (0, crypto_1.createHash)('sha256').update(payload).digest('hex');
}
async function getCachedOptimizationResult(cacheKey, dataSignature) {
    const snapshot = await db.collection(CACHE_COLLECTION).doc(cacheKey).get();
    if (!snapshot.exists) {
        return null;
    }
    const data = snapshot.data();
    if (!data) {
        return null;
    }
    const isExpired = data.expiresAt.toMillis() <= Date.now();
    if (isExpired || data.dataSignature !== dataSignature) {
        return null;
    }
    return data.response;
}
async function setCachedOptimizationResult(cacheKey, dataSignature, response) {
    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + CACHE_TTL_MS);
    const document = {
        cacheKey,
        dataSignature,
        response,
        createdAt: now,
        expiresAt,
    };
    await db.collection(CACHE_COLLECTION).doc(cacheKey).set(document);
}
//# sourceMappingURL=cache.js.map