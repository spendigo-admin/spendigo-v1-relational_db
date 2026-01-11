import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, AppNotification } from '../context/NotificationContext';

const NotificationPopover: React.FC = () => {
    const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleNotificationClick = (notification: AppNotification) => {
        markAsRead(notification.id);
        setIsOpen(false);
        if (notification.link) {
            navigate(notification.link);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'order': return '🛍️';
            case 'system': return 'ℹ️';
            case 'alert': return '⚠️';
            default: return '🔔';
        }
    };

    return (
        <div className="relative" ref={popoverRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 bg-[var(--brand-primary)] text-white rounded-lg shadow-lg shadow-[var(--brand-primary)]/20 hover:brightness-110 relative"
            >
                🔔
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-[var(--glass-border)] z-50 animate-fade-in origin-top-right">
                    <div className="p-3 border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--surface-1)] rounded-t-xl">
                        <span className="font-bold text-sm text-[var(--text-main)]">Notifications</span>
                        <div className="flex gap-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-[10px] font-bold text-[var(--brand-primary)] hover:underline"
                                >
                                    Mark all read
                                </button>
                            )}
                            <button
                                onClick={clearAll}
                                className="text-[10px] text-[var(--text-muted)] hover:text-red-500 transition-colors"
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                        {notifications.length > 0 ? (
                            notifications.map(notif => {
                                // Specialized "Tile" logic for New Orders
                                const isNewOrder = notif.title.includes('New Order');
                                const priceMatch = notif.message.match(/\$(\d+\.\d{2})/);
                                const orderPrice = priceMatch ? priceMatch[0] : null;

                                return (
                                    <div
                                        key={notif.id}
                                        onClick={() => handleNotificationClick(notif)}
                                        className={`p-3 border-b border-[var(--glass-border)] last:border-0 hover:bg-[var(--surface-1)] cursor-pointer transition-colors flex gap-3 
                                            ${!notif.read ? 'bg-blue-50/50' : ''} 
                                            ${isNewOrder ? 'items-start py-4' : ''}
                                        `}
                                    >
                                        <div className={`shrink-0 flex items-center justify-center rounded-lg ${isNewOrder ? 'w-10 h-10 bg-blue-100 text-blue-600 border border-blue-200' : 'text-xl mt-1'}`}>
                                            {getIcon(notif.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <p className={`text-sm ${!notif.read || isNewOrder ? 'font-bold text-[var(--text-main)]' : 'font-medium text-[var(--text-main)]'}`}>
                                                    {notif.title}
                                                </p>
                                                {!notif.read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 shrink-0"></div>}
                                            </div>

                                            {isNewOrder ? (
                                                <div className="mt-1">
                                                    <p className="text-xs text-[var(--text-main)] font-medium mb-1 break-words">{notif.message.split(' for $')[0]}</p>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        {orderPrice && (
                                                            <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-100 px-1.5 py-0.5 rounded">
                                                                {orderPrice}
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] text-[var(--text-muted)] bg-gray-100 px-1.5 py-0.5 rounded">
                                                            order #{notif.orderId?.slice(0, 5)}
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-[var(--text-muted)] mt-0.5 break-words whitespace-pre-wrap">{notif.message}</p>
                                            )}

                                            <p className="text-[10px] text-[var(--text-muted)] mt-1.5 opacity-70 flex justify-end">
                                                {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="py-10 text-center text-[var(--text-muted)] text-sm">
                                <div className="text-2xl mb-2 opacity-30">🔕</div>
                                No notifications
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationPopover;
