import { SmartCartOptimizerProductOffer } from './smartcart_optimizer';

export interface SmartCartSingleStoreSimulationInput {
    shopping_list: string[];
    store_product_data: {
        store_id: string;
        products: SmartCartOptimizerProductOffer[];
    };
}

export interface SmartCartSingleStoreSimulationResult {
    store_id: string;
    cart_cost: number | null;
    missing_items: string[];
}

function getBestAvailableStoreOffer(
    productId: string,
    products: SmartCartOptimizerProductOffer[],
): SmartCartOptimizerProductOffer | null {
    const matchingOffers = products.filter(product =>
        product.product_id === productId
        && product.available
        && Number.isFinite(product.unit_price),
    );

    if (matchingOffers.length === 0) {
        return null;
    }

    return matchingOffers.reduce((best, candidate) => {
        if (candidate.unit_price < best.unit_price) {
            return candidate;
        }

        if (candidate.unit_price === best.unit_price && candidate.price < best.price) {
            return candidate;
        }

        return best;
    });
}

export function simulateSingleStoreCart(
    input: SmartCartSingleStoreSimulationInput,
): SmartCartSingleStoreSimulationResult {
    const missing_items: string[] = [];
    let cart_cost = 0;

    input.shopping_list.forEach(productId => {
        const offer = getBestAvailableStoreOffer(productId, input.store_product_data.products);

        if (!offer) {
            missing_items.push(productId);
            return;
        }

        cart_cost += offer.unit_price;
    });

    return {
        store_id: input.store_product_data.store_id,
        cart_cost: missing_items.length === 0 ? Math.round(cart_cost * 10000) / 10000 : null,
        missing_items,
    };
}
