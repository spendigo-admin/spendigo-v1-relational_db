
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

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
    barcode?: string;     // Added
    unit_size?: string;   // Added
    merchant_sku: string;
    price: number;
    currency: string;
    available_quantity: number;

    // UI Helpers
    originalPrice?: number;
    discount?: string;
    nutrition?: any;
}

export const useCatalog = () => {

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
                    const mDoc = await getDoc(doc(db, 'master_products', mid));
                    if (mDoc.exists()) masterMap.set(mid, mDoc.data());
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
                            images: [master.primary_image_url], // TODO: Master should support multiple images
                            category: master.category_id,
                            brand_name: master.brand_name,
                            barcode: master.barcode,
                            unit_size: master.unit_size || master.size,
                            nutrition: master.nutrition,

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
                                images: [mData.primary_image_url], // Fallback
                                category: mData.category_id,
                                brand_name: mData.brand_name,
                                barcode: mData.barcode,
                                unit_size: mData.unit_size || mData.size,
                                nutrition: mData.nutrition,

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
    const useGlobalCatalog = () => {
        const [products, setProducts] = useState<Product[]>([]);
        const [loadingProducts, setLoading] = useState(true);

        useEffect(() => {
            // Limit to 50 for demo performance
            const q = query(collection(db, 'merchant_products') /*, limit(50) */);

            const unsubscribe = onSnapshot(q, async (snapshot) => {
                const fetchedProducts: Product[] = [];
                const masterIds = new Set<string>();
                const merchantIds = new Set<string>();

                snapshot.forEach(doc => {
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

                snapshot.forEach(doc => {
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
                            images: [master.primary_image_url],
                            category: master.category_id,
                            brand_name: master.brand_name,
                            barcode: master.barcode,
                            unit_size: master.unit_size || master.size, // Fallback to 'size'
                            nutrition: master.nutrition,

                            originalPrice: data.original_price,
                            discount: data.discount_label
                        } as Product);
                    }
                });

                setProducts(fetchedProducts);
                setLoading(false);
            });

            return () => unsubscribe();
        }, []);

        return { products, loading: loadingProducts };
    };

    // --- WRITE ACTIONS ---

    // Search Master Catalog (for Merchant adding products)
    const searchMasterCatalog = async (searchQuery: string) => {
        // NOTE: Firestore doesn't support full-text search natively. 
        // For a hackathon/demo, we'll fetch all master products (or a reasonable limit) and filter strictly in memory.
        // In production, use Algolia/Typesense.

        try {
            // Limited fetch for demo performance
            const q = query(collection(db, 'master_products'));
            const snapshot = await import('firebase/firestore').then(mod => mod.getDocs(q));

            const results: any[] = [];
            const lowerQuery = searchQuery.toLowerCase();

            snapshot.forEach(doc => {
                const data = doc.data();
                const text = `${data.product_name} ${data.brand_name || ''} ${data.barcode || ''}`.toLowerCase();
                if (text.includes(lowerQuery)) {
                    results.push({ ...data, id: doc.id });
                }
            });
            return results;
        } catch (err) {
            console.error(err);
            return [];
        }
    };

    // Add Product to Store (Link Merchant -> Master)
    const addMerchantProduct = async (storeId: string, masterId: string, price: number, quantity: number) => {
        const merchantProductId = `${storeId}_${masterId}`; // Deterministic ID
        const ref = doc(db, 'merchant_products', merchantProductId);

        await setDoc(ref, {
            merchant_product_id: merchantProductId,
            merchant_id: storeId,
            master_product_id: masterId,
            price: Number(price),
            available_quantity: Number(quantity),
            currency: 'CAD',
            status: 'active',
            created_at: serverTimestamp(),
            updated_at: serverTimestamp()
        });
    };

    // Update Merchant Product (Price, Quantity)
    const updateMerchantProduct = async (productId: string, data: Partial<Product>) => {
        const ref = doc(db, 'merchant_products', productId);
        // Only allow updating specific fields
        const safeData: any = {};
        if (data.price !== undefined) safeData.price = Number(data.price);
        if (data.available_quantity !== undefined) safeData.available_quantity = Number(data.available_quantity);
        if (data.merchant_sku !== undefined) safeData.merchant_sku = data.merchant_sku;

        safeData.updated_at = serverTimestamp();

        await updateDoc(ref, safeData);
    };

    // Delete Merchant Product
    const deleteMerchantProduct = async (productId: string) => {
        const ref = doc(db, 'merchant_products', productId);
        await deleteDoc(ref);
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
            created_at: serverTimestamp()
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

        // 3. Notify Merchant
        // We need to look up the user ID associated with the merchant store if possible, 
        // OR we notify the store owner.
        // Assuming 'submitted_by_merchant_id' is the Store ID. 
        // Notification system uses User ID.
        // We need to find the User WHO OWNS the store.
        // For now, let's assume specific Logic:
        //  The 'submitted_by_merchant_id' is a STORE ID.
        //  The `notifications` subcollection is on the USER document.
        //  We need to look up the store to get `ownerId`.

        const storeDoc = await getDoc(doc(db, 'stores', reqData.submitted_by_merchant_id));
        if (storeDoc.exists()) {
            const ownerId = storeDoc.data().ownerId;
            if (ownerId) {
                const notifRef = doc(collection(db, 'users', ownerId, 'notifications'));
                batch.set(notifRef, {
                    type: 'system',
                    title: 'Product Request Approved',
                    message: `Your request for '${masterData.name}' has been approved and added to the Master Catalog.`,
                    read: false,
                    timestamp: new Date().toISOString()
                });
            }
        }

        await batch.commit();
    };

    const rejectProductRequest = async (requestId: string, reqData: any, reason: string) => {
        const batch = (await import('firebase/firestore')).writeBatch(db);
        const reqRef = doc(db, 'product_creation_requests', requestId);

        batch.update(reqRef, {
            status: 'rejected',
            resolution_note: reason,
            updated_at: serverTimestamp()
        });

        // Notify Merchant
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

        await batch.commit();
    };

    return {
        useStoreProducts,
        useProductDetail,
        useGlobalCatalog,
        searchMasterCatalog,
        addMerchantProduct,
        updateMerchantProduct,
        deleteMerchantProduct,
        requestMasterProduct,
        useProductRequests,
        approveProductRequest,
        rejectProductRequest,
        loading,
        error
    };
};
