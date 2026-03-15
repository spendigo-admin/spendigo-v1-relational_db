import { normalizeUnitPrice } from './priceNormalization';
import { MerchantProductRecord } from '../models/catalog';
import { SmartCartStoreData } from './types';

export type SmartCartPriceMatrix = Record<string, Record<string, number>>;

function getInventoryPackageSize(inventory: MerchantProductRecord): string | null {
    const packageSize = inventory.package_size ?? inventory.unit_size ?? inventory.net_quantity_unit ?? null;
    return typeof packageSize === 'string' && packageSize.trim().length > 0 ? packageSize.trim() : null;
}

export function buildPriceMatrix(
    normalizedProducts: string[],
    storeProductData: SmartCartStoreData[],
): SmartCartPriceMatrix {
    const matrix: SmartCartPriceMatrix = {};

    normalizedProducts.forEach(productId => {
        matrix[productId] = {};
    });

    storeProductData.forEach(store => {
        store.inventory.forEach(product => {
            if (product.available_quantity <= 0 || product.is_active === false) {
                return;
            }

            if (!matrix[product.master_product_id]) {
                return;
            }

            const packageSize = getInventoryPackageSize(product);
            const normalizedUnitPrice = packageSize ? normalizeUnitPrice(product.price, packageSize) : null;

            if (normalizedUnitPrice === null) {
                return;
            }

            const currentPrice = matrix[product.master_product_id][store.store.id];

            if (currentPrice === undefined || normalizedUnitPrice < currentPrice) {
                matrix[product.master_product_id][store.store.id] = normalizedUnitPrice;
            }
        });
    });

    return matrix;
}
