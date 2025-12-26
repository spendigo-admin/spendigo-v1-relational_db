import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp,
    orderBy,
    writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

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
    id: string; // Firestore Doc ID
    date: string;
    status: 'placed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
    items: OrderItem[];
    storeName: string;
    storeId: string;
    customerName: string;
    customerId: string; // New: Link to Auth User
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
    addOrder: (order: Omit<Order, 'id' | 'date' | 'customerName' | 'customerId'>) => Promise<string>;
    createBatchOrders: (orders: Omit<Order, 'id' | 'date' | 'customerName' | 'customerId'>[]) => Promise<string[]>;
    updateOrderStatus: (orderId: string, status: Order['status']) => Promise<void>;
    updatePaymentStatus: (orderId: string, status: Order['paymentStatus'], auditData?: { id: string; name: string; timestamp: string }) => Promise<void>;
    cancelOrder: (orderId: string) => Promise<void>;
    updateProfile: (updates: Partial<UserProfile>) => void;
    addAddress: (address: Omit<Address, 'id'>) => void;
    updateAddress: (id: string, updates: Partial<Address>) => void;
    deleteAddress: (id: string) => void;
    setDefaultAddress: (id: string) => void;
    loading: boolean;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

// Mock Profile Data (Keep implemented as local storage/memory for now as "User Profile" wasn't explicitly migrated yet)
const INITIAL_PROFILE: UserProfile = {
    id: 'user1',
    name: 'Guest User',
    email: 'guest@example.com',
    phone: '',
    addresses: []
};

export const OrderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [profile, setProfile] = useState<UserProfile>(INITIAL_PROFILE);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    // 1. Sync Orders from Firestore
    useEffect(() => {
        if (!user) {
            setOrders([]);
            setLoading(false);
            return;
        }

        let q;

        // Define Query based on Role
        if (user.role === 'merchant') {
            // Merchants see orders for their store
            // Note: In a real app, 'user.storeId' should be strictly typed. 
            // We assume merchants have 'storeId' in their profile or we filter client-side if query is complex.
            // For now, let's assume we store 'storeId' on the merchant user object or they manage ONE store.
            // A simplified approach for this demo:
            // Query ALL orders where storeId matches the user's storeId (if set)
            // BUT: Access rules usually prevent querying ALL orders.
            // Let's rely on the fact we haven't implemented strict Firestore Rules yet so we can query.
            if (user.storeId) {
                console.log(`OrderContext: Querying orders for Store ID: ${user.storeId}`);
                q = query(collection(db, 'orders'), where('storeId', '==', user.storeId)); // , orderBy('date', 'desc') needs composite index
            } else {
                setOrders([]); // No store assigned
                return;
            }
        } else if (user.role === 'admin') {
            // Admins see everything
            q = query(collection(db, 'orders'));
        } else {
            // Consumers see their own orders
            q = query(collection(db, 'orders'), where('customerId', '==', user.id));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log(`OrderContext: Snapshot update. Docs found: ${snapshot.size}`); // Debug
            const fetchedOrders: Order[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                // console.log('Fetched Order:', doc.id, data.customerId); // Debug
                fetchedOrders.push({ id: doc.id, ...data } as Order);
            });
            // Client-side sort since we might lack composite indexes
            fetchedOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setOrders(fetchedOrders);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    // 2. Profile Management (Simplified Sync - could be moved to AuthContext or UserContext later)
    useEffect(() => {
        if (user) {
            // Initialize profile from Auth user if available
            setProfile(prev => ({
                ...prev,
                id: user.id,
                name: user.name,
                email: user.email,
                // Keep existing addresses if we had them in memory or load from Firestore user doc (TODO)
            }));
        }
    }, [user]);


    // --- Actions ---

    const addOrder = async (orderData: Omit<Order, 'id' | 'date' | 'customerName' | 'customerId'>): Promise<string> => {
        // Fallback for single order, acts as wrapper for batch
        const ids = await createBatchOrders([orderData]);
        return ids[0];
    };

    const createBatchOrders = async (ordersData: Omit<Order, 'id' | 'date' | 'customerName' | 'customerId'>[]): Promise<string[]> => {
        if (!user) throw new Error("Must be logged in");

        const batch = writeBatch(db);
        const orderIds: string[] = [];

        ordersData.forEach(orderData => {
            const newOrderRef = doc(collection(db, 'orders'));
            orderIds.push(newOrderRef.id);

            // Sanitize
            const rawOrder = {
                ...orderData,
                deliveryAddress: orderData.deliveryAddress || null,
                items: orderData.items.map(i => ({
                    ...i,
                    image: i.image || null
                })),
                date: new Date().toISOString(),
                customerId: user.id,
                customerName: user.name || 'Valued Customer',
                createdAt: serverTimestamp()
            };

            const { createdAt, ...rest } = rawOrder;
            const sanitizedRest = JSON.parse(JSON.stringify(rest));
            const finalOrder = { ...sanitizedRest, createdAt };

            batch.set(newOrderRef, finalOrder);
        });

        try {
            await batch.commit();
            console.log(`OrderContext: Batch committed. Orders: ${orderIds.join(', ')}`);
            return orderIds;
        } catch (e) {
            console.error('OrderContext: Batch commit failed', e);
            throw e;
        }
    };

    const updateOrderStatus = async (orderId: string, status: Order['status']) => {
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, { status });
    };

    const updatePaymentStatus = async (orderId: string, status: Order['paymentStatus'], auditData?: { id: string; name: string; timestamp: string }) => {
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, {
            paymentStatus: status,
            paymentCollectedBy: auditData
        });
    };

    const cancelOrder = async (orderId: string) => {
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, { status: 'cancelled' });
    };

    // --- Profile Actions ---
    const updateProfile = async (updates: Partial<UserProfile>) => {
        // Update local state immediately for UI responsiveness
        setProfile(prev => ({ ...prev, ...updates }));

        // Persist to Firestore
        if (user?.id) {
            try {
                const userRef = doc(db, 'users', user.id);
                await updateDoc(userRef, {
                    ...(updates.name && { name: updates.name }),
                    ...(updates.email && { email: updates.email }),
                    ...(updates.phone && { phone: updates.phone })
                });
            } catch (error) {
                console.error('Error updating profile:', error);
                alert('Failed to save profile changes. Please try again.');
            }
        }
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
            createBatchOrders,
            updateOrderStatus,
            updatePaymentStatus,
            cancelOrder,
            updateProfile,
            addAddress,
            updateAddress,
            deleteAddress,
            setDefaultAddress,
            loading
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
