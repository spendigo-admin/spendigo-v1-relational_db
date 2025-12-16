import { describe, it, expect } from 'vitest';
import { TaxService } from '../../services/api/src/compliance/tax';

describe('TaxService (Canada)', () => {
    const taxService = new TaxService();

    it('calculates Ontario HST (13%) correctly', () => {
        // $100.00
        const result = taxService.calculateTax(10000, 'ON');
        expect(result.hst).toBe(1300);
        expect(result.gst).toBe(0);
        expect(result.totalTaxCents).toBe(1300);
    });

    it('calculates Alberta GST (5%) correctly', () => {
        // $100.00
        const result = taxService.calculateTax(10000, 'AB');
        expect(result.hst).toBe(0);
        expect(result.gst).toBe(500);
        expect(result.totalTaxCents).toBe(500);
    });

    it('calculates Quebec GST + QST (5% + 9.975%) correctly', () => {
        // $100.00
        const result = taxService.calculateTax(10000, 'QC');
        expect(result.gst).toBe(500);
        // 9.975% of 10000 = 997.5 -> 998 rounded
        expect(result.qst).toBe(998);
        expect(result.totalTaxCents).toBe(1498);
    });

    it('handles Zero-Rated items', () => {
        const result = taxService.calculateTax(10000, 'ON', true);
        expect(result.totalTaxCents).toBe(0);
    });
});
