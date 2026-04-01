import { describe, expect, it } from 'vitest';
import {
    optimizeSmartCart,
    SmartCartOptimizerInput,
} from '../../apps/web/src/smartcart/smartcart_optimizer';

describe('smartcart_optimizer', () => {
    it('selects the cheapest available store for each requested product', () => {
        const input: SmartCartOptimizerInput = {
            shopping_list: ['olive-oil', 'rice', 'milk'],
            store_products: [
                {
                    store_id: 'store-a',
                    products: [
                        {
                            product_id: 'olive-oil',
                            price: 11.99,
                            package_size: '750ml',
                            unit_price: 1.5987,
                            available: true,
                        },
                        {
                            product_id: 'rice',
                            price: 5.99,
                            package_size: '1kg',
                            unit_price: 0.599,
                            available: true,
                        },
                    ],
                },
                {
                    store_id: 'store-b',
                    products: [
                        {
                            product_id: 'olive-oil',
                            price: 14.49,
                            package_size: '1L',
                            unit_price: 1.449,
                            available: true,
                        },
                        {
                            product_id: 'rice',
                            price: 5.49,
                            package_size: '1kg',
                            unit_price: 0.549,
                            available: true,
                        },
                        {
                            product_id: 'milk',
                            price: 4.99,
                            package_size: '1L',
                            unit_price: 0.499,
                            available: true,
                        },
                    ],
                },
            ],
        };

        const result = optimizeSmartCart(input);

        expect(result).toEqual({
            optimized_items: [
                {
                    product_id: 'olive-oil',
                    chosen_store: 'store-b',
                    price: 14.49,
                    unit_price: 1.449,
                },
                {
                    product_id: 'rice',
                    chosen_store: 'store-b',
                    price: 5.49,
                    unit_price: 0.549,
                },
                {
                    product_id: 'milk',
                    chosen_store: 'store-b',
                    price: 4.99,
                    unit_price: 0.499,
                },
            ],
            total_cost: 24.97,
            store_distribution: {
                'store-b': ['olive-oil', 'rice', 'milk'],
            },
        });
    });

    it('breaks ties deterministically by raw price and then store id', () => {
        const input: SmartCartOptimizerInput = {
            shopping_list: ['pasta'],
            store_products: [
                {
                    store_id: 'store-b',
                    products: [
                        {
                            product_id: 'pasta',
                            price: 3.19,
                            package_size: '900g',
                            unit_price: 0.3544,
                            available: true,
                        },
                    ],
                },
                {
                    store_id: 'store-a',
                    products: [
                        {
                            product_id: 'pasta',
                            price: 2.99,
                            package_size: '850g',
                            unit_price: 0.3544,
                            available: true,
                        },
                    ],
                },
            ],
        };

        const result = optimizeSmartCart(input);

        expect(result.optimized_items).toEqual([
            {
                product_id: 'pasta',
                chosen_store: 'store-a',
                price: 2.99,
                unit_price: 0.3544,
            },
        ]);
        expect(result.store_distribution).toEqual({
            'store-a': ['pasta'],
        });
    });

    it('throws when a requested product is unavailable in every store', () => {
        const input: SmartCartOptimizerInput = {
            shopping_list: ['eggs'],
            store_products: [
                {
                    store_id: 'store-a',
                    products: [
                        {
                            product_id: 'eggs',
                            price: 4.99,
                            package_size: '12-pack',
                            unit_price: 0.4158,
                            available: false,
                        },
                    ],
                },
            ],
        };

        expect(() => optimizeSmartCart(input)).toThrow(
            'Unable to optimize cart: product "eggs" is unavailable in all stores.',
        );
    });
});
