import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/design-system.css';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useAuth } from '../../context/AuthContext';
import { Order } from '../../context/OrderContext';
import NotificationPopover from '../../components/NotificationPopover';

type TimePeriod = 'daily' | 'weekly' | 'monthly';

const MerchantDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { getStore } = useMarketplace();
    const { can, user } = useAuth();
    const storeId = user?.storeId || '1';
    const store = getStore(storeId);

    const [orders, setOrders] = useState<Order[]>([]);
    const [timePeriod, setTimePeriod] = useState<TimePeriod>('daily');
    const [stats, setStats] = useState({
        revenue: 0,
        orderCount: 0,
        avgOrderValue: 0,
        revenueGrowth: 0,
        ordersGrowth: 0
    });
    const [chartData, setChartData] = useState<{ label: string; value: number }[]>([]);

    // Load Orders
    useEffect(() => {
        const loadOrders = () => {
            const storeKey = `spendigo_store_orders_${storeId}`;
            const saved = localStorage.getItem(storeKey);
            if (saved) {
                try {
                    setOrders(JSON.parse(saved));
                } catch (e) {
                    console.error("Failed to load orders", e);
                }
            }
        };
        loadOrders();
        // Optional: polling or event listener could go here
    }, [storeId]);

    // Calculate Stats & Chart Data
    useEffect(() => {
        const now = new Date();
        const startOfPeriod = new Date(now);
        startOfPeriod.setHours(0, 0, 0, 0);

        let previousStart = new Date(startOfPeriod);
        let previousEnd = new Date(startOfPeriod);
        let chartBuckets: { label: string; value: number }[] = [];

        // Define Time Windows
        if (timePeriod === 'daily') {
            // No adjustment needed for startOfPeriod (Today 00:00)
            previousStart.setDate(previousStart.getDate() - 1); // Yesterday 00:00
            previousEnd = new Date(startOfPeriod); // Today 00:00

            // Chart: Hourly (Last 24h or Today's hours?) - Let's do Today's hours 6am-10pm for simplicity or 4h blocks
            // Use 6 buckets of 4 hours: 0-4, 4-8, 8-12, 12-16, 16-20, 20-24
            chartBuckets = ['0-4h', '4-8h', '8-12h', '12-16h', '16-20h', '20-24h'].map(l => ({ label: l, value: 0 }));

        } else if (timePeriod === 'weekly') {
            const day = startOfPeriod.getDay(); // 0 is Sunday
            const diff = startOfPeriod.getDate() - day + (day === 0 ? -6 : 1); // Monday start
            startOfPeriod.setDate(diff);

            previousStart = new Date(startOfPeriod);
            previousStart.setDate(previousStart.getDate() - 7);
            previousEnd = new Date(startOfPeriod);

            // Chart: Mon-Sun
            chartBuckets = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(l => ({ label: l, value: 0 }));
        } else if (timePeriod === 'monthly') {
            startOfPeriod.setDate(1); // 1st of month

            previousStart = new Date(startOfPeriod);
            previousStart.setMonth(previousStart.getMonth() - 1);
            previousEnd = new Date(startOfPeriod);

            // Chart: 4 Weeks
            chartBuckets = ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5'].map(l => ({ label: l, value: 0 }));
        }

        // Filter Function
        const getOrdersInWindow = (start: Date, end: Date) => {
            return orders.filter(o => {
                const d = new Date(o.date);
                return d >= start && d < end;
            });
        };

        // Current Stats
        const currentOrders = orders.filter(o => new Date(o.date) >= startOfPeriod);
        const currentRevenue = currentOrders
            .filter(o => o.paymentStatus === 'paid')
            .reduce((sum, o) => sum + o.total, 0);

        // Previous Stats (for Growth)
        const prevOrders = getOrdersInWindow(previousStart, previousEnd);
        const prevRevenue = prevOrders
            .filter(o => o.paymentStatus === 'paid')
            .reduce((sum, o) => sum + o.total, 0);

        // Calculate Growth %
        const calcGrowth = (curr: number, prev: number) => {
            if (prev === 0) return curr > 0 ? 100 : 0;
            return ((curr - prev) / prev) * 100;
        };

        setStats({
            revenue: currentRevenue,
            orderCount: currentOrders.length,
            avgOrderValue: currentOrders.length > 0 ? currentRevenue / currentOrders.length : 0,
            revenueGrowth: calcGrowth(currentRevenue, prevRevenue),
            ordersGrowth: calcGrowth(currentOrders.length, prevOrders.length)
        });

        // Populate Chart Buckets
        currentOrders.forEach(o => {
            if (o.paymentStatus !== 'paid') return;
            const date = new Date(o.date);
            let bucketIndex = -1;

            if (timePeriod === 'daily') {
                const hour = date.getHours();
                bucketIndex = Math.floor(hour / 4);
            } else if (timePeriod === 'weekly') {
                const day = date.getDay(); // 0=Sun, 1=Mon
                bucketIndex = day === 0 ? 6 : day - 1; // Mon=0, Sun=6
            } else if (timePeriod === 'monthly') {
                const day = date.getDate();
                bucketIndex = Math.floor((day - 1) / 7);
            }

            if (bucketIndex >= 0 && bucketIndex < chartBuckets.length) {
                chartBuckets[bucketIndex].value += o.total;
            }
        });
        setChartData(chartBuckets);

    }, [orders, timePeriod]);


    // Dynamic Stats Calculation
    const productCount = store?.products?.length || 0;
    const activeDealsCount = (store?.saleItems?.length || 0) + (store?.oneDayOffers?.length || 0);

    const displayStats = [
        {
            label: 'Total Revenue',
            value: `$${stats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            change: `${stats.revenueGrowth >= 0 ? '+' : ''}${stats.revenueGrowth.toFixed(1)}%`,
            icon: '💰',
            color: 'bg-green-100 text-green-700',
            trendInv: false
        },
        {
            label: 'Orders',
            value: stats.orderCount.toString(),
            change: `${stats.ordersGrowth >= 0 ? '+' : ''}${stats.ordersGrowth.toFixed(1)}%`,
            icon: '🧾',
            color: 'bg-purple-100 text-purple-700',
            trendInv: false
        },
        {
            label: 'Avg. Order',
            value: `$${stats.avgOrderValue.toFixed(2)}`,
            change: 'n/a',
            icon: '📊',
            color: 'bg-blue-100 text-blue-700',
            trendInv: false
        },
        {
            label: 'Inventory',
            value: productCount.toString(),
            change: 'Items',
            icon: '📦',
            color: 'bg-yellow-100 text-yellow-700',
            trendInv: false
        },
    ];

    // Operational Stats Calculation (For Staff)
    const pendingOrders = orders.filter(o => o.status === 'placed').length;
    const preparingOrders = orders.filter(o => o.status === 'preparing').length;
    const readyOrders = orders.filter(o => o.status === 'out_for_delivery').length;

    const operationalStats = [
        {
            label: 'New Orders',
            value: pendingOrders.toString(),
            icon: '🔔',
            color: 'bg-blue-100 text-blue-700',
            action: () => navigate('/merchant/orders')
        },
        {
            label: 'Preparing',
            value: preparingOrders.toString(),
            icon: '👨‍🍳',
            color: 'bg-orange-100 text-orange-700',
            action: () => navigate('/merchant/orders')
        },
        {
            label: 'Ready / On Route',
            value: readyOrders.toString(),
            icon: '🛵',
            color: 'bg-purple-100 text-purple-700',
            action: () => navigate('/merchant/orders')
        },
        {
            label: 'Completed Today',
            value: orders.filter(o => o.status === 'delivered' && new Date(o.date) >= new Date(new Date().setHours(0, 0, 0, 0))).length.toString(),
            icon: '✅',
            color: 'bg-green-100 text-green-700',
            action: () => navigate('/merchant/orders')
        }
    ];

    const quickActions = [
        { label: 'Manage Orders', icon: '🔔', path: '/merchant/orders', desc: 'View and process active orders', permission: 'orders:read' },
        { label: 'Add Product', icon: '📦', path: '/merchant/products', desc: 'Add new items to your catalog', permission: 'products:write' },
        { label: 'Create Flyer', icon: '📰', path: '/merchant/flyers', desc: 'Upload weekly digital flyer', permission: 'flyers:write' },
        { label: 'New Deal', icon: '🏷️', path: '/merchant/deals', desc: 'Create a sale or offer', permission: 'deals:write' },
        { label: 'Manage Team', icon: '👥', path: '/merchant/settings?tab=team', desc: 'Manage staff roles & permissions', permission: 'team:manage' },
        { label: 'Store Settings', icon: '⚙️', path: '/merchant/settings', desc: 'Manage profile & delivery', permission: 'settings:write' },
    ].filter(action => can(action.permission as any));

    // Mock Recent Orders (Use real if available, showing first 3)
    const recentOrdersDisplay = orders.slice(0, 3).map(o => ({
        id: o.id,
        customer: o.customerName,
        items: `${o.items.length} items`,
        total: `$${o.total.toFixed(2)}`,
        status: o.status,
        time: new Date(o.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));

    return (
        <div className="p-6 animate-fade-in pb-20">
            {/* Hero Section */}
            <div className="mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-r from-[var(--brand-primary)] to-purple-600 p-8 text-white shadow-lg">
                <div className="relative z-10 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">👋 Welcome back, {store?.name || 'Partner'}!</h1>
                        <p className="text-blue-100 text-lg font-medium">Your store is live and accepting orders.</p>
                    </div>
                    <div className="hidden md:flex items-center gap-6">
                        <div className="text-right">
                            <div className="text-sm opacity-80 uppercase tracking-wider font-medium">Current Status</div>
                            <div className="text-2xl font-bold flex items-center justify-end gap-2">
                                <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]"></span>
                                Online
                            </div>
                        </div>
                        <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm border border-white/20">
                            <NotificationPopover />
                        </div>
                    </div>
                </div>
                {/* Decorative circles */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full translate-y-1/3 -translate-x-1/4"></div>
            </div>

            {/* Time Period Selector - Only for Analytics */}
            {can('analytics:read') && (
                <div className="flex justify-end mb-4">
                    <div className="inline-flex bg-white border border-[var(--glass-border)] rounded-lg p-1 shadow-sm">
                        {(['daily', 'weekly', 'monthly'] as const).map(period => (
                            <button
                                key={period}
                                onClick={() => setTimePeriod(period)}
                                className={`px-4 py-1.5 rounded-md text-sm font-bold capitalize transition-all ${timePeriod === period
                                    ? 'bg-[var(--brand-primary)] text-white shadow-sm'
                                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-1)]'
                                    }`}
                            >
                                {period}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Stats Grid - Toggles based on Permission */}
            {can('analytics:read') ? (
                // Financial Stats (Owner/Manager)
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {displayStats.map((stat, idx) => (
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
            ) : (
                // Operational Stats (Staff)
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {operationalStats.map((stat, idx) => (
                        <div key={idx} onClick={stat.action} className="bg-white p-5 rounded-xl border border-[var(--glass-border)] shadow-sm hover:shadow-md hover:border-[var(--brand-primary)] transition-all cursor-pointer group">
                            <div className="flex justify-between items-start mb-2">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${stat.color} group-hover:scale-110 transition-transform`}>
                                    {stat.icon}
                                </div>
                            </div>
                            <div className="mt-2">
                                <p className="text-[var(--text-muted)] text-sm font-medium group-hover:text-[var(--brand-primary)] transition-colors">{stat.label}</p>
                                <h3 className="text-3xl font-bold text-[var(--text-main)]">{stat.value}</h3>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Quick Actions */}
                    <section>
                        <h2 className="text-xl font-bold text-[var(--text-main)] mb-4 flex items-center gap-2">
                            <span>⚡</span> Quick Actions
                        </h2>
                        {quickActions.length > 0 ? (
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
                        ) : (
                            <div className="bg-white p-8 rounded-xl border border-[var(--glass-border)] text-center text-[var(--text-muted)]">
                                No quick actions available for your role.
                            </div>
                        )}
                    </section>

                    {/* Revenue Chart with Animation - Only for Analytics */}
                    {can('analytics:read') && (
                        <section className="bg-white p-6 rounded-xl border border-[var(--glass-border)] shadow-sm">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h2 className="text-xl font-bold text-[var(--text-main)]">Revenue Overview</h2>
                                    <p className="text-sm text-[var(--text-muted)]">Sales performance visualizer ({timePeriod === 'daily' ? 'Hourly' : timePeriod === 'weekly' ? 'Daily' : 'Weekly'})</p>
                                </div>
                            </div>
                            <div className="h-64 flex items-end justify-between gap-3 px-2">
                                {chartData.map((data, i) => {
                                    // Calculate height percentage relative to max value in set, default to 5% if all 0
                                    const maxVal = Math.max(...chartData.map(d => d.value), 100);
                                    const heightPercent = Math.max((data.value / maxVal) * 100, 5);

                                    return (
                                        <div key={i} className="w-full relative group" style={{ height: '100%' }}>
                                            <div
                                                className="absolute bottom-0 w-full bg-gradient-to-t from-[var(--brand-primary)] to-purple-400 rounded-t-lg transition-all duration-500 hover:opacity-90"
                                                style={{ height: `${heightPercent}%`, opacity: data.value > 0 ? 0.8 : 0.2 }}
                                            ></div>
                                            {/* Tooltip */}
                                            <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg z-10">
                                                ${data.value.toFixed(2)}
                                                <div className="text-[10px] opacity-60">{data.label}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex justify-between mt-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider border-t border-[var(--glass-border)] pt-4">
                                {chartData.map((d, i) => (
                                    <span key={i} className="text-center w-full truncate px-1">{d.label}</span>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                {/* Sidebar / Insights */}
                <div className="space-y-6">
                    {/* Flyer Status Card - Gated */}
                    {can('flyers:write') && (
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
                    )}

                    {/* Recent Orders List (Real Data) */}
                    {can('orders:read') && (
                        <section className="bg-white p-6 rounded-xl border border-[var(--glass-border)] shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="font-bold text-[var(--text-main)]">Live Orders</h2>
                                <button onClick={() => navigate('/merchant/orders')} className="text-sm text-[var(--brand-primary)] font-medium hover:underline">View All</button>
                            </div>
                            <div className="space-y-4">
                                {recentOrdersDisplay.length > 0 ? recentOrdersDisplay.map((order, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 hover:bg-[var(--surface-1)] rounded-lg transition-colors border border-transparent hover:border-[var(--glass-border)] cursor-pointer" onClick={() => navigate('/merchant/orders')}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${order.status === 'delivered' ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
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
                                )) : (
                                    <div className="text-center py-6 text-[var(--text-muted)] text-sm">
                                        No recent orders
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* Pro Tip - Dynamic based on deals - Gated */}
                    {can('deals:write') && activeDealsCount === 0 && (
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
