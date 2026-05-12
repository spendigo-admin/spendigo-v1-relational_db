import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, AppNotification } from '../context/NotificationContext';
import { formatNotificationTime } from '../utils/date-helpers';

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
            case 'price_drop': return '🏷️';
            case 'promo': return '✨';
            case 'review': return '⭐';
            case 'approval': return '✅';
            case 'stock': return '📦';
            default: return '🔔';
        }
    };

    return (
        <div className="relative" ref={popoverRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2.5 bg-white border border-gray-100 text-[#112244] rounded-xl shadow-sm hover:border-[#007AFF] hover:text-[#007AFF] transition-all relative active:scale-95 group"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                )}
            </button>

            {isOpen && (
                <div className="fixed md:absolute inset-x-4 md:inset-x-auto md:right-0 top-[5.5rem] md:top-auto md:mt-3 md:w-[22rem] bg-white rounded-[2rem] shadow-2xl border border-gray-100 z-50 animate-fade-in origin-top md:origin-top-right overflow-hidden">
                    <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                        <span className="font-black text-xs uppercase tracking-widest text-[#112244]">Inbox</span>
                        <div className="flex gap-4">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-[10px] font-black uppercase tracking-widest text-[#007AFF] hover:opacity-70 transition-opacity"
                                >
                                    Mark all read
                                </button>
                            )}
                            <button
                                onClick={clearAll}
                                className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:opacity-70 transition-opacity"
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    <div className="max-h-96 overflow-y-auto scrollbar-hide">
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
                                        className={`p-5 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-all flex gap-4 
                                            ${!notif.read ? 'bg-blue-50/30' : ''} 
                                            ${isNewOrder ? 'items-start' : ''}
                                        `}
                                    >
                                        <div className={`shrink-0 flex items-center justify-center rounded-2xl ${isNewOrder ? 'w-12 h-12 bg-blue-100 text-blue-600 border border-blue-200' : 'w-10 h-10 bg-gray-50 text-xl'}`}>
                                            {getIcon(notif.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-0.5">
                                                <p className={`text-sm tracking-tight ${!notif.read || isNewOrder ? 'font-black text-[#112244]' : 'font-bold text-gray-500'}`}>
                                                    {notif.title}
                                                </p>
                                                {!notif.read && <div className="w-2 h-2 bg-[#007AFF] rounded-full mt-1.5 shrink-0 shadow-[0_0_8px_rgba(0,122,255,0.4)]"></div>}
                                            </div>

                                            {isNewOrder ? (
                                                <div className="mt-1.5">
                                                    <p className="text-xs text-gray-500 font-bold mb-2 break-words">{notif.message.split(' for $')[0]}</p>
                                                    <div className="flex items-center gap-2">
                                                        {orderPrice && (
                                                            <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                                                                {orderPrice}
                                                            </span>
                                                        )}
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">
                                                            order #{notif.orderId?.slice(0, 5)}
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-400 font-medium leading-relaxed break-words line-clamp-2">{notif.message}</p>
                                            )}

                                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-300 mt-3">
                                                {formatNotificationTime(notif.timestamp)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="py-20 px-10 text-center flex flex-col items-center justify-center">
                                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6 relative">
                                    <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                    <div className="absolute top-4 right-4 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                                        <div className="w-1.5 h-1.5 bg-gray-200 rounded-full"></div>
                                    </div>
                                </div>
                                <h3 className="text-base font-black text-[#112244] mb-2 tracking-tight">No notifications yet</h3>
                                <p className="text-xs text-gray-400 font-medium leading-relaxed max-w-[15rem]">
                                    We'll notify you here about price drops, order updates, and local deals.
                                </p>
                            </div>
                        )}
                    </div>

                    {notifications.length > 0 && (
                        <div className="p-4 bg-gray-50/50 text-center">
                            <button 
                                onClick={() => { setIsOpen(false); navigate('/notifications'); }}
                                className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-[#007AFF] transition-colors"
                            >
                                View All Notifications
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationPopover;
