import { describe, expect, it } from 'vitest';
import { analyzeTripConsolidation } from '../../apps/web/src/smartcart/analyzeTripConsolidation';
import { SmartCartOptimizationResult } from '../../apps/web/src/types/smartCart';

describe('analyzeTripConsolidation', () => {
    it('recommends the optimized multi-store cart when it saves money', () => {
        const result: SmartCartOptimizationResult = {
            items: [],
            summary: {
                selectedStoreCount: 2,
                totalCartCost: 18.5,
                bestSingleStoreCost: 22,
                savingsVsSingleStore: 3.5,
                unavailableItemCount: 0,
            },
            bestSingleStore: {
                storeId: 'store-a',
                storeName: 'FreshMart',
                totalCost: 22,
                missingItemCount: 0,
                isFullyAvailable: true,
            },
            singleStoreComparisons: [],
            explanations: [],
        };

        const analysis = analyzeTripConsolidation(result);

        expect(analysis).toEqual({
            optimizedStoreCount: 2,
            optimizedTotalCost: 18.5,
            bestSingleStoreCost: 22,
            priceDifference: 3.5,
            recommendation: 'optimized_multi_store',
            summary: 'The optimized multi-store cart saves $3.50 compared with the best single-store option at FreshMart.',
        });
    });

    it('recommends the best single store when consolidation is cheaper', () => {
        const result: SmartCartOptimizationResult = {
            items: [],
            summary: {
                selectedStoreCount: 2,
                totalCartCost: 21.75,
                bestSingleStoreCost: 20.25,
                savingsVsSingleStore: -1.5,
                unavailableItemCount: 0,
            },
            bestSingleStore: {
                storeId: 'store-b',
                storeName: 'BudgetFoods',
                totalCost: 20.25,
                missingItemCount: 0,
                isFullyAvailable: true,
            },
            singleStoreComparisons: [],
            explanations: [],
        };

        const analysis = analyzeTripConsolidation(result);

        expect(analysis).toEqual({
            optimizedStoreCount: 2,
            optimizedTotalCost: 21.75,
            bestSingleStoreCost: 20.25,
            priceDifference: -1.5,
            recommendation: 'best_single_store',
            summary: 'The best single-store cart is cheaper by $1.50 at BudgetFoods, so consolidating the trip is recommended.',
        });
    });

    it('reports when no single store can fulfill the full list', () => {
        const result: SmartCartOptimizationResult = {
            items: [],
            summary: {
                selectedStoreCount: 2,
                totalCartCost: 14.2,
                bestSingleStoreCost: null,
                savingsVsSingleStore: null,
                unavailableItemCount: 0,
            },
            bestSingleStore: null,
            singleStoreComparisons: [],
            explanations: [],
        };

        const analysis = analyzeTripConsolidation(result);

        expect(analysis).toEqual({
            optimizedStoreCount: 2,
            optimizedTotalCost: 14.2,
            bestSingleStoreCost: null,
            priceDifference: null,
            recommendation: 'optimized_multi_store_only_feasible',
            summary: 'No single store can fulfill the full shopping list, so the optimized multi-store cart is the only feasible option.',
        });
    });

    it('recommends the single store when totals are tied', () => {
        const result: SmartCartOptimizationResult = {
            items: [],
            summary: {
                selectedStoreCount: 2,
                totalCartCost: 19.99,
                bestSingleStoreCost: 19.99,
                savingsVsSingleStore: 0,
                unavailableItemCount: 0,
            },
            bestSingleStore: {
                storeId: 'store-c',
                storeName: 'North Market',
                totalCost: 19.99,
                missingItemCount: 0,
                isFullyAvailable: true,
            },
            singleStoreComparisons: [],
            explanations: [],
        };

        const analysis = analyzeTripConsolidation(result);

        expect(analysis).toEqual({
            optimizedStoreCount: 2,
            optimizedTotalCost: 19.99,
            bestSingleStoreCost: 19.99,
            priceDifference: 0,
            recommendation: 'best_single_store',
            summary: 'The best single-store cart matches the optimized cart total at $19.99, so consolidating the trip is the simpler choice at North Market.',
        });
    });
});
