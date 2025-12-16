import { describe, it, expect } from 'vitest';
import { FraudEngine, OrderContext, RiskLevel } from '../../services/api/src/risk/fraud-engine';

describe('FraudEngine', () => {
    const engine = new FraudEngine();

    const safeContext: OrderContext = {
        userId: 'u1',
        totalAmountCents: 2000,
        userLocation: { lat: 43.65, lng: -79.38 }, // Toronto
        storeLocation: { lat: 43.66, lng: -79.39 }, // Nearby
        recentOrderCount_1h: 1
    };

    it('returns LOW risk for normal transaction', () => {
        const assessment = engine.assess(safeContext);
        expect(assessment.level).toBe(RiskLevel.LOW);
        expect(assessment.score).toBe(0);
    });

    it('flags HIGH VELOCITY', () => {
        const riskyContext = { ...safeContext, recentOrderCount_1h: 6 };
        const assessment = engine.assess(riskyContext);
        expect(assessment.flags).toContain('VELOCITY_HIGH_1H');
        expect(assessment.score).toBeGreaterThanOrEqual(50);
    });

    it('flags HIGH VALUE', () => {
        const riskyContext = { ...safeContext, totalAmountCents: 60000 };
        const assessment = engine.assess(riskyContext);
        expect(assessment.flags).toContain('HIGH_VALUE_ORDER');
    });

    it('flags ABNORMAL DISTANCE', () => {
        const riskyContext = {
            ...safeContext,
            userLocation: { lat: 43.65, lng: -79.38 }, // Toronto
            storeLocation: { lat: 45.42, lng: -75.69 }  // Ottawa (~350km away)
        };
        const assessment = engine.assess(riskyContext);
        expect(assessment.flags).toContain('ABNORMAL_DISTANCE');
    });
});
