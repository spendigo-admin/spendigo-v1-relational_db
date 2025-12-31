import React from 'react';
import { NavLink, Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMarketplace } from '../context/MarketplaceContext';
import NotificationPopover from '../components/NotificationPopover';
import '../styles/design-system.css';

const MerchantLayout: React.FC = () => {
    const { user, logout, can } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const searchParams = new URL(window.location.href).searchParams;
    const currentTab = searchParams.get('tab');
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

    // Close sidebar on route change
    React.useEffect(() => {
        setIsSidebarOpen(false);
    }, [location]);

    const { stores, loading: storesLoading } = useMarketplace();

    // STRICT SECURITY CHECK
    React.useEffect(() => {
        if (!user) {
            // Not logged in -> Login
            window.location.href = '/login?returnUrl=' + encodeURIComponent(location.pathname);
            return;
        }

        if (user.role !== 'merchant') {
            // Logged in but WRONG role -> Home
            window.location.href = '/';
            return;
        }

        // ORPHANED MERCHANT CHECK (Store Deleted or Not Created)
        // If merchant has no storeId OR storeId points to non-existent store
        // Redirect to Onboarding (unless already there)
        if (!storesLoading && location.pathname !== '/merchant/onboarding') {
            const hasValidStore = user.storeId && stores[user.storeId];
            if (!hasValidStore) {
                // Allow "suspended" stores to view settings? No, let's stick to onboarding for now or simple "Store Deleted" handling.
                // If store is suspended, the object exists, so this check passes.
                // This check specifically catches "Deleted/Missing" stores.
                navigate('/merchant/onboarding');
            }
        }

    }, [user, location.pathname, stores, storesLoading]);

    // Don't render content if unauthorized (flicker protection)
    if (!user || user.role !== 'merchant') {
        return null;
    }

    // Hide Sidebar on Onboarding
    if (location.pathname === '/merchant/onboarding') {
        return (
            <div className="min-h-screen bg-[var(--surface-0)]">
                <header className="h-16 bg-white border-b border-[var(--glass-border)] flex items-center justify-between px-8">
                    <span className="text-xl font-bold text-[var(--brand-primary)]">Spendigo Merchant</span>
                    <button onClick={logout} className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-main)]">Sign Out</button>
                </header>
                <Outlet />
            </div>
        );
    }

    const isTeamActive = location.pathname === '/merchant/settings' && currentTab === 'team';
    const isSettingsActive = location.pathname === '/merchant/settings' && currentTab !== 'team';

    return (
        <div className="min-h-screen bg-[var(--surface-0)] flex flex-col md:grid md:grid-cols-[250px_1fr]">
            {/* Mobile Header */}
            <header className="md:hidden h-16 bg-white border-b border-[var(--glass-border)] flex items-center justify-between px-4 sticky top-0 z-20">
                <div className="flex flex-col">
                    <span className="text-lg font-bold text-[var(--brand-primary)]">Spendigo Merchant</span>
                </div>
                <div className="flex items-center gap-2">
                    <NotificationPopover />
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-2xl text-[var(--text-main)]">
                        {isSidebarOpen ? '✕' : '☰'}
                    </button>
                </div>
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

                <nav className="space-y-1 px-4 mb-4">
                    <Link
                        to="/"
                        className="flex items-center gap-3 p-3 rounded-lg font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-main)] transition-colors"
                    >
                        <span>🏠</span> Back to Store
                    </Link>
                </nav>

                <div className="border-t border-[var(--glass-border)] pt-4 mt-auto p-4 pb-safe">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-sm font-medium text-[var(--text-main)]">Store Online</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <div>
                            <p className="text-[var(--text-main)] font-bold truncate max-w-[130px]">{user?.storeName || 'My Store'}</p>
                            <p className="text-[var(--text-muted)] truncate max-w-[130px]">{user?.email}</p>
                        </div>
                        <button onClick={logout} className="text-red-500 hover:text-red-700 font-bold" title="Logout">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.36 6.64a9 9 0 11-12.73 0" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v10" />
                            </svg>
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

            {/* Main Content Area */}
            <div className="flex flex-col h-screen overflow-hidden">
                {/* Desktop Top Bar */}
                <header className="hidden md:flex h-16 bg-white border-b border-[var(--glass-border)] items-center justify-end px-8 shrink-0">
                    <div className="flex items-center gap-4">
                        <NotificationPopover />

                        {/* Profile Dropdown */}
                        <div className="relative group">
                            <button className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors">
                                <div className="w-8 h-8 rounded-full bg-[var(--brand-primary)] text-white flex items-center justify-center text-sm font-bold ring-2 ring-white shadow-md">
                                    {user?.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <span className="text-sm font-medium text-[var(--text-main)] max-w-[120px] truncate">
                                    {user?.name.split(' ')[0]}
                                </span>
                            </button>

                            {/* Dropdown Menu */}
                            <div className="absolute right-0 top-12 w-48 glass-panel opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl">
                                <div className="p-3 border-b border-[var(--glass-border)]">
                                    <p className="text-sm font-bold text-[var(--text-main)] truncate">{user?.storeName || 'My Store'}</p>
                                    <p className="text-xs text-[var(--text-muted)] truncate">{user?.email}</p>
                                </div>
                                <Link
                                    to="/merchant/settings"
                                    className="block px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--surface-2)] transition-colors"
                                >
                                    ⚙️ Settings
                                </Link>
                                <Link
                                    to="/merchant/orders"
                                    className="block px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--surface-2)] transition-colors"
                                >
                                    📋 Orders
                                </Link>
                                <Link
                                    to="/merchant/subscription"
                                    className="block px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--surface-2)] transition-colors"
                                >
                                    💳 Billing
                                </Link>
                                <button
                                    onClick={logout}
                                    className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors border-t border-[var(--glass-border)]"
                                >
                                    🚪 Sign Out
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto bg-[var(--surface-1)]">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default MerchantLayout;
