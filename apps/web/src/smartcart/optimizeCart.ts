import {
    SmartCartDecisionExplanation,
    SmartCartItemDecision,
    SmartCartOptimizationInput,
    SmartCartOptimizationResult,
    SmartCartOptimizer,
    SmartCartPriceMatrixCell,
    SmartCartSingleStoreComparison,
    SmartCartStoreInput,
} from '../types/smartCart';
import { buildPriceMatrix } from './buildPriceMatrix';
import { buildSingleStoreComparisons } from './buildSingleStoreComparisons';
import { getComparableCellCost } from './costing';

const PREFERRED_STORE_TOLERANCE = 0.02; // 2% — mirrors smartcart_optimizer.ts

function compareCells(
    left: SmartCartPriceMatrixCell,
    right: SmartCartPriceMatrixCell,
    storeDistances: Map<string, number>,
): number {
    const leftCost = getComparableCellCost(left) ?? Number.POSITIVE_INFINITY;
    const rightCost = getComparableCellCost(right) ?? Number.POSITIVE_INFINITY;

    if (leftCost !== rightCost) {
        return leftCost - rightCost;
    }

    // Equal price: prefer the closer store when distances are known
    const leftDist = storeDistances.get(left.storeId) ?? Number.POSITIVE_INFINITY;
    const rightDist = storeDistances.get(right.storeId) ?? Number.POSITIVE_INFINITY;
    if (leftDist !== rightDist) {
        return leftDist - rightDist;
    }

    return left.storeName.localeCompare(right.storeName);
}

function applyPreferredStoreBias(
    cheapest: SmartCartPriceMatrixCell,
    availableCells: SmartCartPriceMatrixCell[],
    preferredStoreId: string | undefined,
): SmartCartPriceMatrixCell {
    if (!preferredStoreId || cheapest.storeId === preferredStoreId) return cheapest;

    const cheapestCost = getComparableCellCost(cheapest);
    if (cheapestCost === null || cheapestCost <= 0) return cheapest;

    const preferredCell = availableCells.find(c => c.storeId === preferredStoreId);
    if (!preferredCell) return cheapest;

    const preferredCost = getComparableCellCost(preferredCell);
    if (preferredCost === null) return cheapest;

    if ((preferredCost - cheapestCost) / cheapestCost <= PREFERRED_STORE_TOLERANCE) {
        return preferredCell;
    }

    return cheapest;
}

function buildItemExplanation(
    decision: SmartCartItemDecision,
    candidateStoreIds: string[],
    preferredStoreId: string | undefined,
): SmartCartDecisionExplanation {
    const isPreferredBias = preferredStoreId && decision.selectedStoreId === preferredStoreId && candidateStoreIds.length > 1;
    return {
        shoppingListItemId: decision.shoppingListItemId,
        selectedStoreId: decision.selectedStoreId,
        reasonCode: candidateStoreIds.length === 1 ? 'only_available_option' : 'lowest_price',
        summary: candidateStoreIds.length === 1
            ? `${decision.selectedStoreName} was the only store with this item available.`
            : isPreferredBias
                ? `${decision.selectedStoreName} was selected as your preferred store (within ${(PREFERRED_STORE_TOLERANCE * 100).toFixed(0)}% of the lowest price).`
                : `${decision.selectedStoreName} was selected because it had the lowest normalized price for this item.`,
        consideredStoreIds: candidateStoreIds,
    };
}

function findBestSingleStore(
    comparisons: SmartCartSingleStoreComparison[],
): SmartCartSingleStoreComparison | null {
    const fullyAvailable = comparisons.filter(comparison => comparison.isFullyAvailable);

    if (fullyAvailable.length === 0) {
        return null;
    }

    return fullyAvailable.reduce((best, candidate) => {
        if (candidate.totalWithDelivery < best.totalWithDelivery) {
            return candidate;
        }

        if (candidate.totalWithDelivery === best.totalWithDelivery) {
            return candidate.storeName.localeCompare(best.storeName) < 0 ? candidate : best;
        }

        return best;
    });
}

function calculateMultiStoreDeliveryFees(
    items: SmartCartItemDecision[],
    stores: SmartCartStoreInput[],
): number {
    const storeMap = new Map(stores.map(s => [s.id, s]));
    const storeSubtotals = new Map<string, number>();

    items.forEach(item => {
        const current = storeSubtotals.get(item.selectedStoreId) ?? 0;
        storeSubtotals.set(item.selectedStoreId, current + item.lineTotal);
    });

    let totalFees = 0;
    storeSubtotals.forEach((subtotal, storeId) => {
        const store = storeMap.get(storeId);
        if (!store?.deliveryFee || store.deliveryFee <= 0) return;
        if (store.freeDeliveryThreshold && subtotal >= store.freeDeliveryThreshold) return;
        totalFees += store.deliveryFee;
    });

    return totalFees;
}

export function optimizeCart(input: SmartCartOptimizationInput): SmartCartOptimizationResult {
    const matrix = buildPriceMatrix(input);
    const singleStoreComparisons = buildSingleStoreComparisons(matrix);
    const bestSingleStore = findBestSingleStore(singleStoreComparisons);
    const preferredStoreId = input.preferredStoreId;

    // Build distance lookup for tie-breaking (closer store wins equal-price items)
    const storeDistances = new Map<string, number>(
        input.stores
            .filter(s => s.distanceKm !== undefined)
            .map(s => [s.id, s.distanceKm!]),
    );

    const items: SmartCartItemDecision[] = [];
    const explanations: SmartCartDecisionExplanation[] = [];

    matrix.rows.forEach(row => {
        const availableCells = Object.values(row.cells)
            .filter(cell => getComparableCellCost(cell) !== null)
            .sort((a, b) => compareCells(a, b, storeDistances));

        if (availableCells.length === 0) {
            return;
        }

        const cheapestCell = availableCells[0];
        const selectedCell = applyPreferredStoreBias(cheapestCell, availableCells, preferredStoreId);
        const selectedComparableCost = getComparableCellCost(selectedCell);

        if (selectedComparableCost === null || selectedCell.merchantProductId === null) {
            return;
        }

        const decision: SmartCartItemDecision = {
            shoppingListItemId: row.shoppingListItemId,
            quantity: row.quantity,
            selectedStoreId: selectedCell.storeId,
            selectedStoreName: selectedCell.storeName,
            selectedMerchantProductId: selectedCell.merchantProductId,
            unitPrice: selectedComparableCost,
            lineTotal: selectedComparableCost * row.quantity,
            candidateCount: availableCells.length,
        };

        items.push(decision);
        explanations.push(buildItemExplanation(decision, availableCells.map(cell => cell.storeId), preferredStoreId));
    });

    const totalCartCost = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const deliveryFees = calculateMultiStoreDeliveryFees(items, input.stores);
    const totalWithDelivery = totalCartCost + deliveryFees;
    const unavailableItemCount = matrix.rows.length - items.length;
    const selectedStoreCount = new Set(items.map(item => item.selectedStoreId)).size;

    const bestSingleStoreWithDelivery = bestSingleStore?.totalWithDelivery ?? null;

    return {
        items,
        summary: {
            selectedStoreCount,
            totalCartCost: totalWithDelivery,
            bestSingleStoreCost: bestSingleStoreWithDelivery,
            savingsVsSingleStore: bestSingleStoreWithDelivery !== null ? bestSingleStoreWithDelivery - totalWithDelivery : null,
            unavailableItemCount,
        },
        bestSingleStore,
        singleStoreComparisons,
        explanations,
    };
}

export class CheapestAvailableCartOptimizer implements SmartCartOptimizer {
    optimize(input: SmartCartOptimizationInput): SmartCartOptimizationResult {
        return optimizeCart(input);
    }
}
