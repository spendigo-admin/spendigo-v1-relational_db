import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

export interface WishlistItem {
    id: string;
    name: string;
    category: string;
    image: string;
    addedAt: string;
}

interface WishlistContextType {
    items: WishlistItem[];
    addItem: (item: Omit<WishlistItem, 'addedAt'>) => void;
    removeItem: (id: string) => void;
    isInWishlist: (id: string) => boolean;
    clearWishlist: () => void;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const listKey = `spendigo_wishlist_${user?.id || 'guest'}`;

    const [items, setItems] = useState<WishlistItem[]>([]);

    // Reload when user changes
    useEffect(() => {
        const saved = localStorage.getItem(listKey);
        setItems(saved ? JSON.parse(saved) : []);
    }, [listKey]);

    useEffect(() => {
        localStorage.setItem(listKey, JSON.stringify(items));
    }, [items, listKey]);

    const addItem = (item: Omit<WishlistItem, 'addedAt'>) => {
        if (!items.find(i => i.id === item.id)) {
            setItems(prev => [...prev, { ...item, addedAt: new Date().toISOString() }]);
        }
    };

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const isInWishlist = (id: string) => {
        return items.some(i => i.id === id);
    };

    const clearWishlist = () => {
        setItems([]);
    };

    return (
        <WishlistContext.Provider value={{ items, addItem, removeItem, isInWishlist, clearWishlist }}>
            {children}
        </WishlistContext.Provider>
    );
};

export const useWishlist = () => {
    const context = useContext(WishlistContext);
    if (!context) throw new Error('useWishlist must be used within WishlistProvider');
    return context;
};
