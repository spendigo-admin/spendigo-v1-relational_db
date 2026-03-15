import { describe, expect, it } from 'vitest';
import { buildPriceMatrix } from '../../apps/web/src/smartcart/buildPriceMatrix';
import { SmartCartOptimizationInput } from '../../apps/web/src/types/smartCart';

describe('buildPriceMatrix', () => {
    it('builds rows by product and columns by store with normalized unit prices', () => {
        const input: SmartCartOptimizationInput = {
            shoppingList: [
                {
                    id: 'item-olive-oil',
                    name: 'Olive Oil',
                    quantity: 1,
                    preferredMasterProductId: 'master-olive-oil',
                },
            ],
            stores: [
                { id: 'store-a', name: 'FreshMart' },
                { id: 'store-b', name: 'BudgetFoods' },
            ],
            prices: [
                {
                    merchantProductId: 'mp-olive-750',
                    storeId: 'store-a',
                    masterProductId: 'master-olive-oil',
                    productName: 'Olive Oil',
                    unit: '750ml',
                    price: 11.99,
                    currency: 'CAD',
                    inStock: true,
                    availableQuantity: 5,
                },
                {
                    merchantProductId: 'mp-olive-1l',
                    storeId: 'store-b',
                    masterProductId: 'master-olive-oil',
                    productName: 'Olive Oil',
                    unit: '1L',
                    price: 14.49,
                    currency: 'CAD',
                    inStock: true,
                    availableQuantity: 3,
                },
            ],
        };

        const result = buildPriceMatrix(input);

        expect(result.storeColumns).toHaveLength(2);
        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].cells['store-a']).toMatchObject({
            available: true,
            merchantProductId: 'mp-olive-750',
            comparisonUnit: '100ml',
        });
        expect(result.rows[0].cells['store-b']).toMatchObject({
            available: true,
            merchantProductId: 'mp-olive-1l',
            comparisonUnit: '100ml',
        });
        expect(result.rows[0].cells['store-a'].unitPrice).toBeCloseTo(1.5987, 4);
        expect(result.rows[0].cells['store-b'].unitPrice).toBeCloseTo(1.449, 4);
    });

    it('keeps unavailable or unmatched cells in the matrix for optimizer visibility', () => {
        const input: SmartCartOptimizationInput = {
            shoppingList: [
                {
                    id: 'item-milk',
                    name: 'Milk',
                    quantity: 1,
                },
            ],
            stores: [
                { id: 'store-a', name: 'FreshMart' },
                { id: 'store-b', name: 'BudgetFoods' },
            ],
            prices: [
                {
                    merchantProductId: 'mp-milk-a',
                    storeId: 'store-a',
                    productName: 'Milk',
                    unit: '1L',
                    price: 4.99,
                    currency: 'CAD',
                    inStock: false,
                    availableQuantity: 0,
                },
            ],
        };

        const result = buildPriceMatrix(input);

        expect(result.rows[0].cells['store-a']).toMatchObject({
            merchantProductId: 'mp-milk-a',
            available: false,
            comparisonUnit: '100ml',
        });
        expect(result.rows[0].cells['store-b']).toEqual({
            shoppingListItemId: 'item-milk',
            storeId: 'store-b',
            storeName: 'BudgetFoods',
            available: false,
            merchantProductId: null,
            productName: null,
            packageSize: null,
            price: null,
            unitPrice: null,
            comparisonUnit: null,
            availableQuantity: 0,
            isComparableByUnitPrice: false,
        });
    });

    it('keeps the cheapest comparable offer when a store has multiple matching products', () => {
        const input: SmartCartOptimizationInput = {
            shoppingList: [
                {
                    id: 'item-rice',
                    name: 'Rice',
                    quantity: 1,
                    preferredMasterProductId: 'master-rice',
                },
            ],
            stores: [
                { id: 'store-a', name: 'FreshMart' },
            ],
            prices: [
                {
                    merchantProductId: 'mp-rice-900g',
                    storeId: 'store-a',
                    masterProductId: 'master-rice',
                    productName: 'Rice',
                    unit: '900g',
                    price: 5.49,
                    currency: 'CAD',
                    inStock: true,
                    availableQuantity: 4,
                },
                {
                    merchantProductId: 'mp-rice-1kg',
                    storeId: 'store-a',
                    masterProductId: 'master-rice',
                    productName: 'Rice',
                    unit: '1kg',
                    price: 5.79,
                    currency: 'CAD',
                    inStock: true,
                    availableQuantity: 8,
                },
            ],
        };

        const result = buildPriceMatrix(input);

        expect(result.rows[0].cells['store-a']).toMatchObject({
            merchantProductId: 'mp-rice-1kg',
            comparisonUnit: '100g',
        });
        expect(result.rows[0].cells['store-a'].unitPrice).toBeCloseTo(0.579, 4);
    });
});
