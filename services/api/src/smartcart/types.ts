import { MerchantProductRecord, StoreRecord } from '../models/catalog';

export interface SmartCartOptimizeRequestBody {
    shopping_list: string[];
    user_location?: {
        lat?: number;
        lng?: number;
    };
    store_filter?: {
        store_ids?: string[];
    } | string[];
}

export interface SmartCartStoreData {
    store: StoreRecord;
    inventory: MerchantProductRecord[];
}

export interface SmartCartOptimizedItem {
    product_id: string;
    chosen_store: string;
    price: number;
    unit_price: number;
}

export interface SmartCartOptimizedCart {
    optimized_items: SmartCartOptimizedItem[];
    total_cost: number;
    store_distribution: Record<string, string[]>;
}

export interface SmartCartSingleStoreOption {
    store_id: string;
    store_name: string;
    cart_cost: number | null;
    missing_items: string[];
}

export interface SmartCartOptimizeResponse {
    optimized_cart: SmartCartOptimizedItem[];
    store_breakdown: Record<string, string[]>;
    total_cost: number;
    best_single_store_option: SmartCartSingleStoreOption | null;
    savings: number | null;
}
