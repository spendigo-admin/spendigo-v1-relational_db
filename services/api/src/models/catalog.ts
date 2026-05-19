export interface MasterProductRecord {
    id: string;
    master_product_id: string;
    product_name: string;
    brand_name?: string;
    category_id?: string;
    net_quantity_value?: number;
    net_quantity_unit?: string;
    unit_type?: 'weight' | 'volume' | 'count';
    package_count?: number;
    primary_image_url?: string;
    secondary_image_urls?: string[];
    tax_category_id?: string;
    status?: 'active' | 'deprecated' | 'blocked';
    verification_status?: 'unverified' | 'verified' | 'manufacturer_verified';
    updated_at?: unknown;
}

export interface StoreRecord {
    id: string;
    name: string;
    status?: 'active' | 'pending' | 'suspended' | 'pending_deletion';
    province?: string;
    address?: string;
    location?: {
        lat?: number;
        lng?: number;
    };
    deliveryFee?: number;
    freeDeliveryThreshold?: number;
    pickupEnabled?: boolean;
    deliveryEnabled?: boolean;
    updatedAt?: unknown;
}

export interface MerchantProductRecord {
    id: string;
    merchant_product_id: string;
    merchant_id: string;
    master_product_id: string;
    price: number;
    currency: 'CAD' | string;
    available_quantity: number;
    merchant_sku?: string;
    original_price?: number;
    discount_label?: string;
    discount_valid_until?: string | null;
    is_active?: boolean;
    product_name?: string;
    brand?: string;
    unit_size?: string;
    net_quantity_unit?: string;
    package_size?: string;
    updated_at?: unknown;
    updatedAt?: unknown;
}
