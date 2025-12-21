import React, { createContext, useContext, useEffect, useState } from 'react';
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
}

interface CartContextType {
    items: CartItem[];
    addToCart: (item: Omit<CartItem, 'id'>) => void;
    addItemsToCart: (items: Omit<CartItem, 'id'>[]) => void;
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
    const cartKey = `spendigo_cart_${user?.id || 'guest'}`;

    const [items, setItems] = useState<CartItem[]>([]);

    // Load Items on Mount or User Change
    useEffect(() => {
        const saved = localStorage.getItem(cartKey);
        setItems(saved ? JSON.parse(saved) : []);
    }, [cartKey]);

    const [notification, setNotification] = useState<{
        message: string;
        type: 'success' | 'info';
        savings?: number;
        competitor?: { name: string; price: number };
    } | null>(null);

    // Save Items to Store
    useEffect(() => {
        localStorage.setItem(cartKey, JSON.stringify(items));
    }, [items, cartKey]);

    const clearNotification = () => setNotification(null);

    const addToCart = (newItem: Omit<CartItem, 'id'>) => {
        setItems(prev => {
            const existing = prev.find(i => i.productId === newItem.productId);
            if (existing) {
                return prev.map(i =>
                    i.productId === newItem.productId
                        ? { ...i, quantity: i.quantity + newItem.quantity }
                        : i
                );
            }
            return [...prev, { ...newItem, id: Math.random().toString(36).substr(2, 9) }];
        });

        // Price Comparison Logic
        let savings = 0;
        let competitor = undefined;

        // Note: In a real app, this would be an API call. Here we iterate the mock data.
        // We need to access STORE_DATA. We'll import it or assume it's available via a helper.
        // Since we can't easily import inside the function in this tool workflow without top-level edits,
        // we will do a basic "simulation" or rely on the fact that we can import it.
        // Let's assume we need to import it. I will add the import in a separate step if not present.
        // For now, I'll write the logic assuming STORE_DATA is available.

        // Find competitors
        const allStores = Object.values(STORE_DATA);
        const competitors: { storeName: string; price: number }[] = [];

        allStores.forEach((store: any) => {
            if (store.id === newItem.storeId) return; // Skip current store
            const match = store.products.find((p: any) => p.name === newItem.productName);
            if (match) {
                competitors.push({ storeName: store.name, price: match.price });
            }
        });

        if (competitors.length > 0) {
            // Check for savings (if we bought cheaper)
            const expensiveCompetitor = competitors.find(c => c.price > newItem.price);
            if (expensiveCompetitor) {
                savings = parseFloat((expensiveCompetitor.price - newItem.price).toFixed(2));
                competitor = { name: expensiveCompetitor.storeName, price: expensiveCompetitor.price };
            } else {
                // Check if we overpaid
                const cheapCompetitor = competitors.find(c => c.price < newItem.price);
                if (cheapCompetitor) {
                    competitor = { name: cheapCompetitor.storeName, price: cheapCompetitor.price };
                }
            }
        }

        // Trigger notification
        setNotification({
            message: `${newItem.productName} added to cart!`,
            type: 'success',
            savings: savings > 0 ? savings : undefined,
            competitor
        });

        // Auto-clear after 4s (slightly longer to read)
        setTimeout(() => setNotification(null), 4000);
    };

    const addItemsToCart = (newItems: Omit<CartItem, 'id'>[]) => {
        setItems(prev => {
            let updatedItems = [...prev];
            newItems.forEach(newItem => {
                const existingIndex = updatedItems.findIndex(i => i.productId === newItem.productId);
                if (existingIndex > -1) {
                    updatedItems[existingIndex] = {
                        ...updatedItems[existingIndex],
                        quantity: updatedItems[existingIndex].quantity + newItem.quantity
                    };
                } else {
                    updatedItems.push({ ...newItem, id: Math.random().toString(36).substr(2, 9) });
                }
            });
            return updatedItems;
        });

        // Summary notification with item names
        const names = newItems.map(i => i.productName).join(', ');
        const message = newItems.length > 3
            ? `${newItems.length} items added: ${newItems.slice(0, 2).map(i => i.productName).join(', ')} and ${newItems.length - 2} more`
            : `${newItems.length} items added: ${names}`;

        setNotification({
            message,
            type: 'success'
        });

        setTimeout(() => setNotification(null), 3000);
    };

    const removeFromCart = (itemId: string) => {
        const itemToRemove = items.find(i => i.id === itemId);
        setItems(prev => prev.filter(i => i.id !== itemId));

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

        setItems(prev => prev.map(i => {
            if (i.id === itemId) {
                const newQty = Math.max(0, i.quantity + delta);

                // Trigger removal notification if qty hits 0
                if (newQty === 0 && itemToUpdate) {
                    setNotification({
                        message: `${itemToUpdate.productName} removed from cart`,
                        type: 'info'
                    });
                    setTimeout(() => setNotification(null), 3000);
                }

                return { ...i, quantity: newQty };
            }
            return i;
        }).filter(i => i.quantity > 0));
    };

    const clearCart = () => setItems([]);

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
