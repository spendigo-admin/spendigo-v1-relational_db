import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useMarketplace } from './MarketplaceContext';
import { isFlyerActive, filterActiveDeals } from '../utils/date-helpers';

// Unified Notification Type
export interface AppNotification {
    id: string;
    type: 'price_drop' | 'order' | 'promo' | 'system' | 'alert' | 'review' | 'approval' | 'stock';
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

/**
 * Generates dynamic notifications based on active marketplace data.
 */
const generateMarketplaceNotifications = (stores: Record<string, any>): AppNotification[] => {
    const marketNotifs: AppNotification[] = [];
    
    Object.values(stores).forEach((store: any) => {
        // 1. Generate Flyer Notification
        if (isFlyerActive(store.flyer)) {
            marketNotifs.push({
                id: `flyer-${store.id}`,
                type: 'promo',
                title: `New Flyer: ${store.name} 📰`,
                message: `${store.name} just published their new weekly flyer! Tap to browse fresh deals.`,
                timestamp: new Date().toISOString(), // Use now as it's discovered now
                time: 'Just now',
                read: false,
                link: `/store/${store.id}?tab=flyer`
            });
        }

        // 2. Generate Deal Notifications (Limit to most interesting ones)
        const allDeals = [...(store.oneDayOffers || []), ...(store.saleItems || [])];
        const activeDeals = filterActiveDeals(allDeals);
        
        // Pick the top deal or flash sale
        const flashSale = activeDeals.find((d: any) => d.isFlashSale);
        const topDeal = flashSale || activeDeals[0];

        if (topDeal) {
            const discount = topDeal.type === 'percentage' 
                ? `${topDeal.value}% OFF` 
                : topDeal.type === 'fixed' 
                ? `$${topDeal.value} OFF` 
                : 'HOT DEAL';

            marketNotifs.push({
                id: `deal-${store.id}-${topDeal.id || 'top'}`,
                type: flashSale ? 'alert' : 'price_drop',
                title: `${flashSale ? '⚡ Flash Sale' : '🔥 Hot Deal'}: ${store.name}`,
                message: `${topDeal.productName || topDeal.name || 'Special items'} are now ${discount}! Don't miss out.`,
                timestamp: new Date().toISOString(),
                time: 'Active now',
                read: false,
                link: `/store/${store.id}?tab=offers`
            });
        }
    });

    // Sort by type (alerts first, then promos) and limited to 10 to keep it manageable
    return marketNotifs
        .sort((a, b) => {
            if (a.type === 'alert' && b.type !== 'alert') return -1;
            if (a.type !== 'alert' && b.type === 'alert') return 1;
            return 0;
        })
        .slice(0, 10);
};

export interface NotificationPreferences {
    priceDrop: boolean;
    orderUpdates: boolean;
    promotions: boolean;
    newArrivals: boolean;
    maxDistance: number; // in kilometers
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
    priceDrop: true,
    orderUpdates: true,
    promotions: true,
    newArrivals: false,
    maxDistance: 10,
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
    togglePreference: (key: keyof NotificationPreferences) => Promise<void>;
    setPreference: (key: keyof NotificationPreferences, value: any) => Promise<void>;
    toast: AppNotification | null;
    setToast: (toast: AppNotification | null) => void;
}

// Imports updated
import { doc, onSnapshot, setDoc, getDoc, collection, query, orderBy, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, messaging } from '../lib/firebase';
import { onMessage } from 'firebase/messaging';
import { usePushNotifications } from '../hooks/usePushNotifications';

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { stores } = useMarketplace();

    // Ensure FCM tokens are registered/refreshed for every logged-in user on app load,
    // not just when they visit the /notifications page.
    usePushNotifications(user?.id);

    // Determine context ID: Store > User > Guest
    // If user is logged in, we use their UID. If guest, we use LocalStorage.
    const contextId = user?.id; // Subcollections hang off USER document
    const isAuth = !!user;

    // Keys for LocalStorage Fallback (Guest / Demo)
    const LOCAL_NOTIF_KEY = `spendigo_notifications_${contextId || 'guest'}`;
    const LOCAL_PREF_KEY = `spendigo_notification_prefs_${contextId || 'guest'}`;

    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
    const [toast, setToast] = useState<AppNotification | null>(null);
    const lastNotifIds = useRef<Set<string>>(new Set());
    const isFirstLoad = useRef(true);

    // Sync Logic
    useEffect(() => {
        let unsubscribe: () => void;

        const initialize = async () => {
            if (isAuth && contextId) {
                // Load prefs from Firestore; fall back to localStorage
                try {
                    const prefDoc = await getDoc(doc(db, 'users', contextId));
                    const saved = prefDoc.data()?.notificationPreferences;
                    if (saved) {
                        setPreferences({ ...DEFAULT_PREFERENCES, ...saved });
                    } else {
                        const local = localStorage.getItem(LOCAL_PREF_KEY);
                        if (local) setPreferences(JSON.parse(local));
                    }
                } catch {
                    const local = localStorage.getItem(LOCAL_PREF_KEY);
                    if (local) setPreferences(JSON.parse(local));
                }

                // FIRESTORE SYNC (Subcollection)
                const notifRef = collection(db, 'users', contextId, 'notifications');
                const q = query(notifRef, orderBy('timestamp', 'desc'));

                unsubscribe = onSnapshot(q, (snapshot) => {
                    const loaded: AppNotification[] = [];
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        // Firestore serverTimestamp() returns a Timestamp object, not a string.
                        // Convert to ISO string so the rest of the app always sees strings.
                        if (data.timestamp && typeof data.timestamp !== 'string') {
                            data.timestamp = data.timestamp.toDate
                                ? data.timestamp.toDate().toISOString()
                                : new Date(data.timestamp.seconds * 1000).toISOString();
                        }
                        loaded.push({ id: doc.id, ...data } as AppNotification);
                    });

                    // Explicitly sort by timestamp descending to ensure newest are first
                    loaded.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

                    // Trigger toast for NEW notifications (not on first load)
                    if (!isFirstLoad.current) {
                        const newNotif = loaded.find(n => !lastNotifIds.current.has(n.id) && !n.read);
                        if (newNotif) {
                            setToast(newNotif);
                            setTimeout(() => setToast(null), 5000);
                        }
                    }

                    // Update tracking refs
                    lastNotifIds.current = new Set(loaded.map(n => n.id));
                    isFirstLoad.current = false;
                    
                    setNotifications(loaded);
                });
            } else {
                // LOCAL STORAGE SYNC (Guest)
                const savedPrefs = localStorage.getItem(LOCAL_PREF_KEY);
                if (savedPrefs) setPreferences(JSON.parse(savedPrefs));

                const savedNotifs = localStorage.getItem(LOCAL_NOTIF_KEY);
                if (savedNotifs) {
                    try { 
                        const local = JSON.parse(savedNotifs);
                        // Merge local with marketplace if local is sparse
                        const market = generateMarketplaceNotifications(stores);
                        const merged = [...local, ...market.filter(m => !local.some((l: any) => l.id === m.id))];
                        merged.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
                        setNotifications(merged.slice(0, 20));
                    } catch (e) { 
                        setNotifications(generateMarketplaceNotifications(stores));
                    }
                } else {
                    setNotifications(generateMarketplaceNotifications(stores));
                }
            }

            // Foreground Messages Listener
            if (messaging) {
                onMessage(messaging, (payload) => {
                    console.log('Foreground message received. ', payload);
                    if (payload.notification) {
                        const fcmType = (payload.data?.type as string) || 'system';

                        // Map FCM data types to user preference keys and check consent
                        const prefKey: keyof NotificationPreferences | null =
                            fcmType === 'price_drop' ? 'priceDrop' :
                            fcmType === 'order' ? 'orderUpdates' :
                            fcmType === 'promo' ? 'promotions' : null;

                        // Only suppress if there's an explicit false — default (undefined) means allowed
                        if (prefKey && preferences[prefKey] === false) {
                            console.log(`Foreground FCM suppressed — user preference '${prefKey}' is off.`);
                            return;
                        }

                        const newNotif: Omit<AppNotification, 'id' | 'timestamp' | 'read'> = {
                            type: fcmType as AppNotification['type'],
                            title: payload.notification.title || 'New Notification',
                            message: payload.notification.body || '',
                            link: payload.data?.link,
                            orderId: payload.data?.orderId
                        };

                        addNotification(newNotif);
                    }
                });
            }
        };

        initialize();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [contextId, isAuth, LOCAL_NOTIF_KEY, LOCAL_PREF_KEY]);

    const setPreference = async (key: keyof NotificationPreferences, value: any) => {
        const newPrefs = { ...preferences, [key]: value };
        setPreferences(newPrefs);
        localStorage.setItem(LOCAL_PREF_KEY, JSON.stringify(newPrefs));

        if (isAuth && contextId) {
            try {
                await updateDoc(doc(db, 'users', contextId), {
                    notificationPreferences: newPrefs
                });
            } catch (e) {
                console.error('Failed to persist notification preferences:', e);
            }
        }
    };

    const togglePreference = async (key: keyof NotificationPreferences) => {
        if (typeof preferences[key] !== 'boolean') return;
        await setPreference(key, !preferences[key]);
    };

    // Actions
    const addNotification = async (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
        const newId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const payload = {
            id: newId,
            ...n,
            timestamp: new Date().toISOString(),
            read: false
        };

        // --- Trigger Ephemeral Toast IMMEDIATELY for UI responsiveness ---
        setToast({ ...payload, id: `toast-${Date.now()}` } as AppNotification);
        setTimeout(() => setToast(null), 5000);

        if (isAuth && contextId) {
            try {
                await setDoc(doc(db, 'users', contextId, 'notifications', newId), payload);
            } catch (e) {
                console.error("Failed to save notification to Firestore:", e);
            }
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
        if (isAuth && contextId) {
            const batch = (await import('firebase/firestore')).writeBatch(db);
            // Limit to first 500 to stay within batch limits
            const toDelete = notifications.slice(0, 500);

            toDelete.forEach(n => {
                const ref = doc(db, 'users', contextId, 'notifications', n.id);
                batch.delete(ref);
            });
            if (toDelete.length > 0) await batch.commit();
        } else {
            setNotifications([]);
            localStorage.setItem(LOCAL_NOTIF_KEY, JSON.stringify([]));
        }
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
            togglePreference,
            setPreference,
            toast,
            setToast
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
