import { describe, expect, it } from 'vitest';
import { simulateSingleStoreCart } from '../../apps/web/src/smartcart/smartcart_single_store_simulator';

describe('smartcart_single_store_simulator', () => {
    it('returns the normalized cart cost when the store can fulfill the full list', () => {
        const result = simulateSingleStoreCart({
            shopping_list: ['olive-oil', 'rice'],
            store_product_data: {
                store_id: 'store-a',
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
                ],
            },
        });

        expect(result).toEqual({
            store_id: 'store-a',
            cart_cost: 1.998,
            missing_items: [],
        });
    });

    it('returns null cost and missing items when the store cannot fulfill the full list', () => {
        const result = simulateSingleStoreCart({
            shopping_list: ['olive-oil', 'milk'],
            store_product_data: {
                store_id: 'store-b',
                products: [
                    {
                        product_id: 'olive-oil',
                        price: 11.99,
                        package_size: '750ml',
                        unit_price: 1.5987,
                        available: true,
                    },
                    {
                        product_id: 'milk',
                        price: 4.99,
                        package_size: '1L',
                        unit_price: 0.499,
                        available: false,
                    },
                ],
            },
        });

        expect(result).toEqual({
            store_id: 'store-b',
            cart_cost: null,
            missing_items: ['milk'],
        });
    });

    it('skips unavailable offers and picks the cheapest available match in the store', () => {
        const result = simulateSingleStoreCart({
            shopping_list: ['pasta'],
            store_product_data: {
                store_id: 'store-c',
                products: [
                    {
                        product_id: 'pasta',
                        price: 3.49,
                        package_size: '1kg',
                        unit_price: 0.349,
                        available: true,
                    },
                    {
                        product_id: 'pasta',
                        price: 2.99,
                        package_size: '900g',
                        unit_price: 0.3322,
                        available: true,
                    },
                    {
                        product_id: 'pasta',
                        price: 2.79,
                        package_size: '750g',
                        unit_price: 0.372,
                        available: false,
                    },
                ],
            },
        });

        expect(result).toEqual({
            store_id: 'store-c',
            cart_cost: 0.3322,
            missing_items: [],
        });
    });
});
