import { OptimizationRequest, OptimizedResult, StoreCandidate } from './types';
import { generateExplanation } from './explainability';

// Helper: Haversine Distance (km)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}

export class SmartCartEngine {
    // In a real implementation, this would fetch from DB
    async findCandidates(request: OptimizationRequest): Promise<StoreCandidate[]> {
        // Mock Data returning candidates
        return [];
    }

    async optimize(request: OptimizationRequest, candidates: StoreCandidate[]): Promise<OptimizedResult> {
        // 1. Filter candidates by distance (max 10km for example)
        const validStores = candidates.filter(store =>
            calculateDistance(request.userLocation.lat, request.userLocation.lng, store.location.lat, store.location.lng) <= 10
        );

        // 2. Simple Heuristic: Greedy approach (Cheapest item price + Delivery allocation)
        // NOTE: This is a simplified version. The real "Hard" problem requires linear programming if complex.
        // For MVP, we iterate items and find the cheapest store *assuming* we already pay delivery if we pick that store.

        // Group items by cheapest store
        const cartMap = new Map<string, { storeId: string; price: number; itemIndex: number }>();

        // Naive Pass: Find absolute cheapest per item
        request.items.forEach((item, index) => {
            let bestPrice = Infinity;
            let bestStoreId = '';

            validStores.forEach(store => {
                const stock = store.inventory.find(i => i.productId === item.productId);
                if (stock && stock.inStock && stock.priceCents < bestPrice) {
                    bestPrice = stock.priceCents;
                    bestStoreId = store.storeId;
                }
            });

            if (bestStoreId) {
                cartMap.set(item.productId, { storeId: bestStoreId, price: bestPrice, itemIndex: index });
            }
        });

        // 3. Construct Result
        const resultStores = new Map<string, any>();
        let totalCost = 0;

        cartMap.forEach((val, productId) => {
            const store = validStores.find(s => s.storeId === val.storeId)!;

            if (!resultStores.has(val.storeId)) {
                resultStores.set(val.storeId, {
                    storeId: store.storeId,
                    storeName: store.storeName,
                    items: [],
                    subtotalCents: 0,
                    deliveryFeeCents: store.deliveryFeeCents
                });
                totalCost += store.deliveryFeeCents;
            }

            const storeGroup = resultStores.get(val.storeId);
            const quantity = request.items[val.itemIndex].quantity;
            const lineTotal = val.price * quantity;

            storeGroup.items.push({
                productId,
                quantity,
                priceCents: val.price,
                reason: 'Best Price'
            });
            storeGroup.subtotalCents += lineTotal;
            totalCost += lineTotal;
        });

        const storesArray = Array.from(resultStores.values());

        const result: OptimizedResult = {
            snapshotId: crypto.randomUUID(),
            totalCostCents: totalCost,
            savingsCents: 500, // Mock savings calculation vs single store
            stores: storesArray,
            explanation: ''
        };

        // 4. Generate Explanation
        result.explanation = generateExplanation(result);

        return result;
    }
}
