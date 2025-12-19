import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/design-system.css';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useAuth } from '../../context/AuthContext';

const MerchantDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { getStore } = useMarketplace();
    const { can, user } = useAuth();
    const storeId = user?.storeId || '1';
    const store = getStore(storeId);

    // Dynamic Stats Calculation
    const productCount = store?.products?.length || 0;
    const activeDealsCount = (store?.saleItems?.length || 0) + (store?.oneDayOffers?.length || 0);
    const flyerStatus = store?.flyer?.title ? 'Active' : 'No Flyer';

    // Mock Revenue Data (Visual only)
    const stats = [
        { label: 'Total Revenue', value: '$12,450', change: '+12%', icon: '💰', color: 'bg-green-100 text-green-700' },
        { label: 'Active Deals', value: activeDealsCount.toString(), change: 'Live Now', icon: '🏷️', color: 'bg-purple-100 text-purple-700' },
        { label: 'Inventory Items', value: productCount.toString(), change: 'Products', icon: '📦', color: 'bg-blue-100 text-blue-700' },
        { label: 'Store Rating', value: store?.rating.toString() || '4.8', change: '⭐', icon: '🏆', color: 'bg-yellow-100 text-yellow-700' },
    ];

    const quickActions = [
        { label: 'Add Product', icon: '📦', path: '/merchant/products', desc: 'Add new items to your catalog', permission: 'products:write' },
        { label: 'Create Flyer', icon: '📰', path: '/merchant/flyers', desc: 'Upload weekly digital flyer', permission: 'flyers:write' },
        { label: 'New Deal', icon: '🏷️', path: '/merchant/deals', desc: 'Create a sale or offer', permission: 'deals:write' },
        { label: 'Manage Team', icon: '👥', path: '/merchant/settings?tab=team', desc: 'Manage staff roles & permissions', permission: 'team:manage' },
        { label: 'Store Settings', icon: '⚙️', path: '/merchant/settings', desc: 'Manage profile & delivery', permission: 'settings:write' },
    ].filter(action => can(action.permission as any));

    // Mock Recent Orders (since Orders are local state in another page)
    const recentOrders = [
        { id: '#ORD-8821', customer: 'Sarah Jenkins', items: 'Weekly Groceries (12 items)', total: '$84.50', status: 'Pending', time: '2 mins ago' },
        { id: '#ORD-8820', customer: 'Mike Ross', items: 'Snacks & Drinks', total: '$22.15', status: 'Processing', time: '15 mins ago' },
        { id: '#ORD-8819', customer: 'Jessica Pearson', items: 'Office Supplies', total: '$145.00', status: 'Ready', time: '42 mins ago' },
    ];

    return (
        <div className="p-6 animate-fade-in pb-20">
            {/* Hero Section */}
            <div className="mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-r from-[var(--brand-primary)] to-purple-600 p-8 text-white shadow-lg">
                <div className="relative z-10 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">👋 Welcome back, {store?.name || 'Partner'}!</h1>
                        <p className="opacity-90 text-lg">Your store is live and accepting orders.</p>
                    </div>
                    <div className="hidden md:block text-right">
                        <div className="text-sm opacity-80 uppercase tracking-wider font-medium">Current Status</div>
                        <div className="text-2xl font-bold flex items-center gap-2">
                            <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]"></span>
                            Online
                        </div>
                    </div>
                </div>
                {/* Decorative circles */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full translate-y-1/3 -translate-x-1/4"></div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {stats.map((stat, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-xl border border-[var(--glass-border)] shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${stat.color}`}>
                                {stat.icon}
                            </div>
                            {stat.change && (
                                <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                                    {stat.change}
                                </span>
                            )}
                        </div>
                        <div className="mt-2">
                            <p className="text-[var(--text-muted)] text-sm font-medium">{stat.label}</p>
                            <h3 className="text-2xl font-bold text-[var(--text-main)]">{stat.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Quick Actions */}
                    <section>
                        <h2 className="text-xl font-bold text-[var(--text-main)] mb-4 flex items-center gap-2">
                            <span>⚡</span> Quick Actions
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {quickActions.map((action, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => navigate(action.path)}
                                    className="bg-white p-5 rounded-xl border border-[var(--glass-border)] hover:border-[var(--brand-primary)] hover:shadow-md transition-all text-left group relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-gray-50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="relative z-10">
                                        <div className="text-3xl mb-3 group-hover:scale-110 transition-transform origin-left">{action.icon}</div>
                                        <p className="font-bold text-[var(--text-main)]">{action.label}</p>
                                        <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">{action.desc}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Revenue Chart with Animation */}
                    <section className="bg-white p-6 rounded-xl border border-[var(--glass-border)] shadow-sm">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h2 className="text-xl font-bold text-[var(--text-main)]">Revenue Overview</h2>
                                <p className="text-sm text-[var(--text-muted)]">Sales performance over the last 7 days</p>
                            </div>
                            <select className="bg-[var(--surface-1)] border border-[var(--glass-border)] text-sm rounded-lg p-2 font-medium outline-none">
                                <option>Last 7 Days</option>
                                <option>This Month</option>
                                <option>This Year</option>
                            </select>
                        </div>
                        <div className="h-64 flex items-end justify-between gap-3 px-2">
                            {[40, 65, 45, 80, 55, 90, 75].map((h, i) => (
                                <div key={i} className="w-full relative group" style={{ height: '100%' }}>
                                    <div
                                        className="absolute bottom-0 w-full bg-gradient-to-t from-[var(--brand-primary)] to-purple-400 rounded-t-lg transition-all duration-500 hover:opacity-90"
                                        style={{ height: `${h}%`, opacity: 0.8 }}
                                    ></div>
                                    {/* Tooltip */}
                                    <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg z-10">
                                        ${h * 24.5}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between mt-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider border-t border-[var(--glass-border)] pt-4">
                            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                        </div>
                    </section>
                </div>

                {/* Sidebar / Insights */}
                <div className="space-y-6">
                    {/* Flyer Status Card */}
                    <div className="bg-white p-6 rounded-xl border border-[var(--glass-border)] shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-[var(--text-main)]">Weekly Flyer</h3>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${store?.flyer?.title ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {store?.flyer?.title ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        {store?.flyer?.title ? (
                            <div className="p-3 bg-[var(--surface-1)] rounded-lg flex items-center gap-3">
                                <img src={store.flyer.image} className="w-12 h-12 rounded-lg object-cover" alt="Flyer" />
                                <div>
                                    <div className="font-bold text-sm truncate w-40">{store.flyer.title}</div>
                                    <div className="text-xs text-[var(--text-muted)]">Ends: {store.flyer.validUntil}</div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-4 text-[var(--text-muted)] text-sm">
                                <p className="mb-2">No active flyer.</p>
                                <button onClick={() => navigate('/merchant/flyers')} className="text-[var(--brand-primary)] font-bold hover:underline">Create one now</button>
                            </div>
                        )}
                    </div>

                    {/* Recent Orders List */}
                    {can('orders:read') && (
                        <section className="bg-white p-6 rounded-xl border border-[var(--glass-border)] shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="font-bold text-[var(--text-main)]">Live Orders</h2>
                                <button onClick={() => navigate('/merchant/orders')} className="text-sm text-[var(--brand-primary)] font-medium hover:underline">View All</button>
                            </div>
                            <div className="space-y-4">
                                {recentOrders.map((order, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 hover:bg-[var(--surface-1)] rounded-lg transition-colors border border-transparent hover:border-[var(--glass-border)] cursor-pointer" onClick={() => navigate('/merchant/orders')}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${order.status === 'Pending' ? 'bg-yellow-400' : order.status === 'Processing' ? 'bg-blue-400' : 'bg-green-400'}`}></div>
                                            <div>
                                                <div className="font-bold text-sm text-[var(--text-main)]">{order.customer}</div>
                                                <div className="text-xs text-[var(--text-muted)]">{order.items}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-sm">{order.total}</div>
                                            <div className="text-[10px] text-[var(--text-muted)] uppercase">{order.time}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Pro Tip - Dynamic based on deals */}
                    {activeDealsCount === 0 && (
                        <section className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100">
                            <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">🚀 Boost Sales</h3>
                            <p className="text-sm text-blue-800 mb-4 leading-relaxed">
                                Stores with at least one active deal see <strong>30% more traffic</strong> on average.
                            </p>
                            <button
                                onClick={() => navigate('/merchant/deals')}
                                className="w-full py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all"
                            >
                                Create First Deal
                            </button>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MerchantDashboard;
