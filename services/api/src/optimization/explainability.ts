import { OptimizedResult } from './types';

export function generateExplanation(result: OptimizedResult): string {
    const storeCount = result.stores.length;
    if (storeCount === 0) return "No stores found for these items.";
    if (storeCount === 1) return `Best option is ${result.stores[0].storeName} for a total of $${(result.totalCostCents / 100).toFixed(2)}.`;

    const savingsStr = (result.savingsCents / 100).toFixed(2);
    const storeNames = result.stores.map(s => s.storeName).join(' and ');

    return `SmartCart split your order between ${storeNames}. Even with multiple delivery fees, you saved $${savingsStr} compared to buying everything at a single store.`;
}
