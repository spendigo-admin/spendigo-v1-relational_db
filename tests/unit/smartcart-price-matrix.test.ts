import { describe, expect, it } from 'vitest';
import {
    buildSmartCartPriceMatrix,
    SmartCartPriceMatrixInput,
} from '../../apps/web/src/smartcart/smartcart_price_matrix';

describe('smartcart_price_matrix', () => {
    it('builds a product-to-store price matrix using normalized unit prices', () => {
        const input: SmartCartPriceMatrixInput = {
            normalized_products: ['olive-oil', 'rice'],
            store_products: [
                {
                    store_id: 'store-a',
                    products: [
                        {
                            product_id: 'olive-oil',
                            price: 11.99,
                            package_size: '750ml',
                            available: true,
                        },
                        {
                            product_id: 'rice',
                            price: 5.99,
                            package_size: '1kg',
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
                            available: true,
                        },
                    ],
                },
            ],
        };

        const result = buildSmartCartPriceMatrix(input);

        expect(result['olive-oil']['store-a']).toBeCloseTo(1.5987, 4);
        expect(result['olive-oil']['store-b']).toBeCloseTo(1.449, 4);
        expect(result.rice['store-a']).toBeCloseTo(0.599, 4);
        expect(result.rice['store-b']).toBeUndefined();
    });

    it('ignores unavailable items and preserves empty rows for missing products', () => {
        const input: SmartCartPriceMatrixInput = {
            normalized_products: [
                { product_id: 'milk' },
                { product_id: 'eggs' },
            ],
            store_products: [
                {
                    store_id: 'store-a',
                    products: [
                        {
                            product_id: 'milk',
                            price: 4.99,
                            package_size: '1L',
                            available: false,
                        },
                    ],
                },
            ],
        };

        const result = buildSmartCartPriceMatrix(input);

        expect(result).toEqual({
            milk: {},
            eggs: {},
        });
    });

    it('falls back to provided unit_price when package normalization is unavailable', () => {
        const input: SmartCartPriceMatrixInput = {
            normalized_products: ['chips'],
            store_products: [
                {
                    store_id: 'store-a',
                    products: [
                        {
                            product_id: 'chips',
                            price: 4.99,
                            package_size: 'Family Size',
                            unit_price: 4.99,
                            available: true,
                        },
                    ],
                },
            ],
        };

        const result = buildSmartCartPriceMatrix(input);

        expect(result).toEqual({
            chips: {
                'store-a': 4.99,
            },
        });
    });

    it('keeps the cheapest normalized unit price when a store has multiple offers for the same product', () => {
        const input: SmartCartPriceMatrixInput = {
            normalized_products: ['pasta'],
            store_products: [
                {
                    store_id: 'store-a',
                    products: [
                        {
                            product_id: 'pasta',
                            price: 2.99,
                            package_size: '900g',
                            available: true,
                        },
                        {
                            product_id: 'pasta',
                            price: 3.49,
                            package_size: '1kg',
                            available: true,
                        },
                    ],
                },
            ],
        };

        const result = buildSmartCartPriceMatrix(input);

        expect(result.pasta['store-a']).toBeCloseTo(0.3322, 4);
    });
});
