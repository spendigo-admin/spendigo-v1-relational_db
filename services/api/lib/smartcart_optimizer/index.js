"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimize_cart = optimize_cart;
const priceNormalization_1 = require("../api/src/smartcart/priceNormalization");
function compare_offers(left, right) {
    if (left.unit_price !== right.unit_price) {
        return left.unit_price - right.unit_price;
    }
    if (left.inventory.price !== right.inventory.price) {
        return left.inventory.price - right.inventory.price;
    }
    return left.store_id.localeCompare(right.store_id);
}
function get_inventory_package_size(inventory) {
    var _a, _b, _c;
    const packageSize = (_c = (_b = (_a = inventory.package_size) !== null && _a !== void 0 ? _a : inventory.unit_size) !== null && _b !== void 0 ? _b : inventory.net_quantity_unit) !== null && _c !== void 0 ? _c : null;
    return typeof packageSize === 'string' && packageSize.trim().length > 0 ? packageSize.trim() : null;
}
function find_available_offers(product_id, store_data) {
    return store_data.flatMap(store => {
        return store.inventory
            .filter(product => product.master_product_id === product_id &&
            product.available_quantity > 0 &&
            product.is_active !== false &&
            Number.isFinite(product.price))
            .map(inventory => {
            const packageSize = get_inventory_package_size(inventory);
            const unit_price = packageSize ? (0, priceNormalization_1.normalizeUnitPrice)(inventory.price, packageSize) : null;
            return unit_price === null
                ? null
                : {
                    store_id: store.store.id,
                    inventory,
                    unit_price,
                };
        })
            .filter((offer) => Boolean(offer));
    });
}
function optimize_cart(shopping_list, store_data) {
    const optimized_items = [];
    const store_distribution = {};
    shopping_list.forEach(product_id => {
        const available_offers = find_available_offers(product_id, store_data).sort(compare_offers);
        if (available_offers.length === 0) {
            throw new Error(`Product "${product_id}" is unavailable in all eligible stores.`);
        }
        const selected_offer = available_offers[0];
        optimized_items.push({
            product_id,
            chosen_store: selected_offer.store_id,
            price: selected_offer.inventory.price,
            unit_price: selected_offer.unit_price,
        });
        if (!store_distribution[selected_offer.store_id]) {
            store_distribution[selected_offer.store_id] = [];
        }
        store_distribution[selected_offer.store_id].push(product_id);
    });
    return {
        optimized_items,
        total_cost: optimized_items.reduce((sum, item) => sum + item.unit_price, 0),
        store_distribution,
    };
}
//# sourceMappingURL=index.js.map