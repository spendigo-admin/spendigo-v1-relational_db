import * as admin from 'firebase-admin';
import { MerchantProductRecord, StoreRecord } from '../models/catalog';
import { SmartCartOptimizeRequestBody, SmartCartStoreData } from './types';
import { createHash } from 'crypto';

const db = admin.firestore();

export function getRequestedStoreIds(storeFilter: SmartCartOptimizeRequestBody['store_filter']): string[] | null {
    if (!storeFilter) {
        return null;
    }

    if (Array.isArray(storeFilter)) {
        return storeFilter.filter((value): value is string => typeof value === 'string' && value.length > 0);
    }

    return (storeFilter.store_ids ?? []).filter((value): value is string => typeof value === 'string' && value.length > 0);
}

function chunk<T>(values: T[], size: number): T[][] {
    const chunks: T[][] = [];

    for (let index = 0; index < values.length; index += size) {
        chunks.push(values.slice(index, index + size));
    }

    return chunks;
}

function getPackageSize(data: FirebaseFirestore.DocumentData): string | null {
    const packageSize = data.unit_size ?? data.net_quantity_unit ?? data.package_size ?? null;
    return typeof packageSize === 'string' && packageSize.trim().length > 0 ? packageSize.trim() : null;
}

export function normalizeRequestedProducts(shoppingList: unknown): string[] {
    if (!Array.isArray(shoppingList) || shoppingList.length === 0) {
        throw new Error('shopping_list must be a non-empty array.');
    }

    const normalized = shoppingList
        .filter((value): value is string => typeof value === 'string')
        .map(value => value.trim())
        .filter(value => value.length > 0);

    return Array.from(new Set(normalized));
}

export interface LoadStoreProductDataResult {
    storeProductData: SmartCartStoreData[];
    dataSignature: string;
}

export async function loadStoreProductData(
    shoppingList: string[],
    storeFilter?: SmartCartOptimizeRequestBody['store_filter'],
): Promise<LoadStoreProductDataResult> {
    const requestedStoreIds = getRequestedStoreIds(storeFilter);
    const productChunks = chunk(shoppingList, 30);
    const merchantProducts: Array<{ id: string; data: FirebaseFirestore.DocumentData }> = [];

    for (const productChunk of productChunks) {
        const snapshot = await db
            .collection('merchant_products')
            .where('master_product_id', 'in', productChunk)
            .get();

        snapshot.forEach(doc => {
            merchantProducts.push({ id: doc.id, data: doc.data() });
        });
    }

    const filteredMerchantProducts = merchantProducts.filter(({ data }) => {
        if (requestedStoreIds && !requestedStoreIds.includes(String(data.merchant_id))) {
            return false;
        }

        return true;
    });

    const storeIds = Array.from(new Set(filteredMerchantProducts.map(({ data }) => String(data.merchant_id))));
    const stores = await Promise.all(storeIds.map(storeId => db.collection('stores').doc(storeId).get()));
    const storeMap = new Map<string, FirebaseFirestore.DocumentData>();

    stores.forEach(storeDoc => {
        if (!storeDoc.exists) {
            return;
        }

        const data = storeDoc.data();

        if (!data) {
            return;
        }

        if (data.status && data.status !== 'active') {
            return;
        }

        storeMap.set(storeDoc.id, data);
    });

    const grouped = new Map<string, SmartCartStoreData>();
    const signatureParts: string[] = [];

    filteredMerchantProducts.forEach(({ id, data }) => {
        const storeId = String(data.merchant_id);
        const store = storeMap.get(storeId);

        if (!store) {
            return;
        }

        const availableQuantity = Number(data.available_quantity ?? 0);
        const packageSize = getPackageSize(data);

        const updatedAt = data.updated_at?.toMillis?.()
            ?? data.updatedAt?.toMillis?.()
            ?? data.updated_at?._seconds
            ?? data.updatedAt?._seconds
            ?? '';

        signatureParts.push([
            id,
            storeId,
            String(data.master_product_id),
            Number(data.price).toFixed(4),
            String(availableQuantity),
            packageSize ?? '',
            data.is_active === false ? 'inactive' : 'active',
            String(updatedAt),
        ].join('|'));

        if (!grouped.has(storeId)) {
            const storeRecord: StoreRecord = {
                id: storeId,
                name: String(store.name ?? storeId),
                status: store.status,
                province: store.province,
                address: typeof store.address === 'string' ? store.address : undefined,
                location: store.location,
                deliveryFee: store.deliveryFee,
                freeDeliveryThreshold: store.freeDeliveryThreshold,
                pickupEnabled: store.pickupEnabled,
                deliveryEnabled: store.deliveryEnabled,
                updatedAt: store.updatedAt,
            };

            grouped.set(storeId, {
                store: storeRecord,
                inventory: [],
            });
        }

        const inventoryRecord: MerchantProductRecord = {
            id,
            merchant_product_id: String(data.merchant_product_id ?? id),
            merchant_id: storeId,
            master_product_id: String(data.master_product_id),
            price: Number(data.price),
            currency: String(data.currency ?? 'CAD'),
            available_quantity: availableQuantity,
            merchant_sku: data.merchant_sku,
            original_price: data.original_price,
            discount_label: data.discount_label,
            is_active: data.is_active,
            product_name: data.product_name,
            brand: data.brand,
            unit_size: data.unit_size,
            net_quantity_unit: data.net_quantity_unit,
            package_size: packageSize ?? undefined,
            updated_at: data.updated_at,
            updatedAt: data.updatedAt,
        };

        grouped.get(storeId)?.inventory.push(inventoryRecord);
    });

    signatureParts.sort();

    return {
        storeProductData: Array.from(grouped.values()),
        dataSignature: createHash('sha256').update(signatureParts.join('||')).digest('hex'),
    };
}
