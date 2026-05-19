
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, orderBy, getCountFromServer, limit } from 'firebase/firestore';
import { db, storage } from '../lib/firebase';
import { ref, deleteObject } from 'firebase/storage';
import { searchClient, ALGOLIA_INDEX_NAME, ALGOLIA_MERCHANT_INDEX_NAME } from '../lib/algolia';
import { auditBridge } from '../utils/auditBridge';

export interface Product {
    id: string; // Merchant Product ID
    merchant_id: string;
    master_product_id: string;

    // Legacy / UI Compat
    storeId: string;
    storeName?: string;
    storeAddress?: string;

    name: string;
    description?: string;
    image: string;
    images: string[];
    category: string;
    brand_name?: string;
    barcode?: string;
    unit_size?: string;
    merchant_sku: string;
    price: number;
    currency: string;
    available_quantity: number;

    // UI Helpers
    originalPrice?: number;
    discount?: string;

    // Enhanced Master Attributes
    product_type?: string;
    storage_type?: string;
    package_count?: number;
    unit_type?: string;
    nutrition?: {
        calories?: number;
        protein?: number;
        fat?: number;
        carbs?: number;
        [key: string]: any;
    };
    ingredients?: string;
    allergens?: string[];
    dietary_tags?: string[];

    // Gap Fixes
    is_sold_by_weight?: boolean;
    tax_category_id?: string;
    suggested_retail_price?: number;
    age_restricted?: boolean;
    is_canadian_local?: boolean;
}

// Helper to generate barcode variants for robust deduplication
export const generateBarcodeVariants = (raw: string) => {
    if (!raw) return [];
    const clean = raw.replace(/^0+/, ''); // Strip leading zeros
    if (!clean) return [raw]; // Edge case for "000"

    const variants = new Set([raw, clean]);
    // Standard Global Trade Item Number (GTIN) formats
    variants.add(clean.padStart(8, '0'));  // GTIN-8
    variants.add(clean.padStart(12, '0')); // GTIN-12 (UPC-A)
    variants.add(clean.padStart(13, '0')); // GTIN-13 (EAN)
    variants.add(clean.padStart(14, '0')); // GTIN-14 (ITF-14)

    return Array.from(variants);
};

// Admin View Model
export interface MasterProduct {
    master_product_id: string;
    product_name: string;
    product_name_fr?: string; // Quebec/Bilingual support
    brand_name: string;
    brand_family_id?: string; // For variant grouping
    is_generic?: boolean;
    barcode?: string;
    upc_gtin?: string;
    status: 'active' | 'deprecated' | 'blocked' | 'pending_review';
    verification_status: 'unverified' | 'verified' | 'manufacturer_verified';

    // Classification
    category_id: string;
    subcategory?: string;
    product_type?: 'food' | 'non-food';
    storage_type?: 'ambient' | 'refrigerated' | 'frozen';
    age_restricted?: boolean;

    // Tax & Commerce
    tax_category_id: string; // e.g. 'zero_rated_grocery', 'taxable_grocery'
    is_sold_by_weight: boolean;
    suggested_retail_price?: number;

    // Size & Packaging
    net_quantity_value?: number;
    net_quantity_unit?: string;
    package_count?: number;
    unit_type?: 'weight' | 'volume' | 'count';
    substitution_group_id?: string;

    // Logistics
    dimensions?: {
        length: number;
        width: number;
        height: number;
        unit: 'cm' | 'in';
    };
    weight_gross?: number;

    // Media
    primary_image_url: string;
    secondary_image_urls?: string[];
    short_description?: string;
    short_description_fr?: string;

    // Nutrition & Ingredients
    nutrition?: {
        calories?: number;
        protein?: number;
        fat?: number;
        carbs?: number;
        [key: string]: any;
    };
    ingredients?: string;
    ingredients_fr?: string;
    allergens?: string[];
    dietary_tags?: string[];

    // Search & Metadata
    search_keywords?: string[]; // Synonyms (e.g. Soda, Pop)

    // Governance
    data_source?: string;
    confidence_score?: number;
    created_by?: string;
    created_at?: any;
    updated_at?: any;

    // Usage (Read Only)
    number_of_merchants_listing?: number;
    
    // Sourcing
    is_canadian_local?: boolean;
}

export const useCatalog = () => {

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // --- ADMIN: MASTER CATALOG ---
    const useMasterCatalog = () => {
        const [masterProducts, setMasterProducts] = useState<MasterProduct[]>([]);
        const [loadingMaster, setLoadingMaster] = useState(true);

        useEffect(() => {
            const q = query(collection(db, 'master_products'));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const fetched: MasterProduct[] = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        master_product_id: doc.id,
                        product_name: data.product_name,
                        product_name_fr: data.product_name_fr,
                        brand_name: data.brand_name || '',
                        brand_family_id: data.brand_family_id,
                        barcode: data.barcode || data.upc_gtin,
                        upc_gtin: data.upc_gtin || data.barcode,
                        status: data.status || 'active',
                        verification_status: data.verification_status || 'unverified',
                        category_id: data.category_id,
                        subcategory: data.subcategory,
                        product_type: data.product_type,
                        storage_type: data.storage_type || 'ambient',
                        age_restricted: data.age_restricted || false,
                        tax_category_id: data.tax_category_id || 'zero_rated_grocery',
                        is_sold_by_weight: data.is_sold_by_weight || false,
                        suggested_retail_price: data.suggested_retail_price,
                        net_quantity_value: data.net_quantity_value,
                        net_quantity_unit: data.net_quantity_unit,
                        package_count: data.package_count || 1,
                        unit_type: data.unit_type,
                        substitution_group_id: data.substitution_group_id,
                        dimensions: data.dimensions,
                        weight_gross: data.weight_gross,
                        primary_image_url: data.primary_image_url,
                        secondary_image_urls: data.secondary_image_urls,
                        short_description: data.short_description,
                        short_description_fr: data.short_description_fr,
                        nutrition: data.nutrition,
                        ingredients: data.ingredients,
                        ingredients_fr: data.ingredients_fr,
                        allergens: data.allergens,
                        dietary_tags: data.dietary_tags,
                        search_keywords: data.search_keywords || [],
                        data_source: data.data_source || 'admin',
                        confidence_score: data.confidence_score,
                        created_at: data.created_at,
                        number_of_merchants_listing: data.number_of_merchants_listing || 0,
                        is_canadian_local: data.is_canadian_local || false
                    } as MasterProduct;
                });
                setMasterProducts(fetched);
                setLoadingMaster(false);
            }, (err) => {
                console.error("Master catalog fetch error", err);
                setLoadingMaster(false);
            });
            return () => unsubscribe();
        }, []);

        return { masterProducts, loading: loadingMaster };
    };

    // Fetch all products for a specific store
    const useStoreProducts = (storeId: string) => {
        const [products, setProducts] = useState<Product[]>([]);
        const [loadingProducts, setLoading] = useState(true);

        useEffect(() => {
            if (!storeId) return;

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
                            // Pending might use 'status'='pending_review'
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
                            price: data.price,
                            currency: data.currency || 'CAD',
                            available_quantity: data.available_quantity,

                            name: master.product_name,
                            description: master.short_description,
                            image: master.primary_image_url,
                            images: [master.primary_image_url, ...(master.secondary_image_urls ?? [])].filter(Boolean),
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
                            age_restricted: master.age_restricted || false,
                            is_canadian_local: data.is_canadian_local ?? master.is_canadian_local ?? false,

                            originalPrice: data.original_price,
                            discount: data.discount_label
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

        return { products, loading: loadingProducts };
    };

    // Fetch single product detail
    // We assume ID is the merchant_product_id
    const useProductDetail = (productId: string) => {
        const [product, setProduct] = useState<Product | null>(null);
        const [loadingProduct, setLoading] = useState(true);

        useEffect(() => {
            if (!productId) return;

            const fetchProduct = async () => {
                try {
                    const productRef = doc(db, 'merchant_products', productId);
                    const pSnap = await getDoc(productRef);

                    if (pSnap.exists()) {
                        const pData = pSnap.data();
                        // Fetch Master
                        const mRef = doc(db, 'master_products', pData.master_product_id);
                        const mSnap = await getDoc(mRef);

                        // Fetch Store (for name/address)
                        const sRef = doc(db, 'stores', pData.merchant_id);
                        const sSnap = await getDoc(sRef);
                        const sData = sSnap.exists() ? sSnap.data() : {};

                        if (mSnap.exists()) {
                            const mData = mSnap.data();
                            setProduct({
                                id: pSnap.id,
                                merchant_id: pData.merchant_id,
                                master_product_id: pData.master_product_id,

                                storeId: pData.merchant_id,
                                storeName: sData.name || 'Unknown Store',
                                storeAddress: sData.address || 'Address not available',

                                merchant_sku: pData.merchant_sku,
                                price: pData.price,
                                currency: pData.currency || 'CAD',
                                available_quantity: pData.available_quantity,

                                name: mData.product_name,
                                description: mData.short_description,
                                image: mData.primary_image_url,
                                images: [mData.primary_image_url, ...(mData.secondary_image_urls ?? [])].filter(Boolean),
                                category: mData.category_id,
                                brand_name: mData.brand_name,
                                barcode: mData.barcode,
                                unit_size: mData.unit_size || mData.size,
                                nutrition: mData.nutrition,
                                ingredients: mData.ingredients,
                                dietary_tags: mData.dietary_tags,
                                storage_type: mData.storage_type,
                                package_count: mData.package_count,
                                unit_type: mData.unit_type,
                                is_sold_by_weight: mData.is_sold_by_weight,
                                tax_category_id: mData.tax_category_id,
                                suggested_retail_price: mData.suggested_retail_price,
                                age_restricted: mData.age_restricted || false,
                                is_canadian_local: pData.is_canadian_local ?? mData.is_canadian_local ?? false,

                                originalPrice: pData.original_price,
                                discount: pData.discount_label
                            } as Product);
                        }
                    }
                } catch (err) {
                    console.error(err);
                } finally {
                    setLoading(false);
                }
            };

            fetchProduct();
        }, [productId]);

        return { product, loading: loadingProduct };
    };

    // Fetch all products (Global Search)
    const useGlobalCatalog = (searchQuery?: string, location?: { lat: number; lng: number }, searchDistance?: number) => {
        const [products, setProducts] = useState<Product[]>([]);
        const [loadingProducts, setLoading] = useState(true);

        useEffect(() => {
            const fetchProducts = async () => {
                setLoading(true);
                try {
                    // STRATEGY A: ALGOLIA SEARCH (If query exists)
                    if (searchQuery && searchQuery.trim().length > 2 && searchClient) {
                        const searchOptions: any = {
                            hitsPerPage: 40,
                        };
                        
                        // Apply Geo-Spatial Filtering
                        // Temporarily disabled at the Algolia level because the merchant_products index 
                        // is currently missing _geoloc fields. Search.tsx performs local distance filtering anyway.
                        if (location?.lat && location?.lng) {
                           // searchOptions.aroundLatLng = `${location.lat},${location.lng}`;
                           // if (searchDistance && searchDistance > 0) {
                           //    searchOptions.aroundRadius = searchDistance * 1000;
                           // }
                        }

                        // 1. Search Algolia for Merchant Products
                        const { results } = await searchClient.search({
                            requests: [{
                                indexName: ALGOLIA_MERCHANT_INDEX_NAME,
                                query: searchQuery,
                                ...searchOptions
                            }]
                        });
                        const hits = (results[0] as any).hits;

                        if (hits.length === 0) {
                            setProducts([]);
                            setLoading(false);
                            return;
                        }

                        // 2. Direct mapping since merchant_products index is fully denormalized
                        const fetchedProducts: Product[] = hits.map((hit: any) => ({
                            id: hit.objectID,
                            merchant_id: hit.merchant_id,
                            master_product_id: hit.master_product_id,

                            storeId: hit.merchant_id,
                            storeName: 'Available Nearby', // Store name mapping can be resolved at UI level or cached
                            storeAddress: '',

                            merchant_sku: hit.merchant_sku || '',
                            price: hit.price,
                            currency: 'CAD',
                            available_quantity: hit.available_quantity,

                            name: hit.product_name,
                            description: hit.short_description,
                            image: hit.primary_image_url,
                            images: [hit.primary_image_url, ...(hit.secondary_image_urls ?? [])].filter(Boolean),
                            category: hit.category_id,
                            brand_name: hit.brand_name,
                            barcode: hit.barcode || hit.upc_gtin,
                            is_canadian_local: hit.is_canadian_local || false,
                            
                            originalPrice: hit.original_price,
                            discount: hit.discount_label
                        } as Product));

                        setProducts(fetchedProducts);
                    }
                    // STRATEGY B: DEFAULT LISTING (No query)
                    else {
                        const q = query(collection(db, 'merchant_products'), limit(50));
                        const snapshot = await getDocs(q);
                        const fetchedProducts = await mapSnapshotToProducts(snapshot);
                        setProducts(fetchedProducts);
                    }
                } catch (err) {
                    console.error("Global search error:", err);
                } finally {
                    setLoading(false);
                }
            };
            fetchProducts();
        }, [searchQuery, location?.lat, location?.lng, searchDistance]);

        // Helper: Convert MerchantProduct + MasterProduct + Store => UI Product
        const mapSnapshotToProducts = async (snapshot: any) => {
            const fetchedProducts: Product[] = [];
            const masterIds = new Set<string>();
            const merchantIds = new Set<string>();

            snapshot.forEach((doc: any) => {
                const d = doc.data();
                masterIds.add(d.master_product_id);
                merchantIds.add(d.merchant_id);
            });

            const masterMap = new Map();
            await Promise.all(Array.from(masterIds).map(async (mid) => {
                const mDoc = await getDoc(doc(db, 'master_products', mid));
                if (mDoc.exists()) masterMap.set(mid, mDoc.data());
            }));

            const storeMap = new Map();
            await Promise.all(Array.from(merchantIds).map(async (sid) => {
                const sDoc = await getDoc(doc(db, 'stores', sid));
                if (sDoc.exists()) storeMap.set(sid, sDoc.data());
            }));

            snapshot.forEach((doc: any) => {
                const data = doc.data();
                const master = masterMap.get(data.master_product_id);
                const store = storeMap.get(data.merchant_id);

                if (master) {
                    fetchedProducts.push({
                        id: doc.id,
                        merchant_id: data.merchant_id,
                        master_product_id: data.master_product_id,

                        storeId: data.merchant_id,
                        storeName: store?.name || 'Unknown Store',
                        storeAddress: store?.address,

                        merchant_sku: data.merchant_sku,
                        price: data.price,
                        currency: data.currency || 'CAD',
                        available_quantity: data.available_quantity,

                        name: master.product_name,
                        description: master.short_description,
                        image: master.primary_image_url,
                        images: [master.primary_image_url, ...(master.secondary_image_urls ?? [])].filter(Boolean),
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
                        age_restricted: master.age_restricted || false,
                        is_canadian_local: data.is_canadian_local ?? master.is_canadian_local ?? false,

                        originalPrice: data.original_price,
                        discount: data.discount_label
                    } as Product);
                }
            });
            return fetchedProducts;
        };

        return { products, loading: loadingProducts };
    };

    // --- WRITE ACTIONS ---

    // Search Master Catalog (for Merchant adding products)
    const searchMasterCatalog = async (searchQuery: string) => {
        const results: any[] = [];
        const seenIds = new Set<string>();
        const lowerQuery = searchQuery.toLowerCase().trim();

        try {
            // 1. Barcode Search (Direct Index Lookup)
            // Checks both exact match and potentially stripped zeros if needed.
            // Barcodes are best served by exact lookup in DB for strict accuracy.
            if (/^\d+$/.test(lowerQuery)) {
                // Check Master
                const masterQ = query(collection(db, 'master_products'), where('upc_gtin', '==', lowerQuery));
                const masterSnap = await getDocs(masterQ);
                masterSnap.forEach(doc => {
                    const data = doc.data();
                    if (!seenIds.has(doc.id)) {
                        results.push({ ...data, id: doc.id });
                        seenIds.add(doc.id);
                    }
                });

                // Check Pending
                const pendingQ = query(collection(db, 'pending_master_products'), where('original_barcode', '==', lowerQuery));
                const pendingSnap = await getDocs(pendingQ);
                pendingSnap.forEach(doc => {
                    if (!seenIds.has(doc.id)) {
                        const data = doc.data();
                        results.push({
                            ...data,
                            id: doc.id,
                            barcode: data.original_barcode,
                            product_name: data.product_name,
                            brand_name: data.brand,
                            is_pending: true
                        });
                        seenIds.add(doc.id);
                    }
                });

                // If found via barcode, return immediately
                if (results.length > 0) return results;
            }

            // 2. Algolia Search (Fuzzy Text Search)
            // If configured, this is much better than Firestore "contains"
            if (searchClient) {
                try {
                    const { results } = await searchClient.search({
                        requests: [{
                            indexName: ALGOLIA_INDEX_NAME,
                            query: lowerQuery,
                            hitsPerPage: 20,
                        }]
                    });

                    // Algolia v5 structure: results[0].hits
                    const hits = (results[0] as any).hits;

                    const algoliaResults = hits.map((hit: any) => {
                        // Map Algolia objectID to id
                        return {
                            ...hit,
                            id: hit.objectID,
                        };
                    });

                    if (algoliaResults.length > 0) {
                        return algoliaResults;
                    }
                } catch (algErr) {
                    console.warn("Algolia search error (falling back to Firestore):", algErr);
                }
            }

            // 3. Name/Brand Search (Memory Filter fallback)
            // Warning: This is slow and reads all docs (or limited set). 
            // Only runs if Algolia is off or fails or returns nothing.

            const q = query(collection(db, 'master_products'));
            const snapshot = await getDocs(q);

            snapshot.forEach(doc => {
                const data = doc.data();
                if (seenIds.has(doc.id)) return;

                const text = `${data.product_name} ${data.brand_name || ''} ${data.barcode || ''}`.toLowerCase();
                if (text.includes(lowerQuery)) {
                    results.push({ ...data, id: doc.id });
                }
            });

            return results;
        } catch (err) {
            console.error('Search error:', err);
            return [];
        }
    };

    const getAverageMarketPrice = async (masterProductId: string): Promise<number> => {
        try {
            const q = query(
                collection(db, 'merchant_products'),
                where('master_product_id', '==', masterProductId)
            );
            const snapshot = await getDocs(q);
            if (snapshot.empty) return 0;

            let total = 0;
            let count = 0;
            snapshot.forEach(doc => {
                const price = doc.data().price;
                if (typeof price === 'number' && price > 0) {
                    total += price;
                    count++;
                }
            });

            return count > 0 ? total / count : 0;
        } catch (err) {
            console.error('[getAverageMarketPrice] Error:', err);
            return 0;
        }
    };

    // Add Product to Store (Link Merchant -> Master)
    const addMerchantProduct = async (storeId: string, masterId: string, price: number, quantity: number, options?: { is_canadian_local?: boolean }) => {
        const merchantProductId = `${storeId}_${masterId}`; // Deterministic ID
        const ref = doc(db, 'merchant_products', merchantProductId);

        const productData: any = {
            merchant_product_id: merchantProductId,
            merchant_id: storeId,
            master_product_id: masterId,
            price: Number(price),
            available_quantity: Number(quantity),
            currency: 'CAD',
            status: 'active',
            created_at: serverTimestamp(),
            updated_at: serverTimestamp()
        };

        if (options?.is_canadian_local !== undefined) {
            productData.is_canadian_local = Boolean(options.is_canadian_local);
        }

        await setDoc(ref, productData);
        auditBridge.emit('MERCHANT_PRODUCT_ADD', {
            storeId,
            masterId,
            price,
            merchantProductId
        });
        await syncStoreProductCount(storeId);
    };

    // Update Merchant Product (Price, Quantity)
    const updateMerchantProduct = async (productId: string, data: Partial<Product>) => {
        const ref = doc(db, 'merchant_products', productId);
        // Only allow updating specific fields
        const safeData: any = {};
        if (data.price !== undefined) safeData.price = Number(data.price);
        if (data.available_quantity !== undefined) safeData.available_quantity = Number(data.available_quantity);
        if (data.merchant_sku !== undefined) safeData.merchant_sku = data.merchant_sku;
        if (data.is_canadian_local !== undefined) safeData.is_canadian_local = Boolean(data.is_canadian_local);

        safeData.updated_at = serverTimestamp();

        await updateDoc(ref, safeData);
        auditBridge.emit('MERCHANT_PRODUCT_UPDATE', {
            productId,
            updates: safeData
        });
    };

    // Delete Merchant Product
    const deleteMerchantProduct = async (storeId: string, productId: string) => {
        const ref = doc(db, 'merchant_products', productId);
        await deleteDoc(ref);
        auditBridge.emit('MERCHANT_PRODUCT_DELETE', {
            storeId,
            productId
        });
        await syncStoreProductCount(storeId);
    };

    // Request New Product
    const requestMasterProduct = async (storeId: string, data: any) => {
        const ref = collection(db, 'product_creation_requests');
        await addDoc(ref, {
            submitted_by_merchant_id: storeId,
            status: 'pending', // Enforced by rules
            requested_product_name: data.name,
            requested_brand: data.brand || '',
            requested_category: data.category || '',
            requested_description: data.description || '',
            requested_barcode: data.barcode || '',
            requested_image_url: data.image || '',
            requested_barcode_image_url: data.barcodeImage || '',
            created_at: serverTimestamp()
        });
        auditBridge.emit('MASTER_PRODUCT_REQUEST', {
            storeId,
            productName: data.name,
            barcode: data.barcode
        });
    };

    // --- ADMIN ACTIONS ---

    // Listen to Pending Requests
    const useProductRequests = () => {
        const [requests, setRequests] = useState<any[]>([]);

        useEffect(() => {
            const q = query(
                collection(db, 'product_creation_requests'),
                where('status', '==', 'pending')
            );
            return onSnapshot(q, (snap) => {
                setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            });
        }, []);

        return { requests };
    };

    const approveProductRequest = async (requestId: string, reqData: any, masterData: any) => {
        const batch = (await import('firebase/firestore')).writeBatch(db);

        // 1. Create Master Product
        const masterId = `mp-${masterData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`;
        const masterRef = doc(db, 'master_products', masterId);

        batch.set(masterRef, {
            master_product_id: masterId,
            product_name: masterData.name,
            brand_name: masterData.brand,
            category_id: masterData.category,
            primary_image_url: masterData.image,
            short_description: masterData.description,
            upc_gtin: masterData.barcode || null, // Include barcode
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
            status: 'active'
        });

        // 2. Approve Request
        const reqRef = doc(db, 'product_creation_requests', requestId);
        batch.update(reqRef, {
            status: 'approved',
            approved_master_product_id: masterId,
            resolution_note: 'Approved by Admin',
            updated_at: serverTimestamp()
        });

        // 3. Auto-Add to Merchant Inventory
        // This ensures the usage count logic (stores carrying item) picks it up immediately.
        // And the merchant doesn't have to re-add it.
        if (reqData.submitted_by_merchant_id) {
            const merchProdId = `mpInv-${masterId}-${reqData.submitted_by_merchant_id.slice(-6)}`;
            const merchProdRef = doc(db, 'merchant_products', merchProdId);
            batch.set(merchProdRef, {
                merchant_product_id: merchProdId,
                merchant_id: reqData.submitted_by_merchant_id,
                master_product_id: masterId,
                price: 0, // Merchant must set price
                available_quantity: 0,
                is_active: true,
                created_at: serverTimestamp(),
                updated_at: serverTimestamp()
            });
        }

        // 4. Notify Merchant
        // We need to look up the user ID associated with the merchant store if possible, 
        // OR we notify the store owner.
        // Assuming 'submitted_by_merchant_id' is the Store ID. 
        // Notification system uses User ID.
        // We need to find the User WHO OWNS the store.
        // For now, let's assume specific Logic:
        //  The 'submitted_by_merchant_id' is a STORE ID.
        //  The `notifications` subcollection is on the USER document.
        //  We need to look up the store to get `ownerId`.

        // 4. Notify Merchant
        if (reqData.submitted_by_merchant_id) {
            try {
                const storeDoc = await getDoc(doc(db, 'stores', reqData.submitted_by_merchant_id));
                if (storeDoc.exists()) {
                    const ownerId = storeDoc.data().ownerId;
                    if (ownerId) {
                        const notifRef = doc(collection(db, 'users', ownerId, 'notifications'));
                        batch.set(notifRef, {
                            type: 'system',
                            title: 'Product Request Approved',
                            message: `Your request for '${masterData.name}' has been approved and added to your inventory. Please update price/stock.`,
                            read: false,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            } catch (e) {
                console.warn("Failed to lookup merchant for notification:", e);
            }
        }

        await batch.commit();
        auditBridge.emit('MASTER_PRODUCT_APPROVE', {
            requestId,
            productName: masterData.name,
            masterId,
            merchantId: reqData.submitted_by_merchant_id
        }, `product_creation_requests/${requestId}`);
    };

    const rejectProductRequest = async (requestId: string, reqData: any, reason: string) => {
        const batch = (await import('firebase/firestore')).writeBatch(db);
        const reqRef = doc(db, 'product_creation_requests', requestId);

        batch.update(reqRef, {
            status: 'rejected',
            resolution_note: reason,
            updated_at: serverTimestamp()
        });

        // Cleanup Images (Request Rejection)
        if (reqData.requested_image_url && reqData.requested_image_url.includes('firebasestorage')) {
            try {
                await deleteObject(ref(storage, reqData.requested_image_url));
            } catch (e) { console.warn('Failed to delete rejected image', e); }
        }
        if (reqData.requested_barcode_image_url && reqData.requested_barcode_image_url.includes('firebasestorage')) {
            try {
                await deleteObject(ref(storage, reqData.requested_barcode_image_url));
            } catch (e) { console.warn('Failed to delete rejected barcode image', e); }
        }

        // Notify Merchant
        // Notify Merchant
        if (reqData.submitted_by_merchant_id) {
            try {
                const storeDoc = await getDoc(doc(db, 'stores', reqData.submitted_by_merchant_id));
                if (storeDoc.exists()) {
                    const ownerId = storeDoc.data().ownerId;
                    if (ownerId) {
                        const notifRef = doc(collection(db, 'users', ownerId, 'notifications'));
                        batch.set(notifRef, {
                            type: 'alert',
                            title: 'Product Request Rejected',
                            message: `Your request for '${reqData.requested_product_name}' was rejected: ${reason}`,
                            read: false,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            } catch (e) {
                console.warn("Failed to lookup merchant for rejection notification:", e);
            }
        }

        await batch.commit();
        auditBridge.emit('MASTER_PRODUCT_REJECT', {
            requestId,
            productName: reqData.requested_product_name,
            reason,
            merchantId: reqData.submitted_by_merchant_id
        }, `product_creation_requests/${requestId}`);
    };

    // Bulk Add Merchant Products
    const bulkAddMerchantProducts = async (storeId: string, items: { barcode: string, price: number, quantity: number }[]) => {
        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[]
        };

        for (const item of items) {
            try {
                // 1. Find master product by barcode locally (Robust Check)
                const variants = generateBarcodeVariants(item.barcode);
                const q = query(collection(db, 'master_products'), where('barcode', 'in', variants));
                const snap = await import('firebase/firestore').then(mod => mod.getDocs(q));

                let masterId: string | null = null;

                if (!snap.empty) {
                    masterId = snap.docs[0].id;
                } else {
                    // 2. Auto-Discovery: Try external - Save to PENDING for admin review
                    try {
                        console.log(`[bulkAddMerchantProducts] Trying external lookup for ${item.barcode}`);
                        const externalProduct = await fetchExternalUPC(item.barcode);
                        if (externalProduct) {
                            console.log(`[bulkAddMerchantProducts] External product fetched, saving to pending review...`);
                            masterId = await addPendingMasterProduct(externalProduct as any, storeId, item.barcode);
                            console.log(`[bulkAddMerchantProducts] ✅ Product saved to pending: ${masterId}`);
                        }
                    } catch (extErr: any) {
                        console.error(`[bulkAddMerchantProducts] ❌ External lookup failed for ${item.barcode}:`, extErr.message, extErr);
                    }
                }

                if (masterId) {
                    const merchantProductId = `${storeId}_${masterId}`;
                    const ref = doc(db, 'merchant_products', merchantProductId);

                    // Use individual setDoc instead of batch to avoid:
                    // 1. 500-operation limit silently dropping items
                    // 2. Atomic batch failure rejecting ALL items if one fails
                    await setDoc(ref, {
                        merchant_product_id: merchantProductId,
                        merchant_id: storeId,
                        master_product_id: masterId,
                        merchant_sku: item.barcode,
                        price: Number(item.price),
                        available_quantity: Number(item.quantity),
                        currency: 'CAD',
                        status: 'active',
                        created_at: serverTimestamp(),
                        updated_at: serverTimestamp()
                    }, { merge: true });

                    results.success++;
                    console.log(`[bulkAddMerchantProducts] ✅ Merchant product created: ${merchantProductId}`);
                } else {
                    results.failed++;
                    results.errors.push(`UPC ${item.barcode} not found locally or globally.`);
                }
            } catch (err: any) {
                results.failed++;
                results.errors.push(`Error processing UPC ${item.barcode}: ${err.message}`);
                console.error(`[bulkAddMerchantProducts] ❌ Failed to create merchant product for ${item.barcode}:`, err.message);
            }
        }

        if (results.success > 0) {
            await syncStoreProductCount(storeId);
            auditBridge.emit('MERCHANT_PRODUCT_BULK_IMPORT', {
                storeId, total: items.length, success: results.success, failed: results.failed
            }, `stores/${storeId}`);
        }

        return results;
    };

    // Helper to sync count
    const syncStoreProductCount = async (storeId: string) => {
        try {
            const result = await getCountFromServer(query(collection(db, 'merchant_products'), where('merchant_id', '==', storeId)));
            const count = result.data().count;
            // Update count AND clear legacy 'products' array to prevent fallback zombies
            await updateDoc(doc(db, 'stores', storeId), {
                productCount: count,
                products: []
            });
            console.log(`Synced product count for ${storeId}: ${count}`);
        } catch (e) {
            console.error("Failed to sync product count", e);
        }
    };

    // Fetch from External Source (Open Food Facts - FREE)
    const fetchExternalUPC = async (barcode: string) => {
        setLoading(true);
        const userAgent = "SpendigoApp - WebScanner - Version 1.0";

        const categoryMap: Record<string, string> = {
            'lait': 'Dairy', 'milk': 'Dairy', 'cream': 'Dairy', 'yogourt': 'Dairy', 'cheese': 'Dairy',
            'pain': 'Bakery', 'bread': 'Bakery', 'bun': 'Bakery', 'cookie': 'Bakery',
            'poulet': 'Meat', 'chicken': 'Meat', 'beef': 'Meat', 'pork': 'Meat', 'steak': 'Meat',
            'fruit': 'Produce', 'legume': 'Produce', 'apple': 'Produce', 'banana': 'Produce', 'tomato': 'Produce',
            'soda': 'Beverages', 'pop': 'Beverages', 'water': 'Beverages', 'juice': 'Beverages', 'drink': 'Beverages',
            'egg': 'Dairy', 'oeuf': 'Dairy'
        };

        const cleanBarcode = barcode.trim().replace(/[^0-9]/g, '');
        if (!cleanBarcode) {
            setLoading(false);
            throw new Error("Invalid barcode provided.");
        }

        try {
            // Try different variants of the barcode (Original, 12-digit, Stripped)
            const variants = [cleanBarcode];
            if (cleanBarcode.length === 13 && cleanBarcode.startsWith('0')) variants.push(cleanBarcode.slice(1));
            if (cleanBarcode.startsWith('0')) variants.push(cleanBarcode.replace(/^0+/, ''));

            console.log(`[fetchExternalUPC] Trying barcode variants for "${cleanBarcode}":`, Array.from(new Set(variants)));

            let pData = null;
            for (const v of Array.from(new Set(variants))) {
                // Try multiple endpoints - different CORS policies
                const endpoints = [
                    `https://world.openfoodfacts.org/api/v2/product/${v}.json`,
                    `https://world.openfoodfacts.org/api/v0/product/${v}.json`,
                    `https://openfoodfacts.org/api/v0/product/${v}.json` // Different domain, often better CORS
                ];

                for (const url of endpoints) {
                    try {
                        console.log(`[fetchExternalUPC] Attempting: ${url}`);
                        const res = await fetch(url);
                        console.log(`[fetchExternalUPC] Response status: ${res.status}, ok: ${res.ok}`);

                        if (res.ok) {
                            const json = await res.json();
                            console.log(`[fetchExternalUPC] JSON status: ${json.status}`);

                            if (json.status === 1) {
                                console.log(`[fetchExternalUPC] ✅ Product found:`, json.product.product_name);
                                pData = json.product;
                                break;
                            }
                        }
                    } catch (e: any) {
                        console.error(`[fetchExternalUPC] ❌ Error fetching ${url}:`, e.message, e.name);
                    }
                }

                if (pData) break;
            }

            if (!pData) {
                console.error(`[fetchExternalUPC] ⚠️ All attempts failed for barcode: ${barcode}`);
                throw new Error(`Barcode ${barcode} not found in global database after trying ${Array.from(new Set(variants)).length} variants across multiple endpoints.`);
            }

            const p = pData;
            const name = p.product_name || p.generic_name || "Unknown Product";

            // Auto-Discovery: Category Mapping
            let categoryId = 'General';
            const searchableText = `${name} ${p.categories || ''} ${p.generic_name || ''}`.toLowerCase();
            for (const [key, val] of Object.entries(categoryMap)) {
                if (searchableText.includes(key)) {
                    categoryId = val;
                    break;
                }
            }

            // Map OFF fields to Spendigo MasterProduct schema
            const mapped: Partial<MasterProduct> = {
                product_name: name,
                brand_name: p.brands?.split(',')[0] || "Generic",
                barcode: cleanBarcode,
                upc_gtin: cleanBarcode,
                primary_image_url: p.image_url || p.image_front_url || "",
                short_description: p.generic_name || p.product_name,
                ingredients: p.ingredients_text,
                allergens: Array.isArray(p.allergens_tags) ? p.allergens_tags.map((t: any) => typeof t === 'string' ? t.replace('en:', '') : String(t)) : [],
                dietary_tags: [
                    ...(Array.isArray(p.labels_tags) ? p.labels_tags : []),
                    ...(Array.isArray(p.states_tags) && p.states_tags.includes('en:checked') ? ['verified'] : [])
                ].map((t: any) => typeof t === 'string' ? t.replace('en:', '') : String(t)),
                nutrition: {
                    calories: p.nutriments?.['energy-kcal_100g'],
                    protein: p.nutriments?.proteins_100g,
                    fat: p.nutriments?.fat_100g,
                    carbs: p.nutriments?.carbohydrates_100g
                },
                net_quantity_value: parseFloat(String(p.quantity || '').match(/[\d.]+/)?.[0] || '0'),
                net_quantity_unit: String(p.quantity || '').match(/[a-zA-Z]+/)?.[0] || '',
                data_source: 'open_food_facts',
                status: 'active',
                verification_status: 'unverified',
                is_sold_by_weight: categoryId === 'Meat' || categoryId === 'Produce',
                tax_category_id: 'zero_rated_grocery',
                category_id: categoryId
            };

            return mapped as MasterProduct;
        } catch (err: any) {
            console.error("OFF Fetch Error:", err);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const addMasterProduct = async (data: MasterProduct) => {
        try {
            console.log(`[addMasterProduct] Checking for existing product with barcode: ${data.barcode}`);

            // Check if product with this barcode already exists
            let masterId = data.master_product_id;

            if (data.barcode) {
                const variants = generateBarcodeVariants(data.barcode);
                const q = query(collection(db, 'master_products'), where('barcode', 'in', variants));
                const existingSnap = await getDocs(q);

                if (!existingSnap.empty) {
                    masterId = existingSnap.docs[0].id;
                    console.log(`[addMasterProduct] ⚠️ Barcode ${data.barcode} exists as: ${masterId}. Updating.`);
                }
            }

            // If no existing product found, generate new ID
            if (!masterId) {
                masterId = `mp-${data.product_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`;
                console.log(`[addMasterProduct] Creating NEW product: ${masterId}`);
            }

            // Remove undefined values (Firestore doesn't support them)
            const cleanPayload = (obj: any): any => {
                if (obj === null || obj === undefined) return null;
                if (Array.isArray(obj)) return obj.filter(v => v !== undefined).map(cleanPayload);
                if (typeof obj === 'object') {
                    if (typeof obj.isEqual === 'function' || obj instanceof Date) return obj;
                    const cleaned: any = {};
                    for (const [key, value] of Object.entries(obj)) {
                        if (value !== undefined) {
                            cleaned[key] = cleanPayload(value);
                        }
                    }
                    return cleaned;
                }
                return obj;
            };

            const payload = cleanPayload({
                ...data,
                master_product_id: masterId,
                updated_at: serverTimestamp(),
                created_at: data.created_at || serverTimestamp()
            });

            const ref = doc(db, 'master_products', masterId);

            await setDoc(ref, payload, { merge: true });
            console.log(`[addMasterProduct] ✅ Successfully created/updated master product: ${masterId}`);
            return masterId;
        } catch (err: any) {
            console.error(`[addMasterProduct] ❌ Failed to add master product:`, err.message, err);
            throw err;
        }
    };

    // ============= PENDING MASTER PRODUCTS =============
    const usePendingMasterProducts = () => {
        const [pendingProducts, setPendingProducts] = useState<any[]>([]);
        const [loading, setLoading] = useState(true);

        useEffect(() => {
            const q = query(collection(db, 'pending_master_products'), orderBy('created_at', 'desc'));
            const unsubscribe = onSnapshot(q, snapshot => {
                const pending: any[] = [];
                snapshot.forEach(doc => {
                    pending.push({ id: doc.id, ...doc.data() });
                });
                setPendingProducts(pending);
                setLoading(false);
            });
            return () => unsubscribe();
        }, []);

        return { pendingProducts, loading };
    };

    const addPendingMasterProduct = async (data: MasterProduct, merchantId: string, barcode: string) => {
        try {
            console.log(`[addPendingMasterProduct] Checking duplicates for: ${barcode}`);

            // 1. Check if already in MASTER catalog
            const variants = generateBarcodeVariants(barcode);
            const masterQ = query(collection(db, 'master_products'), where('barcode', 'in', variants));
            const masterSnap = await getDocs(masterQ);

            if (!masterSnap.empty) {
                const existingId = masterSnap.docs[0].id;
                console.log(`[addPendingMasterProduct] ⚠️ Already in MASTER: ${existingId}`);
                return existingId;
            }

            // 2. Check if already PENDING
            // Note: generateBarcodeVariants(barcode) reused from above 'variants'
            const pendingQ = query(collection(db, 'pending_master_products'), where('original_barcode', 'in', variants));
            const pendingSnap = await getDocs(pendingQ);

            if (!pendingSnap.empty) {
                const existingId = pendingSnap.docs[0].id;
                console.log(`[addPendingMasterProduct] ⚠️ Already PENDING: ${existingId}`);
                return existingId;
            }

            // 3. Create new pending product
            const pendingId = `pending-${barcode}-${Date.now()}`;
            const ref = doc(db, 'pending_master_products', pendingId);

            console.log(`[addPendingMasterProduct] Creating NEW: ${pendingId}`);

            // Remove undefined values
            const cleanPayload = (obj: any): any => {
                if (obj === null || obj === undefined) return null;
                if (Array.isArray(obj)) return obj.filter(v => v !== undefined).map(cleanPayload);
                if (typeof obj === 'object') {
                    if (typeof obj.isEqual === 'function' || obj instanceof Date) return obj;
                    const cleaned: any = {};
                    for (const [key, value] of Object.entries(obj)) {
                        if (value !== undefined) {
                            cleaned[key] = cleanPayload(value);
                        }
                    }
                    return cleaned;
                }
                return obj;
            };

            const payload = cleanPayload({
                ...data,
                pending_id: pendingId,
                discovered_by_merchant: merchantId,
                original_barcode: barcode,
                status: 'pending_review',
                created_at: serverTimestamp(),
                updated_at: serverTimestamp()
            });

            await setDoc(ref, payload, { merge: true });
            console.log(`[addPendingMasterProduct] ✅ Saved to pending: ${pendingId}`);
            return pendingId;
        } catch (err: any) {
            console.error(`[addPendingMasterProduct] ❌ Failed:`, err.message, err);
            throw err;
        }
    };

    const commitPendingProduct = async (pendingId: string, pendingData: any) => {
        try {
            console.log(`[commitPendingProduct] Committing: ${pendingId}`);

            // 1. Add to master_products
            const masterId = await addMasterProduct(pendingData as MasterProduct);
            console.log(`[commitPendingProduct] Created master: ${masterId}`);

            // 2. Update all merchant_products that reference pending ID
            const merchantQuery = query(
                collection(db, 'merchant_products'),
                where('master_product_id', '==', pendingId)
            );
            const merchantSnap = await getDocs(merchantQuery);

            console.log(`[commitPendingProduct] Updating ${merchantSnap.size} merchant products`);

            const updates = merchantSnap.docs.map(docSnap =>
                updateDoc(doc(db, 'merchant_products', docSnap.id), {
                    master_product_id: masterId,
                    updated_at: serverTimestamp()
                })
            );
            await Promise.all(updates);
            console.log(`[commitPendingProduct] ✅ Merchant products updated`);

            // 3. Delete from pending
            await deleteDoc(doc(db, 'pending_master_products', pendingId));
            console.log(`[commitPendingProduct] ✅ Pending deleted`);

            return masterId;
        } catch (err: any) {
            console.error('[commitPendingProduct] ❌ Failed:', err);
            throw err;
        }
    };

    const rejectPendingProduct = async (pendingId: string) => {
        await deleteDoc(doc(db, 'pending_master_products', pendingId));
    };

    const migrateCategories = async () => {
        setLoading(true);
        try {
            console.log("Starting Category Migration...");
            const { writeBatch: wb } = await import('firebase/firestore');
            let batch = wb(db);
            let operationCount = 0;
            const MAX_BATCH = 450;
            let batchCommits = 0;

            const flushBatch = async () => {
                if (operationCount === 0) return;
                await batch.commit();
                batch = wb(db);
                operationCount = 0;
                batchCommits++;
            };

            const cleanId = (id: string) => {
                if (!id) return 'Other';
                const map: Record<string, string> = {
                    // Legacy prefixed IDs
                    'cat-dairy': 'Dairy & Eggs',
                    'cat-bakery': 'Bakery',
                    'cat-meat': 'Meat & Seafood',
                    'cat-produce': 'Produce',
                    'cat-beverages': 'Beverages',
                    'cat-general': 'Other',
                    // French
                    'lait': 'Dairy & Eggs',
                    // Long-form names from bulk seed script
                    'Dairy & Refrigerated': 'Dairy & Eggs',
                    'Bakery & Grains': 'Bakery',
                    'Produce & Frozen': 'Produce',
                    'Snacks & Household': 'Snacks',
                    'Pantry Staples': 'Pantry',
                    'Breakfast & Beverages': 'Beverages',
                    'Meat & Seafood': 'Meat & Seafood',
                    // Short-form names from a previous migration run
                    'Dairy': 'Dairy & Eggs',
                    'Meat': 'Meat & Seafood',
                    'General': 'Other',
                };
                if (map[id]) return map[id];
                return id.replace(/^cat-/, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            };

            // 1. Update Master Products
            const masterSnap = await getDocs(collection(db, 'master_products'));
            for (const doc of masterSnap.docs) {
                const data = doc.data();
                const current = data.category_id || '';
                const newCat = cleanId(current);
                if (newCat !== current) {
                    batch.update(doc.ref, { category_id: newCat });
                    operationCount++;
                }
                if (operationCount >= MAX_BATCH) await flushBatch();
            }

            // 2. Pending Products
            const pendingSnap = await getDocs(collection(db, 'pending_master_products'));
            for (const doc of pendingSnap.docs) {
                const data = doc.data();
                if (data.category_id) {
                    const newCat = cleanId(data.category_id);
                    if (newCat !== data.category_id) {
                        batch.update(doc.ref, { category_id: newCat });
                        operationCount++;
                    }
                }
                if (operationCount >= MAX_BATCH) await flushBatch();
            }

            await flushBatch();
            console.log(`Migration Complete. Batches: ${batchCommits}`);

        } catch (e) {
            console.error("Migration failed", e);
            throw e;
        } finally {
            setLoading(false);
        }
    };

    const updateMasterProduct = async (id: string, data: Partial<MasterProduct>) => {
        try {
            await updateDoc(doc(db, 'master_products', id), {
                ...data,
                updated_at: serverTimestamp()
            });
        } catch (e) {
            console.error("Update Master Product failed", e);
            throw e;
        }
    };

    const deleteMasterProduct = async (id: string) => {
        try {
            // Delete Image if hosted
            const docSnap = await getDoc(doc(db, 'master_products', id));
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.primary_image_url && data.primary_image_url.includes('firebasestorage')) {
                    try {
                        await deleteObject(ref(storage, data.primary_image_url));
                    } catch (err) { console.warn('Master Product Image delete failed', err); }
                }
                for (const url of (data.secondary_image_urls ?? [])) {
                    if (url?.includes('firebasestorage')) {
                        try { await deleteObject(ref(storage, url)); } catch { /* ignore */ }
                    }
                }
            }
            await deleteDoc(doc(db, 'master_products', id));
        } catch (e) {
            console.error("Delete Master Product failed", e);
            throw e;
        }
    };

    return {
        useStoreProducts,
        useProductDetail,
        useGlobalCatalog,
        searchMasterCatalog,
        addMerchantProduct,
        updateMerchantProduct,
        deleteMerchantProduct,
        bulkAddMerchantProducts,
        fetchExternalUPC,
        addMasterProduct,
        updateMasterProduct,
        deleteMasterProduct,
        addPendingMasterProduct,
        requestMasterProduct,
        useMasterCatalog,
        useProductRequests,
        usePendingMasterProducts,
        approveProductRequest,
        rejectProductRequest,
        commitPendingProduct,
        rejectPendingProduct,
        migrateCategories,
        getAverageMarketPrice,
        loading,
        error
    };
};
