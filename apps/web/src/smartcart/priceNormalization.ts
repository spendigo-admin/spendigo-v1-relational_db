export type PackageMeasureType = 'volume' | 'weight' | 'count';

export type PackageBaseUnit = 'ml' | 'g' | 'ea';

export interface NormalizedPackageSize {
    rawSize: string;
    quantity: number;
    unit: string;
    measureType: PackageMeasureType;
    baseQuantity: number;
    baseUnit: PackageBaseUnit;
}

export interface UnitPriceCalculationInput {
    price: number;
    packageSize: string;
}

export interface UnitPriceCalculationResult {
    packageSize: NormalizedPackageSize;
    pricePerBaseUnit: number;
    comparisonQuantity: number;
    comparisonUnit: string;
    pricePerComparisonUnit: number;
}

export interface ComparablePriceOfferInput {
    merchantProductId: string;
    productName: string;
    storeId: string;
    price: number;
    packageSize: string;
}

export interface ComparablePriceOffer {
    merchantProductId: string;
    productName: string;
    storeId: string;
    price: number;
    packageSize: string;
    normalizedPackageSize: NormalizedPackageSize;
    unitPrice: UnitPriceCalculationResult;
}

const UNIT_ALIASES: Record<string, { unit: string; measureType: PackageMeasureType; multiplier: number; baseUnit: PackageBaseUnit; comparisonQuantity: number; comparisonUnit: string }> = {
    ml: { unit: 'ml', measureType: 'volume', multiplier: 1, baseUnit: 'ml', comparisonQuantity: 100, comparisonUnit: '100ml' },
    milliliter: { unit: 'ml', measureType: 'volume', multiplier: 1, baseUnit: 'ml', comparisonQuantity: 100, comparisonUnit: '100ml' },
    milliliters: { unit: 'ml', measureType: 'volume', multiplier: 1, baseUnit: 'ml', comparisonQuantity: 100, comparisonUnit: '100ml' },
    millilitre: { unit: 'ml', measureType: 'volume', multiplier: 1, baseUnit: 'ml', comparisonQuantity: 100, comparisonUnit: '100ml' },
    millilitres: { unit: 'ml', measureType: 'volume', multiplier: 1, baseUnit: 'ml', comparisonQuantity: 100, comparisonUnit: '100ml' },
    l: { unit: 'L', measureType: 'volume', multiplier: 1000, baseUnit: 'ml', comparisonQuantity: 100, comparisonUnit: '100ml' },
    liter: { unit: 'L', measureType: 'volume', multiplier: 1000, baseUnit: 'ml', comparisonQuantity: 100, comparisonUnit: '100ml' },
    liters: { unit: 'L', measureType: 'volume', multiplier: 1000, baseUnit: 'ml', comparisonQuantity: 100, comparisonUnit: '100ml' },
    litre: { unit: 'L', measureType: 'volume', multiplier: 1000, baseUnit: 'ml', comparisonQuantity: 100, comparisonUnit: '100ml' },
    litres: { unit: 'L', measureType: 'volume', multiplier: 1000, baseUnit: 'ml', comparisonQuantity: 100, comparisonUnit: '100ml' },
    g: { unit: 'g', measureType: 'weight', multiplier: 1, baseUnit: 'g', comparisonQuantity: 100, comparisonUnit: '100g' },
    gr: { unit: 'g', measureType: 'weight', multiplier: 1, baseUnit: 'g', comparisonQuantity: 100, comparisonUnit: '100g' },
    gram: { unit: 'g', measureType: 'weight', multiplier: 1, baseUnit: 'g', comparisonQuantity: 100, comparisonUnit: '100g' },
    grams: { unit: 'g', measureType: 'weight', multiplier: 1, baseUnit: 'g', comparisonQuantity: 100, comparisonUnit: '100g' },
    kg: { unit: 'kg', measureType: 'weight', multiplier: 1000, baseUnit: 'g', comparisonQuantity: 100, comparisonUnit: '100g' },
    kilogram: { unit: 'kg', measureType: 'weight', multiplier: 1000, baseUnit: 'g', comparisonQuantity: 100, comparisonUnit: '100g' },
    kilograms: { unit: 'kg', measureType: 'weight', multiplier: 1000, baseUnit: 'g', comparisonQuantity: 100, comparisonUnit: '100g' },
    ea: { unit: 'ea', measureType: 'count', multiplier: 1, baseUnit: 'ea', comparisonQuantity: 1, comparisonUnit: 'ea' },
    each: { unit: 'ea', measureType: 'count', multiplier: 1, baseUnit: 'ea', comparisonQuantity: 1, comparisonUnit: 'ea' },
    count: { unit: 'ea', measureType: 'count', multiplier: 1, baseUnit: 'ea', comparisonQuantity: 1, comparisonUnit: 'ea' },
    ct: { unit: 'ea', measureType: 'count', multiplier: 1, baseUnit: 'ea', comparisonQuantity: 1, comparisonUnit: 'ea' },
    pk: { unit: 'pk', measureType: 'count', multiplier: 1, baseUnit: 'ea', comparisonQuantity: 1, comparisonUnit: 'ea' },
    pack: { unit: 'pk', measureType: 'count', multiplier: 1, baseUnit: 'ea', comparisonQuantity: 1, comparisonUnit: 'ea' },
    packs: { unit: 'pk', measureType: 'count', multiplier: 1, baseUnit: 'ea', comparisonQuantity: 1, comparisonUnit: 'ea' },
};

const PACKAGE_SIZE_PATTERNS = [
    /(\d+(?:\.\d+)?)\s*(ml|milliliters?|millilitres?|l|liters?|litres?|g|gr|grams?|kg|kilograms?|ea|each|count|ct|pk|packs?|package|packages)\b/i,
    /(\d+(?:\.\d+)?)\s*-\s*(pack|pk)\b/i,
];

function getUnitDefinition(rawUnit: string) {
    const normalized = rawUnit.toLowerCase() === 'package' || rawUnit.toLowerCase() === 'packages'
        ? 'pack'
        : rawUnit.toLowerCase();

    return UNIT_ALIASES[normalized] ?? null;
}

export function parsePackageSize(packageSize: string): NormalizedPackageSize | null {
    const trimmed = packageSize.trim();

    if (!trimmed) {
        return null;
    }

    for (const pattern of PACKAGE_SIZE_PATTERNS) {
        const match = trimmed.match(pattern);

        if (!match) {
            continue;
        }

        const quantity = Number(match[1]);
        const unitDefinition = getUnitDefinition(match[2]);

        if (!Number.isFinite(quantity) || quantity <= 0 || !unitDefinition) {
            return null;
        }

        return {
            rawSize: packageSize,
            quantity,
            unit: unitDefinition.unit,
            measureType: unitDefinition.measureType,
            baseQuantity: quantity * unitDefinition.multiplier,
            baseUnit: unitDefinition.baseUnit,
        };
    }

    return null;
}

export function calculateUnitPrice(input: UnitPriceCalculationInput): UnitPriceCalculationResult | null {
    const parsedSize = parsePackageSize(input.packageSize);

    if (!parsedSize || !Number.isFinite(input.price) || input.price < 0) {
        return null;
    }

    const unitDefinition = getUnitDefinition(parsedSize.unit);

    if (!unitDefinition) {
        return null;
    }

    const pricePerBaseUnit = input.price / parsedSize.baseQuantity;
    const pricePerComparisonUnit = Math.round((pricePerBaseUnit * unitDefinition.comparisonQuantity) * 10000) / 10000;

    return {
        packageSize: parsedSize,
        pricePerBaseUnit,
        comparisonQuantity: unitDefinition.comparisonQuantity,
        comparisonUnit: unitDefinition.comparisonUnit,
        pricePerComparisonUnit,
    };
}

export function normalizeComparablePriceOffer(input: ComparablePriceOfferInput): ComparablePriceOffer | null {
    const unitPrice = calculateUnitPrice({
        price: input.price,
        packageSize: input.packageSize,
    });

    if (!unitPrice) {
        return null;
    }

    return {
        merchantProductId: input.merchantProductId,
        productName: input.productName,
        storeId: input.storeId,
        price: input.price,
        packageSize: input.packageSize,
        normalizedPackageSize: unitPrice.packageSize,
        unitPrice,
    };
}
