import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAudit } from './AuditContext';

interface MarketplaceContextType {
    stores: Record<string, any>;
    updateStore: (storeId: string | number, data: any) => Promise<void>;
    updateStoreProducts: (storeId: string | number, products: any[]) => Promise<void>;
    updateStoreFlyer: (storeId: string | number, flyer: any) => Promise<void>;
    updateStoreDeals: (storeId: string | number, type: 'oneDayOffers' | 'saleItems', deals: any[]) => Promise<void>;
    updateStoreTeam: (storeId: string | number, team: any[]) => Promise<void>;
    updateStoreStatus: (storeId: string | number, status: 'active' | 'pending' | 'suspended') => Promise<void>;
    addStore: (store: any) => Promise<void>;
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
    const { logEvent } = useAudit();
    const [stores, setStores] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);

    // Sync Stores from Firestore
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'stores'), (snapshot) => {
            const storeData: Record<string, any> = {};
            snapshot.forEach(doc => {
                storeData[doc.id] = { id: doc.id, ...doc.data() };
            });
            setStores(storeData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const updateStore = async (storeId: string | number, data: any) => {
        const storeRef = doc(db, 'stores', String(storeId));
        await updateDoc(storeRef, data);
    };

    const updateStoreProducts = async (storeId: string | number, products: any[]) => {
        const storeRef = doc(db, 'stores', String(storeId));
        await updateDoc(storeRef, { products });
    };

    const updateStoreFlyer = async (storeId: string | number, flyer: any) => {
        const storeRef = doc(db, 'stores', String(storeId));
        await updateDoc(storeRef, { flyer });
    };

    const updateStoreDeals = async (storeId: string | number, type: 'oneDayOffers' | 'saleItems', deals: any[]) => {
        const storeRef = doc(db, 'stores', String(storeId));
        await updateDoc(storeRef, { [type]: deals });
    };

    const updateStoreTeam = async (storeId: string | number, team: any[]) => {
        const storeRef = doc(db, 'stores', String(storeId));
        await updateDoc(storeRef, { team });
    };

    const updateStoreStatus = async (storeId: string | number, status: 'active' | 'pending' | 'suspended') => {
        const storeRef = doc(db, 'stores', String(storeId));
        const store = stores[storeId];

        logEvent('STORE_STATUS_UPDATE', {
            storeId,
            storeName: store?.name,
            oldStatus: store?.status,
            newStatus: status
        }, `store/${storeId}`);

        await updateDoc(storeRef, { status });
    };

    const addStore = async (store: any) => {
        const newId = store.id || `store-${Date.now()}`;

        logEvent('STORE_CREATED', {
            storeId: newId,
            storeName: store.name,
            merchantEmail: store.merchantEmail
        }, `store/${newId}`);

        await setDoc(doc(db, 'stores', newId), {
            ...store,
            id: newId,
            status: store.status || 'pending',
            products: [],
            joinedAt: new Date().toISOString().split('T')[0]
        });
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

        logEvent('STORE_DELETION_REQUESTED', {
            storeId,
            requesterId,
            requesterRole
        }, `store/${storeId}`);
    };

    const approveDeleteStore = async (storeId: string) => {
        const storeRef = doc(db, 'stores', storeId);
        await deleteDoc(storeRef);

        logEvent('STORE_DELETION_APPROVED', {
            storeId
        }, `store/${storeId}`);
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
        // deleteDoc is not imported, let's fix imports first or assume it is available? 
        // Wait, I need to check imports. I'll just use deleteDoc here and update imports in next step if needed. 
        // Actually, I can't easily see imports without view_file again. 
        // Better to use updateDoc to mark as deleted? No, physical delete is requested.
        // Let's assume I need to add deleteDoc to imports.
        // For now, I will use the imported 'updateDoc' etc. I see 'doc' 'collection' 'onSnapshot' 'updateDoc' 'setDoc' 'getDoc'. 'deleteDoc' is MISSING.
        // I will add it to imports in a separate call or same call if possible.
        // Since I can't effectively multi-replace safely without ensuring I have the import, 
        // I'll stick to defining the functions here and then fix the import.
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

    const getStore = (storeId: string | number) => stores[storeId];

    return (
        <MarketplaceContext.Provider value={{
            stores,
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
