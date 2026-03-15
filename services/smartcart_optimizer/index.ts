import type {
    SmartCartOptimizedCart,
    SmartCartOptimizedItem,
    SmartCartStoreData,
} from '../api/src/smartcart/types';
import type { MerchantProductRecord } from '../api/src/models/catalog';
import { normalizeUnitPrice } from '../api/src/smartcart/priceNormalization';

function compare_offers(
    left: { store_id: string; inventory: MerchantProductRecord; unit_price: number },
    right: { store_id: string; inventory: MerchantProductRecord; unit_price: number },
): number {
    if (left.unit_price !== right.unit_price) {
        return left.unit_price - right.unit_price;
    }

    if (left.inventory.price !== right.inventory.price) {
        return left.inventory.price - right.inventory.price;
    }

    return left.store_id.localeCompare(right.store_id);
}

function get_inventory_package_size(inventory: MerchantProductRecord): string | null {
    const packageSize = inventory.package_size ?? inventory.unit_size ?? inventory.net_quantity_unit ?? null;
    return typeof packageSize === 'string' && packageSize.trim().length > 0 ? packageSize.trim() : null;
}

function find_available_offers(
    product_id: string,
    store_data: SmartCartStoreData[],
): Array<{ store_id: string; inventory: MerchantProductRecord; unit_price: number }> {
    return store_data.flatMap(store => {
        return store.inventory
            .filter(product =>
                product.master_product_id === product_id &&
                product.available_quantity > 0 &&
                product.is_active !== false &&
                Number.isFinite(product.price),
            )
            .map(inventory => {
                const packageSize = get_inventory_package_size(inventory);
                const unit_price = packageSize ? normalizeUnitPrice(inventory.price, packageSize) : null;

                return unit_price === null
                    ? null
                    : {
                        store_id: store.store.id,
                        inventory,
                        unit_price,
                    };
            })
            .filter((offer): offer is { store_id: string; inventory: MerchantProductRecord; unit_price: number } => Boolean(offer));
    });
}

export function optimize_cart(
    shopping_list: string[],
    store_data: SmartCartStoreData[],
): SmartCartOptimizedCart {
    const optimized_items: SmartCartOptimizedItem[] = [];
    const store_distribution: Record<string, string[]> = {};

    shopping_list.forEach(product_id => {
        const available_offers = find_available_offers(product_id, store_data).sort(compare_offers);

        if (available_offers.length === 0) {
            throw new Error(`Product "${product_id}" is unavailable in all eligible stores.`);
        }

        const selected_offer = available_offers[0];

        optimized_items.push({
            product_id,
            chosen_store: selected_offer.store_id,
            price: selected_offer.inventory.price,
            unit_price: selected_offer.unit_price,
        });

        if (!store_distribution[selected_offer.store_id]) {
            store_distribution[selected_offer.store_id] = [];
        }

        store_distribution[selected_offer.store_id].push(product_id);
    });

    return {
        optimized_items,
        total_cost: Math.round(optimized_items.reduce((sum, item) => sum + item.unit_price, 0) * 10000) / 10000,
        store_distribution,
    };
}
