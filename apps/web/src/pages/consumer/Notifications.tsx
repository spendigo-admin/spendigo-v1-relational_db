import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/design-system.css';
import { useNotifications, AppNotification } from '../../context/NotificationContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useAuth } from '../../context/AuthContext';
import SEO from '../../components/SEO';

const Notifications: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { notifications, unreadCount, markAsRead, markAllRead, preferences, togglePreference } = useNotifications();
    const { permissionStatus, requestPermission } = usePushNotifications(user?.id);
    const [isRequesting, setIsRequesting] = useState(false);

    const handleRequestPermission = async () => {
        setIsRequesting(true);
        await requestPermission();
        setIsRequesting(false);
    };

    const getIconConfig = (type: string) => {
        switch (type) {
            case 'price_drop': return { icon: '🏷️', color: 'bg-green-100 text-green-700' };
            case 'order': return { icon: '📦', color: 'bg-blue-100 text-blue-700' };
            case 'promo': return { icon: '✨', color: 'bg-purple-100 text-purple-700' };
            case 'alert': return { icon: '⚠️', color: 'bg-orange-100 text-orange-700' };
            default: return { icon: '🔔', color: 'bg-gray-100 text-gray-700' };
        }
    };

    // Simple grouping logic
    const sections = useMemo(() => {
        const sorted = [...notifications].sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        const today: AppNotification[] = [];
        const earlier: AppNotification[] = [];

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        sorted.forEach(n => {
            const time = new Date(n.timestamp).getTime();
            if (time >= todayStart) today.push(n);
            else earlier.push(n);
        });

        return { today, earlier };
    }, [notifications]);

    const renderNotification = (n: AppNotification) => {
        const config = getIconConfig(n.type);
        return (
            <div
                key={n.id}
                onClick={() => {
                    markAsRead(n.id);
                    if (n.link) navigate(n.link);
                }}
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
                        <span>{n.time}</span>
                        <span>•</span>
                        <span>{n.type.replace('_', ' ')}</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="animate-fade-in pb-24 bg-[var(--surface-1)] min-h-screen">
            <SEO title="Notifications" description="Your Spendigo notifications." noIndex />
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-md border-b border-[var(--glass-border)] p-5 sticky top-14 z-30 pt-safe">
                <div className="max-w-xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-[var(--text-main)] tracking-tight">Inbox</h1>
                        {unreadCount > 0 && (
                            <div className="inline-flex items-center gap-1.5 mt-0.5">
                                <span className="flex h-2 w-2 rounded-full bg-[var(--brand-primary)]"></span>
                                <p className="text-xs font-bold text-[var(--brand-primary)] uppercase tracking-wider">{unreadCount} New Messages</p>
                            </div>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllRead}
                            className="bg-[var(--brand-primary-light)] text-[var(--brand-primary)] px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:bg-[var(--brand-primary)] hover:text-white"
                        >
                            Mark all read
                        </button>
                    )}
                </div>
            </div>

            <div className="max-w-xl mx-auto p-4 space-y-8">
                {notifications.length === 0 ? (
                    <div className="text-center py-20 animate-fade-in">
                        <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center text-4xl mx-auto mb-6 shadow-xl border border-[var(--glass-border)]">
                            📭
                        </div>
                        <h2 className="text-xl font-bold text-[var(--text-main)]">All Caught Up!</h2>
                        <p className="max-w-[240px] mx-auto text-sm">Your inbox is empty. We'll notify you when price drops or deals arrive.</p>
                    </div>
                ) : (
                    <>
                        {sections.today.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] ml-1">Today</h3>
                                <div className="space-y-3">
                                    {sections.today.map(renderNotification)}
                                </div>
                            </div>
                        )}

                        {sections.earlier.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] ml-1">Earlier</h3>
                                <div className="space-y-3">
                                    {sections.earlier.map(renderNotification)}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Push Notification Opt-In */}
                {permissionStatus !== 'granted' && (
                    <div className="bg-gradient-to-br from-[var(--brand-primary)] to-indigo-600 rounded-[2rem] p-6 shadow-md text-white mt-12 mb-6 animate-fade-in text-center sm:text-left flex flex-col sm:flex-row items-center gap-6">
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl backdrop-blur-sm shrink-0">
                            🔔
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-black text-xl mb-1">Stay in the Loop</h3>
                            <p className="text-blue-100 text-sm mb-4 leading-relaxed">
                                Get instant alerts when your order is out for delivery or prices drop on your wishlist.
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

                {/* Preferences Section Redesign */}
                <div className={`bg-white rounded-[2rem] border border-[var(--glass-border)] p-6 shadow-sm ${permissionStatus !== 'granted' ? 'mt-4' : 'mt-12'}`}>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">⚙️</div>
                        <div>
                            <h3 className="font-bold text-sm text-[var(--text-main)]">Preferences</h3>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Configure Alerts</p>
                        </div>
                    </div>

                    <div className="space-y-5">
                        {[
                            { key: 'priceDrop', label: 'Price Drop Alerts', desc: 'Alerts for wishlisted items' },
                            { key: 'orderUpdates', label: 'Order Tracking', desc: 'Real-time status updates' },
                            { key: 'promotions', label: 'Deals & Offers', desc: 'Exclusive store promotions' },
                            { key: 'newArrivals', label: 'New Arrivals', desc: 'Fresh additions to catalog' },
                        ].map(pref => (
                            <div key={pref.key} className="flex items-center justify-between group">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-[var(--text-main)]">{pref.label}</p>
                                    <p className="text-[11px] text-[var(--text-muted)] line-clamp-1 group-hover:text-[var(--text-main)] transition-colors">{pref.desc}</p>
                                </div>
                                <button
                                    onClick={() => togglePreference(pref.key as any)}
                                    className={`w-11 h-6 rounded-full transition-all relative shrink-0 ${preferences[pref.key as keyof typeof preferences]
                                        ? 'bg-[var(--brand-primary)] shadow-[0_4px_12px_rgba(37,99,235,0.3)]'
                                        : 'bg-[var(--surface-3)]'
                                        }`}
                                >
                                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${preferences[pref.key as keyof typeof preferences] ? 'left-6' : 'left-1'
                                        }`}></span>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Notifications;
