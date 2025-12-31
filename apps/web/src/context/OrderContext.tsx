import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    updateDoc,
    setDoc,
    getDoc,
    doc,
    serverTimestamp,
    orderBy,
    writeBatch,
    arrayUnion
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
    status: 'placed' | 'preparing' | 'on_hold' | 'out_for_delivery' | 'delivered' | 'cancelled';
    items: OrderItem[];
    storeName: string;
    storeId: string;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string; // New: Shopper contact info
    customerId: string; // New: Link to Auth User
    subtotal: number;
    tax: number;
    deliveryFee: number;
    total: number;
    paymentMethod: 'card' | 'in_store';
    paymentStatus: 'paid' | 'pending';
    paymentCollectedBy?: { id: string; name: string; timestamp: string };
    estimatedTime?: string; // New: "20 min", "5:30 PM", etc.
    estimatedDelivery?: string; // Legacy
    rejectionReason?: string; // New
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
    updateOrderStatus: (orderId: string, status: Order['status'], reason?: string) => Promise<void>;
    updateEstimatedTime: (orderId: string, time: string) => Promise<void>;
    updatePaymentStatus: (orderId: string, status: Order['paymentStatus'], auditData?: { id: string; name: string; timestamp: string }) => Promise<void>;
    cancelOrder: (orderId: string, reason?: string) => Promise<void>;
    updateProfile: (updates: Partial<UserProfile>) => void;
    addAddress: (address: Omit<Address, 'id'>) => Promise<void>;
    updateAddress: (id: string, updates: Partial<Address>) => Promise<void>;
    deleteAddress: (id: string) => Promise<void>;
    setDefaultAddress: (id: string) => Promise<void>;
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
                setLoading(false);
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

    // 2. Profile Management
    useEffect(() => {
        const fetchUserData = async () => {
            if (user?.id) {
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.id));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        setProfile({
                            id: user.id,
                            name: data.name || user.name,
                            email: data.email || user.email,
                            phone: data.phoneNumber || data.phone || '',
                            addresses: data.addresses || []
                        });
                    }
                } catch (error) {
                    console.error('Error fetching user addresses:', error);
                }
            }
        };

        fetchUserData();
    }, [user]);


    // --- Notification Helper ---
    const sendOrderNotification = async (targetId: string, title: string, message: string, type: 'order' | 'alert' = 'order', orderId?: string) => {
        try {
            const notifRef = doc(db, 'notifications', targetId);
            const newNotif = {
                id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                type,
                title,
                message,
                timestamp: new Date().toISOString(),
                read: false,
                orderId
            };
            await setDoc(notifRef, {
                list: arrayUnion(newNotif),
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (e) {
            console.error("Failed to send notification", e);
        }
    };

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
                customerEmail: user.email,
                customerPhone: user.phoneNumber || '', // Capture phone from Auth Profile
                createdAt: serverTimestamp()
            };

            const { createdAt, ...rest } = rawOrder;
            const sanitizedRest = JSON.parse(JSON.stringify(rest));
            const finalOrder = { ...sanitizedRest, createdAt };

            batch.set(newOrderRef, finalOrder);

            // Notify Shopper
            sendOrderNotification(user.id, 'Order Placed! 📋', `Your order from ${orderData.storeName} has been received.`, 'order', newOrderRef.id);

            // Notify Merchant
            sendOrderNotification(orderData.storeId, 'New Order! 🔔', `New order from ${user.name} for $${orderData.total.toFixed(2)}`, 'order', newOrderRef.id);
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

    const updateOrderStatus = async (orderId: string, status: Order['status'], reason?: string) => {
        const order = orders.find(o => o.id === orderId);
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, {
            status,
            ...(reason && { rejectionReason: reason })
        });

        if (order) {
            let title = '';
            let message = '';

            switch (status) {
                case 'preparing':
                    title = 'Preparing Order 👨‍🍳';
                    message = `${order.storeName} has started preparing your order.`;
                    break;
                case 'on_hold':
                    title = 'Order on Hold ⏳';
                    message = `${order.storeName} has briefly paused your order. Check tracking for details.`;
                    break;
                case 'out_for_delivery':
                    title = order.deliveryAddress ? 'Out for Delivery! 🚚' : 'Ready for Pickup! 🛍️';
                    message = order.deliveryAddress ? 'Your order is on the way.' : 'Your order is ready to be picked up.';
                    break;
                case 'delivered':
                    title = 'Order Completed! ✅';
                    message = `Your order from ${order.storeName} is complete. Thank you!`;
                    break;
            }

            if (title) {
                sendOrderNotification(order.customerId, title, message, 'order', order.id);
            }
        }
    };

    const updateEstimatedTime = async (orderId: string, time: string) => {
        const order = orders.find(o => o.id === orderId);
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, {
            estimatedTime: time
        });

        if (order) {
            sendOrderNotification(order.customerId, 'Time Updated ⏱️', `${order.storeName} updated your ready time to ${time}.`, 'order', order.id);
        }
    };

    const updatePaymentStatus = async (orderId: string, status: Order['paymentStatus'], auditData?: { id: string; name: string; timestamp: string }) => {
        const order = orders.find(o => o.id === orderId);
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, {
            paymentStatus: status,
            paymentCollectedBy: auditData
        });

        if (order && status === 'paid') {
            sendOrderNotification(order.customerId, 'Payment Confirmed 💳', `Payment for order #${orderId.substr(0, 8)} has been confirmed by ${order.storeName}.`, 'order', order.id);
        }
    };

    const cancelOrder = async (orderId: string, reason?: string) => {
        const order = orders.find(o => o.id === orderId);
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, {
            status: 'cancelled',
            ...(reason && { rejectionReason: reason })
        });

        if (order) {
            const message = reason ? `Cancelled: ${reason}` : `Your order from ${order.storeName} was cancelled.`;
            sendOrderNotification(order.customerId, 'Order Cancelled 🚫', message, 'alert', order.id);
        }
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
                    ...(updates.phone && { phoneNumber: updates.phone })
                });
            } catch (error) {
                console.error('Error updating profile:', error);
                sendOrderNotification(user.id, 'Profile Update Failed', 'Failed to save profile changes. Please try again.', 'alert');
            }
        }
    };

    const addAddress = async (address: Omit<Address, 'id'>) => {
        const newAddress: Address = { ...address, id: `addr-${Date.now()}` };
        const updatedAddresses = [...profile.addresses, newAddress];

        setProfile(prev => ({ ...prev, addresses: updatedAddresses }));

        if (user?.id) {
            await updateDoc(doc(db, 'users', user.id), { addresses: updatedAddresses });
        }
    };

    const updateAddress = async (id: string, updates: Partial<Address>) => {
        const updatedAddresses = profile.addresses.map(addr => addr.id === id ? { ...addr, ...updates } : addr);
        setProfile(prev => ({ ...prev, addresses: updatedAddresses }));

        if (user?.id) {
            await updateDoc(doc(db, 'users', user.id), { addresses: updatedAddresses });
        }
    };

    const deleteAddress = async (id: string) => {
        const updatedAddresses = profile.addresses.filter(addr => addr.id !== id);
        setProfile(prev => ({ ...prev, addresses: updatedAddresses }));

        if (user?.id) {
            await updateDoc(doc(db, 'users', user.id), { addresses: updatedAddresses });
        }
    };

    const setDefaultAddress = async (id: string) => {
        const updatedAddresses = profile.addresses.map(addr => ({ ...addr, isDefault: addr.id === id }));
        setProfile(prev => ({ ...prev, addresses: updatedAddresses }));

        if (user?.id) {
            await updateDoc(doc(db, 'users', user.id), { addresses: updatedAddresses });
        }
    };

    return (
        <OrderContext.Provider value={{
            orders,
            profile,
            addOrder,
            createBatchOrders,
            updateOrderStatus,
            updateEstimatedTime,
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
