import React from 'react';
import '../../styles/design-system.css';
import { useNotifications } from '../../context/NotificationContext';

const Notifications: React.FC = () => {
    const { notifications, unreadCount, markAsRead, markAllRead, preferences, togglePreference } = useNotifications();

    const getIcon = (type: string) => {
        switch (type) {
            case 'price_drop': return '💰';
            case 'order': return '📦';
            case 'promo': return '🎁';
            default: return '🔔';
        }
    };

    return (
        <div className="animate-fade-in pb-20">
            {/* Header */}
            <div className="bg-white border-b border-[var(--glass-border)] p-4 sticky top-14 z-30">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--text-main)]">Notifications</h1>
                        {unreadCount > 0 && (
                            <p className="text-sm text-[var(--text-muted)]">{unreadCount} unread</p>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-sm text-[var(--brand-primary)] font-medium">
                            Mark all read
                        </button>
                    )}
                </div>
            </div>

            <div className="max-w-3xl mx-auto p-4 space-y-6">
                {/* Notification List */}
                <div className="space-y-2">
                    {notifications.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-5xl mb-4">🔔</p>
                            <p className="text-[var(--text-muted)]">No notifications yet</p>
                        </div>
                    ) : (
                        notifications.map(notification => (
                            <div
                                key={notification.id}
                                onClick={() => markAsRead(notification.id)}
                                className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${notification.read
                                    ? 'border-[var(--glass-border)]'
                                    : 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                                    }`}
                            >
                                <div className="flex gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[var(--surface-1)] flex items-center justify-center text-xl">
                                        {getIcon(notification.type)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-start justify-between">
                                            <p className={`font-medium ${notification.read ? 'text-[var(--text-main)]' : 'text-[var(--brand-primary)]'}`}>
                                                {notification.title}
                                            </p>
                                            {!notification.read && (
                                                <span className="w-2 h-2 rounded-full bg-[var(--brand-primary)]"></span>
                                            )}
                                        </div>
                                        <p className="text-sm text-[var(--text-muted)] mt-1">{notification.message}</p>
                                        <p className="text-xs text-[var(--text-muted)] mt-2">{notification.time}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Notification Preferences */}
                <div className="bg-white rounded-xl border border-[var(--glass-border)] p-4">
                    <h3 className="font-bold text-[var(--text-main)] mb-4">Notification Preferences</h3>
                    <div className="space-y-4">
                        {[
                            { key: 'priceDrop', label: 'Price Drop Alerts', desc: 'Get notified when items in your wishlist go on sale' },
                            { key: 'orderUpdates', label: 'Order Updates', desc: 'Track your order status in real-time' },
                            { key: 'promotions', label: 'Promotions & Deals', desc: 'Receive exclusive offers and discounts' },
                            { key: 'newArrivals', label: 'New Arrivals', desc: 'Be the first to know about new products' },
                        ].map(pref => (
                            <div key={pref.key} className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-[var(--text-main)]">{pref.label}</p>
                                    <p className="text-xs text-[var(--text-muted)]">{pref.desc}</p>
                                </div>
                                <button
                                    onClick={() => togglePreference(pref.key as any)}
                                    className={`w-12 h-7 rounded-full transition-colors relative ${preferences[pref.key as keyof typeof preferences]
                                        ? 'bg-[var(--brand-primary)]'
                                        : 'bg-[var(--surface-2)]'
                                        }`}
                                >
                                    <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${preferences[pref.key as keyof typeof preferences] ? 'left-6' : 'left-1'
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
