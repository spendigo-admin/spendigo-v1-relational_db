"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimizeCart = optimizeCart;
function compareOffers(left, right) {
    if (left.offer.unit_price !== right.offer.unit_price) {
        return left.offer.unit_price - right.offer.unit_price;
    }
    if (left.offer.price !== right.offer.price) {
        return left.offer.price - right.offer.price;
    }
    return left.store_id.localeCompare(right.store_id);
}
function findAvailableOffers(productId, storeProducts) {
    return storeProducts.flatMap(store => {
        const matchingOffers = store.products.filter(product => product.product_id === productId &&
            product.available &&
            Number.isFinite(product.price) &&
            Number.isFinite(product.unit_price));
        return matchingOffers.map(offer => ({
            store_id: store.store_id,
            offer,
        }));
    });
}
function optimizeCart(shoppingList, storeProducts) {
    const optimized_items = [];
    const store_distribution = {};
    shoppingList.forEach(productId => {
        const availableOffers = findAvailableOffers(productId, storeProducts).sort(compareOffers);
        if (availableOffers.length === 0) {
            throw new Error(`Product "${productId}" is unavailable in all eligible stores.`);
        }
        const selected = availableOffers[0];
        optimized_items.push({
            product_id: productId,
            chosen_store: selected.store_id,
            price: selected.offer.price,
            unit_price: selected.offer.unit_price,
        });
        if (!store_distribution[selected.store_id]) {
            store_distribution[selected.store_id] = [];
        }
        store_distribution[selected.store_id].push(productId);
    });
    return {
        optimized_items,
        total_cost: optimized_items.reduce((sum, item) => sum + item.unit_price, 0),
        store_distribution,
    };
}
//# sourceMappingURL=optimizer.js.map