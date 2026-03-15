import { buildSmartCartCacheKey, getCachedOptimizationResult, setCachedOptimizationResult } from './cache';
import { buildPriceMatrix, SmartCartPriceMatrix } from './priceMatrix';
import { getRequestedStoreIds, loadStoreProductData, normalizeRequestedProducts } from './loadStoreProductData';
import { optimizeCart } from './optimizer';
import { findBestSingleStoreOption } from './singleStore';
import { SmartCartOptimizeRequestBody, SmartCartOptimizeResponse } from './types';

export interface SmartCartOptimizationServiceResult {
    response: SmartCartOptimizeResponse;
    priceMatrix: SmartCartPriceMatrix;
}

export async function optimizeSmartCartService(
    requestBody: SmartCartOptimizeRequestBody,
): Promise<SmartCartOptimizationServiceResult> {
    const normalizedProducts = normalizeRequestedProducts(requestBody.shopping_list);
    const requestedStoreIds = getRequestedStoreIds(requestBody.store_filter);
    const cacheKey = buildSmartCartCacheKey(normalizedProducts, requestedStoreIds);
    const { storeProductData, dataSignature } = await loadStoreProductData(normalizedProducts, requestBody.store_filter);
    const cachedResponse = await getCachedOptimizationResult(cacheKey, dataSignature);
    const priceMatrix = buildPriceMatrix(normalizedProducts, storeProductData);

    if (cachedResponse) {
        return {
            response: cachedResponse,
            priceMatrix,
        };
    }

    const optimizedCart = optimizeCart(normalizedProducts, storeProductData);
    const bestSingleStoreOption = findBestSingleStoreOption(normalizedProducts, storeProductData);
    const savings = bestSingleStoreOption?.cart_cost !== null && bestSingleStoreOption?.cart_cost !== undefined
        ? bestSingleStoreOption.cart_cost - optimizedCart.total_cost
        : null;

    const response: SmartCartOptimizeResponse = {
        optimized_cart: optimizedCart.optimized_items,
        store_breakdown: optimizedCart.store_distribution,
        total_cost: optimizedCart.total_cost,
        best_single_store_option: bestSingleStoreOption,
        savings,
    };

    await setCachedOptimizationResult(cacheKey, dataSignature, response);

    return {
        response,
        priceMatrix,
    };
}
