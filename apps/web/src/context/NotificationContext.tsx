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

import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();

    // Determine context ID: Store > User > Guest
    const contextId = user?.storeId || user?.id || 'guest';
    const isAuth = !!user;

    // Keys for LocalStorage Fallback
    const LOCAL_NOTIF_KEY = `spendigo_notifications_${contextId}`;
    const LOCAL_PREF_KEY = `spendigo_notification_prefs_${contextId}`;

    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
    const [loading, setLoading] = useState(true);

    // Sync Logic
    useEffect(() => {
        let unsubscribe: () => void;

        const initialize = async () => {
            if (isAuth) {
                // FIRESTORE SYNC
                const notifRef = doc(db, 'notifications', contextId);

                // Subscribe
                unsubscribe = onSnapshot(notifRef, (doc) => {
                    if (doc.exists()) {
                        const data = doc.data();
                        setNotifications(data.list || []);
                        if (data.preferences) setPreferences(data.preferences);
                    } else {
                        // Initialize if empty? Or just set empty.
                        setNotifications([]);
                    }
                    setLoading(false);
                });
            } else {
                // LOCAL STORAGE SYNC (Guest)
                const savedNotifs = localStorage.getItem(LOCAL_NOTIF_KEY);
                if (savedNotifs) {
                    try { setNotifications(JSON.parse(savedNotifs)); } catch (e) { console.error(e); }
                } else {
                    // Seed mocks for demo only if guest
                    setNotifications(MOCK_NOTIFICATIONS);
                }

                const savedPrefs = localStorage.getItem(LOCAL_PREF_KEY);
                if (savedPrefs) setPreferences(JSON.parse(savedPrefs));

                setLoading(false);
            }
        };

        initialize();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [contextId, isAuth, LOCAL_NOTIF_KEY, LOCAL_PREF_KEY]);

    // Save Helper
    const saveToStorage = async (newNotifs: AppNotification[], newPrefs: NotificationPreferences) => {
        if (isAuth) {
            // Write to Firestore
            try {
                await setDoc(doc(db, 'notifications', contextId), {
                    list: newNotifs,
                    preferences: newPrefs,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            } catch (e) {
                console.error("Failed to save notifications", e);
            }
        } else {
            // Write to LocalStorage
            localStorage.setItem(LOCAL_NOTIF_KEY, JSON.stringify(newNotifs));
            localStorage.setItem(LOCAL_PREF_KEY, JSON.stringify(newPrefs));
        }
    };

    // --- Actions ---

    // Note: State updates here are optimistic for local UI, 
    // but actual persistence is handled by saveToStorage.
    // However, if we rely on Firestore listener to update State, we should strictly write to DB.
    // For Guests, we set State + LS.

    const updateState = (newNotifs: AppNotification[], newPrefs: NotificationPreferences) => {
        if (!isAuth) {
            setNotifications(newNotifs);
            setPreferences(newPrefs);
        }
        // Auth users wait for Listener (or we could optimistically update, but listener is fast enough locally)
        saveToStorage(newNotifs, newPrefs);
    };

    const markAsRead = (id: string) => {
        const newNotifs = notifications.map(n => n.id === id ? { ...n, read: true } : n);
        updateState(newNotifs, preferences);
    };

    const markAllAsRead = () => {
        const newNotifs = notifications.map(n => ({ ...n, read: true }));
        updateState(newNotifs, preferences);
    };

    const clearAll = () => {
        updateState([], preferences);
    };

    const deleteNotification = (id: string) => {
        const newNotifs = notifications.filter(n => n.id !== id);
        updateState(newNotifs, preferences);
    };

    const addNotification = (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
        const newNotif: AppNotification = {
            ...n,
            id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            timestamp: new Date().toISOString(),
            read: false,
        };
        const newNotifs = [newNotif, ...notifications];
        updateState(newNotifs, preferences);
    };

    const togglePreference = (key: keyof NotificationPreferences) => {
        const newPrefs = { ...preferences, [key]: !preferences[key] };
        updateState(notifications, newPrefs);
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            preferences,
            markAsRead,
            markAllAsRead,
            markAllRead: markAllAsRead, // Alias
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
