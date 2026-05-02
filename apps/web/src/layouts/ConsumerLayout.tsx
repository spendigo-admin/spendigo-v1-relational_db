import React, { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import NotificationPopover from '../components/NotificationPopover';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import '../styles/design-system.css';
import { analytics, db } from '../lib/firebase';
import { logEvent } from 'firebase/analytics';
import { doc, onSnapshot } from 'firebase/firestore';

const ConsumerLayout: React.FC = () => {
    const { itemCount, notification, clearNotification } = useCart();
    const { user, logout } = useAuth();
    const { unreadCount, toast, setToast } = useNotifications();
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

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
            setSearchQuery('');
        }
    };

    // STRICT ACCESS CONTROL: Redirect merchants/admins to their dashboards
    // They are not allowed to view the shopper UI.
    React.useEffect(() => {
        if (user?.role === 'merchant') {
            navigate('/merchant/dashboard', { replace: true });
        } else if (user?.role === 'admin') {
            navigate('/admin/dashboard', { replace: true });
        }
    }, [user, navigate]);

    return (
        <div className="min-h-screen bg-gray-50/30 relative flex flex-col">
            {/* TOP NAVIGATION BAR */}
            <header className="fixed top-0 left-0 right-0 h-[calc(4rem+var(--safe-area-top))] pt-safe bg-white border-b-2 border-gray-200 z-50 px-4 flex items-center justify-between gap-4 shadow-sm">
                {/* LEFT: Logo + Search */}
                <div className="flex items-center gap-8 flex-1 max-w-4xl">
                    {/* PREMIUM RETAIL LOGO */}
                    <Link to="/" className="flex items-center gap-3 group shrink-0">
                        <img src="/app-icon.png" alt="Spendigo Logo" style={{width: 40, height: 40, borderRadius: 8}} className="group-hover:scale-105 transition-transform" />
                        <div className="flex flex-col leading-none">
                            <span className="text-2xl font-black text-gray-900 italic tracking-tighter group-hover:text-blue-600 transition-colors">Spendigo</span>
                            <span className="text-[10px] font-semibold text-gray-500 tracking-widest mt-1">SmartCart AI</span>
                        </div>
                    </Link>

                    {/* Expanded Retail Search Bar */}
                    {location.pathname !== '/search' && (
                        <form onSubmit={handleSearch} className="hidden md:flex flex-1 relative group max-w-lg">
                            <input
                                type="text"
                                placeholder="Search marketplace..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-10 pl-12 pr-4 bg-gray-100 border-2 border-transparent text-sm text-gray-900 font-medium placeholder-gray-400 rounded-full focus:bg-white focus:border-blue-600 transition-all outline-none"
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-blue-600 transition-colors text-sm">🔍</span>
                        </form>
                    )}
                </div>

                {/* RIGHT: Actions (Optimizer, Cart, Notifications, Profile) */}
                <div className="flex items-center gap-3 shrink-0">
                    {/* Compare Tool */}
                    {flyerIngestionEnabled && (
                        <NavLink to="/compare" className={({ isActive }) => `hidden lg:flex items-center gap-2 px-4 py-2 text-[10px] font-black tracking-widest transition-all skew-x-[-12deg] border-2 ${isActive ? 'bg-gray-100 text-black border-black shadow-sm' : 'text-gray-500 border-gray-200 hover:text-black hover:border-gray-400'}`}>
                            <span className="skew-x-[12deg] text-xs">⚖️</span>
                            <span className="skew-x-[12deg]">Compare</span>
                        </NavLink>
                    )}

                    {/* SmartCart Optimizer Tool */}
                    <NavLink to="/smartcart" className={({ isActive }) => `hidden lg:flex items-center gap-2 px-4 py-2 text-[10px] font-black tracking-widest transition-all skew-x-[-12deg] border-2 ${isActive ? 'bg-gray-100 text-black border-black shadow-sm' : 'text-gray-500 border-gray-200 hover:text-black hover:border-gray-400'}`}>
                        <span className="skew-x-[12deg] text-xs">✨</span>
                        <span className="skew-x-[12deg]">Optimizer</span>
                    </NavLink>

                    <div className="hidden md:block w-px h-8 bg-gray-200 mx-2"></div>

                    {/* Desktop Cart */}
                    <NavLink to="/cart" className={({ isActive }) => `hidden md:flex items-center gap-2 px-5 py-2 text-[10px] font-black tracking-widest transition-all border-2 skew-x-[-12deg] ${isActive ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-900 border-gray-200 hover:border-blue-600'}`}>
                        <div className="skew-x-[12deg] flex items-center gap-2 relative">
                            <span className="text-sm">🛒</span>
                            <span>{t('cart')}</span>
                            {itemCount > 0 && (
                                <span className="absolute -top-3 -right-6 bg-blue-600 text-white border-2 border-white text-[9px] px-1.5 py-0.5 rounded-full font-black animate-pulse">
                                    {itemCount}
                                </span>
                            )}
                        </div>
                    </NavLink>

                    {/* Context Links (Authorized Only) */}
                    {user?.role === 'merchant' && (
                        <Link to="/merchant/dashboard" className="hidden lg:flex items-center gap-1 text-[10px] font-black text-black bg-gray-100 border border-gray-200 px-4 py-2 tracking-widest hover:bg-gray-200 transition-colors skew-x-[-12deg]">
                            <span className="skew-x-[12deg]">💼 Merchant</span>
                        </Link>
                    )}
                    {user?.role === 'admin' && (
                        <Link to="/admin/dashboard" className="hidden lg:flex items-center gap-1 text-[10px] font-black text-white bg-purple-600 px-4 py-2 tracking-widest hover:bg-purple-700 transition-colors skew-x-[-12deg] shadow-md">
                            <span className="skew-x-[12deg]">🛡️ System</span>
                        </Link>
                    )}

                    {/* Notifications Popover */}
                    <div className="hidden sm:block">
                        <NotificationPopover />
                    </div>

                    {/* Mobile Inbox Link */}
                    <Link to="/notifications" className={`sm:hidden relative w-10 h-10 flex items-center justify-center shadow-md transition-all border-2 bg-white skew-x-[-12deg] ${location.pathname === '/notifications' ? 'border-blue-600' : 'border-gray-200 hover:border-blue-600'}`}>
                        <span className="text-sm skew-x-[12deg]">🔔</span>
                        {unreadCount > 0 && (
                            <span className="absolute -top-2 -right-2 w-3 h-3 border-2 border-white bg-blue-600 skew-x-[12deg] shadow-sm animate-pulse"></span>
                        )}
                    </Link>

                    <div className="hidden sm:block">
                        <LanguageSwitcher />
                    </div>

                    {/* Profile / Auth */}
                    {user ? (
                        <div className="hidden md:block relative group ml-2">
                            <Link
                                to="/profile"
                                className="flex items-center gap-3 px-3 py-1.5 hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
                                title={user.name}
                            >
                                <span className="hidden lg:block text-xs font-semibold text-gray-900 tracking-wide text-right">
                                    {user.name.split(' ')[0]}<br/><span className="text-gray-500 text-[10px] font-medium">Shopper</span>
                                </span>
                                <div className="w-8 h-8 bg-gray-900 text-white flex items-center justify-center text-xs font-black shadow-sm">
                                    <span>{user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</span>
                                </div>
                            </Link>

                            {/* Dropdown Menu (hidden on mobile, accessible on desktop) */}
                            <div className="hidden sm:block absolute right-0 top-12 w-56 bg-white border-2 border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl">
                                <div className="p-4 border-b border-gray-100 bg-gray-50">
                                <p className="text-xs font-semibold text-gray-900 tracking-wide truncate">{user.name}</p>
                                    <p className="text-[10px] text-gray-500 font-medium tracking-wide truncate mt-1">{user.email}</p>
                                </div>
                                <div>
                                    <Link
                                        to="/profile"
                                        className="block px-5 py-3 text-xs font-medium text-gray-700 tracking-wide hover:bg-blue-50 hover:text-blue-700 transition-colors"
                                    >
                                        → {t('myProfile')}
                                    </Link>
                                    <Link
                                        to="/profile"
                                        state={{ activeTab: 'orders' }}
                                        className="block px-5 py-3 text-xs font-medium text-gray-700 tracking-wide hover:bg-blue-50 hover:text-blue-700 transition-colors"
                                    >
                                        → {t('orderHistory')}
                                    </Link>
                                    <button
                                        onClick={logout}
                                        className="w-full text-left px-5 py-3 text-xs font-medium text-blue-600 tracking-wide hover:bg-blue-50 transition-colors border-t border-gray-100"
                                    >
                                        × {t('signOut')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <Link to="/login" className="hidden sm:inline-flex items-center justify-center px-6 py-2.5 bg-blue-600 text-white text-[10px] font-black tracking-widest shadow-md hover:bg-blue-700 transition-all ml-2">
                            <span>{t('signIn')}</span>
                        </Link>
                    )}

                    {/* Mobile Cart Icon */}
                    <Link to="/cart" className={`md:hidden relative w-10 h-10 flex items-center justify-center shadow-md ml-2 transition-all border-2 bg-white skew-x-[-12deg] ${location.pathname === '/cart' ? 'border-blue-600 text-blue-600' : 'border-gray-200 text-gray-900 hover:border-blue-600'}`}>
                        <span className="text-sm skew-x-[12deg]">🛒</span>
                        {itemCount > 0 && (
                            <span className={`absolute -top-3 -right-2 w-5 h-5 text-[10px] font-black border-2 flex items-center justify-center shadow-sm skew-x-[12deg] animate-pulse ${location.pathname === '/cart' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-900 border-gray-200'}`}>
                                {itemCount}
                            </span>
                        )}
                    </Link>
                </div>
            </header>

            {/* MAIN CONTENT AREA */}
            <main className="pt-[calc(4rem+var(--safe-area-top))] min-h-[calc(100vh-16rem)] pb-8 flex-1 animate-fade-in">
                <Outlet />
            </main>

            {/* GLOBAL RETAIL FOOTER */}
            <footer className="bg-white border-t-2 border-gray-200 pb-[calc(5rem+var(--safe-area-bottom))] md:pb-4 pt-6 px-4">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center md:items-start justify-between gap-4 text-center md:text-left">
                    <div className="max-w-xs">
                        <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
                            <img src="/app-icon.png" alt="Spendigo Logo" style={{width: 32, height: 32, borderRadius: 6}} />
                            <span className="text-3xl font-black text-gray-900 italic tracking-tighter">Spendigo</span>
                        </div>
                        <p className="text-gray-500 text-xs font-medium tracking-wide leading-relaxed">
                            The high-performance local marketplace. Powered by SmartCart AI.
                        </p>
                    </div>

                    <div className="flex flex-wrap justify-center md:justify-end gap-x-12 gap-y-4">
                        <div className="flex flex-col gap-2">
                    <span className="hidden md:inline text-[10px] font-black text-gray-900 tracking-widest mb-1 border-b border-gray-200 pb-1 inline-block">Platform</span>
                            <Link to="/how-it-works" className="text-xs text-gray-500 font-bold hover:text-gray-900 tracking-wide transition-colors">How it Works</Link>
                            <Link to="/careers" className="text-xs text-gray-500 font-bold hover:text-gray-900 tracking-wide transition-colors">Careers</Link>
                            <Link to="/partner" className="text-xs text-gray-500 font-bold hover:text-blue-600 tracking-wide transition-colors">Partner with Us →</Link>
                        </div>
                        <div className="flex flex-col gap-2">
                            <span className="hidden md:inline text-[10px] font-black text-gray-900 tracking-widest mb-1 border-b border-gray-200 pb-1 inline-block">Legal</span>
                            <Link to="/privacy" className="text-xs text-gray-500 font-bold hover:text-gray-900 tracking-wide transition-colors">Privacy Policy</Link>
                            <Link to="/terms" className="text-xs text-gray-500 font-bold hover:text-gray-900 tracking-wide transition-colors">Terms of Service</Link>
                        </div>
                    </div>
                </div>
                
                <div className="max-w-7xl mx-auto mt-6 pt-3 border-t border-gray-100 text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-3">
                    <p className="text-[10px] font-medium text-gray-400 tracking-wide">&copy; {new Date().getFullYear()} Spendigo Inc. All rights reserved.</p>
                    <div className="flex items-center gap-4 text-2xl hover:scale-110 transition-transform cursor-default">
                        🍁
                    </div>
                </div>
            </footer>

            {/* HIGH-IMPACT MOBILE BOTTOM TAB BAR */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-[var(--glass-border)] z-50 flex items-stretch shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
                <NavLink to="/" end className={({ isActive }) => `flex flex-col items-center justify-center flex-1 transition-colors duration-150 gap-0.5 ${isActive ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
                    {({ isActive }: any) => (
                        <React.Fragment>
                            <div className={`w-10 h-7 flex items-center justify-center rounded-xl transition-colors duration-150 ${isActive ? 'bg-[var(--brand-primary-light)]' : ''}`}>
                                <span className="text-lg">🏠</span>
                            </div>
                            <span className="text-[11px] font-medium">{t('homeNav')}</span>
                        </React.Fragment>
                    )}
                </NavLink>

                <NavLink to="/search" className={({ isActive }) => `flex flex-col items-center justify-center flex-1 transition-colors duration-150 gap-0.5 ${isActive ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
                    {({ isActive }: any) => (
                        <React.Fragment>
                            <div className={`w-10 h-7 flex items-center justify-center rounded-xl transition-colors duration-150 ${isActive ? 'bg-[var(--brand-primary-light)]' : ''}`}>
                                <span className="text-lg">🔍</span>
                            </div>
                            <span className="text-[11px] font-medium">{t('searchNav')}</span>
                        </React.Fragment>
                    )}
                </NavLink>

                <NavLink to="/smartcart" className={({ isActive }) => `flex flex-col items-center justify-center flex-1 transition-colors duration-150 gap-0.5 relative ${isActive ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
                    {({ isActive }: any) => (
                        <React.Fragment>
                            <div className={`w-10 h-7 flex items-center justify-center rounded-xl transition-colors duration-150 ${isActive ? 'bg-[var(--brand-primary-light)]' : ''}`}>
                                <span className={`text-lg ${isActive ? 'animate-pulse' : ''}`}>✨</span>
                            </div>
                            <span className="text-[11px] font-medium">{t('smartCartNav')}</span>
                        </React.Fragment>
                    )}
                </NavLink>

                {flyerIngestionEnabled && (
                    <NavLink to="/compare" className={({ isActive }) => `flex flex-col items-center justify-center flex-1 transition-colors duration-150 gap-0.5 ${isActive ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
                        {({ isActive }: any) => (
                            <React.Fragment>
                                <div className={`w-10 h-7 flex items-center justify-center rounded-xl transition-colors duration-150 ${isActive ? 'bg-[var(--brand-primary-light)]' : ''}`}>
                                    <span className="text-lg">⚖️</span>
                                </div>
                                <span className="text-[11px] font-medium">Compare</span>
                            </React.Fragment>
                        )}
                    </NavLink>
                )}



                <NavLink to="/profile" className={({ isActive }) => `flex flex-col items-center justify-center flex-1 transition-colors duration-150 gap-0.5 ${isActive ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}>
                    {({ isActive }: any) => (
                        <React.Fragment>
                            <div className={`w-10 h-7 flex items-center justify-center rounded-xl transition-colors duration-150 ${isActive ? 'bg-[var(--brand-primary-light)]' : ''}`}>
                                <span className="text-lg">👤</span>
                            </div>
                            <span className="text-[11px] font-medium">{t('profileNav')}</span>
                        </React.Fragment>
                    )}
                </NavLink>
            </nav>

            {/* Bottom padding for mobile nav */}
            <div className="md:hidden h-20"></div>

            {/* GLOBAL NOTIFICATION TOAST (Cart) */}
            {notification && (
                <div className="fixed bottom-24 left-4 right-4 md:bottom-8 md:left-auto md:right-8 z-[100] animate-slide-up pointer-events-none md:max-w-md w-full">
                    <div className={`p-5 shadow-2xl flex items-center justify-between border-b-4 pointer-events-auto skew-x-[-2deg] ${notification.type === 'success' ? 'bg-gray-900 border-green-500 text-white' : 'bg-gray-900 border-red-600 text-white'
                        }`}>
                        <div className="flex-1 mr-4 skew-x-[2deg]">
                            <div className="flex items-start gap-4 mb-1">
                                <span className="text-2xl mt-1">
                                    {notification.type === 'success' ? '✅' : '🗑️'}
                                </span>
                                <div>
                                    <p className={`font-black text-sm tracking-widest ${notification.type === 'success' ? 'text-white' : 'text-red-400'}`}>{notification.message}</p>
                                    
                                    {/* Savings Info */}
                                    {notification.savings && notification.savings > 0 && (
                                        <div className="text-[10px] bg-green-500 text-black px-2 py-1 mt-2 inline-flex items-center gap-2 font-black tracking-widest shadow-inner">
                                            <span className="animate-pulse">🔥</span>
                                            <span>Saved ${notification.savings}</span>
                                            <span className="opacity-70 truncate max-w-[120px]">vs {notification.competitor?.name}</span>
                                        </div>
                                    )}

                                    {/* Competitor Warning */}
                                    {!notification.savings && notification.competitor && notification.type === 'success' && (
                                        <div className="text-[10px] text-white/70 mt-2 flex justify-start items-center gap-2 tracking-widest font-bold">
                                            <span>💡 Available for ${notification.competitor.price} at {notification.competitor.name}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={clearNotification}
                            className={`p-2 text-white transition-all shrink-0 skew-x-[2deg] hover:scale-110 active:scale-95 ${notification.type === 'success' ? 'bg-white/10 hover:bg-green-600' : 'bg-white/10 hover:bg-red-600'}`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* SYSTEM TOAST (Notification Context) */}
            {toast && (
                <div className="fixed bottom-24 left-4 right-4 md:bottom-8 md:left-auto md:right-8 z-[110] animate-slide-up pointer-events-none md:max-w-md w-full">
                    <div className={`p-4 text-white shadow-2xl flex items-center justify-between border-l-4 pointer-events-auto ${toast.type === 'alert' ? 'bg-gray-900 border-red-600' : 'bg-gray-900 border-white'
                        }`}>
                        <div className="flex-1 mr-4">
                            <div className="flex items-center gap-3">
                                <span className={toast.type === 'alert' ? 'text-red-500 text-2xl animate-pulse' : 'text-white text-2xl'}>
                                    {toast.type === 'alert' ? '🚨' : '🔔'}
                                </span>
                                <div>
                                    <p className="font-black text-xs tracking-widest text-white">{toast.title}</p>
                                    <p className="text-[10px] text-gray-400 font-bold tracking-wide mt-1">{toast.message}</p>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setToast(null)}
                            className="bg-gray-800 hover:bg-black p-2 text-gray-400 hover:text-white transition-all shrink-0 active:scale-95 border border-gray-700"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConsumerLayout;
