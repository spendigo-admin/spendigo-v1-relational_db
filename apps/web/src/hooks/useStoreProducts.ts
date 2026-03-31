
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product } from './useCatalog';

// Fetch all products for a specific store
export const useStoreProducts = (storeId: string) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loadingProducts, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!storeId) {
            setLoading(false);
            return;
        }

        // Query merchant_products
        const q = query(collection(db, 'merchant_products'), where('merchant_id', '==', storeId));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const fetchedProducts: Product[] = [];
            const masterIds = new Set<string>();
            snapshot.forEach(doc => masterIds.add(doc.data().master_product_id));

            const masterMap = new Map();
            await Promise.all(Array.from(masterIds).map(async (mid) => {
                // 1. Try Master Catalog
                let mDoc = await getDoc(doc(db, 'master_products', mid));
                let isPending = false;

                // 2. If not found, try Pending Catalog
                if (!mDoc.exists()) {
                    mDoc = await getDoc(doc(db, 'pending_master_products', mid));
                    isPending = true;
                }

                if (mDoc.exists()) {
                    const data = mDoc.data()!;
                    // Map pending fields if necessary
                    if (isPending) {
                        if (!data.barcode && data.original_barcode) data.barcode = data.original_barcode;
                    }
                    masterMap.set(mid, { ...data, is_pending: isPending });
                }
            }));

            snapshot.forEach(doc => {
                const data = doc.data();
                const master = masterMap.get(data.master_product_id);
                if (master) {
                    fetchedProducts.push({
                        id: doc.id,
                        merchant_id: data.merchant_id,
                        master_product_id: data.master_product_id,

                        // UI Compat
                        storeId: data.merchant_id,
                        storeName: 'Loading...',
                        storeAddress: 'Loading...',

                        merchant_sku: data.merchant_sku,
                        currency: data.currency || 'CAD',
                        available_quantity: data.available_quantity,

                        name: master.product_name,
                        description: master.short_description,
                        image: master.primary_image_url,
                        images: [master.primary_image_url],
                        category: master.category_id,
                        brand_name: master.brand_name,
                        barcode: master.barcode,
                        unit_size: master.unit_size || master.size,
                        nutrition: master.nutrition,
                        ingredients: master.ingredients,
                        dietary_tags: master.dietary_tags,
                        storage_type: master.storage_type,
                        package_count: master.package_count,
                        unit_type: master.unit_type,
                        is_sold_by_weight: master.is_sold_by_weight,
                        tax_category_id: master.tax_category_id,
                        suggested_retail_price: master.suggested_retail_price,

                        price: (data.discount_valid_until && new Date(data.discount_valid_until) < new Date() && data.original_price > 0) 
                            ? data.original_price : data.price,
                        originalPrice: (data.price < data.original_price) ? data.original_price : undefined,
                        discount: (data.discount_valid_until && new Date(data.discount_valid_until) < new Date()) 
                            ? undefined : data.discount_label
                    } as Product);
                }
            });

            setProducts(fetchedProducts);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching store products", err);
            setError(err.message);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [storeId]);

    return { products, loading: loadingProducts, error };
};
