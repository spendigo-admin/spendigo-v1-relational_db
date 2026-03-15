import {
    SmartCartListItemInput,
    SmartCartOptimizationInput,
    SmartCartPriceInput,
    SmartCartPriceMatrix,
    SmartCartPriceMatrixCell,
    SmartCartPriceMatrixRow,
    SmartCartStoreInput,
} from '../types/smartCart';
import { calculateUnitPrice } from './priceNormalization';

function normalizeName(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function matchesShoppingListItem(
    shoppingListItem: SmartCartListItemInput,
    priceInput: SmartCartPriceInput,
): boolean {
    if (shoppingListItem.preferredMasterProductId && priceInput.masterProductId) {
        return shoppingListItem.preferredMasterProductId === priceInput.masterProductId;
    }

    return normalizeName(shoppingListItem.name) === normalizeName(priceInput.productName);
}

function createEmptyCell(
    shoppingListItemId: string,
    store: SmartCartStoreInput,
): SmartCartPriceMatrixCell {
    return {
        shoppingListItemId,
        storeId: store.id,
        storeName: store.name,
        available: false,
        merchantProductId: null,
        productName: null,
        packageSize: null,
        price: null,
        unitPrice: null,
        comparisonUnit: null,
        availableQuantity: 0,
        isComparableByUnitPrice: false,
    };
}

function rankCellCandidate(
    currentCell: SmartCartPriceMatrixCell,
    nextCell: SmartCartPriceMatrixCell,
): SmartCartPriceMatrixCell {
    if (!currentCell.available) {
        return nextCell;
    }

    if (currentCell.isComparableByUnitPrice && nextCell.isComparableByUnitPrice) {
        return (nextCell.unitPrice ?? Number.POSITIVE_INFINITY) < (currentCell.unitPrice ?? Number.POSITIVE_INFINITY)
            ? nextCell
            : currentCell;
    }

    if (nextCell.isComparableByUnitPrice && !currentCell.isComparableByUnitPrice) {
        return nextCell;
    }

    if ((nextCell.price ?? Number.POSITIVE_INFINITY) < (currentCell.price ?? Number.POSITIVE_INFINITY)) {
        return nextCell;
    }

    return currentCell;
}

function buildCell(
    shoppingListItemId: string,
    store: SmartCartStoreInput,
    priceInput: SmartCartPriceInput,
): SmartCartPriceMatrixCell {
    const normalizedUnitPrice = priceInput.unit
        ? calculateUnitPrice({
            price: priceInput.price,
            packageSize: priceInput.unit,
        })
        : null;

    const availableQuantity = priceInput.availableQuantity ?? 0;
    const available = priceInput.inStock && (priceInput.availableQuantity === undefined || availableQuantity > 0);

    return {
        shoppingListItemId,
        storeId: store.id,
        storeName: store.name,
        available,
        merchantProductId: priceInput.merchantProductId,
        productName: priceInput.productName,
        packageSize: priceInput.unit ?? null,
        price: priceInput.price,
        unitPrice: normalizedUnitPrice?.pricePerComparisonUnit ?? null,
        comparisonUnit: normalizedUnitPrice?.comparisonUnit ?? null,
        availableQuantity,
        isComparableByUnitPrice: normalizedUnitPrice !== null,
    };
}

export function buildPriceMatrix(input: SmartCartOptimizationInput): SmartCartPriceMatrix {
    const storeMap = new Map(input.stores.map(store => [store.id, store]));

    const rows: SmartCartPriceMatrixRow[] = input.shoppingList.map(shoppingListItem => {
        const cells = Object.fromEntries(
            input.stores.map(store => [store.id, createEmptyCell(shoppingListItem.id, store)]),
        ) as Record<string, SmartCartPriceMatrixCell>;

        input.prices
            .filter(priceInput => matchesShoppingListItem(shoppingListItem, priceInput))
            .forEach(priceInput => {
                const store = storeMap.get(priceInput.storeId);

                if (!store) {
                    return;
                }

                const nextCell = buildCell(shoppingListItem.id, store, priceInput);
                cells[store.id] = rankCellCandidate(cells[store.id], nextCell);
            });

        return {
            shoppingListItemId: shoppingListItem.id,
            productName: shoppingListItem.name,
            quantity: shoppingListItem.quantity,
            preferredMasterProductId: shoppingListItem.preferredMasterProductId,
            cells,
        };
    });

    return {
        storeColumns: input.stores,
        rows,
    };
}
