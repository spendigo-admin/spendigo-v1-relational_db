import React, { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import NotificationPopover from '../components/NotificationPopover';
import LocationPopover from '../components/LocationPopover';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import '../styles/design-system.css';
import { analytics, db } from '../lib/firebase';
import { logEvent } from 'firebase/analytics';
import { doc, onSnapshot } from 'firebase/firestore';
import ReConsentModal from '../components/ReConsentModal';

const ConsumerLayout: React.FC = () => {
    const { itemCount, notification, clearNotification } = useCart();
    const { user, logout, loading } = useAuth();
    const { unreadCount, toast, setToast, markAsRead } = useNotifications();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const location = useLocation();
    const { t } = useTranslation();
    const [flyerIngestionEnabled, setFlyerIngestionEnabled] = useState(true);

    // Track Page Views
    React.useEffect(() => {
        if (analytics) {
            logEvent(analytics, 'page_view', {
                page_path: location.pathname,
                page_location: window.location.href,
                page_title: document.title
            });
        }

        // Custom Firestore Counter for Dashboard
        import('../utils/traffic').then(({ incrementDailyVisitors }) => {
            incrementDailyVisitors();
        });

        const unsubSettings = onSnapshot(doc(db, 'settings', 'platform'), (snap) => {
            if (snap.exists()) {
                setFlyerIngestionEnabled(snap.data().flyerIngestionEnabled !== false);
            }
        });

        return () => unsubSettings();
    }, [location]);

    // STRICT SECURITY CHECK: Redirect Admin/Merchant away from Shopper UI
    React.useEffect(() => {
        if (user) {
            if (user.role === 'admin') {
                navigate('/admin/dashboard', { replace: true });
            } else if (user.role === 'merchant') {
                navigate('/merchant/dashboard', { replace: true });
            }
        }
    }, [user, navigate]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
            setSearchQuery('');
        }
    };

    const handleToastClick = () => {
        if (!toast) return;
        if (toast.id) markAsRead(toast.id);
        setToast(null);
        if (toast.link) {
            navigate(toast.link);
        } else {
            navigate('/notifications');
        }
    };

    // Don't render shopper UI if auth is still loading or if user is admin/merchant (Redirection handled by useEffect)
    if (loading || (user && user.role !== 'consumer')) {
        return null;
    }

    return (
        <div className="min-h-screen bg-[#F4F7FA] relative flex flex-col">
            <ReConsentModal />
            {/* TOP NAVIGATION BAR */}
            <header className="fixed top-0 left-0 right-0 h-[calc(4.5rem+var(--safe-area-top))] pt-safe bg-white border-b border-gray-100 z-50 px-6 md:px-12 flex items-center justify-between shadow-sm">
                {/* LEFT: Logo with Bag Icon */}
                <div className="flex items-center gap-12">
                    <LocationPopover />

                    {/* DESKTOP NAV LINKS */}
                    <nav className="hidden lg:flex items-center gap-8">
                        {[
                            { label: t('storesWord'), to: '/#local-merchants' },
                            { label: t('flyersNav'), to: '/flyers' },
                            { label: t('dealsWord'), to: '/deals' },
                            ...(flyerIngestionEnabled ? [{ label: t('compareNav'), to: '/compare' }] : []),
                            { label: t('smartCartNav'), to: '/smartcart' },
                        ].map(item => (
                            <Link
                                key={item.to}
                                to={item.to}
                                className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-colors"
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>

                {/* CENTER: Desktop Search */}
                <div className="hidden lg:flex flex-1 max-w-xl mx-12">
                    <form onSubmit={handleSearch} className="relative w-full group">
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('searchPlaceholder')}
                            className="w-full bg-gray-50 border border-transparent rounded-2xl py-3 pl-12 pr-4 text-sm font-bold focus:bg-white focus:border-[#007AFF]/20 transition-all outline-none"
                        />
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-300">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </form>
                </div>

                {/* RIGHT: Actions */}
                <div className="flex items-center gap-3 md:gap-4">
                    <NotificationPopover />
                    
                    {/* CONSISTENT CART ICON */}
                    <Link to="/cart" className="p-2.5 bg-white border border-[var(--glass-border)] text-[var(--brand-navy)] rounded-xl shadow-sm hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-all relative active:scale-95 group">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                        {itemCount > 0 && (
                            <span className="absolute top-2 right-2 w-4 h-4 bg-[var(--brand-primary)] text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-md shadow-blue-500/20">
                                {itemCount}
                            </span>
                        )}
                    </Link>
                    
                    {/* CONSISTENT PROFILE ICON */}
                    <Link to="/profile" className="hidden md:flex p-2.5 bg-white border border-[var(--glass-border)] text-[var(--brand-navy)] rounded-xl shadow-sm hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-all relative active:scale-95 group">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </Link>
                </div>
            </header>

            {/* MAIN CONTENT AREA */}
            <main className="pt-[calc(4.5rem+var(--safe-area-top))] min-h-screen pb-32 animate-fade-in">
                <Outlet />
            </main>

            {/* BOTTOM NAVIGATION - Mobile Only */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(4rem+var(--safe-area-bottom))] bg-white/80 backdrop-blur-xl border-t border-gray-100 z-50 flex items-stretch shadow-[0_-4px_16px_rgba(0,0,0,0.03)] px-2">
                <NavLink to="/" end className={({ isActive }) => `flex flex-col items-center justify-center flex-1 transition-colors duration-150 gap-1 ${isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-900'}`}>
                    <svg className="w-6 h-6" fill={location.pathname === '/' ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    <span className="text-[10px] font-semibold tracking-tight">{t('homeNav')}</span>
                </NavLink>

                <NavLink to="/search" className={({ isActive }) => `flex flex-col items-center justify-center flex-1 transition-colors duration-150 gap-1 ${isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-900'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span className="text-[10px] font-semibold tracking-tight">{t('searchNav')}</span>
                </NavLink>

                {flyerIngestionEnabled && (
                    <NavLink to="/compare" className={({ isActive }) => `flex flex-col items-center justify-center flex-1 transition-colors duration-150 gap-1 ${isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-900'}`}>
                        <svg className="w-6 h-6" fill={location.pathname === '/compare' ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span className="text-[10px] font-semibold tracking-tight">Compare</span>
                    </NavLink>
                )}

                <NavLink to="/smartcart" className={({ isActive }) => `flex flex-col items-center justify-center flex-1 transition-colors duration-150 gap-1 relative ${isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-900'}`}>
                    <div className="relative">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path d="M12 2l7 4v8l-7 4-7-4V6l7-4z" />
                            <circle cx="12" cy="10" r="2.5" fill="currentColor" />
                            <path d="M12 14v2M12 6V4" />
                            <circle cx="8" cy="21" r="1.5" />
                            <circle cx="16" cy="21" r="1.5" />
                        </svg>
                        <span className="absolute -top-1.5 -right-1.5 text-[10px] animate-pulse">✨</span>
                    </div>
                    <span className="text-[10px] font-semibold tracking-tight">{t('smartCartNav')}</span>
                    {itemCount > 0 && (
                        <span className="absolute top-2 right-1 w-4 h-4 bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                            {itemCount}
                        </span>
                    )}
                </NavLink>

                <NavLink to="/profile" className={({ isActive }) => `flex flex-col items-center justify-center flex-1 transition-colors duration-150 gap-1 ${isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-900'}`}>
                    <svg className="w-6 h-6" fill={location.pathname === '/profile' ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-[10px] font-semibold tracking-tight">{t('profileNav')}</span>
                </NavLink>
            </nav>

            {/* GLOBAL ULTRA-COMPACT PREMIUM FOOTER */}
            <footer className="bg-white border-t border-gray-100 pb-[calc(4rem+var(--safe-area-bottom))] md:pb-6 pt-6 px-6 md:px-12 mt-auto">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-6">
                        <div className="flex items-center gap-4">
                            <Link to="/" className="flex items-center gap-2 group">
                                <div className="w-8 h-8 bg-[var(--brand-primary)] rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                    </svg>
                                </div>
                                <span className="text-lg font-black text-[var(--brand-navy)] tracking-tighter italic">Spendigo</span>
                            </Link>
                            <span className="hidden md:block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest italic border-l border-gray-100 pl-4 opacity-50">
                                {t('footerTagline')}
                            </span>
                        </div>
 
                        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
                            {[
                                { to: '/how-it-works', label: 'How It Works' },
                                { to: '/careers', label: 'Careers' },
                                { to: '/partner', label: 'Partner with Us' },
                                { to: '/privacy', label: 'Privacy' },
                                { to: '/terms', label: 'Terms' }
                            ].map(link => (
                                <Link key={link.to} to={link.to} className="text-[10px] font-black text-[var(--text-muted)] hover:text-[var(--brand-primary)] transition-colors uppercase tracking-[0.2em]">
                                    {link.label}
                                </Link>
                            ))}
                            <LanguageSwitcher />
                        </nav>
                    </div>
 
                    <div className="pt-6 border-t border-gray-100 flex flex-row items-center justify-between">
                        <div className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] flex items-center gap-2 opacity-50">
                            <span>Spendigo Inc. © 2026</span>
                            <span className="opacity-40">•</span>
                            <span className="hidden sm:inline">{t('footerMadeWith')}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xl flex items-center gap-1.5" title="Proudly Canadian">
                                <span>🍁</span>
                                <span>🇨🇦</span>
                            </span>
                        </div>
                    </div>
                </div>
            </footer>

            {/* GLOBAL NOTIFICATION TOAST (Cart/System) */}
            {(notification || toast) && (
                <div className="fixed bottom-24 left-4 right-4 md:bottom-8 md:left-auto md:right-8 z-[110] animate-slide-up pointer-events-none md:max-w-md w-full">
                    {/* CART TOAST */}
                    {notification && (
                        <div className={`p-4 shadow-2xl flex flex-col pointer-events-auto rounded-2xl bg-white border-l-4 mb-4 ${notification.type === 'success' ? 'border-green-500' : 'border-red-500'}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex-1 mr-4">
                                    <p className="text-sm font-bold text-gray-900">{notification.message}</p>
                                    {notification.description && (
                                        <p className="text-xs text-gray-500 mt-1">{notification.description}</p>
                                    )}
                                </div>
                                <button
                                    onClick={clearNotification}
                                    className="p-2 text-gray-400 hover:text-gray-900 transition-all shrink-0"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* SYSTEM NOTIFICATION TOAST */}
                    {toast && (
                        <div 
                            onClick={handleToastClick}
                            className="p-4 bg-white border border-gray-100 shadow-2xl rounded-2xl flex items-center justify-between pointer-events-auto cursor-pointer hover:bg-gray-50 transition-colors group"
                        >
                            <div className="flex-1 mr-4">
                                <div className="flex items-center gap-3">
                                    <span className={toast.type === 'alert' ? 'text-red-500 text-xl' : 'text-blue-500 text-xl'}>
                                        {toast.type === 'alert' ? '🚨' : '🔔'}
                                    </span>
                                    <div>
                                        <p className="font-bold text-sm text-gray-900 group-hover:text-blue-600 transition-colors">{toast.title}</p>
                                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{toast.message}</p>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); setToast(null); }}
                                className="bg-gray-800 hover:bg-black p-2 text-gray-400 hover:text-white transition-all shrink-0 active:scale-95 border border-gray-700 rounded-lg"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ConsumerLayout;
