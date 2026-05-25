import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useNotifications, AppNotification } from '../../context/NotificationContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import SEO from '../../components/SEO';

interface MerchantNotificationPreferences {
    newOrders: boolean;
    orderUpdates: boolean;
    reviewReceived: boolean;
    subscriptionAlerts: boolean;
    teamActivity: boolean;
}

const DEFAULT_MERCHANT_PREFS: MerchantNotificationPreferences = {
    newOrders: true,
    orderUpdates: true,
    reviewReceived: true,
    subscriptionAlerts: true,
    teamActivity: false,
};

const getRelativeTime = (timestamp: string): string => {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
};

const getIconConfig = (type: string) => {
    switch (type) {
        case 'order': return { icon: '🛍️', color: 'bg-blue-100 text-blue-700' };
        case 'system': return { icon: 'ℹ️', color: 'bg-gray-100 text-gray-700' };
        case 'alert': return { icon: '⚠️', color: 'bg-orange-100 text-orange-700' };
        case 'review': return { icon: '⭐', color: 'bg-yellow-100 text-yellow-700' };
        case 'stock': return { icon: '📦', color: 'bg-orange-100 text-orange-700' };
        case 'price_drop': return { icon: '🏷️', color: 'bg-green-100 text-green-700' };
        case 'promo': return { icon: '✨', color: 'bg-purple-100 text-purple-700' };
        case 'approval': return { icon: '✅', color: 'bg-teal-100 text-teal-700' };
        default: return { icon: '🔔', color: 'bg-gray-100 text-gray-700' };
    }
};

const MerchantNotifications: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { stores } = useMarketplace();
    const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
    const { permissionStatus, requestPermission } = usePushNotifications(user?.id);
    const [isRequesting, setIsRequesting] = useState(false);
    const [prefs, setPrefs] = useState<MerchantNotificationPreferences>(DEFAULT_MERCHANT_PREFS);
    const [savingPrefs, setSavingPrefs] = useState(false);
    
    const isLocked = user?.storeId ? stores[user.storeId]?.status === 'pending_deletion' : false;

    useEffect(() => {
        if (!user?.storeId) return;
        getDoc(doc(db, 'stores', user.storeId)).then(snap => {
            const saved = snap.data()?.notificationPreferences;
            if (saved) {
                setPrefs(prev => ({ ...prev, ...saved }));
            }
        }).catch(() => {});
    }, [user?.storeId]);

    const handleRequestPermission = async () => {
        if (isLocked) return;
        setIsRequesting(true);
        await requestPermission();
        setIsRequesting(false);
    };

    const togglePref = async (key: keyof MerchantNotificationPreferences) => {
        if (isLocked) return;
        const updated = { ...prefs, [key]: !prefs[key] };
        setPrefs(updated);
        if (!user?.storeId) return;
        setSavingPrefs(true);
        try {
            const docRef = doc(db, 'stores', user.storeId);
            const snap = await getDoc(docRef);
            const currentPrefs = snap.data()?.notificationPreferences || {};
            await updateDoc(docRef, {
                notificationPreferences: {
                    ...currentPrefs,
                    ...updated
                }
            });
        } catch (error) {
            console.error("Failed to save alert preferences:", error);
        } finally {
            setSavingPrefs(false);
        }
    };

    const sections = useMemo(() => {
        const sorted = [...notifications].sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const today: AppNotification[] = [];
        const earlier: AppNotification[] = [];
        sorted.forEach(n => {
            if (new Date(n.timestamp).getTime() >= todayStart.getTime()) today.push(n);
            else earlier.push(n);
        });
        return { today, earlier };
    }, [notifications]);

    const renderNotification = (n: AppNotification) => {
        const config = getIconConfig(n.type);
        return (
            <div
                key={n.id}
                onClick={() => { markAsRead(n.id); if (n.link) navigate(n.link); }}
                className={`flex gap-4 p-4 rounded-2xl cursor-pointer transition-all border ${!n.read
                    ? 'bg-blue-50/40 border-blue-100 shadow-sm'
                    : 'bg-white border-[var(--glass-border)] opacity-80'
                } hover:shadow-md hover:scale-[1.01] active:scale-[0.99]`}
            >
                <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center text-xl shadow-inner ${config.color}`}>
                    {config.icon}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <h4 className={`text-sm font-bold truncate leading-tight ${!n.read ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>
                            {n.title}
                        </h4>
                        {!n.read && (
                            <span className="w-2 h-2 shrink-0 rounded-full bg-[var(--brand-primary)] mt-1.5 shadow-[0_0_8px_rgba(37,99,235,0.4)]"></span>
                        )}
                    </div>
                    <p className={`text-sm mt-1 leading-relaxed ${!n.read ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>
                        {n.message}
                    </p>
                    <div className="flex items-center gap-2 mt-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] opacity-60">
                        <span>{getRelativeTime(n.timestamp)}</span>
                        <span>•</span>
                        <span>{n.type.replace('_', ' ')}</span>
                    </div>
                </div>
            </div>
        );
    };

    const prefItems = [
        { key: 'newOrders' as const, label: 'New Orders', desc: 'Alert when a customer places a new order' },
        { key: 'orderUpdates' as const, label: 'Order Status Updates', desc: 'Status changes on existing orders' },
        { key: 'reviewReceived' as const, label: 'Customer Reviews', desc: 'New reviews posted for your store' },
        { key: 'subscriptionAlerts' as const, label: 'Subscription Alerts', desc: 'Plan expiry and renewal reminders' },
        { key: 'teamActivity' as const, label: 'Team Activity', desc: 'Team member invite and remove events' },
    ];

    return (
        <div className="max-w-2xl mx-auto p-4 pb-24 space-y-8 animate-fade-in">
            <SEO title="Notifications" description="Your merchant notification inbox." noIndex />

            {/* Header */}
            <div className="flex items-center justify-between pt-2">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-main)]">Notifications</h1>
                    <p className="text-sm text-[var(--text-muted)]">
                        {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllAsRead}
                            className="px-3 py-1.5 text-xs font-bold text-[var(--brand-primary)] bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                            Mark all read
                        </button>
                    )}
                    {notifications.length > 0 && (
                        <button
                            onClick={clearAll}
                            className="px-3 py-1.5 text-xs font-bold text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                        >
                            Clear all
                        </button>
                    )}
                </div>
            </div>

            {/* Notification list */}
            {notifications.length === 0 ? (
                <div className="bg-white rounded-[2rem] border border-[var(--glass-border)] p-12 text-center shadow-sm">
                    <div className="text-4xl mb-3 opacity-30">🔕</div>
                    <h2 className="text-lg font-bold text-[var(--text-main)]">All Caught Up!</h2>
                    <p className="text-sm text-[var(--text-muted)] mt-1">New orders and alerts will appear here.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {sections.today.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] ml-1">Today</h3>
                            {sections.today.map(renderNotification)}
                        </div>
                    )}
                    {sections.earlier.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] ml-1">Earlier</h3>
                            {sections.earlier.map(renderNotification)}
                        </div>
                    )}
                </div>
            )}

            {/* Push Notification Opt-In */}
            {permissionStatus !== 'granted' && (
                <div className="bg-gradient-to-br from-[var(--brand-primary)] to-indigo-600 rounded-[2rem] p-6 shadow-md text-white text-center sm:text-left flex flex-col sm:flex-row items-center gap-6">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl backdrop-blur-sm shrink-0">
                        🔔
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-black text-xl mb-1">Enable Push Alerts</h3>
                        <p className="text-blue-100 text-sm mb-4 leading-relaxed">
                            Get instant push notifications for new orders and low-stock alerts, even when the app is closed.
                        </p>
                        <button
                            onClick={handleRequestPermission}
                            disabled={isRequesting}
                            className="bg-white text-[var(--brand-primary)] px-6 py-2.5 rounded-full font-bold text-sm hover:scale-105 active:scale-95 transition-transform shadow-lg disabled:opacity-75"
                        >
                            {isRequesting ? 'Enabling...' : 'Enable Notifications'}
                        </button>
                    </div>
                </div>
            )}

            {/* Preferences */}
            <div className="bg-white rounded-[2rem] border border-[var(--glass-border)] p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl animate-pulse">⚙️</div>
                    <div>
                        <h3 className="font-black text-base text-[var(--text-main)]">Alert Preferences</h3>
                        <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">
                            {savingPrefs ? '⏳ Saving Alerts...' : 'Configure Alerts'}
                        </p>
                    </div>
                </div>
                <div className="space-y-4">
                    {prefItems.map(pref => {
                        const isChecked = prefs[pref.key];
                        return (
                            <div 
                                key={pref.key} 
                                onClick={() => togglePref(pref.key)}
                                className={`flex items-center justify-between p-4 rounded-xl border border-[var(--glass-border)] transition-all hover:bg-gray-50/50 cursor-pointer ${
                                    isChecked ? 'bg-blue-50/10' : 'bg-white'
                                }`}
                            >
                                <div className="flex-1 pr-4">
                                    <div className="font-bold text-sm text-[var(--text-main)]">{pref.label}</div>
                                    <div className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{pref.desc}</div>
                                </div>
                                <button
                                    type="button"
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ring-2 ring-transparent focus:ring-[var(--brand-primary)]/20 ${
                                        isChecked ? 'bg-[var(--brand-primary)]' : 'bg-gray-200'
                                    }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                            isChecked ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default MerchantNotifications;
