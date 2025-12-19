import React, { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import '../styles/design-system.css';

const ConsumerLayout: React.FC = () => {
    const { itemCount, notification, clearNotification } = useCart();
    const { user, logout } = useAuth();
    const { unreadCount } = useNotifications();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
            setSearchQuery('');
        }
    };

    return (
        <div className="min-h-screen bg-[var(--surface-0)] relative">
            {/* TOP NAVIGATION BAR */}
            <header className="fixed top-0 left-0 right-0 h-[calc(3.5rem+var(--safe-area-top))] pt-safe bg-white border-b border-[var(--glass-border)] z-50 px-4 flex items-center justify-between gap-4">
                {/* LEFT: Logo + Search */}
                <div className="flex items-center gap-6 flex-1 max-w-3xl">
                    {/* Logo (Home) */}
                    <Link to="/" className="flex flex-col leading-tight group shrink-0">
                        <span className="text-xl font-bold bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-secondary)] bg-clip-text text-transparent group-hover:brightness-110 transition-all">Spendigo</span>
                        <span className="text-xs font-semibold text-[var(--text-main)] tracking-widest uppercase">SmartCart</span>
                    </Link>

                    {/* Expanded Search Bar */}
                    <form onSubmit={handleSearch} className="hidden md:flex flex-1 relative group max-w-lg">
                        <input
                            type="text"
                            placeholder="Search Products"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-10 pl-10 pr-4 bg-[var(--surface-1)] border border-transparent rounded-full text-sm focus:bg-white focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--brand-primary)]/10 transition-all outline-none group-hover:bg-[var(--surface-2)]"
                        />
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                    </form>
                </div>

                {/* RIGHT: Actions (Optimizer, Cart, Notifications, Profile) */}
                <div className="flex items-center gap-2 shrink-0">
                    {/* SmartCart Optimizer */}
                    <NavLink to="/smartcart" className={({ isActive }) => `hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium shrink-0 transition-colors ${isActive ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-2)]'}`}>
                        <span className="text-base">✨</span>
                        <span>SmartCart Optimizer</span>
                    </NavLink>

                    <div className="hidden md:block w-px h-6 bg-[var(--glass-border)] mx-1"></div>

                    {/* Desktop Cart */}
                    <NavLink to="/cart" className={({ isActive }) => `hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-2)]'}`}>
                        <span className="text-lg">🛒</span>
                        <span>Cart</span>
                        {itemCount > 0 && (
                            <span className="bg-[var(--brand-primary)] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                {itemCount}
                            </span>
                        )}
                    </NavLink>

                    {/* Context Links (Authorized Only) */}
                    {user?.role === 'merchant' && (
                        <Link to="/merchant/dashboard" className="hidden lg:flex items-center gap-1 text-xs font-bold text-[var(--brand-primary)] bg-[var(--brand-primary)]/10 px-3 py-1.5 rounded-full hover:bg-[var(--brand-primary)] hover:text-white transition-colors">
                            <span className="text-lg">💼</span> Dashboard
                        </Link>
                    )}
                    {user?.role === 'admin' && (
                        <Link to="/admin/dashboard" className="hidden lg:flex items-center gap-1 text-xs font-bold text-purple-600 bg-purple-100 px-3 py-1.5 rounded-full hover:bg-purple-600 hover:text-white transition-colors">
                            <span className="text-lg">🛡️</span> System
                        </Link>
                    )}

                    {/* Notifications */}
                    <Link to="/notifications" className="relative w-10 h-10 rounded-full hover:bg-[var(--surface-2)] flex items-center justify-center transition-colors">
                        <span className="text-lg">🔔</span>
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                        )}
                    </Link>

                    {/* Profile / Auth */}
                    {user ? (
                        <div className="flex items-center gap-2">
                            <Link to="/profile" className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors">
                                <div className="w-8 h-8 rounded-full bg-[var(--brand-primary)] text-white flex items-center justify-center text-sm font-bold">
                                    {user.avatar || '👤'}
                                </div>
                                <span className="text-sm font-medium text-[var(--text-main)]">{user.name.split(' ')[0]}</span>
                            </Link>
                            <button
                                onClick={logout}
                                className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-red-50 text-[var(--text-muted)] hover:text-red-500 transition-colors"
                                title="Sign Out"
                            >
                                🚪
                            </button>
                        </div>
                    ) : (
                        <Link to="/login" className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-full bg-[var(--brand-primary)] text-white text-sm font-bold shadow-lg shadow-[var(--brand-primary)]/20 hover:brightness-110 transition-all">
                            Sign In
                        </Link>
                    )}

                    {/* Mobile Cart Icon */}
                    <Link to="/cart" className="md:hidden relative w-10 h-10 rounded-full bg-[var(--surface-2)] flex items-center justify-center">
                        <span className="text-lg">🛒</span>
                        {itemCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--brand-secondary)] text-white text-[10px] font-bold flex items-center justify-center rounded-full">
                                {itemCount}
                            </span>
                        )}
                    </Link>
                </div>
            </header>

            {/* MAIN CONTENT AREA */}
            <main className="pt-[calc(3.5rem+var(--safe-area-top))]">
                <Outlet />
            </main>

            {/* MOBILE BOTTOM TAB BAR */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(4rem+var(--safe-area-bottom))] pb-safe bg-white border-t border-[var(--glass-border)] z-50 flex items-center justify-around">
                <NavLink to="/" end className={({ isActive }) => `flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${isActive ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)]'}`}>
                    <span className="text-xl">🏠</span>
                    <span className="text-[10px] font-medium">Home</span>
                </NavLink>

                <NavLink to="/search" className={({ isActive }) => `flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${isActive ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)]'}`}>
                    <span className="text-xl">🔍</span>
                    <span className="text-[10px] font-medium">Search</span>
                </NavLink>

                <NavLink to="/cart" className={({ isActive }) => `flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${isActive ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)]'}`}>
                    <div className="relative">
                        <span className="text-xl">🛒</span>
                        {itemCount > 0 && (
                            <span className="absolute -top-1 -right-2 w-4 h-4 bg-red-500 text-white text-[8px] font-bold flex items-center justify-center rounded-full">
                                {itemCount}
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] font-medium">Cart</span>
                </NavLink>

                <NavLink to="/profile" className={({ isActive }) => `flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors ${isActive ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)]'}`}>
                    <span className="text-xl">👤</span>
                    <span className="text-[10px] font-medium">Profile</span>
                </NavLink>
            </nav>

            {/* Bottom padding for mobile nav */}
            <div className="md:hidden h-[calc(4rem+var(--safe-area-bottom))]"></div>

            {/* GLOBAL NOTIFICATION TOAST */}
            {notification && (
                <div className="fixed bottom-24 left-4 right-4 z-[100] animate-slide-up pointer-events-none">
                    <div className={`max-w-md mx-auto glass-panel p-4 text-white shadow-2xl flex items-center justify-between border-none pointer-events-auto ${notification.type === 'success' ? 'bg-[var(--status-success)]/95 backdrop-blur-md' : 'bg-orange-500/95 backdrop-blur-md'
                        }`}>
                        <div className="flex-1 mr-4">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xl">
                                    {notification.type === 'success' ? '✅' : '🗑️'}
                                </span>
                                <p className="font-bold text-sm">{notification.message}</p>
                            </div>

                            {/* Savings Info */}
                            {notification.savings && notification.savings > 0 && (
                                <div className="text-xs bg-white/20 rounded px-2 py-1 mt-1 inline-flex items-center gap-1 animate-pulse">
                                    <span>🔥</span>
                                    <span className="font-bold">You saved ${notification.savings}</span>
                                    <span className="opacity-80">vs {notification.competitor?.name}</span>
                                </div>
                            )}

                            {/* Competitor Warning (if item was more expensive) */}
                            {!notification.savings && notification.competitor && notification.type === 'success' && (
                                <div className="text-xs text-white/90 mt-1 flex items-center gap-1">
                                    <span>💡</span>
                                    <span>Available for ${notification.competitor.price} at {notification.competitor.name}</span>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={clearNotification}
                            className="bg-white/20 hover:bg-white/30 p-1.5 rounded-full transition-colors shrink-0"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConsumerLayout;
