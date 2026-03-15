import { describe, expect, it } from 'vitest';
import { optimize_cart } from '../../services/smartcart_optimizer';

describe('services/smartcart_optimizer', () => {
    it('handles a single store cart', () => {
        const result = optimize_cart(
            ['olive-oil', 'rice'],
            [
                {
                    store: {
                        id: 'store-a',
                        name: 'FreshMart',
                    },
                    inventory: [
                        {
                            id: 'mp-olive-a',
                            merchant_product_id: 'mp-olive-a',
                            merchant_id: 'store-a',
                            master_product_id: 'olive-oil',
                            price: 14.49,
                            currency: 'CAD',
                            available_quantity: 10,
                            package_size: '1L',
                            is_active: true,
                        },
                        {
                            id: 'mp-rice-a',
                            merchant_product_id: 'mp-rice-a',
                            merchant_id: 'store-a',
                            master_product_id: 'rice',
                            price: 5.49,
                            currency: 'CAD',
                            available_quantity: 12,
                            package_size: '1kg',
                            is_active: true,
                        },
                    ],
                },
            ],
        );

        expect(result).toEqual({
            optimized_items: [
                {
                    product_id: 'olive-oil',
                    chosen_store: 'store-a',
                    price: 14.49,
                    unit_price: 1.449,
                },
                {
                    product_id: 'rice',
                    chosen_store: 'store-a',
                    price: 5.49,
                    unit_price: 0.549,
                },
            ],
            total_cost: 1.998,
            store_distribution: {
                'store-a': ['olive-oil', 'rice'],
            },
        });
    });

    it('optimizes across multiple stores for the cheapest combination', () => {
        const result = optimize_cart(
            ['olive-oil', 'rice'],
            [
                {
                    store: {
                        id: 'store-a',
                        name: 'FreshMart',
                    },
                    inventory: [
                        {
                            id: 'mp-olive-a',
                            merchant_product_id: 'mp-olive-a',
                            merchant_id: 'store-a',
                            master_product_id: 'olive-oil',
                            price: 11.99,
                            currency: 'CAD',
                            available_quantity: 10,
                            package_size: '750ml',
                            is_active: true,
                        },
                        {
                            id: 'mp-rice-a',
                            merchant_product_id: 'mp-rice-a',
                            merchant_id: 'store-a',
                            master_product_id: 'rice',
                            price: 5.99,
                            currency: 'CAD',
                            available_quantity: 12,
                            package_size: '1kg',
                            is_active: true,
                        },
                    ],
                },
                {
                    store: {
                        id: 'store-b',
                        name: 'BudgetFoods',
                    },
                    inventory: [
                        {
                            id: 'mp-olive-b',
                            merchant_product_id: 'mp-olive-b',
                            merchant_id: 'store-b',
                            master_product_id: 'olive-oil',
                            price: 14.49,
                            currency: 'CAD',
                            available_quantity: 9,
                            package_size: '1L',
                            is_active: true,
                        },
                        {
                            id: 'mp-rice-b',
                            merchant_product_id: 'mp-rice-b',
                            merchant_id: 'store-b',
                            master_product_id: 'rice',
                            price: 5.49,
                            currency: 'CAD',
                            available_quantity: 14,
                            package_size: '1kg',
                            is_active: true,
                        },
                    ],
                },
            ],
        );

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
            ],
            total_cost: 1.998,
            store_distribution: {
                'store-b': ['olive-oil', 'rice'],
            },
        });
    });

    it('throws when a requested product is missing from all eligible stores', () => {
        expect(() => optimize_cart(
            ['olive-oil', 'milk'],
            [
                {
                    store: {
                        id: 'store-a',
                        name: 'FreshMart',
                    },
                    inventory: [
                        {
                            id: 'mp-olive-a',
                            merchant_product_id: 'mp-olive-a',
                            merchant_id: 'store-a',
                            master_product_id: 'olive-oil',
                            price: 14.49,
                            currency: 'CAD',
                            available_quantity: 10,
                            package_size: '1L',
                            is_active: true,
                        },
                    ],
                },
                {
                    store: {
                        id: 'store-b',
                        name: 'BudgetFoods',
                    },
                    inventory: [
                        {
                            id: 'mp-olive-b',
                            merchant_product_id: 'mp-olive-b',
                            merchant_id: 'store-b',
                            master_product_id: 'olive-oil',
                            price: 15.49,
                            currency: 'CAD',
                            available_quantity: 7,
                            package_size: '1L',
                            is_active: true,
                        },
                    ],
                },
            ],
        )).toThrow('Product "milk" is unavailable in all eligible stores.');
    });

    it('breaks equal prices across stores deterministically by store id', () => {
        const result = optimize_cart(
            ['rice'],
            [
                {
                    store: {
                        id: 'store-b',
                        name: 'BudgetFoods',
                    },
                    inventory: [
                        {
                            id: 'mp-rice-b',
                            merchant_product_id: 'mp-rice-b',
                            merchant_id: 'store-b',
                            master_product_id: 'rice',
                            price: 5.49,
                            currency: 'CAD',
                            available_quantity: 8,
                            package_size: '1kg',
                            is_active: true,
                        },
                    ],
                },
                {
                    store: {
                        id: 'store-a',
                        name: 'FreshMart',
                    },
                    inventory: [
                        {
                            id: 'mp-rice-a',
                            merchant_product_id: 'mp-rice-a',
                            merchant_id: 'store-a',
                            master_product_id: 'rice',
                            price: 5.49,
                            currency: 'CAD',
                            available_quantity: 8,
                            package_size: '1kg',
                            is_active: true,
                        },
                    ],
                },
            ],
        );

        expect(result).toEqual({
            optimized_items: [
                {
                    product_id: 'rice',
                    chosen_store: 'store-a',
                    price: 5.49,
                    unit_price: 0.549,
                },
            ],
            total_cost: 0.549,
            store_distribution: {
                'store-a': ['rice'],
            },
        });
    });
});
