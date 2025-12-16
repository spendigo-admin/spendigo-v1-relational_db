export interface OrderContext {
    userId: string;
    totalAmountCents: number;
    userLocation: { lat: number; lng: number };
    storeLocation: { lat: number; lng: number };
    recentOrderCount_1h: number; // Injected dependency (from DB count)
    ipAddress?: string;
}

export enum RiskLevel {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

export interface RiskAssessment {
    score: number; // 0 to 100
    level: RiskLevel;
    flags: string[];
}

export class FraudEngine {
    assess(context: OrderContext): RiskAssessment {
        let score = 0;
        const flags: string[] = [];

        // 1. Velocity Check
        if (context.recentOrderCount_1h > 5) {
            score += 50;
            flags.push('VELOCITY_HIGH_1H');
        }

        // 2. High Value Check
        if (context.totalAmountCents > 50000) { // $500
            score += 30;
            flags.push('HIGH_VALUE_ORDER');
        }

        // 3. Distance Check (Anomaly)
        const distanceKm = this.calculateDistance(
            context.userLocation.lat, context.userLocation.lng,
            context.storeLocation.lat, context.storeLocation.lng
        );

        if (distanceKm > 50) {
            score += 40;
            flags.push('ABNORMAL_DISTANCE');
        }

        // Determine Level
        let level = RiskLevel.LOW;
        if (score >= 80) level = RiskLevel.CRITICAL;
        else if (score >= 50) level = RiskLevel.HIGH;
        else if (score >= 20) level = RiskLevel.MEDIUM;

        return { score, level, flags };
    }

    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        // Simple Haversine (Duplicated utility, in prod move to shared/utils)
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
