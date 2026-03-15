"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimizeSmartCartService = optimizeSmartCartService;
const cache_1 = require("./cache");
const priceMatrix_1 = require("./priceMatrix");
const loadStoreProductData_1 = require("./loadStoreProductData");
const optimizer_1 = require("./optimizer");
const singleStore_1 = require("./singleStore");
async function optimizeSmartCartService(requestBody) {
    const normalizedProducts = (0, loadStoreProductData_1.normalizeRequestedProducts)(requestBody.shopping_list);
    const requestedStoreIds = (0, loadStoreProductData_1.getRequestedStoreIds)(requestBody.store_filter);
    const cacheKey = (0, cache_1.buildSmartCartCacheKey)(normalizedProducts, requestedStoreIds);
    const { storeProductData, dataSignature } = await (0, loadStoreProductData_1.loadStoreProductData)(normalizedProducts, requestBody.store_filter);
    const cachedResponse = await (0, cache_1.getCachedOptimizationResult)(cacheKey, dataSignature);
    const priceMatrix = (0, priceMatrix_1.buildPriceMatrix)(normalizedProducts, storeProductData);
    if (cachedResponse) {
        return {
            response: cachedResponse,
            priceMatrix,
        };
    }
    const optimizedCart = (0, optimizer_1.optimizeCart)(normalizedProducts, storeProductData);
    const bestSingleStoreOption = (0, singleStore_1.findBestSingleStoreOption)(normalizedProducts, storeProductData);
    const savings = (bestSingleStoreOption === null || bestSingleStoreOption === void 0 ? void 0 : bestSingleStoreOption.cart_cost) !== null && (bestSingleStoreOption === null || bestSingleStoreOption === void 0 ? void 0 : bestSingleStoreOption.cart_cost) !== undefined
        ? bestSingleStoreOption.cart_cost - optimizedCart.total_cost
        : null;
    const response = {
        optimized_cart: optimizedCart.optimized_items,
        store_breakdown: optimizedCart.store_distribution,
        total_cost: optimizedCart.total_cost,
        best_single_store_option: bestSingleStoreOption,
        savings,
    };
    await (0, cache_1.setCachedOptimizationResult)(cacheKey, dataSignature, response);
    return {
        response,
        priceMatrix,
    };
}
//# sourceMappingURL=optimizeSmartCart.js.map