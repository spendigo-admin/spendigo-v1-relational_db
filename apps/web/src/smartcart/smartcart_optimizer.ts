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
    distanceKm?: number; // pre-computed distance from shopper, used for tie-breaking
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
    preferredStoreId?: string;
}

const PREFERRED_STORE_TOLERANCE = 0.02; // 2% tolerance for preferred store bias

function compareOffers(
    left: { store_id: string; offer: SmartCartOptimizerProductOffer; distanceKm?: number },
    right: { store_id: string; offer: SmartCartOptimizerProductOffer; distanceKm?: number },
): number {
    if (left.offer.unit_price !== right.offer.unit_price) {
        return left.offer.unit_price - right.offer.unit_price;
    }

    if (left.offer.price !== right.offer.price) {
        return left.offer.price - right.offer.price;
    }

    // Equal price: prefer closer store
    const leftDist = left.distanceKm ?? Number.POSITIVE_INFINITY;
    const rightDist = right.distanceKm ?? Number.POSITIVE_INFINITY;
    if (leftDist !== rightDist) {
        return leftDist - rightDist;
    }

    return left.store_id.localeCompare(right.store_id);
}

function findAvailableOffers(
    productId: string,
    storeProducts: SmartCartOptimizerStoreEntry[],
): Array<{ store_id: string; offer: SmartCartOptimizerProductOffer; distanceKm?: number }> {
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
            distanceKm: store.distanceKm,
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

        let selected = availableOffers[0];

        // Preferred store bias: if preferred store has an offer within tolerance, pick it
        if (input.preferredStoreId && selected.store_id !== input.preferredStoreId) {
            const preferredOffer = availableOffers.find(o => o.store_id === input.preferredStoreId);
            if (preferredOffer) {
                const cheapestPrice = selected.offer.unit_price;
                const preferredPrice = preferredOffer.offer.unit_price;
                if (cheapestPrice > 0 && (preferredPrice - cheapestPrice) / cheapestPrice <= PREFERRED_STORE_TOLERANCE) {
                    selected = preferredOffer;
                }
            }
        }

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

    const total_cost = Math.round(optimized_items.reduce((sum, item) => sum + item.price, 0) * 10000) / 10000;

    return {
        optimized_items,
        total_cost,
        store_distribution,
    };
}
