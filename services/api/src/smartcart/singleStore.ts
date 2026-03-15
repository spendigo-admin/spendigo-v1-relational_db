import { MerchantProductRecord } from '../models/catalog';
import { normalizeUnitPrice } from './priceNormalization';
import { SmartCartSingleStoreOption, SmartCartStoreData } from './types';

function getBestAvailableStoreOffer(
    productId: string,
    products: MerchantProductRecord[],
): { inventory: MerchantProductRecord; unitPrice: number } | null {
    const matchingOffers = products
        .filter(product =>
            product.master_product_id === productId &&
            product.available_quantity > 0 &&
            product.is_active !== false,
        )
        .map(product => {
            const packageSize = product.package_size ?? product.unit_size ?? product.net_quantity_unit ?? null;
            const unitPrice = packageSize ? normalizeUnitPrice(product.price, packageSize) : null;

            return unitPrice === null ? null : { inventory: product, unitPrice };
        })
        .filter((product): product is { inventory: MerchantProductRecord; unitPrice: number } => Boolean(product));

    if (matchingOffers.length === 0) {
        return null;
    }

    return matchingOffers.reduce((best, candidate) => {
        if (candidate.unitPrice < best.unitPrice) {
            return candidate;
        }

        if (candidate.unitPrice === best.unitPrice && candidate.inventory.price < best.inventory.price) {
            return candidate;
        }

        return best;
    });
}

export function simulateSingleStoreCart(
    shoppingList: string[],
    storeProductData: SmartCartStoreData,
): SmartCartSingleStoreOption {
    const missing_items: string[] = [];
    let cart_cost = 0;

    shoppingList.forEach(productId => {
        const offer = getBestAvailableStoreOffer(productId, storeProductData.inventory);

        if (!offer) {
            missing_items.push(productId);
            return;
        }

        cart_cost += offer.unitPrice;
    });

    return {
        store_id: storeProductData.store.id,
        store_name: storeProductData.store.name,
        cart_cost: missing_items.length === 0 ? cart_cost : null,
        missing_items,
    };
}

export function findBestSingleStoreOption(
    shoppingList: string[],
    storeProducts: SmartCartStoreData[],
): SmartCartSingleStoreOption | null {
    const options = storeProducts.map(store => simulateSingleStoreCart(shoppingList, store));
    const feasible = options.filter(option => option.cart_cost !== null);

    if (feasible.length === 0) {
        return null;
    }

    return feasible.reduce((best, candidate) => {
        if ((candidate.cart_cost ?? Number.POSITIVE_INFINITY) < (best.cart_cost ?? Number.POSITIVE_INFINITY)) {
            return candidate;
        }

        if (candidate.cart_cost === best.cart_cost) {
            return candidate.store_id.localeCompare(best.store_id) < 0 ? candidate : best;
        }

        return best;
    });
}
