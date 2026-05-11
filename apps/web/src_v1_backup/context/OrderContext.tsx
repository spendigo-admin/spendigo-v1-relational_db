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
    arrayUnion,
    increment
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { useCart } from './CartContext';
import { auditBridge } from '../utils/auditBridge';

// Types
export interface Address {
    id: string;
    label: string;
    street: string;
    city: string;
    province: string;
    postalCode: string;
    isDefault: boolean;
    lat?: number;
    lng?: number;
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
    paymentStatus: 'paid' | 'pending' | 'refunding' | 'refunded';
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
    refundOrder: (orderId: string, reason: string) => Promise<void>;
    downloadOrderReceipt: (orderId: string) => Promise<void>;
    reorder: (orderId: string) => Promise<string[]>; // Returns an array of out-of-stock or changed item messages
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
    id: '',
    name: '',
    email: '',
    phone: '',
    addresses: []
};

export const OrderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [profile, setProfile] = useState<UserProfile>(INITIAL_PROFILE);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const { clearCart, addItemsToCart } = useCart();

    // 1. Sync Orders from Firestore
    useEffect(() => {
        if (!user) {
            setOrders([]);
            setProfile(INITIAL_PROFILE);
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
                q = query(collection(db, 'orders'), where('storeId', '==', user.storeId));
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
            const notifId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            const notifRef = doc(db, 'users', targetId, 'notifications', notifId);
            const newNotif = {
                id: notifId,
                type,
                title,
                message,
                timestamp: new Date().toISOString(),
                read: false,
                orderId
            };
            // Use setDoc to create the individual notification document
            await setDoc(notifRef, newNotif);
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

        try {
            const placeOrderFn = httpsCallable(functions, 'placeOrder');
            const result = await placeOrderFn({ orders: ordersData });
            const { orderIds } = result.data as { orderIds: string[] };

            // Notifications are now handled by the onOrderCreated server-side trigger
            // for better security and to avoid permission-denied errors.
            
            return orderIds;

        } catch (e: any) {
            console.error('OrderContext: Place Order failed', e);
            throw e; // Propagate error to UI
        }
    };

    const updateOrderStatus = async (orderId: string, status: Order['status'], reason?: string) => {
        const order = orders.find(o => o.id === orderId);
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, {
            status,
            ...(reason && { rejectionReason: reason })
        });

        auditBridge.emit('ORDER_STATUS_UPDATE', {
            orderId,
            newStatus: status,
            reason: reason || null
        });

        // Notifications are now handled by server-side triggers
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

        auditBridge.emit('ORDER_PAYMENT_UPDATE', {
            orderId,
            newStatus: status,
            collectedBy: auditData?.name || 'System'
        });

        // Notifications are now handled by server-side triggers
    };

    const cancelOrder = async (orderId: string, reason?: string) => {
        try {
            const cancelOrderFn = httpsCallable(functions, 'cancelOrder');
            await cancelOrderFn({ orderId, reason });

            auditBridge.emit('ORDER_CANCEL', {
                orderId,
                reason: reason || 'Merchant Cancelled'
            });

            // Notifications are now handled by server-side triggers

        } catch (e: any) {
            console.error("Failed to cancel order", e);
            throw e;
        }
    };

    const refundOrder = async (orderId: string, reason: string) => {
        try {
            const refundOrderFn = httpsCallable(functions, 'refundOrder');
            await refundOrderFn({ orderId, reason });

            auditBridge.emit('ORDER_REFUND', {
                orderId,
                reason
            });
        } catch (e: any) {
            console.error('OrderContext: Refund order failed', e);
            throw e;
        }
    };

    const downloadOrderReceipt = async (orderId: string) => {
        try {
            const downloadReceiptFn = httpsCallable(functions, 'downloadReceipt');
            const result = await downloadReceiptFn({ orderId });
            const { url } = result.data as { url: string };
            if (url) {
                window.open(url, '_blank');
            }
        } catch (e: any) {
            console.error('OrderContext: Download receipt failed', e);
            throw e;
        }
    };

    const reorder = async (orderId: string): Promise<string[]> => {
        const order = orders.find(o => o.id === orderId);
        if (!order) throw new Error("Order not found in your history.");

        const validItems = [];
        const outOfStockMessages: string[] = [];

        for (const item of order.items) {
            const productRef = doc(db, 'merchant_products', item.productId);
            const productSnap = await getDoc(productRef);
            
            if (productSnap.exists()) {
                const data = productSnap.data();
                
                if (data.status !== 'inactive' && data.available_quantity > 0) {
                    const quantityToAdd = Math.min(item.quantity, data.available_quantity);
                    
                    if (quantityToAdd < item.quantity) {
                        outOfStockMessages.push(`${item.productName} (Only ${quantityToAdd} available)`);
                    }

                    if (data.price !== item.price) {
                        outOfStockMessages.push(`${item.productName} (Price changed from $${item.price} to $${data.price})`);
                    }

                    validItems.push({
                        productId: item.productId,
                        productName: item.productName,
                        price: data.price,
                        quantity: quantityToAdd,
                        storeId: order.storeId,
                        storeName: order.storeName,
                        image: item.image,
                        originalPrice: data.original_price
                    });
                } else {
                    outOfStockMessages.push(`${item.productName} (Out of stock)`);
                }
            } else {
                outOfStockMessages.push(`${item.productName} (No longer carried by store)`);
            }
        }

        if (validItems.length === 0) {
            throw new Error("None of the items from this order are currently available at the store.");
        }

        clearCart();
        await addItemsToCart(validItems);

        return outOfStockMessages;
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
            refundOrder,
            downloadOrderReceipt,
            reorder,
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
