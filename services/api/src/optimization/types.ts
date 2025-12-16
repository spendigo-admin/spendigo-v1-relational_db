export interface OptimizationRequest {
    userLocation: {
        lat: number;
        lng: number;
    };
    items: {
        productId: string; // The "canonical" product ID (or name for loose matching)
        quantity: number;
    }[];
    maxStores?: number; // Default 3
}

export interface StoreCandidate {
    storeId: string;
    storeName: string;
    location: {
        lat: number;
        lng: number;
    };
    inventory: {
        productId: string;
        priceCents: number;
        inStock: boolean;
    }[];
    deliveryFeeCents: number;
}

export interface OptimizedResult {
    snapshotId: string; // For audit
    totalCostCents: number;
    savingsCents: number; // Compared to worst case single store
    stores: {
        storeId: string;
        storeName: string;
        items: {
            productId: string;
            quantity: number;
            priceCents: number;
            reason?: string; // "Cheapest option"
        }[];
        subtotalCents: number;
        deliveryFeeCents: number;
    }[];
    explanation: string; // Human readable summary
}
