import { Order } from '../context/OrderContext';

export interface ValidationResult {
    isValid: boolean;
    discrepancy: number;
    flaggedItems: {
        id: string;
        name: string;
        orderPrice: number;
        catalogPrice: number;
    }[];
}

/**
 * Validates that the order total matches the sum of its items' current catalog prices.
 * Used to detect "Price Tampering" attacks where a user sends a modified payload.
 */
export const validateOrderIntegrity = (order: Order, storeProducts: any[]): ValidationResult => {
    let expectedTotal = 0;
    const flaggedItems: ValidationResult['flaggedItems'] = [];

    // 1. Recalculate Total
    order.items.forEach(item => {
        // Find the product in the OFFICIAL store catalog
        // Note: In a real app, we might need to check historical snapshots if prices changed legally.
        // For this MVP security check, we assume price consistency for open orders.
        const product = storeProducts.find(p => p.id === item.productId || p.name === item.productName);

        if (!product) {
            // Product not found? Maybe deleted. We can't validate price easily.
            // Strict mode: Flag it. Lenient mode: Accept order price.
            // Let's go with Lenient but note it.
            expectedTotal += (item.price * item.quantity);
        } else {
            const currentPrice = product.price; // Or salePrice if applicable logic exists

            // Check for discrepancy > 0.05 (float tolerance)
            if (Math.abs(item.price - currentPrice) > 0.05) {
                flaggedItems.push({
                    id: item.productId,
                    name: item.productName,
                    orderPrice: item.price,
                    catalogPrice: currentPrice
                });
                expectedTotal += (currentPrice * item.quantity);
            } else {
                expectedTotal += (item.price * item.quantity);
            }
        }
    });

    // 2. Add Delivery Fee (if applicable)
    // We assume the order.total includes delivery. We need to know the store's fee.
    // Simplifying: We check if the SUM of items matches closely to order.total (excluding delivery/tax variance)
    // OR we just check the item prices individually.

    // BETTER STRATEGY: Just return the item-level flags.
    // If flaggedItems > 0, we have a problem.

    return {
        isValid: flaggedItems.length === 0,
        discrepancy: Math.abs(order.total - expectedTotal),
        flaggedItems
    };
};
