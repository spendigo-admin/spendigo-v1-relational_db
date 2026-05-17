import { normalizeUnitPrice } from './priceNormalization';
import { MerchantProductRecord } from '../models/catalog';
import { SmartCartOptimizedCart, SmartCartOptimizedItem, SmartCartStoreData } from './types';

function getBestOffer(
    productId: string,
    inventory: MerchantProductRecord[],
): { price: number; unitPrice: number } | null {
    let best: { price: number; unitPrice: number } | null = null;

    for (const product of inventory) {
        if (
            product.master_product_id !== productId ||
            product.available_quantity <= 0 ||
            product.is_active === false
        ) {
            continue;
        }

        const packageSize = product.package_size ?? product.unit_size ?? product.net_quantity_unit ?? null;
        const unitPrice = typeof packageSize === 'string' && packageSize.trim().length > 0
            ? normalizeUnitPrice(product.price, packageSize)
            : null;

        if (unitPrice === null) continue;

        if (best === null || unitPrice < best.unitPrice) {
            best = { price: product.price, unitPrice };
        }
    }

    return best;
}

export function optimizeCart(
    shoppingList: string[],
    storeProducts: SmartCartStoreData[],
): SmartCartOptimizedCart {
    const optimizedItems: SmartCartOptimizedItem[] = [];
    const storeDistribution: Record<string, string[]> = {};
    let totalCost = 0;

    for (const productId of shoppingList) {
        let bestStoreId: string | null = null;
        let bestPrice = 0;
        let bestUnitPrice = Infinity;

        for (const { store, inventory } of storeProducts) {
            const offer = getBestOffer(productId, inventory);
            if (offer && offer.unitPrice < bestUnitPrice) {
                bestStoreId = store.id;
                bestPrice = offer.price;
                bestUnitPrice = offer.unitPrice;
            }
        }

        if (bestStoreId !== null) {
            optimizedItems.push({
                product_id: productId,
                chosen_store: bestStoreId,
                price: bestPrice,
                unit_price: bestUnitPrice,
            });
            totalCost += bestUnitPrice;

            if (!storeDistribution[bestStoreId]) {
                storeDistribution[bestStoreId] = [];
            }
            storeDistribution[bestStoreId].push(productId);
        }
    }

    return {
        optimized_items: optimizedItems,
        total_cost: Math.round(totalCost * 10000) / 10000,
        store_distribution: storeDistribution,
    };
}
