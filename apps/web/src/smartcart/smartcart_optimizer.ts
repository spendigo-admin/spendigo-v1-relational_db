export interface SmartCartOptimizerProductOffer {
    product_id: string;
    price: number;
    package_size: string;
    unit_price: number;
    available: boolean;
}

export interface SmartCartOptimizerStoreEntry {
    store_id: string;
    products: SmartCartOptimizerProductOffer[];
}

export interface SmartCartOptimizedItem {
    product_id: string;
    chosen_store: string;
    price: number;
    unit_price: number;
}

export interface SmartCartOptimizedCart {
    optimized_items: SmartCartOptimizedItem[];
    total_cost: number;
    store_distribution: Record<string, string[]>;
}

export interface SmartCartOptimizerInput {
    shopping_list: string[];
    store_products: SmartCartOptimizerStoreEntry[];
}

function compareOffers(
    left: { store_id: string; offer: SmartCartOptimizerProductOffer },
    right: { store_id: string; offer: SmartCartOptimizerProductOffer },
): number {
    if (left.offer.unit_price !== right.offer.unit_price) {
        return left.offer.unit_price - right.offer.unit_price;
    }

    if (left.offer.price !== right.offer.price) {
        return left.offer.price - right.offer.price;
    }

    return left.store_id.localeCompare(right.store_id);
}

function findAvailableOffers(
    productId: string,
    storeProducts: SmartCartOptimizerStoreEntry[],
): Array<{ store_id: string; offer: SmartCartOptimizerProductOffer }> {
    return storeProducts.flatMap(store => {
        const matchingOffers = store.products.filter(product =>
            product.product_id === productId
            && product.available
            && Number.isFinite(product.price)
            && Number.isFinite(product.unit_price),
        );

        return matchingOffers.map(offer => ({
            store_id: store.store_id,
            offer,
        }));
    });
}

export function optimizeSmartCart(input: SmartCartOptimizerInput): SmartCartOptimizedCart {
    const optimized_items: SmartCartOptimizedItem[] = [];
    const store_distribution: Record<string, string[]> = {};

    input.shopping_list.forEach(productId => {
        const availableOffers = findAvailableOffers(productId, input.store_products).sort(compareOffers);

        if (availableOffers.length === 0) {
            throw new Error(`Unable to optimize cart: product "${productId}" is unavailable in all stores.`);
        }

        const selected = availableOffers[0];
        const optimizedItem: SmartCartOptimizedItem = {
            product_id: productId,
            chosen_store: selected.store_id,
            price: selected.offer.price,
            unit_price: selected.offer.unit_price,
        };

        optimized_items.push(optimizedItem);

        if (!store_distribution[selected.store_id]) {
            store_distribution[selected.store_id] = [];
        }

        store_distribution[selected.store_id].push(productId);
    });

    const total_cost = optimized_items.reduce((sum, item) => sum + item.unit_price, 0);

    return {
        optimized_items,
        total_cost,
        store_distribution,
    };
}
