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
    savings_rate: number | null;
    store_count: number;
    recommendation: SmartCartComparisonRecommendation;
}

const MIN_SAVINGS_RATE = 0.05; // 5% minimum savings rate
const STORE_PENALTY = 0.02; // 2% penalty per additional store beyond 1

// Dynamic absolute minimum: 1.5% of the basket value, bounded $1.50–$5.
// Mirrors analyzeTripConsolidation.ts — kept in sync to avoid split behaviour.
function dynamicMinAbsoluteSavings(basketCost: number): number {
    return Math.min(5, Math.max(1.5, basketCost * 0.015));
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
    const store_count = Object.keys(optimizedCartResult.store_distribution).length;
    const bestSingleStore = findBestSingleStore(listOfSingleStoreCartCosts);

    if (!bestSingleStore || bestSingleStore.cart_cost === null) {
        return {
            optimized_cost,
            best_single_store_cost: null,
            best_store: null,
            savings: null,
            savings_rate: null,
            store_count,
            recommendation: 'optimized_multi_store_only_feasible',
        };
    }

    const best_single_store_cost = bestSingleStore.cart_cost;
    const savings = Math.round((best_single_store_cost - optimized_cost) * 10000) / 10000;
    const savingsRate = best_single_store_cost === 0 ? 0 : savings / best_single_store_cost;

    // Hybrid threshold: must exceed both absolute minimum AND percentage minimum
    // Additional stores add friction — penalize each extra store beyond 1
    const extraStores = Math.max(0, store_count - 1);
    const adjustedSavingsRate = savingsRate - (extraStores * STORE_PENALTY);

    const worthMultiStore = savings >= dynamicMinAbsoluteSavings(best_single_store_cost) && adjustedSavingsRate >= MIN_SAVINGS_RATE;

    return {
        optimized_cost,
        best_single_store_cost,
        best_store: bestSingleStore.store_id,
        savings,
        savings_rate: savingsRate,
        store_count,
        recommendation: worthMultiStore ? 'optimized_multi_store' : 'single_store',
    };
}
