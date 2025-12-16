import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import '../styles/design-system.css';

const MerchantLayout: React.FC = () => {
    return (
        <div className="min-h-screen grid grid-cols-[250px_1fr] bg-[var(--surface-0)]">
            {/* Sidebar */}
            <aside className="border-r border-[var(--glass-border)] bg-white p-4 flex flex-col">
                <div className="mb-8 p-2">
                    <div className="flex flex-col">
                        <span className="text-xl font-bold text-[var(--brand-primary)]">Spendigo</span>
                        <span className="text-xs font-semibold text-[var(--text-main)] tracking-widest uppercase">MERCHANT</span>
                    </div>
                </div>

                <nav className="flex-1 space-y-1">
                    <NavLink
                        to="/merchant/dashboard"
                        className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg font-medium transition-colors ${isActive ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                    >
                        <span>📊</span> Dashboard
                    </NavLink>
                    <NavLink
                        to="/merchant/orders"
                        className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg font-medium transition-colors ${isActive ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                    >
                        <span>📋</span> Orders
                    </NavLink>
                    <NavLink
                        to="/merchant/products"
                        className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg font-medium transition-colors ${isActive ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                    >
                        <span>📦</span> Products
                    </NavLink>
                    <NavLink
                        to="/merchant/flyers"
                        className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg font-medium transition-colors ${isActive ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                    >
                        <span>📰</span> Flyers
                    </NavLink>
                    <NavLink
                        to="/merchant/deals"
                        className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg font-medium transition-colors ${isActive ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                    >
                        <span>🏷️</span> Deals
                    </NavLink>
                    <NavLink
                        to="/merchant/onboarding"
                        className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg font-medium transition-colors ${isActive ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                    >
                        <span>⚙️</span> Settings
                    </NavLink>
                </nav>

                <div className="border-t border-[var(--glass-border)] pt-4 mt-auto">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-sm font-medium text-[var(--text-main)]">Store Online</span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">FreshMart Demo Store</p>
                    <p className="text-xs text-[var(--text-muted)]">merchant@example.com</p>
                </div>
            </aside>

            {/* Main Content */}
            <main className="overflow-y-auto bg-[var(--surface-1)]">
                <Outlet />
            </main>
        </div>
    );
};

export default MerchantLayout;
