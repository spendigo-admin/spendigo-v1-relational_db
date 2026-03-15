"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPriceMatrix = buildPriceMatrix;
function buildPriceMatrix(normalizedProducts, storeProductData) {
    const matrix = {};
    normalizedProducts.forEach(productId => {
        matrix[productId] = {};
    });
    storeProductData.forEach(store => {
        store.products.forEach(product => {
            if (!product.available) {
                return;
            }
            if (!matrix[product.product_id]) {
                return;
            }
            const currentPrice = matrix[product.product_id][store.store_id];
            if (currentPrice === undefined || product.unit_price < currentPrice) {
                matrix[product.product_id][store.store_id] = product.unit_price;
            }
        });
    });
    return matrix;
}
//# sourceMappingURL=priceMatrix.js.map