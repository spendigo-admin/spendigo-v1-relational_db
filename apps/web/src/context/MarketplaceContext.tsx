import React, { createContext, useContext, useState, ReactNode } from 'react';
import { STORE_DATA } from '../data/productData';

interface MarketplaceContextType {
    stores: Record<string, any>;
    updateStore: (storeId: string | number, data: any) => void;
    updateStoreProducts: (storeId: string | number, products: any[]) => void;
    updateStoreFlyer: (storeId: string | number, flyer: any) => void;
    updateStoreDeals: (storeId: string | number, type: 'oneDayOffers' | 'saleItems', deals: any[]) => void;
    updateStoreTeam: (storeId: string | number, team: any[]) => void;
    updateStoreStatus: (storeId: string | number, status: 'active' | 'pending' | 'suspended') => void;
    addStore: (store: any) => void;
    getStore: (storeId: string | number) => any;
}

const MarketplaceContext = createContext<MarketplaceContextType | undefined>(undefined);

import { useAudit } from './AuditContext';

export const MarketplaceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { logEvent } = useAudit();
    // Initialize with the static mock data, ensure they have status
    const initialData = Object.entries(STORE_DATA).reduce((acc, [key, val]: [string, any]) => {
        acc[key] = { ...val, status: val.status || 'active', joinedAt: val.joinedAt || '2023-01-01' };
        return acc;
    }, {} as Record<string, any>);

    const [stores, setStores] = useState<Record<string, any>>(initialData);

    const updateStore = (storeId: string | number, data: any) => {
        setStores(prev => ({
            ...prev,
            [storeId]: { ...prev[storeId], ...data }
        }));
    };

    const updateStoreProducts = (storeId: string | number, products: any[]) => {
        setStores(prev => ({
            ...prev,
            [storeId]: { ...prev[storeId], products }
        }));
    };

    const updateStoreFlyer = (storeId: string | number, flyer: any) => {
        setStores(prev => ({
            ...prev,
            [storeId]: { ...prev[storeId], flyer }
        }));
    };

    const updateStoreDeals = (storeId: string | number, type: 'oneDayOffers' | 'saleItems', deals: any[]) => {
        setStores(prev => ({
            ...prev,
            [storeId]: { ...prev[storeId], [type]: deals }
        }));
    };

    const updateStoreTeam = (storeId: string | number, team: any[]) => {
        setStores(prev => ({
            ...prev,
            [storeId]: { ...prev[storeId], team }
        }));
    };

    const updateStoreStatus = (storeId: string | number, status: 'active' | 'pending' | 'suspended') => {
        setStores(prev => {
            const store = prev[storeId];
            logEvent('STORE_STATUS_UPDATE', {
                storeId,
                storeName: store?.name,
                oldStatus: store?.status,
                newStatus: status
            }, `store/${storeId}`);
            return {
                ...prev,
                [storeId]: { ...prev[storeId], status }
            };
        });
    };

    const addStore = (store: any) => {
        const newId = store.id || `store-${Date.now()}`;
        logEvent('STORE_CREATED', {
            storeId: newId,
            storeName: store.name,
            merchantEmail: store.merchantEmail
        }, `store/${newId}`);

        setStores(prev => ({
            ...prev,
            [newId]: { ...store, id: newId, status: store.status || 'pending', products: [], joinedAt: new Date().toISOString().split('T')[0] }
        }));
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
            addStore,
            getStore
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
