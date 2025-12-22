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
    { id: 'n1', type: 'price_drop', title: 'Price Drop Alert! 🔥', message: 'Organic Avocados dropped from $8.99 to $6.99', timestamp: new Date(Date.now() - 7200000).toISOString(), time: '2 hours ago', read: false, productId: 'p1' },
    { id: 'n2', type: 'promo', title: 'Weekend Flash Sale!', message: 'Get 20% off all dairy products', timestamp: new Date(Date.now() - 172800000).toISOString(), time: '2 days ago', read: false },
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

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();

    // Determine the storage key: Prefer storeId for merchants, otherwise userId, else guest
    const contextId = user?.storeId || user?.id || 'guest';
    const notifKey = `spendigo_notifications_${contextId}`;
    const prefKey = `spendigo_notification_prefs_${contextId}`;

    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);

    // Load Data
    const loadNotifications = () => {
        const savedNotifs = localStorage.getItem(notifKey);
        if (savedNotifs) {
            try {
                setNotifications(JSON.parse(savedNotifs));
            } catch (e) {
                console.error("Error parsing notifications", e);
                setNotifications([]);
            }
        } else {
            // Only seed mocks for guest/consumer, maybe empty for merchant?
            // For now, if empty, we leave empty unless it's a fresh guest
            if (!user?.storeId) {
                setNotifications(MOCK_NOTIFICATIONS);
            } else {
                setNotifications([]);
            }
        }
    };

    useEffect(() => {
        loadNotifications();

        const savedPrefs = localStorage.getItem(prefKey);
        if (savedPrefs) setPreferences(JSON.parse(savedPrefs));

        // Poll for updates (important for Merchant receiving orders)
        const interval = setInterval(loadNotifications, 3000);
        return () => clearInterval(interval);
    }, [notifKey, prefKey]);

    // Persist changes
    const saveNotifications = (newNotifs: AppNotification[]) => {
        setNotifications(newNotifs);
        localStorage.setItem(notifKey, JSON.stringify(newNotifs));
    };

    const markAsRead = (id: string) => {
        saveNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const markAllAsRead = () => {
        saveNotifications(notifications.map(n => ({ ...n, read: true })));
    };

    const clearAll = () => {
        saveNotifications([]);
    };

    const deleteNotification = (id: string) => {
        saveNotifications(notifications.filter(n => n.id !== id));
    };

    const addNotification = (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
        const newNotif: AppNotification = {
            ...n,
            id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            timestamp: new Date().toISOString(),
            read: false,
        };
        saveNotifications([newNotif, ...notifications]);
    };

    const togglePreference = (key: keyof NotificationPreferences) => {
        const newPrefs = { ...preferences, [key]: !preferences[key] };
        setPreferences(newPrefs);
        localStorage.setItem(prefKey, JSON.stringify(newPrefs));
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
