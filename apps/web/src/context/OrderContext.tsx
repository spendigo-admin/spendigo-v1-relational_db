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
    customerName: string;
    subtotal: number;
    tax: number;
    deliveryFee: number;
    total: number;
    paymentMethod: 'card' | 'in_store';
    paymentStatus: 'paid' | 'pending';
    paymentCollectedBy?: { id: string; name: string; timestamp: string };
    estimatedDelivery?: string;
    deliveryAddress?: Address;
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
    addOrder: (order: Omit<Order, 'id' | 'date' | 'customerName'>) => string;
    updateOrderStatus: (orderId: string, status: Order['status']) => void;
    updatePaymentStatus: (orderId: string, status: Order['paymentStatus'], auditData?: { id: string; name: string; timestamp: string }) => void;
    cancelOrder: (orderId: string) => void;
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

const MOCK_PROFILES: Record<string, UserProfile> = {
    'family@spendigo.ca': {
        id: 'shop2',
        name: 'Sarah Family',
        email: 'family@spendigo.ca',
        phone: '+1 (905) 555-0123',
        addresses: [
            { id: 'addr-fam-1', label: 'Home', street: '42 Maple Drive', city: 'Oakville', province: 'ON', postalCode: 'L6J 5A2', isDefault: true },
            { id: 'addr-fam-2', label: 'Cottage', street: '12 Lakeview Path', city: 'Muskoka', province: 'ON', postalCode: 'P0B 1M0', isDefault: false }
        ]
    },
    'student@spendigo.ca': {
        id: 'shop3',
        name: 'Steve Student',
        email: 'student@spendigo.ca',
        phone: '+1 (416) 555-0987',
        addresses: [
            { id: 'addr-stu-1', label: 'Dorm', street: '200 University Ave, Apt 404', city: 'Waterloo', province: 'ON', postalCode: 'N2L 3G1', isDefault: true }
        ]
    },
    'chef@spendigo.ca': {
        id: 'shop4',
        name: 'Chef Chris',
        email: 'chef@spendigo.ca',
        phone: '+1 (416) 555-5555',
        addresses: [
            { id: 'addr-chef-1', label: 'Restaurant', street: '88 King St West', city: 'Toronto', province: 'ON', postalCode: 'M5X 1E2', isDefault: true },
            { id: 'addr-chef-2', label: 'Home', street: '500 Wellington St', city: 'Toronto', province: 'ON', postalCode: 'M5V 1E3', isDefault: false }
        ]
    }
};

const INITIAL_ORDERS: Order[] = [
    {
        id: 'ORD-001',
        date: '2024-12-15T10:30:00',
        status: 'delivered',
        storeName: 'FreshMart',
        storeId: '1',
        customerName: 'John Doe',
        items: [
            { productId: 'p1', productName: 'Organic Avocados (5pk)', price: 6.99, quantity: 2, image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=100' },
            { productId: 'p2', productName: 'Almond Milk (1L)', price: 4.49, quantity: 1, image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=100' },
        ],
        subtotal: 18.47,
        tax: 2.40,
        deliveryFee: 0,
        total: 20.87,
        paymentMethod: 'card',
        paymentStatus: 'paid',
        deliveryAddress: INITIAL_PROFILE.addresses[0]
    },
    {
        id: 'ORD-002',
        date: '2024-12-16T14:00:00',
        status: 'out_for_delivery',
        storeName: 'QuickPick',
        storeId: '2',
        customerName: 'John Doe',
        items: [
            { productId: 'p7', productName: 'Energy Drink (4pk)', price: 9.99, quantity: 1, image: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=100' },
        ],
        subtotal: 9.99,
        tax: 1.30,
        deliveryFee: 2.99,
        total: 14.28,
        paymentMethod: 'in_store',
        paymentStatus: 'pending',
        estimatedDelivery: '2:45 PM',
        deliveryAddress: INITIAL_PROFILE.addresses[0]
    }
];

import { useAuth } from './AuthContext';

export const OrderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [profile, setProfile] = useState<UserProfile>(INITIAL_PROFILE);
    const { user } = useAuth();

    // Helper to get storage keys based on current user (or guest)
    const getStorageKeys = () => {
        const userId = user?.id || 'guest';
        return {
            ordersKey: `spendigo_orders_${userId}`,
            profileKey: `spendigo_profile_${userId}`
        };
    };

    // Load data when user changes
    useEffect(() => {
        const { ordersKey, profileKey } = getStorageKeys();

        const savedOrders = localStorage.getItem(ordersKey);
        const savedProfile = localStorage.getItem(profileKey);

        let initialOrders: Order[] = [];

        if (savedOrders) {
            initialOrders = JSON.parse(savedOrders);
        } else {
            // For demo purposes, give "guest" or the main demo shopper data
            if (!user || user.email === 'shopper@example.com') {
                initialOrders = INITIAL_ORDERS;
            }
        }
        setOrders(initialOrders);

        if (savedProfile) {
            setProfile(JSON.parse(savedProfile));
        } else {
            if (user && MOCK_PROFILES[user.email]) {
                setProfile(MOCK_PROFILES[user.email]);
            } else {
                setProfile(user ? {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: '',
                    addresses: []
                } : INITIAL_PROFILE);
            }
        }
    }, [user]);

    // Real-time Sync: Poll Merchant "Server" for updates
    useEffect(() => {
        if (orders.length === 0) return;

        const syncWithMerchant = () => {
            let hasMultiUpdates = false;
            const updatedOrders = orders.map(order => {
                const storeKey = `spendigo_store_orders_${order.storeId}`;
                const storeOrdersStr = localStorage.getItem(storeKey);
                if (storeOrdersStr) {
                    const storeOrders = JSON.parse(storeOrdersStr) as Order[];
                    const masterOrder = storeOrders.find(o => o.id === order.id);
                    // If master record exists and has newer status/payment info
                    if (masterOrder && (
                        masterOrder.status !== order.status ||
                        masterOrder.paymentStatus !== order.paymentStatus
                    )) {
                        hasMultiUpdates = true;
                        return {
                            ...order,
                            status: masterOrder.status,
                            paymentStatus: masterOrder.paymentStatus,
                            paymentCollectedBy: masterOrder.paymentCollectedBy,
                            estimatedDelivery: masterOrder.estimatedDelivery
                        };
                    }
                }
                return order;
            });

            if (hasMultiUpdates) {
                setOrders(updatedOrders);
            }
        };

        const interval = setInterval(syncWithMerchant, 2000); // 2s polling
        return () => clearInterval(interval);
    }, [orders]); // Depend on orders to have latest list to check

    // Save data when it changes (Persist the synced updates)
    useEffect(() => {
        const { ordersKey } = getStorageKeys();
        if (orders.length > 0) { // Don't wipe if empty init
            localStorage.setItem(ordersKey, JSON.stringify(orders));
        }
    }, [orders, user]);

    useEffect(() => {
        const { profileKey } = getStorageKeys();
        localStorage.setItem(profileKey, JSON.stringify(profile));
    }, [profile, user]);

    const addOrder = (orderData: Omit<Order, 'id' | 'date' | 'customerName'>): string => {
        const newOrder: Order = {
            ...orderData,
            id: `ORD-${String(Date.now()).slice(-6)}`,
            date: new Date().toISOString(),
            customerName: user?.name || profile.name || 'Guest User'
        };

        // 1. Update User's Order History (State + Effect handles persistence)
        setOrders(prev => [newOrder, ...prev]);

        // 2. Dual-Write: Update Store's Inbox (Direct LocalStorage update)
        // This simulates a backend push to the merchant
        const storeKey = `spendigo_store_orders_${orderData.storeId}`;
        try {
            const existingStoreOrders = JSON.parse(localStorage.getItem(storeKey) || '[]');
            const updatedStoreOrders = [newOrder, ...existingStoreOrders];
            localStorage.setItem(storeKey, JSON.stringify(updatedStoreOrders));

            // 3. Trigger Notification for Merchant
            const notifKey = `spendigo_notifications_${orderData.storeId}`;
            const existingNotifs = JSON.parse(localStorage.getItem(notifKey) || '[]');
            const newNotif = {
                id: `notif-${Date.now()}`,
                title: 'New Order Received',
                message: `Order #${newOrder.id} from ${newOrder.customerName}`,
                type: 'order',
                timestamp: new Date().toISOString(),
                read: false,
                link: '/merchant/orders'
            };
            localStorage.setItem(notifKey, JSON.stringify([newNotif, ...existingNotifs]));

        } catch (e) {
            console.error('Failed to route order/notification to merchant:', e);
        }

        return newOrder.id;
    };

    const updateOrderStatus = (orderId: string, status: Order['status']) => {
        setOrders(prev => prev.map(order =>
            order.id === orderId ? { ...order, status } : order
        ));
    };

    const updatePaymentStatus = (orderId: string, status: Order['paymentStatus'], auditData?: { id: string; name: string; timestamp: string }) => {
        setOrders(prev => prev.map(order =>
            order.id === orderId ? { ...order, paymentStatus: status, paymentCollectedBy: auditData } : order
        ));
    };

    const cancelOrder = (orderId: string) => {
        const orderToCancel = orders.find(o => o.id === orderId);
        if (!orderToCancel) return;

        // 1. Update Local (User) State
        setOrders(prev => prev.map(o =>
            o.id === orderId ? { ...o, status: 'cancelled' } : o
        ));

        // 2. Update Store Storage (Merchant View)
        const storeKey = `spendigo_store_orders_${orderToCancel.storeId}`;
        try {
            const storeOrdersStr = localStorage.getItem(storeKey);
            if (storeOrdersStr) {
                const storeOrders = JSON.parse(storeOrdersStr) as Order[];
                const updatedStoreOrders = storeOrders.map(o =>
                    o.id === orderId ? { ...o, status: 'cancelled' as const } : o
                );
                localStorage.setItem(storeKey, JSON.stringify(updatedStoreOrders));
            }

            // 3. Notify Merchant
            const notifKey = `spendigo_notifications_${orderToCancel.storeId}`;
            const existingNotifs = JSON.parse(localStorage.getItem(notifKey) || '[]');
            const newNotif = {
                id: `notif-cancel-${Date.now()}`,
                title: 'Order Cancelled',
                message: `Order #${orderId} was cancelled by the customer.`,
                type: 'alert',
                timestamp: new Date().toISOString(),
                read: false,
                link: '/merchant/orders'
            };
            localStorage.setItem(notifKey, JSON.stringify([newNotif, ...existingNotifs]));

        } catch (e) {
            console.error('Failed to update store storage for cancellation:', e);
        }
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
            updatePaymentStatus,
            cancelOrder,
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
