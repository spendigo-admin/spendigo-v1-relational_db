import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useNotifications, AppNotification } from '../../context/NotificationContext';
import { auditBridge } from '../../utils/auditBridge';
import SEO from '../../components/SEO';

interface AdminNotificationPreferences {
    pendingApprovals: boolean;
    systemAlerts: boolean;
    auditAlerts: boolean;
    merchantActivity: boolean;
}

const DEFAULT_ADMIN_PREFS: AdminNotificationPreferences = {
    pendingApprovals: true,
    systemAlerts: true,
    auditAlerts: true,
    merchantActivity: false,
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
        case 'approval': return { icon: '✅', color: 'bg-teal-100 text-teal-700' };
        case 'review': return { icon: '⭐', color: 'bg-yellow-100 text-yellow-700' };
        case 'stock': return { icon: '📦', color: 'bg-orange-100 text-orange-700' };
        case 'price_drop': return { icon: '🏷️', color: 'bg-green-100 text-green-700' };
        case 'promo': return { icon: '✨', color: 'bg-purple-100 text-purple-700' };
        default: return { icon: '🔔', color: 'bg-gray-100 text-gray-700' };
    }
};

const AdminNotifications: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
    const [prefs, setPrefs] = useState<AdminNotificationPreferences>(DEFAULT_ADMIN_PREFS);
    const [savingPrefs, setSavingPrefs] = useState(false);

    useEffect(() => {
        if (!user?.id) return;
        getDoc(doc(db, 'users', user.id)).then(snap => {
            const saved = snap.data()?.adminNotificationPreferences;
            if (saved) setPrefs({ ...DEFAULT_ADMIN_PREFS, ...saved });
        }).catch(() => {});

        auditBridge.emit('ADMIN_NOTIFICATIONS_VIEWED', { count: notifications.length });
    }, [user?.id]);

    const togglePref = async (key: keyof AdminNotificationPreferences) => {
        const updated = { ...prefs, [key]: !prefs[key] };
        setPrefs(updated);
        if (!user?.id) return;
        setSavingPrefs(true);
        try {
            await updateDoc(doc(db, 'users', user.id), { adminNotificationPreferences: updated });
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
        { key: 'pendingApprovals' as const, label: 'Pending Approvals', desc: 'New store and product submissions awaiting review' },
        { key: 'systemAlerts' as const, label: 'System Alerts', desc: 'Health checks and critical error events' },
        { key: 'auditAlerts' as const, label: 'Audit Alerts', desc: 'Chain integrity warnings and anomalies' },
        { key: 'merchantActivity' as const, label: 'Merchant Activity', desc: 'Subscription changes and store suspensions' },
    ];

    return (
        <div className="space-y-6 animate-fade-in text-left">
            <SEO title="Notifications — Admin" description="Admin notification inbox and preferences." noIndex />

            {/* Header */}
            <div className="flex items-center justify-between">
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
                <div className="glass-panel p-12 text-center">
                    <div className="text-4xl mb-3 opacity-30">🔕</div>
                    <p className="text-[var(--text-muted)]">No notifications yet.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {sections.today.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Today</h3>
                            {sections.today.map(renderNotification)}
                        </div>
                    )}
                    {sections.earlier.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Earlier</h3>
                            {sections.earlier.map(renderNotification)}
                        </div>
                    )}
                </div>
            )}

            {/* Preferences */}
            <div className="glass-panel p-6">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">⚙️</div>
                    <div>
                        <h3 className="font-bold text-sm text-[var(--text-main)]">Alert Preferences</h3>
                        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                            {savingPrefs ? 'Saving...' : 'Admin Notifications'}
                        </p>
                    </div>
                </div>
                <div className="space-y-5">
                    {prefItems.map(pref => (
                        <div key={pref.key} className="flex items-center justify-between group">
                            <div className="min-w-0 pr-4">
                                <p className="text-sm font-bold text-[var(--text-main)]">{pref.label}</p>
                                <p className="text-[11px] text-[var(--text-muted)] line-clamp-1">{pref.desc}</p>
                            </div>
                            <button
                                onClick={() => togglePref(pref.key)}
                                className={`w-11 h-6 rounded-full transition-all relative shrink-0 ${prefs[pref.key]
                                    ? 'bg-[var(--brand-primary)] shadow-[0_4px_12px_rgba(37,99,235,0.3)]'
                                    : 'bg-[var(--surface-3)]'
                                }`}
                            >
                                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${prefs[pref.key] ? 'left-6' : 'left-1'}`}></span>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AdminNotifications;
