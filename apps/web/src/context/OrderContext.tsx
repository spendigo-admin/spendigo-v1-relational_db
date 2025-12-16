import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Types
export interface Address {
    id: string;
    label: string;
    street: string;
    city: string;
    province: string;
    postalCode: string;
    isDefault: boolean;
}

export interface OrderItem {
    productId: string;
    productName: string;
    price: number;
    quantity: number;
    image?: string;
}

export interface Order {
    id: string;
    date: string;
    status: 'placed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
    items: OrderItem[];
    storeName: string;
    storeId: string;
    subtotal: number;
    tax: number;
    deliveryFee: number;
    total: number;
    estimatedDelivery?: string;
    deliveryAddress: Address;
}

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    phone: string;
    addresses: Address[];
}

interface OrderContextType {
    orders: Order[];
    profile: UserProfile;
    addOrder: (order: Omit<Order, 'id' | 'date'>) => string;
    updateOrderStatus: (orderId: string, status: Order['status']) => void;
    updateProfile: (updates: Partial<UserProfile>) => void;
    addAddress: (address: Omit<Address, 'id'>) => void;
    updateAddress: (id: string, updates: Partial<Address>) => void;
    deleteAddress: (id: string) => void;
    setDefaultAddress: (id: string) => void;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

// Mock initial data
const INITIAL_PROFILE: UserProfile = {
    id: 'user1',
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1 (416) 555-0123',
    addresses: [
        { id: 'addr1', label: 'Home', street: '123 Queen Street West', city: 'Toronto', province: 'ON', postalCode: 'M5H 2M9', isDefault: true },
        { id: 'addr2', label: 'Work', street: '456 Bay Street', city: 'Toronto', province: 'ON', postalCode: 'M5J 2T3', isDefault: false },
    ]
};

const INITIAL_ORDERS: Order[] = [
    {
        id: 'ORD-001',
        date: '2024-12-15T10:30:00',
        status: 'delivered',
        storeName: 'FreshMart',
        storeId: '1',
        items: [
            { productId: 'p1', productName: 'Organic Avocados (5pk)', price: 6.99, quantity: 2, image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=100' },
            { productId: 'p2', productName: 'Almond Milk (1L)', price: 4.49, quantity: 1, image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=100' },
        ],
        subtotal: 18.47,
        tax: 2.40,
        deliveryFee: 0,
        total: 20.87,
        deliveryAddress: INITIAL_PROFILE.addresses[0]
    },
    {
        id: 'ORD-002',
        date: '2024-12-16T14:00:00',
        status: 'out_for_delivery',
        storeName: 'QuickPick',
        storeId: '2',
        items: [
            { productId: 'p7', productName: 'Energy Drink (4pk)', price: 9.99, quantity: 1, image: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=100' },
        ],
        subtotal: 9.99,
        tax: 1.30,
        deliveryFee: 2.99,
        total: 14.28,
        estimatedDelivery: '2:45 PM',
        deliveryAddress: INITIAL_PROFILE.addresses[0]
    }
];

export const OrderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [orders, setOrders] = useState<Order[]>(() => {
        const saved = localStorage.getItem('spendigo_orders');
        return saved ? JSON.parse(saved) : INITIAL_ORDERS;
    });

    const [profile, setProfile] = useState<UserProfile>(() => {
        const saved = localStorage.getItem('spendigo_profile');
        return saved ? JSON.parse(saved) : INITIAL_PROFILE;
    });

    useEffect(() => {
        localStorage.setItem('spendigo_orders', JSON.stringify(orders));
    }, [orders]);

    useEffect(() => {
        localStorage.setItem('spendigo_profile', JSON.stringify(profile));
    }, [profile]);

    const addOrder = (orderData: Omit<Order, 'id' | 'date'>): string => {
        const newOrder: Order = {
            ...orderData,
            id: `ORD-${String(Date.now()).slice(-6)}`,
            date: new Date().toISOString(),
        };
        setOrders(prev => [newOrder, ...prev]);
        return newOrder.id;
    };

    const updateOrderStatus = (orderId: string, status: Order['status']) => {
        setOrders(prev => prev.map(order =>
            order.id === orderId ? { ...order, status } : order
        ));
    };

    const updateProfile = (updates: Partial<UserProfile>) => {
        setProfile(prev => ({ ...prev, ...updates }));
    };

    const addAddress = (address: Omit<Address, 'id'>) => {
        const newAddress: Address = { ...address, id: `addr-${Date.now()}` };
        setProfile(prev => ({ ...prev, addresses: [...prev.addresses, newAddress] }));
    };

    const updateAddress = (id: string, updates: Partial<Address>) => {
        setProfile(prev => ({
            ...prev,
            addresses: prev.addresses.map(addr => addr.id === id ? { ...addr, ...updates } : addr)
        }));
    };

    const deleteAddress = (id: string) => {
        setProfile(prev => ({
            ...prev,
            addresses: prev.addresses.filter(addr => addr.id !== id)
        }));
    };

    const setDefaultAddress = (id: string) => {
        setProfile(prev => ({
            ...prev,
            addresses: prev.addresses.map(addr => ({ ...addr, isDefault: addr.id === id }))
        }));
    };

    return (
        <OrderContext.Provider value={{
            orders,
            profile,
            addOrder,
            updateOrderStatus,
            updateProfile,
            addAddress,
            updateAddress,
            deleteAddress,
            setDefaultAddress
        }}>
            {children}
        </OrderContext.Provider>
    );
};

export const useOrders = () => {
    const context = useContext(OrderContext);
    if (!context) throw new Error('useOrders must be used within OrderProvider');
    return context;
};
