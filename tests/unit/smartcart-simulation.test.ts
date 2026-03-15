import { describe, expect, it } from 'vitest';
import {
    generateSmartCartSimulationCase,
    runSmartCartOptimizerSimulation,
} from '../../apps/web/src/smartcart/smartcart_simulation';

describe('smartcart_simulation', () => {
    it('generates the default synthetic case shape with five stores and one hundred products', () => {
        const result = generateSmartCartSimulationCase(5, 100, 42);

        expect(result.shopping_list).toHaveLength(100);
        expect(result.store_products).toHaveLength(5);
        expect(result.store_products.every(store => store.products.length === 100)).toBe(true);
    });

    it('runs two hundred optimization simulations and validates each run', () => {
        const result = runSmartCartOptimizerSimulation({
            iterations: 200,
            seed: 100,
        });

        expect(result.config).toEqual({
            storeCount: 5,
            productCount: 100,
            iterations: 200,
            seed: 100,
        });
        expect(result.runs).toHaveLength(200);
        expect(result.validations).toHaveLength(200);
        expect(result.validations.every(validation => validation.eachProductAppearsOnce)).toBe(true);
        expect(result.validations.every(validation => validation.noUnavailableProductSelected)).toBe(true);
        expect(result.validations.every(validation => validation.totalCostIsMinimized)).toBe(true);
        expect(result.printedReport.split('\n')).toHaveLength(200);
        expect(result.printedReport).toContain('optimized cart cost');
        expect(result.printedReport).toContain('best single-store cost');
        expect(result.printedReport).toContain('savings percentage');
    });
});
