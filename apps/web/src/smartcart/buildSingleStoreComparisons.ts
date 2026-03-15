import {
    SmartCartPriceMatrix,
    SmartCartSingleStoreComparison,
} from '../types/smartCart';
import { getComparableCellCost } from './costing';

export function buildSingleStoreComparisons(matrix: SmartCartPriceMatrix): SmartCartSingleStoreComparison[] {
    return matrix.storeColumns.map(store => {
        let totalCost = 0;
        let missingItemCount = 0;

        matrix.rows.forEach(row => {
            const cell = row.cells[store.id];
            const comparableCost = cell ? getComparableCellCost(cell) : null;

            if (comparableCost === null) {
                missingItemCount += 1;
                return;
            }

            totalCost += comparableCost * row.quantity;
        });

        return {
            storeId: store.id,
            storeName: store.name,
            totalCost,
            missingItemCount,
            isFullyAvailable: missingItemCount === 0,
        };
    });
}
