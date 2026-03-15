"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPriceMatrix = buildPriceMatrix;
const priceNormalization_1 = require("./priceNormalization");
function getInventoryPackageSize(inventory) {
    var _a, _b, _c;
    const packageSize = (_c = (_b = (_a = inventory.package_size) !== null && _a !== void 0 ? _a : inventory.unit_size) !== null && _b !== void 0 ? _b : inventory.net_quantity_unit) !== null && _c !== void 0 ? _c : null;
    return typeof packageSize === 'string' && packageSize.trim().length > 0 ? packageSize.trim() : null;
}
function buildPriceMatrix(normalizedProducts, storeProductData) {
    const matrix = {};
    normalizedProducts.forEach(productId => {
        matrix[productId] = {};
    });
    storeProductData.forEach(store => {
        store.inventory.forEach(product => {
            if (product.available_quantity <= 0 || product.is_active === false) {
                return;
            }
            if (!matrix[product.master_product_id]) {
                return;
            }
            const packageSize = getInventoryPackageSize(product);
            const normalizedUnitPrice = packageSize ? (0, priceNormalization_1.normalizeUnitPrice)(product.price, packageSize) : null;
            if (normalizedUnitPrice === null) {
                return;
            }
            const currentPrice = matrix[product.master_product_id][store.store.id];
            if (currentPrice === undefined || normalizedUnitPrice < currentPrice) {
                matrix[product.master_product_id][store.store.id] = normalizedUnitPrice;
            }
        });
    });
    return matrix;
}
//# sourceMappingURL=priceMatrix.js.map