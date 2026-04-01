import { describe, expect, it } from 'vitest';
import { analyzeTripConsolidation } from '../../apps/web/src/smartcart/analyzeTripConsolidation';
import { SmartCartOptimizationResult } from '../../apps/web/src/types/smartCart';

describe('analyzeTripConsolidation', () => {
    it('recommends the optimized multi-store cart when it saves money above thresholds', () => {
        const result: SmartCartOptimizationResult = {
            items: [],
            summary: {
                selectedStoreCount: 2,
                totalCartCost: 16,
                bestSingleStoreCost: 22,
                savingsVsSingleStore: 6,
                unavailableItemCount: 0,
            },
            bestSingleStore: {
                storeId: 'store-a',
                storeName: 'FreshMart',
                totalCost: 22,
                deliveryFee: 0,
                totalWithDelivery: 22,
                missingItemCount: 0,
                isFullyAvailable: true,
            },
            singleStoreComparisons: [],
            explanations: [],
        };

        const analysis = analyzeTripConsolidation(result);

        expect(analysis.recommendation).toBe('optimized_multi_store');
        expect(analysis.optimizedStoreCount).toBe(2);
        expect(analysis.optimizedTotalCost).toBe(16);
        expect(analysis.bestSingleStoreCost).toBe(22);
        expect(analysis.priceDifference).toBe(6);
        expect(analysis.summary).toContain('saves $6.00');
        expect(analysis.summary).toContain('FreshMart');
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
                deliveryFee: 0,
                totalWithDelivery: 20.25,
                missingItemCount: 0,
                isFullyAvailable: true,
            },
            singleStoreComparisons: [],
            explanations: [],
        };

        const analysis = analyzeTripConsolidation(result);

        expect(analysis.recommendation).toBe('best_single_store');
        expect(analysis.priceDifference).toBe(-1.5);
        expect(analysis.summary).toContain('BudgetFoods');
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

        expect(analysis.recommendation).toBe('optimized_multi_store_only_feasible');
        expect(analysis.bestSingleStoreCost).toBeNull();
        expect(analysis.summary).toContain('only feasible option');
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
                deliveryFee: 0,
                totalWithDelivery: 19.99,
                missingItemCount: 0,
                isFullyAvailable: true,
            },
            singleStoreComparisons: [],
            explanations: [],
        };

        const analysis = analyzeTripConsolidation(result);

        expect(analysis.recommendation).toBe('best_single_store');
        expect(analysis.priceDifference).toBe(0);
        expect(analysis.summary).toContain('North Market');
    });

    it('recommends single store when savings are below $3 minimum', () => {
        const result: SmartCartOptimizationResult = {
            items: [],
            summary: {
                selectedStoreCount: 2,
                totalCartCost: 18,
                bestSingleStoreCost: 20,
                savingsVsSingleStore: 2,
                unavailableItemCount: 0,
            },
            bestSingleStore: {
                storeId: 'store-a',
                storeName: 'FreshMart',
                totalCost: 20,
                deliveryFee: 0,
                totalWithDelivery: 20,
                missingItemCount: 0,
                isFullyAvailable: true,
            },
            singleStoreComparisons: [],
            explanations: [],
        };

        const analysis = analyzeTripConsolidation(result);
        // $2 savings < $3 minimum → best_single_store
        expect(analysis.recommendation).toBe('best_single_store');
    });
});
