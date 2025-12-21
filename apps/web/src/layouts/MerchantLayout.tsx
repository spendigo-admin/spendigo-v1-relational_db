import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/design-system.css';

const MerchantLayout: React.FC = () => {
    const { user, logout, can } = useAuth();
    const location = useLocation();
    const searchParams = new URL(window.location.href).searchParams;
    const currentTab = searchParams.get('tab');
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

    // Close sidebar on route change
    React.useEffect(() => {
        setIsSidebarOpen(false);
    }, [location]);

    const isTeamActive = location.pathname === '/merchant/settings' && currentTab === 'team';
    const isSettingsActive = location.pathname === '/merchant/settings' && currentTab !== 'team';

    return (
        <div className="min-h-screen bg-[var(--surface-0)] flex flex-col md:grid md:grid-cols-[250px_1fr]">
            {/* Mobile Header */}
            <header className="md:hidden h-16 bg-white border-b border-[var(--glass-border)] flex items-center justify-between px-4 sticky top-0 z-20">
                <div className="flex flex-col">
                    <span className="text-lg font-bold text-[var(--brand-primary)]">Spendigo Merchant</span>
                </div>
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-2xl text-[var(--text-main)]">
                    {isSidebarOpen ? '✕' : '☰'}
                </button>
            </header>

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-30 w-[250px] bg-white border-r border-[var(--glass-border)] flex flex-col transition-transform duration-300 ease-in-out
                md:translate-x-0 md:static md:h-screen
                ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
            `}>
                <div className="p-6 mb-2 hidden md:block">
                    <div className="flex flex-col">
                        <span className="text-xl font-bold text-[var(--brand-primary)]">Spendigo</span>
                        <span className="text-xs font-semibold text-[var(--text-main)] tracking-widest uppercase">MERCHANT</span>
                    </div>
                </div>

                {/* Mobile-only spacer */}
                <div className="md:hidden h-4"></div>

                <nav className="flex-1 space-y-1 px-4 overflow-y-auto">
                    <NavLink
                        to="/merchant/dashboard"
                        className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg font-medium transition-colors ${isActive ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                    >
                        <span>📊</span> Dashboard
                    </NavLink>
                    {can('orders:read') && (
                        <NavLink
                            to="/merchant/orders"
                            className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg font-medium transition-colors ${isActive ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                        >
                            <span>📋</span> Orders
                        </NavLink>
                    )}
                    <NavLink
                        to="/merchant/products"
                        className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg font-medium transition-colors ${isActive ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                    >
                        <span>📦</span> Products
                    </NavLink>
                    {can('flyers:write') && (
                        <NavLink
                            to="/merchant/flyers"
                            className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg font-medium transition-colors ${isActive ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                        >
                            <span>📰</span> Flyers
                        </NavLink>
                    )}
                    {can('deals:write') && (
                        <NavLink
                            to="/merchant/deals"
                            className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg font-medium transition-colors ${isActive ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                        >
                            <span>🏷️</span> Deals
                        </NavLink>
                    )}
                    {can('team:manage') && (
                        <NavLink
                            to="/merchant/settings?tab=team"
                            className={`flex items-center gap-3 p-3 rounded-lg font-medium transition-colors ${isTeamActive ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                        >
                            <span>👥</span> Team
                        </NavLink>
                    )}
                    <NavLink
                        to="/merchant/subscription"
                        className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg font-medium transition-colors ${isActive ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                    >
                        <span>💳</span> Billing & Plan
                    </NavLink>
                    <NavLink
                        to="/merchant/settings"
                        className={`flex items-center gap-3 p-3 rounded-lg font-medium transition-colors ${isSettingsActive ? 'bg-[var(--brand-primary)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)]'}`}
                    >
                        <span>⚙️</span> Settings
                    </NavLink>
                </nav>

                <div className="border-t border-[var(--glass-border)] my-2 mx-4"></div>

                <nav className="space-y-1 px-4">
                    <NavLink
                        to="/"
                        className="flex items-center gap-3 p-3 rounded-lg font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)] transition-colors"
                    >
                        <span>🏠</span> Back to Spendigo
                    </NavLink>
                </nav>

                <div className="border-t border-[var(--glass-border)] pt-4 mt-auto p-4 pb-safe">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-sm font-medium text-[var(--text-main)]">Store Online</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-[var(--text-main)] font-bold truncate max-w-[150px]">{user?.storeName || 'My Store'}</p>
                            <p className="text-xs text-[var(--text-muted)] truncate max-w-[150px]">{user?.email}</p>
                        </div>
                        <button onClick={logout} className="text-xs text-red-500 hover:text-red-700 font-bold" title="Logout">
                            🚪
                        </button>
                    </div>
                </div>
            </aside>

            {/* Overlay for mobile sidebar */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 md:hidden animate-fade-in"
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-[var(--surface-1)] h-[calc(100vh-64px)] md:h-screen">
                <Outlet />
            </main>
        </div>
    );
};

export default MerchantLayout;
