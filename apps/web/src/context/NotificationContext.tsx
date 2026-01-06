import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

// Unified Notification Type
export interface AppNotification {
    id: string;
    type: 'price_drop' | 'order' | 'promo' | 'system' | 'alert';
    title: string;
    message: string;
    timestamp: string; // ISO String
    read: boolean;
    link?: string;     // Navigation link
    productId?: string;
    orderId?: string;
    time?: string;     // Backward compatibility for display
}

// Alias for backward compatibility if needed
export type Notification = AppNotification;

const MOCK_NOTIFICATIONS: AppNotification[] = [
    {
        id: 'n1',
        type: 'price_drop',
        title: 'Price Drop: Organic Hass Avocados 🥑',
        message: 'FreshMart: The Organic Hass Avocados in your wishlist are now $1.99 (was $3.49). Stock up while it lasts!',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        time: '2 hours ago',
        read: false,
        productId: 'p1'
    },
    {
        id: 'n2',
        type: 'promo',
        title: 'Flash Sale: 25% Off Dairy 🥛',
        message: 'DailyLoaf Bakery: Today only! Enjoy 25% off all milk and yogurt products. Tap to see eligible items.',
        timestamp: new Date(Date.now() - 172800000).toISOString(),
        time: '2 days ago',
        read: false
    },
    {
        id: 'n3',
        type: 'order',
        title: 'Order Delivered! ✅',
        message: 'Your order #ORD-8821 from Metro Express has been delivered to your doorstep. Rate your experience!',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        time: '1 day ago',
        read: true
    }
];

export interface NotificationPreferences {
    priceDrop: boolean;
    orderUpdates: boolean;
    promotions: boolean;
    newArrivals: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
    priceDrop: true,
    orderUpdates: true,
    promotions: true,
    newArrivals: false,
};

interface NotificationContextType {
    notifications: AppNotification[];
    unreadCount: number;
    preferences: NotificationPreferences;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    markAllRead: () => void; // Deprecated alias
    clearAll: () => void;
    addNotification: (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
    deleteNotification: (id: string) => void;
    togglePreference: (key: keyof NotificationPreferences) => void;
}

// Imports updated
import { doc, onSnapshot, setDoc, getDoc, collection, query, orderBy, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();

    // Determine context ID: Store > User > Guest
    // If user is logged in, we use their UID. If guest, we use LocalStorage.
    const contextId = user?.id; // Subcollections hang off USER document
    const isAuth = !!user;

    // Keys for LocalStorage Fallback (Guest / Demo)
    const LOCAL_NOTIF_KEY = `spendigo_notifications_${contextId || 'guest'}`;
    const LOCAL_PREF_KEY = `spendigo_notification_prefs_${contextId || 'guest'}`;

    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
    const [loading, setLoading] = useState(true);

    // Sync Logic
    useEffect(() => {
        let unsubscribe: () => void;

        const initialize = async () => {
            // Load Prefs (Local for now, could be DB)
            const savedPrefs = localStorage.getItem(LOCAL_PREF_KEY);
            if (savedPrefs) setPreferences(JSON.parse(savedPrefs));

            if (isAuth && contextId) {
                // FIRESTORE SYNC (Subcollection)
                const notifRef = collection(db, 'users', contextId, 'notifications');
                const q = query(notifRef, orderBy('timestamp', 'desc'));

                unsubscribe = onSnapshot(q, (snapshot) => {
                    const loaded: AppNotification[] = [];
                    snapshot.forEach(doc => {
                        loaded.push({ id: doc.id, ...doc.data() } as AppNotification);
                    });
                    setNotifications(loaded);
                    setLoading(false);
                });
            } else {
                // LOCAL STORAGE SYNC (Guest)
                const savedNotifs = localStorage.getItem(LOCAL_NOTIF_KEY);
                if (savedNotifs) {
                    try { setNotifications(JSON.parse(savedNotifs)); } catch (e) { console.error(e); }
                } else {
                    setNotifications(MOCK_NOTIFICATIONS);
                }
                setLoading(false);
            }
        };

        initialize();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [contextId, isAuth, LOCAL_NOTIF_KEY, LOCAL_PREF_KEY]);

    // Save Prefs
    const togglePreference = (key: keyof NotificationPreferences) => {
        const newPrefs = { ...preferences, [key]: !preferences[key] };
        setPreferences(newPrefs);
        localStorage.setItem(LOCAL_PREF_KEY, JSON.stringify(newPrefs));
    };

    // Actions
    const addNotification = async (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
        const payload = {
            ...n,
            timestamp: new Date().toISOString(), // Use serverTimestamp in real app, but ISO string easy for UI
            read: false
        };

        if (isAuth && contextId) {
            await addDoc(collection(db, 'users', contextId, 'notifications'), payload);
        } else {
            // Local
            const newNotif = { ...payload, id: `guest-${Date.now()}` };
            const updated = [newNotif, ...notifications];
            setNotifications(updated);
            localStorage.setItem(LOCAL_NOTIF_KEY, JSON.stringify(updated));
        }
    };

    const markAsRead = async (id: string) => {
        if (isAuth && contextId) {
            const ref = doc(db, 'users', contextId, 'notifications', id);
            await updateDoc(ref, { read: true });
        } else {
            const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
            setNotifications(updated);
            localStorage.setItem(LOCAL_NOTIF_KEY, JSON.stringify(updated));
        }
    };

    const markAllAsRead = async () => {
        if (isAuth && contextId) {
            // Batch update (limit 500)
            const batch = (await import('firebase/firestore')).writeBatch(db);
            notifications.forEach(n => {
                if (!n.read) {
                    const ref = doc(db, 'users', contextId, 'notifications', n.id);
                    batch.update(ref, { read: true });
                }
            });
            if (notifications.some(n => !n.read)) await batch.commit();
        } else {
            const updated = notifications.map(n => ({ ...n, read: true }));
            setNotifications(updated);
            localStorage.setItem(LOCAL_NOTIF_KEY, JSON.stringify(updated));
        }
    };

    const clearAll = async () => {
        // Implement if needed, dangerous to delete all
    };

    const deleteNotification = async (id: string) => {
        if (isAuth && contextId) {
            await deleteDoc(doc(db, 'users', contextId, 'notifications', id));
        } else {
            const updated = notifications.filter(n => n.id !== id);
            setNotifications(updated);
            localStorage.setItem(LOCAL_NOTIF_KEY, JSON.stringify(updated));
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            preferences,
            markAsRead,
            markAllAsRead,
            markAllRead: markAllAsRead,
            clearAll,
            addNotification,
            deleteNotification,
            togglePreference
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
