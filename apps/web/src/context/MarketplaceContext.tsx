import React, { createContext, useContext, useState, ReactNode } from 'react';
import { STORE_DATA } from '../data/productData';

interface MarketplaceContextType {
    stores: Record<string, any>;
    updateStore: (storeId: string | number, data: any) => void;
    updateStoreProducts: (storeId: string | number, products: any[]) => void;
    updateStoreFlyer: (storeId: string | number, flyer: any) => void;
    updateStoreDeals: (storeId: string | number, type: 'oneDayOffers' | 'saleItems', deals: any[]) => void;
    getStore: (storeId: string | number) => any;
}

const MarketplaceContext = createContext<MarketplaceContextType | undefined>(undefined);

export const MarketplaceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Initialize with the static mock data
    const [stores, setStores] = useState<Record<string, any>>(STORE_DATA);

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

    const getStore = (storeId: string | number) => stores[storeId];

    return (
        <MarketplaceContext.Provider value={{ stores, updateStore, updateStoreProducts, updateStoreFlyer, updateStoreDeals, getStore }}>
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
