import { describe, expect, it } from 'vitest';
import { compareOptimizedCartToSingleStore } from '../../apps/web/src/smartcart/smartcart_comparison_engine';
import { SmartCartOptimizedCart } from '../../apps/web/src/smartcart/smartcart_optimizer';
import { SmartCartSingleStoreSimulationResult } from '../../apps/web/src/smartcart/smartcart_single_store_simulator';

describe('smartcart_comparison_engine', () => {
    it('recommends optimized multi-store when savings exceed hybrid threshold', () => {
        const optimizedCart: SmartCartOptimizedCart = {
            optimized_items: [],
            total_cost: 15,
            store_distribution: {
                'store-a': ['milk'],
                'store-b': ['eggs'],
            },
        };

        const singleStoreResults: SmartCartSingleStoreSimulationResult[] = [
            {
                store_id: 'store-a',
                cart_cost: 20,
                missing_items: [],
            },
            {
                store_id: 'store-b',
                cart_cost: 19.5,
                missing_items: [],
            },
        ];

        const result = compareOptimizedCartToSingleStore(optimizedCart, singleStoreResults);
        expect(result.optimized_cost).toBe(15);
        expect(result.best_single_store_cost).toBe(19.5);
        expect(result.best_store).toBe('store-b');
        expect(result.savings).toBe(4.5);
        expect(result.store_count).toBe(2);
        // 4.5 >= $3 AND (4.5/19.5 = 23%) - (1 extra store * 2%) = 21% >= 5%
        expect(result.recommendation).toBe('optimized_multi_store');
    });

    it('recommends single store when savings are below absolute minimum', () => {
        const optimizedCart: SmartCartOptimizedCart = {
            optimized_items: [],
            total_cost: 19.2,
            store_distribution: {
                'store-a': ['milk'],
                'store-b': ['eggs'],
            },
        };

        const singleStoreResults: SmartCartSingleStoreSimulationResult[] = [
            {
                store_id: 'store-a',
                cart_cost: 20,
                missing_items: [],
            },
            {
                store_id: 'store-b',
                cart_cost: null,
                missing_items: ['eggs'],
            },
        ];

        const result = compareOptimizedCartToSingleStore(optimizedCart, singleStoreResults);
        expect(result.optimized_cost).toBe(19.2);
        expect(result.best_single_store_cost).toBe(20);
        expect(result.best_store).toBe('store-a');
        expect(result.savings).toBe(0.8);
        // 0.8 < $3 minimum → single_store
        expect(result.recommendation).toBe('single_store');
    });

    it('uses deterministic tie-breaking for best single store', () => {
        const optimizedCart: SmartCartOptimizedCart = {
            optimized_items: [],
            total_cost: 15,
            store_distribution: {},
        };

        const singleStoreResults: SmartCartSingleStoreSimulationResult[] = [
            {
                store_id: 'store-b',
                cart_cost: 18,
                missing_items: [],
            },
            {
                store_id: 'store-a',
                cart_cost: 18,
                missing_items: [],
            },
        ];

        const result = compareOptimizedCartToSingleStore(optimizedCart, singleStoreResults);
        expect(result.best_store).toBe('store-a');
        expect(result.savings).toBe(3);
        expect(result.store_count).toBe(0);
    });

    it('returns only-feasible recommendation when no single store can fulfill the cart', () => {
        const optimizedCart: SmartCartOptimizedCart = {
            optimized_items: [],
            total_cost: 14,
            store_distribution: {
                'store-a': ['milk'],
                'store-b': ['bread'],
            },
        };

        const singleStoreResults: SmartCartSingleStoreSimulationResult[] = [
            {
                store_id: 'store-a',
                cart_cost: null,
                missing_items: ['bread'],
            },
            {
                store_id: 'store-b',
                cart_cost: null,
                missing_items: ['milk'],
            },
        ];

        const result = compareOptimizedCartToSingleStore(optimizedCart, singleStoreResults);
        expect(result.optimized_cost).toBe(14);
        expect(result.best_single_store_cost).toBeNull();
        expect(result.best_store).toBeNull();
        expect(result.savings).toBeNull();
        expect(result.savings_rate).toBeNull();
        expect(result.recommendation).toBe('optimized_multi_store_only_feasible');
    });
});
