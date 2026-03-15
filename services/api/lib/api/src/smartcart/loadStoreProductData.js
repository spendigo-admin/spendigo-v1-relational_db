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
exports.getRequestedStoreIds = getRequestedStoreIds;
exports.normalizeRequestedProducts = normalizeRequestedProducts;
exports.loadStoreProductData = loadStoreProductData;
const admin = __importStar(require("firebase-admin"));
const crypto_1 = require("crypto");
const db = admin.firestore();
function getRequestedStoreIds(storeFilter) {
    var _a;
    if (!storeFilter) {
        return null;
    }
    if (Array.isArray(storeFilter)) {
        return storeFilter.filter((value) => typeof value === 'string' && value.length > 0);
    }
    return ((_a = storeFilter.store_ids) !== null && _a !== void 0 ? _a : []).filter((value) => typeof value === 'string' && value.length > 0);
}
function chunk(values, size) {
    const chunks = [];
    for (let index = 0; index < values.length; index += size) {
        chunks.push(values.slice(index, index + size));
    }
    return chunks;
}
function getPackageSize(data) {
    var _a, _b, _c;
    const packageSize = (_c = (_b = (_a = data.unit_size) !== null && _a !== void 0 ? _a : data.net_quantity_unit) !== null && _b !== void 0 ? _b : data.package_size) !== null && _c !== void 0 ? _c : null;
    return typeof packageSize === 'string' && packageSize.trim().length > 0 ? packageSize.trim() : null;
}
function normalizeRequestedProducts(shoppingList) {
    if (!Array.isArray(shoppingList) || shoppingList.length === 0) {
        throw new Error('shopping_list must be a non-empty array.');
    }
    const normalized = shoppingList
        .filter((value) => typeof value === 'string')
        .map(value => value.trim())
        .filter(value => value.length > 0);
    return Array.from(new Set(normalized));
}
async function loadStoreProductData(shoppingList, storeFilter) {
    const requestedStoreIds = getRequestedStoreIds(storeFilter);
    const productChunks = chunk(shoppingList, 30);
    const merchantProducts = [];
    for (const productChunk of productChunks) {
        const snapshot = await db
            .collection('merchant_products')
            .where('master_product_id', 'in', productChunk)
            .get();
        snapshot.forEach(doc => {
            merchantProducts.push({ id: doc.id, data: doc.data() });
        });
    }
    const filteredMerchantProducts = merchantProducts.filter(({ data }) => {
        if (requestedStoreIds && !requestedStoreIds.includes(String(data.merchant_id))) {
            return false;
        }
        return true;
    });
    const storeIds = Array.from(new Set(filteredMerchantProducts.map(({ data }) => String(data.merchant_id))));
    const stores = await Promise.all(storeIds.map(storeId => db.collection('stores').doc(storeId).get()));
    const storeMap = new Map();
    stores.forEach(storeDoc => {
        if (!storeDoc.exists) {
            return;
        }
        const data = storeDoc.data();
        if (!data) {
            return;
        }
        if (data.status && data.status !== 'active') {
            return;
        }
        storeMap.set(storeDoc.id, data);
    });
    const grouped = new Map();
    const signatureParts = [];
    filteredMerchantProducts.forEach(({ id, data }) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        const storeId = String(data.merchant_id);
        const store = storeMap.get(storeId);
        if (!store) {
            return;
        }
        const availableQuantity = Number((_a = data.available_quantity) !== null && _a !== void 0 ? _a : 0);
        const packageSize = getPackageSize(data);
        const updatedAt = (_l = (_j = (_g = (_d = (_c = (_b = data.updated_at) === null || _b === void 0 ? void 0 : _b.toMillis) === null || _c === void 0 ? void 0 : _c.call(_b)) !== null && _d !== void 0 ? _d : (_f = (_e = data.updatedAt) === null || _e === void 0 ? void 0 : _e.toMillis) === null || _f === void 0 ? void 0 : _f.call(_e)) !== null && _g !== void 0 ? _g : (_h = data.updated_at) === null || _h === void 0 ? void 0 : _h._seconds) !== null && _j !== void 0 ? _j : (_k = data.updatedAt) === null || _k === void 0 ? void 0 : _k._seconds) !== null && _l !== void 0 ? _l : '';
        signatureParts.push([
            id,
            storeId,
            String(data.master_product_id),
            Number(data.price).toFixed(4),
            String(availableQuantity),
            packageSize !== null && packageSize !== void 0 ? packageSize : '',
            data.is_active === false ? 'inactive' : 'active',
            String(updatedAt),
        ].join('|'));
        if (!grouped.has(storeId)) {
            const storeRecord = {
                id: storeId,
                name: String((_m = store.name) !== null && _m !== void 0 ? _m : storeId),
                status: store.status,
                province: store.province,
                address: typeof store.address === 'string' ? store.address : undefined,
                location: store.location,
                deliveryFee: store.deliveryFee,
                freeDeliveryThreshold: store.freeDeliveryThreshold,
                pickupEnabled: store.pickupEnabled,
                deliveryEnabled: store.deliveryEnabled,
                updatedAt: store.updatedAt,
            };
            grouped.set(storeId, {
                store: storeRecord,
                inventory: [],
            });
        }
        const inventoryRecord = {
            id,
            merchant_product_id: String((_o = data.merchant_product_id) !== null && _o !== void 0 ? _o : id),
            merchant_id: storeId,
            master_product_id: String(data.master_product_id),
            price: Number(data.price),
            currency: String((_p = data.currency) !== null && _p !== void 0 ? _p : 'CAD'),
            available_quantity: availableQuantity,
            merchant_sku: data.merchant_sku,
            original_price: data.original_price,
            discount_label: data.discount_label,
            is_active: data.is_active,
            product_name: data.product_name,
            brand: data.brand,
            unit_size: data.unit_size,
            net_quantity_unit: data.net_quantity_unit,
            package_size: packageSize !== null && packageSize !== void 0 ? packageSize : undefined,
            updated_at: data.updated_at,
            updatedAt: data.updatedAt,
        };
        (_q = grouped.get(storeId)) === null || _q === void 0 ? void 0 : _q.inventory.push(inventoryRecord);
    });
    signatureParts.sort();
    return {
        storeProductData: Array.from(grouped.values()),
        dataSignature: (0, crypto_1.createHash)('sha256').update(signatureParts.join('||')).digest('hex'),
    };
}
//# sourceMappingURL=loadStoreProductData.js.map