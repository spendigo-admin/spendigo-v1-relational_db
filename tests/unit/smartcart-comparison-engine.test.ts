import { describe, expect, it } from 'vitest';
import { compareOptimizedCartToSingleStore } from '../../apps/web/src/smartcart/smartcart_comparison_engine';
import { SmartCartOptimizedCart } from '../../apps/web/src/smartcart/smartcart_optimizer';
import { SmartCartSingleStoreSimulationResult } from '../../apps/web/src/smartcart/smartcart_single_store_simulator';

describe('smartcart_comparison_engine', () => {
    it('recommends optimized multi-store when savings are at least 5%', () => {
        const optimizedCart: SmartCartOptimizedCart = {
            optimized_items: [],
            total_cost: 18,
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

        expect(compareOptimizedCartToSingleStore(optimizedCart, singleStoreResults)).toEqual({
            optimized_cost: 18,
            best_single_store_cost: 19.5,
            best_store: 'store-b',
            savings: 1.5,
            recommendation: 'optimized_multi_store',
        });
    });

    it('recommends single store when savings are below 5%', () => {
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

        expect(compareOptimizedCartToSingleStore(optimizedCart, singleStoreResults)).toEqual({
            optimized_cost: 19.2,
            best_single_store_cost: 20,
            best_store: 'store-a',
            savings: 0.8,
            recommendation: 'single_store',
        });
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

        expect(compareOptimizedCartToSingleStore(optimizedCart, singleStoreResults)).toEqual({
            optimized_cost: 15,
            best_single_store_cost: 18,
            best_store: 'store-a',
            savings: 3,
            recommendation: 'optimized_multi_store',
        });
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

        expect(compareOptimizedCartToSingleStore(optimizedCart, singleStoreResults)).toEqual({
            optimized_cost: 14,
            best_single_store_cost: null,
            best_store: null,
            savings: null,
            recommendation: 'optimized_multi_store_only_feasible',
        });
    });
});
