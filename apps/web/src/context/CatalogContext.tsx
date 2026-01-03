import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
}

interface CatalogContextType {
    catalog: CatalogItem[];
    searchCatalog: (query: string) => CatalogItem[];
    getCatalogItem: (id: string) => CatalogItem | undefined;
    categories: string[];
    loading: boolean;
}

const CatalogContext = createContext<CatalogContextType | undefined>(undefined);

export const CatalogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [catalog, setCatalog] = useState<CatalogItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Subscribe to catalog updates
        const q = query(collection(db, 'catalog'), orderBy('name', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items: CatalogItem[] = [];
            snapshot.forEach(doc => {
                items.push({ id: doc.id, ...doc.data() } as CatalogItem);
            });
            setCatalog(items);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching catalog:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

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
        <CatalogContext.Provider value={{ catalog, searchCatalog, getCatalogItem, categories, loading }}>
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
