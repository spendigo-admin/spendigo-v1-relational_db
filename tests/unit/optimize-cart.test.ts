import { describe, expect, it } from 'vitest';
import { optimizeCart } from '../../apps/web/src/smartcart/optimizeCart';
import { SmartCartOptimizationInput } from '../../apps/web/src/types/smartCart';

describe('optimizeCart', () => {
    it('selects the cheapest available store for each shopping-list item', () => {
        const input: SmartCartOptimizationInput = {
            shoppingList: [
                {
                    id: 'item-olive-oil',
                    name: 'Olive Oil',
                    quantity: 1,
                    preferredMasterProductId: 'master-olive-oil',
                },
                {
                    id: 'item-rice',
                    name: 'Rice',
                    quantity: 2,
                    preferredMasterProductId: 'master-rice',
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
                {
                    merchantProductId: 'mp-rice-1kg-a',
                    storeId: 'store-a',
                    masterProductId: 'master-rice',
                    productName: 'Rice',
                    unit: '1kg',
                    price: 5.99,
                    currency: 'CAD',
                    inStock: true,
                    availableQuantity: 8,
                },
                {
                    merchantProductId: 'mp-rice-1kg-b',
                    storeId: 'store-b',
                    masterProductId: 'master-rice',
                    productName: 'Rice',
                    unit: '1kg',
                    price: 5.49,
                    currency: 'CAD',
                    inStock: true,
                    availableQuantity: 6,
                },
            ],
        };

        const result = optimizeCart(input);

        expect(result.items).toHaveLength(2);
        expect(result.items).toEqual([
            expect.objectContaining({
                shoppingListItemId: 'item-olive-oil',
                selectedStoreId: 'store-b',
                selectedMerchantProductId: 'mp-olive-1l',
            }),
            expect.objectContaining({
                shoppingListItemId: 'item-rice',
                selectedStoreId: 'store-b',
                selectedMerchantProductId: 'mp-rice-1kg-b',
            }),
        ]);
        expect(result.summary.totalCartCost).toBeCloseTo(2.547, 3);
        expect(result.summary.selectedStoreCount).toBe(1);
        expect(result.summary.unavailableItemCount).toBe(0);
    });

    it('computes savings versus the best fully available single-store option', () => {
        const input: SmartCartOptimizationInput = {
            shoppingList: [
                {
                    id: 'item-oil',
                    name: 'Olive Oil',
                    quantity: 1,
                    preferredMasterProductId: 'master-oil',
                },
                {
                    id: 'item-pasta',
                    name: 'Pasta',
                    quantity: 1,
                    preferredMasterProductId: 'master-pasta',
                },
            ],
            stores: [
                { id: 'store-a', name: 'FreshMart' },
                { id: 'store-b', name: 'BudgetFoods' },
            ],
            prices: [
                {
                    merchantProductId: 'mp-oil-a',
                    storeId: 'store-a',
                    masterProductId: 'master-oil',
                    productName: 'Olive Oil',
                    unit: '1L',
                    price: 13.99,
                    currency: 'CAD',
                    inStock: true,
                    availableQuantity: 5,
                },
                {
                    merchantProductId: 'mp-oil-b',
                    storeId: 'store-b',
                    masterProductId: 'master-oil',
                    productName: 'Olive Oil',
                    unit: '1L',
                    price: 12.99,
                    currency: 'CAD',
                    inStock: true,
                    availableQuantity: 4,
                },
                {
                    merchantProductId: 'mp-pasta-a',
                    storeId: 'store-a',
                    masterProductId: 'master-pasta',
                    productName: 'Pasta',
                    unit: '900g',
                    price: 2.99,
                    currency: 'CAD',
                    inStock: true,
                    availableQuantity: 9,
                },
                {
                    merchantProductId: 'mp-pasta-b',
                    storeId: 'store-b',
                    masterProductId: 'master-pasta',
                    productName: 'Pasta',
                    unit: '900g',
                    price: 3.49,
                    currency: 'CAD',
                    inStock: true,
                    availableQuantity: 9,
                },
            ],
        };

        const result = optimizeCart(input);

        expect(result.bestSingleStore).toEqual({
            storeId: 'store-a',
            storeName: 'FreshMart',
            totalCost: expect.any(Number),
            missingItemCount: 0,
            isFullyAvailable: true,
        });
        expect(result.summary.bestSingleStoreCost).toBeCloseTo(1.7312, 4);
        expect(result.summary.totalCartCost).toBeCloseTo(1.6312, 4);
        expect(result.summary.savingsVsSingleStore).toBeCloseTo(0.1, 4);
    });

    it('skips items with no available store and reports them as unavailable', () => {
        const input: SmartCartOptimizationInput = {
            shoppingList: [
                {
                    id: 'item-milk',
                    name: 'Milk',
                    quantity: 1,
                },
                {
                    id: 'item-eggs',
                    name: 'Eggs',
                    quantity: 1,
                },
            ],
            stores: [
                { id: 'store-a', name: 'FreshMart' },
                { id: 'store-b', name: 'BudgetFoods' },
            ],
            prices: [
                {
                    merchantProductId: 'mp-eggs-a',
                    storeId: 'store-a',
                    productName: 'Eggs',
                    unit: '12-pack',
                    price: 4.99,
                    currency: 'CAD',
                    inStock: true,
                    availableQuantity: 7,
                },
            ],
        };

        const result = optimizeCart(input);

        expect(result.items).toHaveLength(1);
        expect(result.items[0]).toEqual(expect.objectContaining({
            shoppingListItemId: 'item-eggs',
            selectedStoreId: 'store-a',
        }));
        expect(result.summary.unavailableItemCount).toBe(1);
        expect(result.summary.totalCartCost).toBeCloseTo(0.4158, 4);
        expect(result.bestSingleStore).toBeNull();
        expect(result.summary.savingsVsSingleStore).toBeNull();
    });
});
