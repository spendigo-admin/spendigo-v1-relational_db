import { useMemo } from 'react';
import { CatalogItem } from '../context/CatalogContext';

interface StoreProduct {
    id: string;
    catalogItemId?: string; // Link to master
    name: string;
    description: string;
    image: string;
    category: string;
    [key: string]: any;
}

interface SyncStats {
    total: number;
    outOfSyncCount: number;
    syncedCount: number;
}

export const useInventorySync = (
    storeProducts: StoreProduct[],
    catalog: CatalogItem[]
) => {
    // Determine which products need updates
    const outOfSyncItems = useMemo(() => {
        if (!storeProducts || !catalog) return [];

        return storeProducts.filter(product => {
            if (!product.catalogItemId) return false; // Not linked

            const master = catalog.find(c => c.id === product.catalogItemId);
            if (!master) return false; // Master item gone? Ignore or handle separate

            // Compare "Managed Fields"
            // We consider it out of sync if critical presentation data differs
            const isDifferent =
                product.name !== master.name ||
                product.description !== master.description ||
                product.image !== master.image ||
                product.category !== master.category;

            return isDifferent;
        });
    }, [storeProducts, catalog]);

    const stats: SyncStats = {
        total: storeProducts.length,
        outOfSyncCount: outOfSyncItems.length,
        syncedCount: storeProducts.length - outOfSyncItems.length
    };

    // The Merge Function
    // Returns a NEW array of products with updates applied to the stale ones
    const getSyncedProducts = (): StoreProduct[] => {
        return storeProducts.map(product => {
            if (!product.catalogItemId) return product;

            const master = catalog.find(c => c.id === product.catalogItemId);
            if (!master) return product;

            // Check if this specific item needs update (reuse logic or just simple check)
            // We just overwrite catalog-managed fields for ALL linked items to be safe, 
            // or we could filter. Overwriting ensures consistency.
            // Preserving Price, Stock, internal IDs.
            return {
                ...product,
                name: master.name,
                description: master.description,
                image: master.image,
                category: master.category,
                taxable: master.taxable !== undefined ? master.taxable : product.taxable
                // Note: We don't sync 'unit' yet as store might sell by different unit?
                // For now, assuming 1:1 mapping.
            };
        });
    };

    return {
        stats,
        outOfSyncItems,
        getSyncedProducts
    };
};
