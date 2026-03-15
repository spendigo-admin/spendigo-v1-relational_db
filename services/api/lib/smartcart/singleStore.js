"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulateSingleStoreCart = simulateSingleStoreCart;
exports.findBestSingleStoreOption = findBestSingleStoreOption;
function getBestAvailableStoreOffer(productId, products) {
    const matchingOffers = products.filter(product => product.product_id === productId &&
        product.available &&
        Number.isFinite(product.unit_price));
    if (matchingOffers.length === 0) {
        return null;
    }
    return matchingOffers.reduce((best, candidate) => {
        if (candidate.unit_price < best.unit_price) {
            return candidate;
        }
        if (candidate.unit_price === best.unit_price && candidate.price < best.price) {
            return candidate;
        }
        return best;
    });
}
function simulateSingleStoreCart(shoppingList, storeProductData) {
    const missing_items = [];
    let cart_cost = 0;
    shoppingList.forEach(productId => {
        const offer = getBestAvailableStoreOffer(productId, storeProductData.products);
        if (!offer) {
            missing_items.push(productId);
            return;
        }
        cart_cost += offer.unit_price;
    });
    return {
        store_id: storeProductData.store_id,
        store_name: storeProductData.store_name,
        cart_cost: missing_items.length === 0 ? cart_cost : null,
        missing_items,
    };
}
function findBestSingleStoreOption(shoppingList, storeProducts) {
    const options = storeProducts.map(store => simulateSingleStoreCart(shoppingList, store));
    const feasible = options.filter(option => option.cart_cost !== null);
    if (feasible.length === 0) {
        return null;
    }
    return feasible.reduce((best, candidate) => {
        var _a, _b;
        if (((_a = candidate.cart_cost) !== null && _a !== void 0 ? _a : Number.POSITIVE_INFINITY) < ((_b = best.cart_cost) !== null && _b !== void 0 ? _b : Number.POSITIVE_INFINITY)) {
            return candidate;
        }
        if (candidate.cart_cost === best.cart_cost) {
            return candidate.store_id.localeCompare(best.store_id) < 0 ? candidate : best;
        }
        return best;
    });
}
//# sourceMappingURL=singleStore.js.map