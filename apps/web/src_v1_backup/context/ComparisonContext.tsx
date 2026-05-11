import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

export interface ComparisonItem {
    id: string;
    name: string;
    category: string;
    image: string;
    addedAt: string;
}

interface ComparisonContextType {
    items: ComparisonItem[];
    addItem: (item: Omit<ComparisonItem, 'addedAt'>) => void;
    removeItem: (id: string) => void;
    isInComparison: (id: string) => boolean;
    clearComparison: () => void;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);

export const ComparisonProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const GUEST_KEY = 'spendigo_comparison_guest';

    const [items, setItems] = useState<ComparisonItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribe: () => void;

        const initializeComparison = async () => {
            if (user) {
                // Collection for comparison wishlists
                const comparisonRef = doc(db, 'comparison_wishlists', user.id);

                const guestJson = localStorage.getItem(GUEST_KEY);
                let guestItems: ComparisonItem[] = [];
                if (guestJson) {
                    try {
                        guestItems = JSON.parse(guestJson);
                    } catch (e) { console.error(e); }
                }

                if (guestItems.length > 0) {
                    const docSnap = await getDoc(comparisonRef);
                    const cloudItems = docSnap.exists() ? (docSnap.data().items as ComparisonItem[]) : [];

                    const mergedItems = [...cloudItems];
                    guestItems.forEach(gItem => {
                        if (!mergedItems.some(i => i.id === gItem.id)) {
                            mergedItems.push({ ...gItem, addedAt: new Date().toISOString() });
                        }
                    });

                    await setDoc(comparisonRef, { items: mergedItems }, { merge: true });
                    localStorage.removeItem(GUEST_KEY);
                }

                unsubscribe = onSnapshot(comparisonRef, (doc) => {
                    if (doc.exists()) {
                        setItems(doc.data().items || []);
                    } else {
                        setItems([]);
                    }
                    setLoading(false);
                });
            } else {
                const saved = localStorage.getItem(GUEST_KEY);
                if (saved) {
                    setItems(JSON.parse(saved));
                } else {
                    setItems([]);
                }
                setLoading(false);
            }
        };

        initializeComparison();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [user]);

    useEffect(() => {
        if (!user && !loading) {
            localStorage.setItem(GUEST_KEY, JSON.stringify(items));
        }
    }, [items, user, loading]);

    const saveToCloud = async (newItems: ComparisonItem[]) => {
        if (!user) return;
        try {
            await setDoc(doc(db, 'comparison_wishlists', user.id), { items: newItems }, { merge: true });
        } catch (e) {
            console.error("Failed to sync comparison list", e);
        }
    };

    const addItem = (item: Omit<ComparisonItem, 'addedAt'>) => {
        if (!items.find(i => i.id === item.id)) {
            const newItem = { ...item, addedAt: new Date().toISOString() };
            const updatedItems = [...items, newItem];
            setItems(updatedItems);
            if (user) saveToCloud(updatedItems);
        }
    };

    const removeItem = (id: string) => {
        const updatedItems = items.filter(i => i.id !== id);
        setItems(updatedItems);
        if (user) saveToCloud(updatedItems);
    };

    const isInComparison = (id: string) => {
        return items.some(i => i.id === id);
    };

    const clearComparison = () => {
        setItems([]);
        if (user) saveToCloud([]);
    };

    return (
        <ComparisonContext.Provider value={{ items, addItem, removeItem, isInComparison, clearComparison }}>
            {children}
        </ComparisonContext.Provider>
    );
};

export const useComparison = () => {
    const context = useContext(ComparisonContext);
    if (!context) throw new Error('useComparison must be used within ComparisonProvider');
    return context;
};
