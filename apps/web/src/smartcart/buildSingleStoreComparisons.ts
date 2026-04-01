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
