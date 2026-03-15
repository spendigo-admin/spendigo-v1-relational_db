"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulateSingleStoreCart = simulateSingleStoreCart;
exports.findBestSingleStoreOption = findBestSingleStoreOption;
const priceNormalization_1 = require("./priceNormalization");
function getBestAvailableStoreOffer(productId, products) {
    const matchingOffers = products
        .filter(product => product.master_product_id === productId &&
        product.available_quantity > 0 &&
        product.is_active !== false)
        .map(product => {
        var _a, _b, _c;
        const packageSize = (_c = (_b = (_a = product.package_size) !== null && _a !== void 0 ? _a : product.unit_size) !== null && _b !== void 0 ? _b : product.net_quantity_unit) !== null && _c !== void 0 ? _c : null;
        const unitPrice = packageSize ? (0, priceNormalization_1.normalizeUnitPrice)(product.price, packageSize) : null;
        return unitPrice === null ? null : { inventory: product, unitPrice };
    })
        .filter((product) => Boolean(product));
    if (matchingOffers.length === 0) {
        return null;
    }
    return matchingOffers.reduce((best, candidate) => {
        if (candidate.unitPrice < best.unitPrice) {
            return candidate;
        }
        if (candidate.unitPrice === best.unitPrice && candidate.inventory.price < best.inventory.price) {
            return candidate;
        }
        return best;
    });
}
function simulateSingleStoreCart(shoppingList, storeProductData) {
    const missing_items = [];
    let cart_cost = 0;
    shoppingList.forEach(productId => {
        const offer = getBestAvailableStoreOffer(productId, storeProductData.inventory);
        if (!offer) {
            missing_items.push(productId);
            return;
        }
        cart_cost += offer.unitPrice;
    });
    return {
        store_id: storeProductData.store.id,
        store_name: storeProductData.store.name,
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