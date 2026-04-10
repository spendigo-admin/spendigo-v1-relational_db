import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/design-system.css';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useAuth } from '../../context/AuthContext';
import { Order, useOrders } from '../../context/OrderContext';
import NotificationPopover from '../../components/NotificationPopover';

type TimePeriod = 'daily' | 'weekly' | 'monthly';

const MerchantDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { getStore } = useMarketplace();
    const { can, user } = useAuth();
    const storeId = user?.storeId || '1';
    const store = getStore(storeId);

    const { orders } = useOrders();
    const [timePeriod, setTimePeriod] = useState<TimePeriod>('daily');
    const [stats, setStats] = useState({
        revenue: 0,
        orderCount: 0,
        avgOrderValue: 0,
        revenueGrowth: 0,
        ordersGrowth: 0
    });
    const [chartData, setChartData] = useState<{ label: string; value: number }[]>([]);

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
            return orders.filter((o: Order) => {
                const d = new Date(o.date);
                return d >= start && d < end;
            });
        };

        // Current Stats
        const currentOrders = orders.filter((o: Order) => new Date(o.date) >= startOfPeriod);
        const currentRevenue = currentOrders
            .filter((o: Order) => o.paymentStatus === 'paid')
            .reduce((sum: number, o: Order) => sum + o.total, 0);

        // Previous Stats (for Growth)
        const prevOrders = getOrdersInWindow(previousStart, previousEnd);
        const prevRevenue = prevOrders
            .filter((o: Order) => o.paymentStatus === 'paid')
            .reduce((sum: number, o: Order) => sum + o.total, 0);

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
        currentOrders.forEach((o: Order) => {
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
    const pendingOrders = orders.filter((o: Order) => o.status === 'placed').length;
    const preparingOrders = orders.filter((o: Order) => o.status === 'preparing').length;
    const readyOrders = orders.filter((o: Order) => o.status === 'out_for_delivery').length;

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
            value: orders.filter((o: Order) => o.status === 'delivered' && new Date(o.date) >= new Date(new Date().setHours(0, 0, 0, 0))).length.toString(),
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
        <div className="p-4 md:p-6 animate-fade-in pb-20 space-y-6">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--brand-primary)] to-purple-600 p-6 md:p-10 text-white shadow-xl">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="max-w-xl">
                        <h1 className="text-2xl md:text-4xl font-black mb-2 tracking-tight">👋 Welcome back, {store?.name || 'Partner'}!</h1>
                        <p className="text-blue-100 text-base md:text-xl font-medium opacity-90">Your store is live and accepting orders.</p>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 flex-1 md:flex-none flex items-center justify-between md:justify-start gap-4">
                            <div className="text-right md:text-left">
                                <div className="text-[10px] opacity-70 uppercase tracking-widest font-black">Status</div>
                                <div className="text-sm font-bold flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]"></span>
                                    ONLINE
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Decorative elements */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-400/20 rounded-full blur-3xl"></div>
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

            {/* Stats Grid */}
            {can('analytics:read') ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    {displayStats.map((stat, idx) => (
                        <div key={idx} className="bg-white p-4 md:p-5 rounded-2xl border border-[var(--glass-border)] shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-xl md:text-2xl ${stat.color}`}>
                                    {stat.icon}
                                </div>
                            </div>
                            <div>
                                <p className="text-[var(--text-muted)] text-[10px] md:text-xs font-bold uppercase tracking-wider">{stat.label}</p>
                                <h3 className="text-lg md:text-2xl font-black text-[var(--text-main)] mt-0.5">{stat.value}</h3>
                                {stat.change !== 'n/a' && (
                                    <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-100 flex items-center gap-0.5 w-fit mt-1">
                                        ↑ {stat.change}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    {operationalStats.map((stat, idx) => (
                        <div key={idx} onClick={stat.action} className="bg-white p-4 md:p-5 rounded-2xl border border-[var(--glass-border)] shadow-sm hover:shadow-md hover:border-[var(--brand-primary)] transition-all cursor-pointer group active:scale-95">
                            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-xl md:text-2xl mb-3 ${stat.color} group-hover:scale-110 transition-transform`}>
                                {stat.icon}
                            </div>
                            <div>
                                <p className="text-[var(--text-muted)] text-[10px] md:text-sm font-bold uppercase tracking-wider group-hover:text-[var(--brand-primary)] transition-colors">{stat.label}</p>
                                <h3 className="text-2xl md:text-3xl font-black text-[var(--text-main)] mt-0.5">{stat.value}</h3>
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
                    {/* Share Store Visibility Widget */}
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-xl text-white shadow-lg relative overflow-hidden group">
                        <div className="relative z-10">
                            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                                <span>🚀</span> Boost Visibility
                            </h3>
                            <p className="text-indigo-100 text-sm mb-4">
                                Share your store link to get more customers.
                            </p>

                            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm p-1 rounded-lg border border-white/20 mb-3">
                                <input
                                    readOnly
                                    value={`${window.location.origin}/store/${store?.id}`}
                                    className="flex-1 bg-transparent border-none text-xs text-white placeholder-white/50 focus:ring-0 px-2 truncate"
                                />
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(`${window.location.origin}/store/${store?.id}`);
                                        // Simple toast fallback
                                        const btn = document.getElementById('copy-btn');
                                        if (btn) btn.innerText = '✅';
                                        setTimeout(() => { if (btn) btn.innerText = '📋'; }, 2000);
                                    }}
                                    id="copy-btn"
                                    className="p-1.5 bg-white text-indigo-600 rounded-md text-xs font-bold hover:bg-indigo-50 transition-colors"
                                    title="Copy Link"
                                >
                                    📋
                                </button>
                            </div>

                            <div className="flex gap-2">
                                <a
                                    href={`https://twitter.com/intent/tweet?text=Check%20out%20${encodeURIComponent(store?.name || 'our store')}%20on%20Spendigo!&url=${encodeURIComponent(`${window.location.origin}/store/${store?.id}`)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-center text-xs font-bold border border-white/10 transition-colors flex items-center justify-center gap-1"
                                >
                                    𝕏 Post
                                </a>
                                <a
                                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/store/${store?.id}`)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-center text-xs font-bold border border-white/10 transition-colors flex items-center justify-center gap-1"
                                >
                                    Facebook
                                </a>
                            </div>
                        </div>

                        {/* Decor */}
                        <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all"></div>
                    </div>
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
                        <section className="bg-white p-5 md:p-6 rounded-2xl border border-[var(--glass-border)] shadow-sm">
                            <div className="flex justify-between items-center mb-5">
                                <h2 className="font-black text-[var(--text-main)] flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                    Live Orders
                                </h2>
                                <button onClick={() => navigate('/merchant/orders')} className="text-xs text-[var(--brand-primary)] font-black hover:underline uppercase tracking-widest">View All</button>
                            </div>
                            <div className="space-y-3">
                                {recentOrdersDisplay.length > 0 ? recentOrdersDisplay.map((order, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-gray-50/50 hover:bg-[var(--surface-1)] rounded-2xl transition-all border border-transparent hover:border-[var(--glass-border)] cursor-pointer active:scale-[0.98]" onClick={() => navigate('/merchant/orders')}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-lg">
                                                {order.status === 'delivered' ? '✅' : '🔔'}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-sm text-[var(--text-main)] truncate">{order.customer}</div>
                                                <div className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wider">{order.items}</div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="font-black text-sm text-[var(--brand-primary)]">{order.total}</div>
                                            <div className="text-[9px] font-bold text-[var(--text-muted)] uppercase mt-0.5">{order.time}</div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-center py-10 text-[var(--text-muted)] text-sm">
                                        <div className="text-4xl mb-3 opacity-20">📭</div>
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
