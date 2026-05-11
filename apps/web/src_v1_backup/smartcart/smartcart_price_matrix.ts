import { calculateUnitPrice } from './priceNormalization';

export interface SmartCartNormalizedProduct {
    product_id: string;
}

export interface SmartCartStoreProductPriceData {
    product_id: string;
    price: number;
    package_size: string;
    unit_price?: number;
    available: boolean;
}

export interface SmartCartPriceMatrixStoreEntry {
    store_id: string;
    products: SmartCartStoreProductPriceData[];
}

export interface SmartCartPriceMatrixInput {
    normalized_products: Array<SmartCartNormalizedProduct | string>;
    store_products: SmartCartPriceMatrixStoreEntry[];
}

export type SmartCartPriceMatrix = Record<string, Record<string, number>>;

function getProductId(product: SmartCartNormalizedProduct | string): string {
    return typeof product === 'string' ? product : product.product_id;
}

function getNormalizedUnitPrice(product: SmartCartStoreProductPriceData): number | null {
    const computedUnitPrice = calculateUnitPrice({
        price: product.price,
        packageSize: product.package_size,
    });

    if (computedUnitPrice) {
        return computedUnitPrice.pricePerComparisonUnit;
    }

    if (typeof product.unit_price === 'number' && Number.isFinite(product.unit_price)) {
        return product.unit_price;
    }

    return null;
}

export function buildSmartCartPriceMatrix(input: SmartCartPriceMatrixInput): SmartCartPriceMatrix {
    const matrix: SmartCartPriceMatrix = {};

    input.normalized_products.forEach(product => {
        const productId = getProductId(product);
        matrix[productId] = {};
    });

    input.store_products.forEach(store => {
        store.products.forEach(product => {
            if (!product.available) {
                return;
            }

            const normalizedUnitPrice = getNormalizedUnitPrice(product);

            if (normalizedUnitPrice === null) {
                return;
            }

            if (!matrix[product.product_id]) {
                return;
            }

            const currentPrice = matrix[product.product_id][store.store_id];

            if (currentPrice === undefined || normalizedUnitPrice < currentPrice) {
                matrix[product.product_id][store.store_id] = normalizedUnitPrice;
            }
        });
    });

    return matrix;
}
