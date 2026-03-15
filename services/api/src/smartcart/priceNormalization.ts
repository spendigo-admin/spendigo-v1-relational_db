type MeasureType = 'volume' | 'weight';

interface UnitDefinition {
    measureType: MeasureType;
    multiplier: number;
    comparisonQuantity: number;
}

const UNIT_DEFINITIONS: Record<string, UnitDefinition> = {
    ml: { measureType: 'volume', multiplier: 1, comparisonQuantity: 100 },
    l: { measureType: 'volume', multiplier: 1000, comparisonQuantity: 100 },
    g: { measureType: 'weight', multiplier: 1, comparisonQuantity: 100 },
    kg: { measureType: 'weight', multiplier: 1000, comparisonQuantity: 100 },
};

const PACKAGE_SIZE_PATTERN = /(\d+(?:\.\d+)?)\s*(ml|l|g|kg)\b/i;

export function normalizeUnitPrice(price: number, packageSize: string): number | null {
    if (!Number.isFinite(price) || price < 0) {
        return null;
    }

    const match = packageSize.trim().match(PACKAGE_SIZE_PATTERN);

    if (!match) {
        return null;
    }

    const quantity = Number(match[1]);
    const unitKey = match[2].toLowerCase();
    const unitDefinition = UNIT_DEFINITIONS[unitKey];

    if (!Number.isFinite(quantity) || quantity <= 0 || !unitDefinition) {
        return null;
    }

    const baseQuantity = quantity * unitDefinition.multiplier;
    const pricePerBaseUnit = price / baseQuantity;

    const rawNormalized = pricePerBaseUnit * unitDefinition.comparisonQuantity;
    return Math.round(rawNormalized * 10000) / 10000;
}
