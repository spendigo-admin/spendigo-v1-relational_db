import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
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
    const GUEST_KEY = 'spendigo_wishlist_guest';

    const [items, setItems] = useState<WishlistItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Hybrid Persistence Logic
    useEffect(() => {
        let unsubscribe: () => void;

        const initializeWishlist = async () => {
            if (user) {
                // AUTHENTICATED: Sync with Firestore and Merge Guest Wishlist
                const wishlistRef = doc(db, 'wishlists', user.id);

                // 1. Check for Guest Items to Merge
                const guestJson = localStorage.getItem(GUEST_KEY);
                let guestItems: WishlistItem[] = [];
                if (guestJson) {
                    try {
                        guestItems = JSON.parse(guestJson);
                    } catch (e) { console.error(e); }
                }

                if (guestItems.length > 0) {
                    // Fetch existing Cloud Wishlist
                    const docSnap = await getDoc(wishlistRef);
                    const cloudItems = docSnap.exists() ? (docSnap.data().items as WishlistItem[]) : [];

                    // Merge Logic: Add guest items if not already present
                    const mergedItems = [...cloudItems];
                    guestItems.forEach(gItem => {
                        if (!mergedItems.some(i => i.id === gItem.id)) {
                            // Ensure addedAt is valid, or refresh it
                            mergedItems.push({ ...gItem, addedAt: new Date().toISOString() });
                        }
                    });

                    // Save merged list
                    await setDoc(wishlistRef, { items: mergedItems }, { merge: true });

                    // Clear Guest Wishlist
                    localStorage.removeItem(GUEST_KEY);
                }

                // 2. Subscribe to Firestore
                unsubscribe = onSnapshot(wishlistRef, (doc) => {
                    if (doc.exists()) {
                        setItems(doc.data().items || []);
                    } else {
                        setItems([]);
                    }
                    setLoading(false);
                });
            } else {
                // GUEST: Use LocalStorage
                const saved = localStorage.getItem(GUEST_KEY);
                if (saved) {
                    setItems(JSON.parse(saved));
                } else {
                    setItems([]);
                }
                setLoading(false);
            }
        };

        initializeWishlist();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [user]);

    // Save to LocalStorage ONLY for Guests
    useEffect(() => {
        if (!user && !loading) {
            localStorage.setItem(GUEST_KEY, JSON.stringify(items));
        }
    }, [items, user, loading]);

    const saveToCloud = async (newItems: WishlistItem[]) => {
        if (!user) return;
        try {
            await setDoc(doc(db, 'wishlists', user.id), { items: newItems }, { merge: true });
        } catch (e) {
            console.error("Failed to sync wishlist", e);
        }
    };

    const addItem = (item: Omit<WishlistItem, 'addedAt'>) => {
        // Optimistic Update / Calculation
        if (!items.find(i => i.id === item.id)) {
            const newItem = { ...item, addedAt: new Date().toISOString() };
            const updatedItems = [...items, newItem];

            if (user) saveToCloud(updatedItems);
            else setItems(updatedItems);
        }
    };

    const removeItem = (id: string) => {
        const updatedItems = items.filter(i => i.id !== id);

        if (user) saveToCloud(updatedItems);
        else setItems(updatedItems);
    };

    const isInWishlist = (id: string) => {
        return items.some(i => i.id === id);
    };

    const clearWishlist = () => {
        if (user) saveToCloud([]);
        else setItems([]);
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
