import { calculateUnitPrice } from './priceNormalization';

export type SmartCartUnitType = 'volume' | 'weight';

export interface SmartCartUnitPriceNormalizationInput {
    product_id: string;
    price: number;
    package_size: string;
    unit_type: SmartCartUnitType;
}

export interface SmartCartUnitPriceNormalizationResult {
    product_id: string;
    price: number;
    normalized_unit_price: number;
}

export function normalizeSmartCartUnitPrice(
    input: SmartCartUnitPriceNormalizationInput,
): SmartCartUnitPriceNormalizationResult {
    const normalized = calculateUnitPrice({
        price: input.price,
        packageSize: input.package_size,
    });

    if (!normalized) {
        throw new Error(`Unable to normalize unit price for product "${input.product_id}".`);
    }

    if (normalized.packageSize.measureType !== input.unit_type) {
        throw new Error(
            `Unit type mismatch for product "${input.product_id}": expected ${input.unit_type}, got ${normalized.packageSize.measureType}.`,
        );
    }

    return {
        product_id: input.product_id,
        price: input.price,
        normalized_unit_price: normalized.pricePerComparisonUnit,
    };
}
