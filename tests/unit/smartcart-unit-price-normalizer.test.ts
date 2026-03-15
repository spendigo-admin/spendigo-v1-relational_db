import { describe, expect, it } from 'vitest';
import { normalizeSmartCartUnitPrice } from '../../apps/web/src/smartcart/smartcart_unit_price_normalizer';

describe('smartcart_unit_price_normalizer', () => {
    it('normalizes volume products consistently across package sizes', () => {
        const oneLiter = normalizeSmartCartUnitPrice({
            product_id: 'olive-oil-1l',
            price: 14.49,
            package_size: '1L',
            unit_type: 'volume',
        });

        const sevenFiftyMl = normalizeSmartCartUnitPrice({
            product_id: 'olive-oil-750ml',
            price: 11.99,
            package_size: '750ml',
            unit_type: 'volume',
        });

        expect(oneLiter).toEqual({
            product_id: 'olive-oil-1l',
            price: 14.49,
            normalized_unit_price: expect.any(Number),
        });
        expect(sevenFiftyMl).toEqual({
            product_id: 'olive-oil-750ml',
            price: 11.99,
            normalized_unit_price: expect.any(Number),
        });
        expect(oneLiter.normalized_unit_price).toBeCloseTo(1.449, 4);
        expect(sevenFiftyMl.normalized_unit_price).toBeCloseTo(1.5987, 4);
        expect(oneLiter.normalized_unit_price).toBeLessThan(sevenFiftyMl.normalized_unit_price);
    });

    it('normalizes weight products consistently across package sizes', () => {
        const fiveHundredGrams = normalizeSmartCartUnitPrice({
            product_id: 'rice-500g',
            price: 3.49,
            package_size: '500g',
            unit_type: 'weight',
        });

        const oneKilogram = normalizeSmartCartUnitPrice({
            product_id: 'rice-1kg',
            price: 6.49,
            package_size: '1kg',
            unit_type: 'weight',
        });

        expect(fiveHundredGrams.normalized_unit_price).toBeCloseTo(0.698, 4);
        expect(oneKilogram.normalized_unit_price).toBeCloseTo(0.649, 4);
        expect(oneKilogram.normalized_unit_price).toBeLessThan(fiveHundredGrams.normalized_unit_price);
    });

    it('throws when package size cannot be normalized', () => {
        expect(() => normalizeSmartCartUnitPrice({
            product_id: 'mystery-item',
            price: 4.99,
            package_size: 'Family Size',
            unit_type: 'weight',
        })).toThrow('Unable to normalize unit price for product "mystery-item".');
    });

    it('throws when the declared unit type does not match the package size', () => {
        expect(() => normalizeSmartCartUnitPrice({
            product_id: 'bad-input',
            price: 4.99,
            package_size: '1L',
            unit_type: 'weight',
        })).toThrow(
            'Unit type mismatch for product "bad-input": expected weight, got volume.',
        );
    });
});
