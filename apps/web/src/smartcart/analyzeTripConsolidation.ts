import {
    SmartCartOptimizationResult,
    SmartCartTripAnalysis,
    SmartCartTripRecommendation,
} from '../types/smartCart';

function buildSummary(
    recommendation: SmartCartTripRecommendation,
    optimizedTotalCost: number,
    bestSingleStoreCost: number | null,
    priceDifference: number | null,
    bestSingleStoreName: string | null,
): string {
    if (recommendation === 'optimized_multi_store_only_feasible') {
        return 'No single store can fulfill the full shopping list, so the optimized multi-store cart is the only feasible option.';
    }

    if (recommendation === 'optimized_multi_store') {
        return `The optimized multi-store cart saves $${(priceDifference ?? 0).toFixed(2)} compared with the best single-store option${bestSingleStoreName ? ` at ${bestSingleStoreName}` : ''}.`;
    }

    if (priceDifference !== null && priceDifference === 0) {
        return `The best single-store cart matches the optimized cart total at $${optimizedTotalCost.toFixed(2)}, so consolidating the trip is the simpler choice${bestSingleStoreName ? ` at ${bestSingleStoreName}` : ''}.`;
    }

    return `The best single-store cart is cheaper by $${Math.abs(priceDifference ?? 0).toFixed(2)}${bestSingleStoreName ? ` at ${bestSingleStoreName}` : ''}, so consolidating the trip is recommended.`;
}

export function analyzeTripConsolidation(
    optimizationResult: SmartCartOptimizationResult,
): SmartCartTripAnalysis {
    const optimizedTotalCost = optimizationResult.summary.totalCartCost;
    const bestSingleStoreCost = optimizationResult.bestSingleStore?.totalCost ?? null;
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
            ),
        };
    }

    const priceDifference = bestSingleStoreCost - optimizedTotalCost;
    const recommendation: SmartCartTripRecommendation = priceDifference > 0
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
        ),
    };
}
