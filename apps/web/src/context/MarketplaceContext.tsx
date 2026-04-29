import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isFlyerActive, filterActiveDeals } from '../utils/date-helpers';
// Audit import removed

interface MarketplaceContextType {
    stores: Record<string, any>;
    updateStore: (storeId: string | number, data: any) => Promise<void>;
    updateStoreProducts: (storeId: string | number, products: any[]) => Promise<void>;
    updateStoreFlyer: (storeId: string | number, flyer: any) => Promise<void>;
    updateStoreDeals: (storeId: string | number, type: 'oneDayOffers' | 'saleItems', deals: any[]) => Promise<void>;
    updateStoreTeam: (storeId: string | number, team: any[]) => Promise<void>;
    updateStoreStatus: (storeId: string | number, status: 'active' | 'pending' | 'suspended', reason?: string) => Promise<void>;
    addStore: (store: any) => Promise<any>;
    deleteStore: (storeId: string) => Promise<void>;
    requestDeleteStore: (storeId: string, requesterId: string, requesterRole: string) => Promise<void>;
    approveDeleteStore: (storeId: string) => Promise<void>;
    // Flyer Management
    subscribeToFlyers: (storeId: string | number, callback: (flyers: any[]) => void) => () => void;
    saveFlyer: (storeId: string | number, flyer: any) => Promise<void>;
    deleteFlyer: (storeId: string | number, flyerId: string) => Promise<void>;
    // Deal Management
    subscribeToDeals: (storeId: string | number, callback: (deals: any[]) => void) => () => void;
    saveDeal: (storeId: string | number, deal: any) => Promise<void>;
    deleteDeal: (storeId: string | number, dealId: string) => Promise<void>;
    getStore: (storeId: string | number) => any;
    loading: boolean;
}

const MarketplaceContext = createContext<MarketplaceContextType | undefined>(undefined);

export const MarketplaceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [stores, setStores] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);

    // Sync Stores from Firestore - OPTIMIZED: Filter for active stores
    useEffect(() => {
        // Load all stores and filter client-side (Firestore doesn't support undefined in 'in' clause)
        const unsubscribe = onSnapshot(collection(db, 'stores'), (snapshot) => {
            const storeData: Record<string, any> = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                // Include all stores so merchants can access their pending/suspended stores
                // Consumer views (like StoreList) will filter for active stores.
                storeData[doc.id] = { id: doc.id, ...data };
            });
            setStores(storeData);
            setLoading(false);
        }, (error) => {
            console.error("Error loading stores:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Time-based reactivity: Refresh filtered stores every minute to handle expirations
    const [lastTimeRefreshed, setLastTimeRefreshed] = useState(Date.now());
    useEffect(() => {
        const interval = setInterval(() => {
            setLastTimeRefreshed(Date.now());
        }, 60000); // 60 seconds
        return () => clearInterval(interval);
    }, []);

    const updateStore = async (storeId: string | number, data: any) => {
        const storeRef = doc(db, 'stores', String(storeId));
        await updateDoc(storeRef, data);
    };

    const updateStoreProducts = async (storeId: string | number, products: any[]) => {
        const storeRef = doc(db, 'stores', String(storeId));
        await updateDoc(storeRef, { products });
    };

    const updateStoreFlyer = async (storeId: string | number, flyer: { title: string; validUntil: string; image: string; items?: any[] }) => {
        const storeRef = doc(db, 'stores', String(storeId));
        const updateData: any = { flyer };
        if (flyer.items) {
            updateData.activeFlyerItems = flyer.items;
        } else {
            updateData.activeFlyerItems = []; // Clear if no active flyer
        }
        await updateDoc(storeRef, updateData);
    };

    const updateStoreDeals = async (storeId: string | number, type: 'oneDayOffers' | 'saleItems', deals: any[]) => {
        const storeRef = doc(db, 'stores', String(storeId));
        await updateDoc(storeRef, { [type]: deals });
    };

    const updateStoreTeam = async (storeId: string | number, team: any[]) => {
        const storeRef = doc(db, 'stores', String(storeId));
        await updateDoc(storeRef, { team });
    };

    const updateStoreStatus = async (storeId: string | number, status: 'active' | 'pending' | 'suspended', reason?: string) => {
        const storeRef = doc(db, 'stores', String(storeId));
        const updateData: any = { status };
        
        if (reason) {
            updateData.statusReason = reason;
            updateData.statusUpdatedAt = new Date().toISOString();
        } else if (status === 'active') {
            // Clear reason when activating
            updateData.statusReason = null;
        }
        
        await updateDoc(storeRef, updateData);
    };

    const addStore = async (store: any) => {
        const newId = store.id || `store-${Date.now()}`;
        // Audit logging removed
        const storeData = {
            ...store,
            id: newId,
            status: store.status || 'pending',
            products: [],
            joinedAt: new Date().toISOString().split('T')[0]
        };
        await setDoc(doc(db, 'stores', newId), storeData);
        return storeData;
    };

    const deleteStore = async (storeId: string) => {
        const storeRef = doc(db, 'stores', storeId);
        await deleteDoc(storeRef);
    };

    const requestDeleteStore = async (storeId: string, requesterId: string, requesterRole: string) => {
        const storeRef = doc(db, 'stores', storeId);
        await updateDoc(storeRef, {
            status: 'pending_deletion',
            deletionRequest: {
                requestedBy: requesterId,
                requesterRole: requesterRole,
                requestedAt: new Date().toISOString()
            }
        });
        // Audit logging removed
    };

    const approveDeleteStore = async (storeId: string) => {
        const storeRef = doc(db, 'stores', storeId);
        await deleteDoc(storeRef);
        // Audit logging removed
    };

    // --- Flyer Management (Subcollection) ---
    const subscribeToFlyers = (storeId: string | number, callback: (flyers: any[]) => void) => {
        const flyersRef = collection(db, 'stores', String(storeId), 'flyers');
        return onSnapshot(flyersRef, (snapshot) => {
            const flyers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(flyers);
        });
    };

    const saveFlyer = async (storeId: string | number, flyer: any) => {
        const flyerId = flyer.id || `f${Date.now()}`;
        const flyerRef = doc(db, 'stores', String(storeId), 'flyers', flyerId);
        await setDoc(flyerRef, { ...flyer, id: flyerId }, { merge: true });
    };

    const deleteFlyer = async (storeId: string | number, flyerId: string) => {
        const flyerRef = doc(db, 'stores', String(storeId), 'flyers', flyerId);
        await deleteDoc(flyerRef);
    };

    // --- Deal Management (Subcollection) ---
    const subscribeToDeals = (storeId: string | number, callback: (deals: any[]) => void) => {
        const dealsRef = collection(db, 'stores', String(storeId), 'deals');
        return onSnapshot(dealsRef, (snapshot) => {
            const deals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(deals);
        });
    };

    const saveDeal = async (storeId: string | number, deal: any) => {
        const dealId = deal.id || `d${Date.now()}`;
        const dealRef = doc(db, 'stores', String(storeId), 'deals', dealId);
        await setDoc(dealRef, { ...deal, id: dealId }, { merge: true });
    };

    const deleteDeal = async (storeId: string | number, dealId: string) => {
        const dealRef = doc(db, 'stores', String(storeId), 'deals', dealId);
        await deleteDoc(dealRef);
    };

    const filterStoreData = (store: any) => {
        if (!store) return store;

        const filteredStore = { ...store };
        const tier = filteredStore.subscriptionTier || 'free';
        // Starter/Free plan has no promos in the marketplace. Core and Growth do.
        const hasPromoPlan = tier !== 'free';

        // 1. Filter Flyer - only clear if it's actually expired OR if store is NOT on growth tier
        if (!isFlyerActive(filteredStore.flyer) || !hasPromoPlan) {
            filteredStore.flyer = { title: '', validUntil: '', image: '' };
            filteredStore.activeFlyerItems = [];
        }

        // 2. Filter Sale Items - clear if expired OR if store is NOT on growth tier
        if (filteredStore.saleItems) {
            filteredStore.saleItems = !hasPromoPlan ? [] : filterActiveDeals(filteredStore.saleItems);
        }

        // 3. Filter One Day Offers - clear if expired OR if store is NOT on growth tier
        if (filteredStore.oneDayOffers) {
            filteredStore.oneDayOffers = !hasPromoPlan ? [] : filterActiveDeals(filteredStore.oneDayOffers);
        }

        return filteredStore;
    };

    const filteredStores = React.useMemo(() => {
        const result: Record<string, any> = {};
        Object.keys(stores).forEach(id => {
            result[id] = filterStoreData(stores[id]);
        });
        return result;
    }, [stores, lastTimeRefreshed]); // Depend on lastTimeRefreshed to re-calc every minute

    const getStore = (storeId: string | number) => filteredStores[storeId];

    return (
        <MarketplaceContext.Provider value={{
            stores: filteredStores,
            updateStore,
            updateStoreProducts,
            updateStoreFlyer,
            updateStoreDeals,
            updateStoreTeam,
            updateStoreStatus,
            deleteStore,
            requestDeleteStore,
            approveDeleteStore,

            addStore,
            subscribeToFlyers,
            saveFlyer,
            deleteFlyer,

            subscribeToDeals,
            saveDeal,
            deleteDeal,

            getStore,
            loading
        }}>
            {children}
        </MarketplaceContext.Provider>
    );
};

export const useMarketplace = () => {
    const context = useContext(MarketplaceContext);
    if (context === undefined) {
        throw new Error('useMarketplace must be used within a MarketplaceProvider');
    }
    return context;
};
