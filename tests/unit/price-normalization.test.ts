import { describe, expect, it } from 'vitest';
import {
    calculateUnitPrice,
    normalizeComparablePriceOffer,
    parsePackageSize,
} from '../../apps/web/src/smartcart/priceNormalization';

describe('priceNormalization', () => {
    it('parses metric volume sizes into milliliters', () => {
        expect(parsePackageSize('750ml')).toEqual({
            rawSize: '750ml',
            quantity: 750,
            unit: 'ml',
            measureType: 'volume',
            baseQuantity: 750,
            baseUnit: 'ml',
        });

        expect(parsePackageSize('1L')).toEqual({
            rawSize: '1L',
            quantity: 1,
            unit: 'L',
            measureType: 'volume',
            baseQuantity: 1000,
            baseUnit: 'ml',
        });
    });

    it('calculates fair unit prices for comparable package sizes', () => {
        const oliveOil750 = calculateUnitPrice({ price: 11.99, packageSize: '750ml' });
        const oliveOil1L = calculateUnitPrice({ price: 14.49, packageSize: '1L' });

        expect(oliveOil750).not.toBeNull();
        expect(oliveOil1L).not.toBeNull();
        expect(oliveOil750?.comparisonUnit).toBe('100ml');
        expect(oliveOil1L?.comparisonUnit).toBe('100ml');
        expect(oliveOil750?.pricePerComparisonUnit).toBeCloseTo(1.5987, 4);
        expect(oliveOil1L?.pricePerComparisonUnit).toBeCloseTo(1.449, 4);
        expect(oliveOil1L?.pricePerComparisonUnit).toBeLessThan(oliveOil750?.pricePerComparisonUnit ?? Infinity);
    });

    it('normalizes weight-based products into grams', () => {
        const result = calculateUnitPrice({ price: 8.99, packageSize: '1kg' });

        expect(result).not.toBeNull();
        expect(result?.packageSize.measureType).toBe('weight');
        expect(result?.packageSize.baseQuantity).toBe(1000);
        expect(result?.comparisonUnit).toBe('100g');
        expect(result?.pricePerComparisonUnit).toBeCloseTo(0.899, 4);
    });

    it('supports count-based pack sizes', () => {
        const result = calculateUnitPrice({ price: 5.99, packageSize: '6-pack' });

        expect(result).not.toBeNull();
        expect(result?.packageSize.measureType).toBe('count');
        expect(result?.packageSize.baseUnit).toBe('ea');
        expect(result?.comparisonUnit).toBe('ea');
        expect(result?.pricePerComparisonUnit).toBeCloseTo(0.9983, 4);
    });

    it('returns null when package size cannot be normalized', () => {
        expect(parsePackageSize('Family Size')).toBeNull();
        expect(calculateUnitPrice({ price: 4.99, packageSize: 'Family Size' })).toBeNull();
        expect(normalizeComparablePriceOffer({
            merchantProductId: 'mp-1',
            productName: 'Mystery Item',
            storeId: 'store-1',
            price: 4.99,
            packageSize: 'Family Size',
        })).toBeNull();
    });

    it('builds a comparable price offer for future optimizer inputs', () => {
        const result = normalizeComparablePriceOffer({
            merchantProductId: 'mp-olive-1',
            productName: 'Olive Oil',
            storeId: 'store-1',
            price: 14.49,
            packageSize: '1L',
        });

        expect(result).not.toBeNull();
        expect(result?.normalizedPackageSize.baseQuantity).toBe(1000);
        expect(result?.unitPrice.comparisonUnit).toBe('100ml');
        expect(result?.unitPrice.pricePerComparisonUnit).toBeCloseTo(1.449, 4);
    });
});
