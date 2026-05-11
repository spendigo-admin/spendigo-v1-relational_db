import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface CatalogItem {
    id: string;
    name: string;
    category: string;
    image: string;
    description: string;
    unit: string;
    taxable: boolean;
    barcode?: string; // Added barcode support
    brand?: string;
    is_canadian_local?: boolean;
}

interface CatalogContextType {
    catalog: CatalogItem[];
    searchCatalog: (query: string) => CatalogItem[];
    getCatalogItem: (id: string) => CatalogItem | undefined;
    loadCatalog: () => void; // Added loadCatalog
    categories: string[];
    loading: boolean;
    isLoaded: boolean; // Added isLoaded state
}

const CatalogContext = createContext<CatalogContextType | undefined>(undefined);

export const CatalogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [catalog, setCatalog] = useState<CatalogItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const unsubscribeRef = useRef<(() => void) | null>(null);

    // Cleanup subscription on unmount
    useEffect(() => {
        return () => {
            if (unsubscribeRef.current) unsubscribeRef.current();
        };
    }, []);

    // Lazy load function
    const loadCatalog = () => {
        if (isLoaded || loading) return; // Prevent duplicate loads

        setLoading(true);
        const q = query(collection(db, 'master_products'), orderBy('product_name', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items: CatalogItem[] = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                items.push({
                    id: doc.id,
                    name: data.product_name || 'Unnamed Product',
                    category: data.category_id || 'General',
                    image: data.primary_image_url || '',
                    description: data.short_description || '',
                    unit: data.unit_size || data.net_quantity_unit || '',
                    taxable: data.tax_category_id !== 'zero_rated_grocery',
                    barcode: data.upc_gtin || data.barcode,
                    brand: data.brand || '',
                    is_canadian_local: data.is_canadian_local || false
                });
            });
            setCatalog(items);
            setLoading(false);
            setIsLoaded(true);
        }, (error) => {
            console.error("Error fetching catalog:", error);
            setLoading(false);
        });

        unsubscribeRef.current = unsubscribe;
    };


    const searchCatalog = (query: string) => {
        if (!query) return catalog;
        const lowerQ = query.toLowerCase();
        return catalog.filter(item =>
            item.name.toLowerCase().includes(lowerQ) ||
            item.category.toLowerCase().includes(lowerQ) ||
            (item.barcode && item.barcode.includes(lowerQ))
        );
    };

    const getCatalogItem = (id: string) => catalog.find(i => i.id === id);

    // Derived State: Unique Categories
    const categories = Array.from(new Set(catalog.map(i => i.category))).sort();

    return (
        <CatalogContext.Provider value={{ catalog, searchCatalog, getCatalogItem, categories, loading, loadCatalog, isLoaded }}>
            {children}
        </CatalogContext.Provider>
    );
};

export const useCatalog = () => {
    const context = useContext(CatalogContext);
    if (context === undefined) {
        throw new Error('useCatalog must be used within a CatalogProvider');
    }
    return context;
};
