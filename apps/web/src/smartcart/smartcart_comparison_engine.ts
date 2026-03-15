import { SmartCartOptimizedCart } from './smartcart_optimizer';
import { SmartCartSingleStoreSimulationResult } from './smartcart_single_store_simulator';

export type SmartCartComparisonRecommendation =
    | 'single_store'
    | 'optimized_multi_store'
    | 'optimized_multi_store_only_feasible';

export interface SmartCartComparisonResult {
    optimized_cost: number;
    best_single_store_cost: number | null;
    best_store: string | null;
    savings: number | null;
    recommendation: SmartCartComparisonRecommendation;
}

function findBestSingleStore(
    singleStoreResults: SmartCartSingleStoreSimulationResult[],
): SmartCartSingleStoreSimulationResult | null {
    const feasibleStores = singleStoreResults.filter(result => result.cart_cost !== null);

    if (feasibleStores.length === 0) {
        return null;
    }

    return feasibleStores.reduce((best, candidate) => {
        if ((candidate.cart_cost ?? Number.POSITIVE_INFINITY) < (best.cart_cost ?? Number.POSITIVE_INFINITY)) {
            return candidate;
        }

        if (candidate.cart_cost === best.cart_cost) {
            return candidate.store_id.localeCompare(best.store_id) < 0 ? candidate : best;
        }

        return best;
    });
}

export function compareOptimizedCartToSingleStore(
    optimizedCartResult: SmartCartOptimizedCart,
    listOfSingleStoreCartCosts: SmartCartSingleStoreSimulationResult[],
): SmartCartComparisonResult {
    const optimized_cost = optimizedCartResult.total_cost;
    const bestSingleStore = findBestSingleStore(listOfSingleStoreCartCosts);

    if (!bestSingleStore || bestSingleStore.cart_cost === null) {
        return {
            optimized_cost,
            best_single_store_cost: null,
            best_store: null,
            savings: null,
            recommendation: 'optimized_multi_store_only_feasible',
        };
    }

    const best_single_store_cost = bestSingleStore.cart_cost;
    const savings = best_single_store_cost - optimized_cost;
    const savingsRate = best_single_store_cost === 0 ? 0 : savings / best_single_store_cost;

    return {
        optimized_cost,
        best_single_store_cost,
        best_store: bestSingleStore.store_id,
        savings,
        recommendation: savingsRate < 0.05 ? 'single_store' : 'optimized_multi_store',
    };
}
