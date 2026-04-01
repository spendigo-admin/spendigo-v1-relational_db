import {
    SmartCartOptimizationResult,
    SmartCartTripAnalysis,
    SmartCartTripRecommendation,
} from '../types/smartCart';

const MIN_ABSOLUTE_SAVINGS = 3;
const MIN_SAVINGS_RATE = 0.05;
const STORE_PENALTY = 0.02;

function buildSummary(
    recommendation: SmartCartTripRecommendation,
    optimizedTotalCost: number,
    bestSingleStoreCost: number | null,
    priceDifference: number | null,
    bestSingleStoreName: string | null,
    storeCount: number,
): string {
    if (recommendation === 'optimized_multi_store_only_feasible') {
        return 'No single store can fulfill the full shopping list, so the optimized multi-store cart is the only feasible option.';
    }

    if (recommendation === 'optimized_multi_store') {
        return `The optimized cart across ${storeCount} stores saves $${(priceDifference ?? 0).toFixed(2)} compared with the best single-store option${bestSingleStoreName ? ` at ${bestSingleStoreName}` : ''}.`;
    }

    if (priceDifference !== null && priceDifference === 0) {
        return `The best single-store cart matches the optimized cart total at $${optimizedTotalCost.toFixed(2)}, so consolidating the trip is the simpler choice${bestSingleStoreName ? ` at ${bestSingleStoreName}` : ''}.`;
    }

    if (priceDifference !== null && priceDifference > 0 && priceDifference < MIN_ABSOLUTE_SAVINGS) {
        return `Multi-store saves only $${priceDifference.toFixed(2)} — not enough to justify visiting ${storeCount} stores. Single-store trip at ${bestSingleStoreName || 'the best option'} is recommended.`;
    }

    return `The best single-store cart is cheaper by $${Math.abs(priceDifference ?? 0).toFixed(2)}${bestSingleStoreName ? ` at ${bestSingleStoreName}` : ''}, so consolidating the trip is recommended.`;
}

export function analyzeTripConsolidation(
    optimizationResult: SmartCartOptimizationResult,
): SmartCartTripAnalysis {
    const optimizedTotalCost = optimizationResult.summary.totalCartCost;
    const bestSingleStoreCost = optimizationResult.bestSingleStore?.totalWithDelivery ?? null;
    const optimizedStoreCount = optimizationResult.summary.selectedStoreCount;

    if (bestSingleStoreCost === null) {
        return {
            optimizedStoreCount,
            optimizedTotalCost,
            bestSingleStoreCost: null,
            priceDifference: null,
            recommendation: 'optimized_multi_store_only_feasible',
            summary: buildSummary(
                'optimized_multi_store_only_feasible',
                optimizedTotalCost,
                null,
                null,
                null,
                optimizedStoreCount,
            ),
        };
    }

    const priceDifference = bestSingleStoreCost - optimizedTotalCost;
    const savingsRate = bestSingleStoreCost === 0 ? 0 : priceDifference / bestSingleStoreCost;
    const extraStores = Math.max(0, optimizedStoreCount - 1);
    const adjustedSavingsRate = savingsRate - (extraStores * STORE_PENALTY);

    const worthMultiStore = priceDifference >= MIN_ABSOLUTE_SAVINGS && adjustedSavingsRate >= MIN_SAVINGS_RATE;
    const recommendation: SmartCartTripRecommendation = worthMultiStore
        ? 'optimized_multi_store'
        : 'best_single_store';

    return {
        optimizedStoreCount,
        optimizedTotalCost,
        bestSingleStoreCost,
        priceDifference,
        recommendation,
        summary: buildSummary(
            recommendation,
            optimizedTotalCost,
            bestSingleStoreCost,
            priceDifference,
            optimizationResult.bestSingleStore?.storeName ?? null,
            optimizedStoreCount,
        ),
    };
}
