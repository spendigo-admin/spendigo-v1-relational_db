import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { STORE_DATA } from '../data/productData';
import { useAuth } from './AuthContext';

export interface CartItem {
    id: string;
    productId: string;
    productName: string;
    price: number;
    quantity: number;
    storeId: string;
    storeName: string;
    image?: string;
    originalPrice?: number;
}

interface CartContextType {
    items: CartItem[];
    addToCart: (item: Omit<CartItem, 'id'>) => Promise<void>;
    addItemsToCart: (items: Omit<CartItem, 'id'>[], savedAmount?: number) => Promise<void>;
    removeFromCart: (itemId: string) => void;
    updateQuantity: (itemId: string, delta: number) => void;
    clearCart: () => void;
    subtotal: number;
    itemCount: number;
    notification: {
        message: string;
        type: 'success' | 'info';
        savings?: number;
        competitor?: { name: string; price: number };
    } | null;
    clearNotification: () => void;
}


const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    // Guest key is constant, Auth users use Firestore
    const GUEST_KEY = 'spendigo_cart_guest';

    const [items, setItems] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Hybrid Persistence Logic
    useEffect(() => {
        let unsubscribe: () => void;

        const initializeCart = async () => {
            if (user) {
                // AUTHENTICATED: Sync with Firestore and Merge Guest Cart
                const cartRef = doc(db, 'carts', user.id);

                // 1. Check for Guest Items to Merge
                const guestCartJson = localStorage.getItem(GUEST_KEY);
                let guestItems: CartItem[] = [];
                if (guestCartJson) {
                    try {
                        guestItems = JSON.parse(guestCartJson);
                    } catch (e) { console.error(e); }
                }

                if (guestItems.length > 0) {
                    // Fetch existing Cloud Cart to merge efficiently
                    const docSnap = await getDoc(cartRef);
                    const cloudItems = docSnap.exists() ? (docSnap.data().items as CartItem[]) : [];

                    // Merge Logic: Guest items override or add to cloud items
                    const mergedItems = [...cloudItems];
                    guestItems.forEach(gItem => {
                        const existingIdx = mergedItems.findIndex(c => c.productId === gItem.productId);
                        if (existingIdx > -1) {
                            mergedItems[existingIdx].quantity += gItem.quantity;
                        } else {
                            mergedItems.push(gItem);
                        }
                    });

                    // Save merged cart to Firestore
                    await setDoc(cartRef, { items: mergedItems }, { merge: true });

                    // Clear Guest Cart
                    localStorage.removeItem(GUEST_KEY);
                }

                // 2. Subscribe to Firestore Updates (Real-time & Multi-device)
                unsubscribe = onSnapshot(cartRef, (doc) => {
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

        initializeCart();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [user]);

    // Save to LocalStorage ONLY for Guests (Firestore saves happen in actions)
    useEffect(() => {
        if (!user && !loading) {
            localStorage.setItem(GUEST_KEY, JSON.stringify(items));
        }
    }, [items, user, loading]);

    const [notification, setNotification] = useState<{
        message: string;
        type: 'success' | 'info';
        savings?: number;
        competitor?: { name: string; price: number };
    } | null>(null);

    const clearNotification = () => setNotification(null);

    const saveToCloud = async (newItems: CartItem[]) => {
        if (!user) return;
        try {
            const sanitized = newItems.map(item =>
                Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined))
            );
            await setDoc(doc(db, 'carts', user.id), { items: sanitized }, { merge: true });
        } catch (e) {
            console.error("Failed to sync cart", e);
        }
    };

    const addToCart = async (newItem: Omit<CartItem, 'id'>) => {
        let updatedItems: CartItem[] = [];

        // Calculate new state logic (replicated for both flows to ensure consistency)
        // Note: For Firestore, we use 'items' state as base because onSnapshot keeps it fresh
        const baseItems = items;
        const existing = baseItems.find(i => i.productId === newItem.productId);

        if (existing) {
            updatedItems = baseItems.map(i =>
                i.productId === newItem.productId
                    ? { ...i, quantity: i.quantity + newItem.quantity, price: newItem.price, originalPrice: newItem.originalPrice }
                    : i
            );
        } else {
            updatedItems = [...baseItems, { ...newItem, id: Math.random().toString(36).substr(2, 9) }];
        }

        // Optimistic Update
        setItems(updatedItems);
        
        if (user) {
            // Auth: Save to Cloud (Listener will keep it in sync, but we await for flow control)
            await saveToCloud(updatedItems);
        }

        // Price Comparison Logic (Preserved)
        let savings = 0;
        let competitor = undefined;
        // ... (Logic remains same, assuming STORE_DATA usage is fine or will be addressed)

        const allStores = Object.values(STORE_DATA);
        const competitors: { storeName: string; price: number }[] = [];

        allStores.forEach((store: any) => {
            if (store.id === newItem.storeId) return;
            const match = store.products.find((p: any) => p.name === newItem.productName);
            if (match) {
                competitors.push({ storeName: store.name, price: match.price });
            }
        });

        if (competitors.length > 0) {
            const expensiveCompetitor = competitors.find(c => c.price > newItem.price);
            if (expensiveCompetitor) {
                savings = parseFloat((expensiveCompetitor.price - newItem.price).toFixed(2));
                competitor = { name: expensiveCompetitor.storeName, price: expensiveCompetitor.price };
            } else {
                const cheapCompetitor = competitors.find(c => c.price < newItem.price);
                if (cheapCompetitor) {
                    competitor = { name: cheapCompetitor.storeName, price: cheapCompetitor.price };
                }
            }
        }

        setNotification({
            message: `${newItem.productName} added to cart!`,
            type: 'success',
            savings: savings > 0 ? savings : undefined,
            competitor
        });

        setTimeout(() => setNotification(null), 4000);
    };

    const addItemsToCart = async (newItems: Omit<CartItem, 'id'>[], savedAmount?: number) => {
        const updatedItems = [...items];
        newItems.forEach(newItem => {
            const existingIndex = updatedItems.findIndex(i => i.productId === newItem.productId);
            if (existingIndex > -1) {
                updatedItems[existingIndex] = {
                    ...updatedItems[existingIndex],
                    quantity: updatedItems[existingIndex].quantity + newItem.quantity,
                    price: newItem.price,
                    originalPrice: newItem.originalPrice
                };
            } else {
                updatedItems.push({ ...newItem, id: Math.random().toString(36).substr(2, 9) });
            }
        });

        // Optimistic Update
        setItems(updatedItems);

        if (user) await saveToCloud(updatedItems);

        // Summary notification remains same
        const names = newItems.map(i => i.productName).join(', ');
        const message = newItems.length > 3
            ? `${newItems.length} items added: ${newItems.slice(0, 2).map(i => i.productName).join(', ')} and ${newItems.length - 2} more`
            : `${newItems.length} items added: ${names}`;

        setNotification({
            message,
            type: 'success',
            savings: savedAmount && savedAmount > 0 ? savedAmount : undefined
        });
        setTimeout(() => setNotification(null), 3000);
    };

    const removeFromCart = (itemId: string) => {
        const itemToRemove = items.find(i => i.id === itemId);
        const updatedItems = items.filter(i => i.id !== itemId);
        setItems(updatedItems);

        if (user) saveToCloud(updatedItems);

        if (itemToRemove) {
            setNotification({
                message: `${itemToRemove.productName} removed from cart`,
                type: 'info'
            });
            setTimeout(() => setNotification(null), 3000);
        }
    };

    const updateQuantity = (itemId: string, delta: number) => {
        const itemToUpdate = items.find(i => i.id === itemId);
        const updatedItems = items.map(i => {
            if (i.id === itemId) {
                return { ...i, quantity: Math.max(0, i.quantity + delta) };
            }
            return i;
        }).filter(i => i.quantity > 0);
        setItems(updatedItems);

        if (user) saveToCloud(updatedItems);

        if (itemToUpdate && itemToUpdate.quantity + delta <= 0) {
            setNotification({
                message: `${itemToUpdate.productName} removed from cart`,
                type: 'info'
            });
            setTimeout(() => setNotification(null), 3000);
        }
    };

    const clearCart = () => {
        setItems([]);
        if (user) saveToCloud([]);
    };

    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <CartContext.Provider value={{
            items,
            addToCart,
            addItemsToCart,
            removeFromCart,
            updateQuantity,
            clearCart,
            subtotal,
            itemCount,
            notification,
            clearNotification
        }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) throw new Error('useCart must be used within a CartProvider');
    return context;
};
