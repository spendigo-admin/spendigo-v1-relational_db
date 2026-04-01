export interface MerchantProduct {
    id: string;
    merchant_id: string;
    master_product_id?: string;
    product_name?: string;
    available_quantity: number;
    price: number;
    brand?: string;
    category?: string;
    description?: string;
    unit_size?: string;
    net_quantity_unit?: string;
    image?: string;
    primary_image_url?: string;
}

export interface StoreOption {
    storeId: string;
    storeName: string;
    price: number;
    originalPrice?: number;
    discount?: string;
    inStock: boolean;
    productId: string;
    brand?: string;
    name?: string;
    unit?: string;
    normalizedUnitPrice?: number;
    comparisonUnit?: string;
    priceTrend?: 'up' | 'down' | 'stable';
    previousPrice?: number;
}

export interface OptimizedWishlistItem {
    id: string;
    name: string;
    image: string;
    category: string;
    description?: string;
    unit?: string;
    taxable?: boolean;
    brand?: string;
    options: StoreOption[];
    cheapest: StoreOption | null;
    maxPrice: number;
    substitutions?: SubstitutionSuggestion[];
}

export interface SubstitutionSuggestion {
    id: string;
    name: string;
    image: string;
    brand?: string;
    cheapestPrice: number;
    cheapestStore: string;
    priceDifference: number;
}

export interface SmartCartListItemInput {
    id: string;
    name: string;
    quantity: number;
    preferredMasterProductId?: string;
    category?: string;
    unit?: string;
    notes?: string;
}

export interface SmartCartStoreInput {
    id: string;
    name: string;
    province?: string;
    deliveryFee?: number;
    freeDeliveryThreshold?: number;
    pickupEnabled?: boolean;
    deliveryEnabled?: boolean;
    maxDeliveryRadiusKm?: number;
}

export interface SmartCartPriceInput {
    merchantProductId: string;
    storeId: string;
    masterProductId?: string;
    productName: string;
    unit?: string;
    price: number;
    originalPrice?: number;
    currency: 'CAD';
    inStock: boolean;
    availableQuantity?: number;
}

export interface SmartCartCandidate {
    merchantProductId: string;
    storeId: string;
    storeName: string;
    masterProductId?: string;
    matchedName: string;
    unit?: string;
    price: number;
    originalPrice?: number;
    inStock: boolean;
    availableQuantity?: number;
    matchConfidence?: number;
    matchReason?: 'master_id' | 'exact_name' | 'fuzzy_name' | 'manual';
}

export interface SmartCartOptimizationInput {
    shoppingList: SmartCartListItemInput[];
    stores: SmartCartStoreInput[];
    prices: SmartCartPriceInput[];
}

export interface SmartCartPriceMatrixCell {
    shoppingListItemId: string;
    storeId: string;
    storeName: string;
    available: boolean;
    merchantProductId: string | null;
    productName: string | null;
    packageSize: string | null;
    price: number | null;
    unitPrice: number | null;
    comparisonUnit: string | null;
    availableQuantity: number;
    isComparableByUnitPrice: boolean;
}

export interface SmartCartPriceMatrixRow {
    shoppingListItemId: string;
    productName: string;
    quantity: number;
    preferredMasterProductId?: string;
    cells: Record<string, SmartCartPriceMatrixCell>;
}

export interface SmartCartPriceMatrix {
    storeColumns: SmartCartStoreInput[];
    rows: SmartCartPriceMatrixRow[];
}

export interface SmartCartItemDecision {
    shoppingListItemId: string;
    quantity: number;
    selectedStoreId: string;
    selectedStoreName: string;
    selectedMerchantProductId: string;
    unitPrice: number;
    lineTotal: number;
    candidateCount: number;
}

export interface SmartCartDecisionExplanation {
    shoppingListItemId: string;
    selectedStoreId: string;
    reasonCode:
        | 'lowest_price'
        | 'only_available_option'
        | 'better_than_single_store'
        | 'matched_by_master_product'
        | 'matched_by_fuzzy_search';
    summary: string;
    consideredStoreIds: string[];
}

export interface SmartCartSingleStoreComparison {
    storeId: string;
    storeName: string;
    totalCost: number;
    deliveryFee: number;
    totalWithDelivery: number;
    missingItemCount: number;
    isFullyAvailable: boolean;
}

export interface SmartCartOptimizationSummary {
    selectedStoreCount: number;
    totalCartCost: number;
    bestSingleStoreCost: number | null;
    savingsVsSingleStore: number | null;
    unavailableItemCount: number;
}

export interface SmartCartOptimizationResult {
    items: SmartCartItemDecision[];
    summary: SmartCartOptimizationSummary;
    bestSingleStore: SmartCartSingleStoreComparison | null;
    singleStoreComparisons: SmartCartSingleStoreComparison[];
    explanations: SmartCartDecisionExplanation[];
}

export type SmartCartTripRecommendation =
    | 'optimized_multi_store'
    | 'best_single_store'
    | 'optimized_multi_store_only_feasible';

export interface SmartCartTripAnalysis {
    optimizedStoreCount: number;
    optimizedTotalCost: number;
    bestSingleStoreCost: number | null;
    priceDifference: number | null;
    recommendation: SmartCartTripRecommendation;
    summary: string;
}

export interface SmartCartOptimizer {
    optimize(input: SmartCartOptimizationInput): SmartCartOptimizationResult;
}

export interface SmartCartCandidateResolver {
    resolveCandidates(input: SmartCartOptimizationInput): Map<string, SmartCartCandidate[]>;
}

export interface SmartCartExplainer {
    explain(params: {
        input: SmartCartOptimizationInput;
        result: SmartCartOptimizationResult;
    }): SmartCartDecisionExplanation[];
}
