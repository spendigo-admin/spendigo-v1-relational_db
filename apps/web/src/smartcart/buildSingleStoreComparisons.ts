import {
    SmartCartPriceMatrix,
    SmartCartSingleStoreComparison,
} from '../types/smartCart';
import { getComparableCellCost } from './costing';

function calculateDeliveryFee(store: { deliveryFee?: number; freeDeliveryThreshold?: number }, subtotal: number): number {
    if (!store.deliveryFee || store.deliveryFee <= 0) {
        return 0;
    }
    if (store.freeDeliveryThreshold && subtotal >= store.freeDeliveryThreshold) {
        return 0;
    }
    return store.deliveryFee;
}

export function buildSingleStoreComparisons(matrix: SmartCartPriceMatrix): SmartCartSingleStoreComparison[] {
    // Pre-compute the average unit price across all stores for each row.
    // Used to estimate the cost of items a store doesn't carry so that
    // incomplete stores are not artificially cheap in the comparison.
    const rowAverageCosts: number[] = matrix.rows.map(row => {
        const availableCosts = Object.values(row.cells)
            .map(cell => getComparableCellCost(cell))
            .filter((cost): cost is number => cost !== null);

        if (availableCosts.length === 0) return 0;
        return availableCosts.reduce((sum, c) => sum + c, 0) / availableCosts.length;
    });

    return matrix.storeColumns.map(store => {
        let totalCost = 0;
        let missingItemCount = 0;

        matrix.rows.forEach((row, idx) => {
            const cell = row.cells[store.id];
            const comparableCost = cell ? getComparableCellCost(cell) : null;

            if (comparableCost === null) {
                missingItemCount += 1;
                // Penalise the store by adding the average market price for the
                // missing item so its total is fairly comparable to stores that
                // carry the full list.
                totalCost += rowAverageCosts[idx] * row.quantity;
                return;
            }

            totalCost += comparableCost * row.quantity;
        });

        const deliveryFee = calculateDeliveryFee(store, totalCost);

        return {
            storeId: store.id,
            storeName: store.name,
            totalCost,
            deliveryFee,
            totalWithDelivery: totalCost + deliveryFee,
            missingItemCount,
            isFullyAvailable: missingItemCount === 0,
        };
    });
}
