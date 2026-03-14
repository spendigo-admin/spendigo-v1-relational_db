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
    inStock: boolean;
    productId: string;
    brand?: string;
    name?: string;
    unit?: string;
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
}
