import React, { createContext, useContext, useEffect, useState } from 'react';

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
    notification: { message: string, type: 'success' | 'info' } | null;
    clearNotification: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [items, setItems] = useState<CartItem[]>(() => {
        const saved = localStorage.getItem('spendigo_cart');
        return saved ? JSON.parse(saved) : [];
    });

    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'info' } | null>(null);

    useEffect(() => {
        localStorage.setItem('spendigo_cart', JSON.stringify(items));
    }, [items]);

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

        // Trigger notification
        setNotification({
            message: `${newItem.productName} added to cart!`,
            type: 'success'
        });

        // Auto-clear after 3s
        setTimeout(() => setNotification(null), 3000);
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
