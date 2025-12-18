import React, { createContext, useContext, useEffect, useState } from 'react';

// Define Notification Type
export interface Notification {
    id: string;
    type: 'price_drop' | 'order' | 'promo';
    title: string;
    message: string;
    time: string;
    read: boolean;
    productId?: string;
    orderId?: string;
}

// Initial Mock Data
const MOCK_NOTIFICATIONS: Notification[] = [
    { id: 'n1', type: 'price_drop', title: 'Price Drop Alert! 🔥', message: 'Organic Avocados dropped from $8.99 to $6.99 at FreshMart', time: '2 hours ago', read: false, productId: 'p1' },
    { id: 'n2', type: 'order', title: 'Order Delivered', message: 'Your order #ORD-001 has been delivered', time: '1 day ago', read: false, orderId: 'ORD-001' },
    { id: 'n3', type: 'promo', title: 'Weekend Flash Sale!', message: 'Get 20% off all dairy products at Metro Express', time: '2 days ago', read: false },
    { id: 'n4', type: 'price_drop', title: 'Price Drop Alert! 🔥', message: 'Almond Milk is now $4.49 (was $5.99)', time: '3 days ago', read: true, productId: 'p2' },
];

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (id: string) => void;
    markAllRead: () => void;
    deleteNotification: (id: string) => void;
    preferences: NotificationPreferences;
    togglePreference: (key: keyof NotificationPreferences) => void;
}

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

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>(() => {
        // Load from localStorage or use Mock data
        const saved = localStorage.getItem('spendigo_notifications');
        return saved ? JSON.parse(saved) : MOCK_NOTIFICATIONS;
    });

    const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
        const saved = localStorage.getItem('spendigo_notification_prefs');
        return saved ? JSON.parse(saved) : DEFAULT_PREFERENCES;
    });

    // Persist to localStorage whenever notifications change
    useEffect(() => {
        localStorage.setItem('spendigo_notifications', JSON.stringify(notifications));
    }, [notifications]);

    // Persist preferences
    useEffect(() => {
        localStorage.setItem('spendigo_notification_prefs', JSON.stringify(preferences));
    }, [preferences]);

    const unreadCount = notifications.filter(n => !n.read).length;

    const markAsRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const deleteNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const togglePreference = (key: keyof NotificationPreferences) => {
        setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            markAsRead,
            markAllRead,
            deleteNotification,
            preferences,
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
