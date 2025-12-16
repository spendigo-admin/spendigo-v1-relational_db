import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../../../../packages/shared/src/auth/types';
import '../styles/design-system.css';

const MerchantLayout: React.FC = () => {
    const { user, loading, checkRole } = useAuth();

    if (loading) return <div className="p-8 text-center">Loading Secure Context...</div>;

    // Strict RBAC
    if (!user || !checkRole(UserRole.MERCHANT)) {
        return <Navigate to="/auth/login" replace />;
    }

    // Mandatory Email Verification Gate
    if (!user.emailVerified) {
        return (
            <div className="min-h-screen bg-[var(--surface-0)] flex items-center justify-center p-4">
                <div className="glass-panel p-8 max-w-md text-center">
                    <h1 className="text-[var(--status-warning)] mb-4">Verification Required</h1>
                    <p>Please verify your email address to access the Merchant Console.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen grid grid-cols-[250px_1fr] bg-[var(--surface-0)]">
            {/* Sidebar */}
            <aside className="border-r border-[var(--glass-border)] bg-[var(--surface-1)] p-4 flex flex-col">
                <div className="mb-8 p-2">
                    <h2 className="text-xl font-bold tracking-tight text-[var(--brand-primary)]">SmartCart</h2>
                    <span className="text-xs uppercase tracking-widest text-[var(--text-muted)]">Merchant</span>
                </div>

                <nav className="flex-1 space-y-2">
                    <a href="/merchant/dashboard" className="block p-3 rounded-lg bg-[var(--surface-2)] text-[var(--text-main)] font-medium">Dashboard</a>
                    <a href="/merchant/products" className="block p-3 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)] transition-colors">Products</a>
                    <a href="/merchant/orders" className="block p-3 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)] transition-colors">Orders</a>
                    <a href="/merchant/finance" className="block p-3 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)] transition-colors">Payouts</a>
                </nav>

                <div className="border-t border-[var(--glass-border)] pt-4 mt-auto">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-2 h-2 rounded-full bg-[var(--status-success)]"></div>
                        <span className="text-sm">Store Online</span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] truncate">{user.email}</p>
                </div>
            </aside>

            {/* Main Content */}
            <main className="p-8 overflow-y-auto">
                <Outlet />
            </main>
        </div>
    );
};

export default MerchantLayout;
