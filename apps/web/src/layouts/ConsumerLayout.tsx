import React from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import '../styles/design-system.css';

const ConsumerLayout: React.FC = () => {
    const { itemCount } = useCart();

    return (
        <div className="min-h-screen bg-[var(--surface-0)] relative">
            {/* TOP NAVIGATION BAR */}
            <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-[var(--glass-border)] z-50 px-4 flex items-center justify-between">
                {/* LEFT: Logo + Nav */}
                <div className="flex items-center gap-6">
                    <Link to="/" className="flex flex-col leading-tight">
                        <span className="text-xl font-bold bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-secondary)] bg-clip-text text-transparent">Spendigo</span>
                        <span className="text-xs font-semibold text-[var(--text-main)] tracking-widest uppercase">SmartCart</span>
                    </Link>

                    {/* Desktop Nav Links */}
                    <nav className="hidden md:flex items-center gap-1">
                        <NavLink to="/" end className={({ isActive }) => `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-2)]'}`}>
                            🏠 Home
                        </NavLink>
                        <NavLink to="/search" className={({ isActive }) => `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-2)]'}`}>
                            🔍 Search
                        </NavLink>
                        <NavLink to="/smartcart" className={({ isActive }) => `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-2)]'}`}>
                            ✨ SmartCart
                        </NavLink>
                        <NavLink to="/cart" className={({ isActive }) => `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-2)]'}`}>
                            🛒 Cart {itemCount > 0 && `(${itemCount})`}
                        </NavLink>
                    </nav>
                </div>

                {/* CENTER: Location (Mobile) */}
                <div className="md:hidden flex items-center gap-1 text-sm">
                    <span>📍</span>
                    <span className="text-[var(--text-muted)] truncate max-w-[100px]">Toronto, ON</span>
                </div>

                {/* RIGHT: Actions */}
                <div className="flex items-center gap-2">
                    {/* Notifications */}
                    <Link to="/notifications" className="relative w-10 h-10 rounded-full hover:bg-[var(--surface-2)] flex items-center justify-center transition-colors">
                        <span className="text-lg">🔔</span>
                        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                    </Link>

                    {/* Profile */}
                    <Link to="/profile" className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors">
                        <span className="w-8 h-8 rounded-full bg-[var(--brand-primary)] text-white flex items-center justify-center text-sm font-bold">JD</span>
                        <span className="text-sm font-medium text-[var(--text-main)]">John</span>
                    </Link>

                    {/* Mobile Cart */}
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
            <main className="pt-14">
                <Outlet />
            </main>

            {/* MOBILE BOTTOM TAB BAR */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-[var(--glass-border)] z-50 flex items-center justify-around">
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
            <div className="md:hidden h-16"></div>
        </div>
    );
};

export default ConsumerLayout;
