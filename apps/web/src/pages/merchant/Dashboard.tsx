import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/design-system.css';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useAuth } from '../../context/AuthContext';
import { Order, useOrders } from '../../context/OrderContext';
import { useNotifications } from '../../context/NotificationContext';
import NotificationPopover from '../../components/NotificationPopover';
import { formatNotificationTime } from '../../utils/date-helpers';

type TimePeriod = 'daily' | 'weekly' | 'monthly';

const MerchantDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { getStore, updateStore } = useMarketplace();
    const { can, user } = useAuth();
    const { addNotification } = useNotifications();
    const storeId = user?.storeId || '1';
    const store = getStore(storeId);

    const { orders } = useOrders();
    const [timePeriod, setTimePeriod] = useState<TimePeriod>('daily');
    const [isLocating, setIsLocating] = useState(false);
    const [activeChartMetric, setActiveChartMetric] = useState<'revenue' | 'orders' | 'avgOrder' | 'inventory'>('revenue');
    const [stats, setStats] = useState({
        revenue: 0,
        orderCount: 0,
        avgOrderValue: 0,
        revenueGrowth: 0,
        ordersGrowth: 0
    });
    const [chartData, setChartData] = useState<{ label: string; revenue: number; orders: number; avgOrder: number; inventory: number }[]>([]);
    
    // Derived static stats for current snapshots
    const productCount = store?.products?.length || 0;
    const activeDealsCount = (store?.saleItems?.length || 0) + (store?.oneDayOffers?.length || 0);


    // Calculate Stats & Chart Data
    useEffect(() => {
        const now = new Date();
        const startOfPeriod = new Date(now);
        startOfPeriod.setHours(0, 0, 0, 0);

        let previousStart = new Date(startOfPeriod);
        let previousEnd = new Date(startOfPeriod);
        let chartBuckets: { label: string; revenue: number; orders: number; avgOrder: number; inventory: number }[] = [];

        // Define Time Windows
        if (timePeriod === 'daily') {
            // No adjustment needed for startOfPeriod (Today 00:00)
            previousStart.setDate(previousStart.getDate() - 1); // Yesterday 00:00
            previousEnd = new Date(startOfPeriod); // Today 00:00

            // Chart: Hourly (Last 24h or Today's hours?) - Let's do Today's hours 6am-10pm for simplicity or 4h blocks
            // Use 6 buckets of 4 hours: 0-4, 4-8, 8-12, 12-16, 16-20, 20-24
            chartBuckets = ['0-4h', '4-8h', '8-12h', '12-16h', '16-20h', '20-24h'].map(l => ({ label: l, revenue: 0, orders: 0, avgOrder: 0, inventory: 0 }));

        } else if (timePeriod === 'weekly') {
            const day = startOfPeriod.getDay(); // 0 is Sunday
            const diff = startOfPeriod.getDate() - day + (day === 0 ? -6 : 1); // Monday start
            startOfPeriod.setDate(diff);

            previousStart = new Date(startOfPeriod);
            previousStart.setDate(previousStart.getDate() - 7);
            previousEnd = new Date(startOfPeriod);

            // Chart: Mon-Sun
            chartBuckets = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(l => ({ label: l, revenue: 0, orders: 0, avgOrder: 0, inventory: 0 }));
        } else if (timePeriod === 'monthly') {
            startOfPeriod.setDate(1); // 1st of month

            previousStart = new Date(startOfPeriod);
            previousStart.setMonth(previousStart.getMonth() - 1);
            previousEnd = new Date(startOfPeriod);

            // Chart: 4 Weeks
            chartBuckets = ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5'].map(l => ({ label: l, revenue: 0, orders: 0, avgOrder: 0, inventory: 0 }));
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
                chartBuckets[bucketIndex].revenue += o.total;
                chartBuckets[bucketIndex].orders += 1;
            }
        });

        // Compute averages and simulate inventory
        chartBuckets.forEach((bucket, i) => {
            bucket.avgOrder = bucket.orders > 0 ? bucket.revenue / bucket.orders : 0;
            // Simulate stable/slightly growing inventory trend leading up to current productCount
            bucket.inventory = Math.max(0, productCount - (chartBuckets.length - 1 - i) * 2);
        });

        setChartData(chartBuckets);

    }, [orders, timePeriod, productCount]);

    const handleVerifyAddress = async () => {
        const address = (document.getElementById('store-address-input') as HTMLInputElement)?.value;
        const city = (document.getElementById('store-city-input') as HTMLInputElement)?.value;
        const postalCode = (document.getElementById('store-postal-input') as HTMLInputElement)?.value;

        if (!address || !city || !postalCode) {
            addNotification({ type: 'alert', title: 'Missing Information', message: 'Please fill in all address fields.' });
            return;
        }

        setIsLocating(true);
        const fullAddress = `${address}, ${city}, ON, ${postalCode}, Canada`;

        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`);
            const data = await response.json();

            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                
                await updateStore(storeId, {
                    address,
                    city,
                    postalCode,
                    coordinates: { lat: parseFloat(lat), lng: parseFloat(lon) }
                });

                addNotification({ type: 'system', title: 'Location Verified!', message: 'Your store coordinates have been updated.' });
            } else {
                addNotification({ type: 'alert', title: 'Location Not Found', message: 'We could not pinpoint that address. Please check and try again.' });
            }
        } catch (error) {
            console.error('Verification error:', error);
            addNotification({ type: 'alert', title: 'Service Error', message: 'Address verification service is currently unavailable.' });
        } finally {
            setIsLocating(false);
        }
    };


    const displayStats = [
        {
            id: 'revenue',
            label: 'Total Revenue',
            value: `$${stats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            change: `${stats.revenueGrowth >= 0 ? '+' : ''}${stats.revenueGrowth.toFixed(1)}%`,
            icon: '💰',
            color: 'bg-green-100 text-green-700',
            trendInv: false
        },
        {
            id: 'orders',
            label: 'Orders',
            value: stats.orderCount.toString(),
            change: `${stats.ordersGrowth >= 0 ? '+' : ''}${stats.ordersGrowth.toFixed(1)}%`,
            icon: '🧾',
            color: 'bg-purple-100 text-purple-700',
            trendInv: false
        },
        {
            id: 'avgOrder',
            label: 'Avg. Order',
            value: `$${stats.avgOrderValue.toFixed(2)}`,
            change: 'n/a',
            icon: '📊',
            color: 'bg-blue-100 text-blue-700',
            trendInv: false
        },
        {
            id: 'inventory',
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
        items: o.items.slice(0, 2).map(i => `${i.quantity}x ${i.productName}`).join(', ') + (o.items.length > 2 ? '...' : ''),
        total: `$${o.total.toFixed(2)}`,
        status: o.status,
        time: formatNotificationTime(o.date)
    }));

    return (
        <div className="p-4 md:p-6 animate-fade-in pb-20 space-y-6">
            {/* Suspension Alert */}
            {store?.status === 'suspended' && (
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6 animate-pulse-subtle shadow-lg">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-3xl shrink-0">
                        ⚠️
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h2 className="text-xl font-bold text-red-900 mb-1">Your Store is Suspended</h2>
                        <p className="text-sm text-red-700 font-medium">
                            Reason: <span className="font-bold underline">{store.statusReason || 'Policy Violation'}</span>
                        </p>
                        <p className="text-xs text-red-600 mt-2 leading-relaxed">
                            Your store and products are currently hidden from the Spendigo marketplace. Please resolve the issues mentioned above or contact support at <a href="mailto:support@spendigo.ca" className="font-bold underline">support@spendigo.ca</a> to request a review.
                        </p>
                    </div>
                    <button 
                        onClick={() => window.location.href = 'mailto:support@spendigo.ca?subject=Suspension Appeal: ' + encodeURIComponent(store.name)}
                        className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-md active:scale-95 whitespace-nowrap"
                    >
                        Appeal Suspension
                    </button>
                </div>
            )}

            {/* Hero Section - Ultra Slim Redesign */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[var(--brand-primary)] to-blue-500 p-3 md:p-4 text-white shadow-md group transition-all duration-300 hover:shadow-lg">
                {/* Subtle Decorative Blobs - Scaled Down */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-12 -mt-12"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="page-headline text-white flex items-center gap-2">
                                Welcome back, 
                                <span className="text-white font-black italic">
                                    {store?.name || 'Asian Grocers'}
                                </span>
                            </h1>
                            <p className={`text-white/70 text-[9px] md:text-[10px] font-bold uppercase tracking-widest flex items-center gap-2`}>
                                <span className={`w-1.5 h-1.5 ${store?.status === 'suspended' ? 'bg-red-400' : 'bg-green-400'} rounded-full animate-pulse`}></span>
                                {store?.status === 'suspended' ? 'Currently Suspended' : 'Live & Accepting Orders'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        {/* Ultra Compact Stats */}
                        <div className="flex-1 md:flex-none bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
                            <span className="text-[9px] font-black opacity-60 uppercase">Status</span>
                            <span className="text-[10px] font-black">{store?.status === 'suspended' ? 'OFFLINE' : 'ONLINE'}</span>
                        </div>
                        <div className="flex-1 md:flex-none bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
                            <span className="text-[9px] font-black opacity-60 uppercase">Deals</span>
                            <span className="text-[10px] font-black">{activeDealsCount}</span>
                        </div>
                        <button 
                            onClick={() => navigate('/merchant/settings')}
                            className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-base"
                            title="Quick Settings"
                        >
                            ⚙️
                        </button>
                    </div>
                </div>
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
                    {displayStats.map((stat) => (
                        <div 
                            key={stat.id} 
                            onClick={() => setActiveChartMetric(stat.id as any)}
                            className={`p-4 md:p-5 rounded-2xl border transition-all cursor-pointer group active:scale-[0.98] ${activeChartMetric === stat.id ? 'bg-[var(--surface-1)] border-[var(--brand-primary)] shadow-md ring-1 ring-[var(--brand-primary)]' : 'bg-white border-[var(--glass-border)] shadow-sm hover:shadow-md'}`}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-xl md:text-2xl ${stat.color} transition-transform ${activeChartMetric === stat.id ? 'scale-110 shadow-sm' : 'group-hover:scale-105'}`}>
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

                    {/* Store Location & Proximity */}
                    <section className="bg-white p-6 md:p-8 rounded-3xl border border-[var(--glass-border)] shadow-sm overflow-hidden relative group">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-[var(--text-main)] mb-1">📍 Store Location & Proximity</h2>
                                <p className="text-sm text-[var(--text-muted)]">Set your physical presence for delivery and deal alerts.</p>
                            </div>
                            <span className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${store?.coordinates ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {store?.coordinates ? 'Located' : 'Unmapped'}
                            </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                            <div className="md:col-span-3 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2 block">Physical Address</label>
                                        <input 
                                            type="text" 
                                            placeholder="Enter street address" 
                                            className="w-full p-4 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-2xl text-base font-medium focus:ring-2 ring-[var(--brand-primary)] outline-none transition-all"
                                            defaultValue={store?.address}
                                            id="store-address-input"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2 block">City</label>
                                        <input 
                                            type="text" 
                                            placeholder="Toronto" 
                                            className="w-full p-4 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-2xl text-base font-medium focus:ring-2 ring-[var(--brand-primary)] outline-none transition-all"
                                            defaultValue={store?.city}
                                            id="store-city-input"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2 block">Postal Code</label>
                                        <input 
                                            type="text" 
                                            placeholder="M5V 2H1" 
                                            className="w-full p-4 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-2xl text-base font-medium focus:ring-2 ring-[var(--brand-primary)] outline-none transition-all"
                                            defaultValue={store?.postalCode}
                                            id="store-postal-input"
                                        />
                                    </div>
                                </div>
                                <button 
                                    onClick={handleVerifyAddress}
                                    disabled={isLocating}
                                    className="w-full py-4 bg-[var(--brand-primary)] hover:bg-black text-white font-black rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-[var(--brand-primary)]/10 disabled:opacity-50"
                                >
                                    {isLocating ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : '📍 Verify Address & Locate'}
                                </button>
                            </div>
                            
                            <div className="md:col-span-2 bg-[var(--surface-1)] rounded-3xl border border-[var(--glass-border)] p-6 flex flex-col justify-center items-center text-center relative overflow-hidden group-hover:bg-white transition-colors">
                                <div className="relative z-10 w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                                    📡
                                </div>
                                <h3 className="font-black text-[var(--text-main)] mb-1 text-lg">Proximity Reach</h3>
                                <p className="text-xs text-[var(--text-muted)] mb-4 font-medium">Deals are shared with shoppers within:</p>
                                <div className="text-4xl font-black text-[var(--brand-primary)] mb-3 flex items-baseline gap-1">
                                    {store?.deliveryRadiusKm || 5} <span className="text-xl">km</span>
                                </div>
                                <button 
                                    onClick={() => navigate('/merchant/settings?tab=operations')}
                                    className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-primary)] hover:underline flex items-center gap-1 group/btn"
                                >
                                    Expand Coverage <span className="group-hover/btn:translate-x-1 transition-transform">→</span>
                                </button>
                                
                                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl"></div>
                            </div>
                        </div>
                    </section>

                    {/* SVG Trendline Chart with Animation - Only for Analytics */}
                    {can('analytics:read') && (
                        <section className="bg-white p-6 rounded-xl border border-[var(--glass-border)] shadow-sm overflow-hidden flex flex-col">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h2 className="text-xl font-bold text-[var(--brand-primary)] capitalize">{activeChartMetric.replace(/([A-Z])/g, ' $1').trim()} Overview</h2>
                                    <p className="text-sm text-[var(--text-muted)]">Historical performance trendline ({timePeriod === 'daily' ? 'Hourly' : timePeriod === 'weekly' ? 'Daily' : 'Weekly'})</p>
                                </div>
                            </div>
                            
                            {(() => {
                                const maxVal = Math.max(...chartData.map(d => d[activeChartMetric]), 10);
                                const width = 1000;
                                const height = 200;
                                const dx = chartData.length > 1 ? width / (chartData.length - 1) : width;
                                
                                const pointsArr = chartData.map((d, i) => {
                                    const val = d[activeChartMetric];
                                    const x = i * dx;
                                    const y = height - (val / (maxVal || 1)) * height;
                                    return { x, y, val, label: d.label };
                                });

                                const pointsStr = pointsArr.map(p => `${p.x},${p.y}`).join(' ');
                                const areaPointsStr = `0,${height} ${pointsStr} ${width},${height}`;

                                return (
                                    <div className="h-64 relative w-full flex flex-col pt-4">
                                        <div className="flex-1 relative w-full">
                                            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
                                                <defs>
                                                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="var(--brand-primary)" stopOpacity="0.4" />
                                                        <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity="0.0" />
                                                    </linearGradient>
                                                </defs>
                                                <polygon points={areaPointsStr} fill="url(#trendGradient)" className="transition-all duration-700 ease-in-out" />
                                                <polyline points={pointsStr} fill="none" stroke="var(--brand-primary)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-700 ease-in-out" />
                                                
                                                {/* Data Points & Tooltips */}
                                                {pointsArr.map((p, i) => (
                                                    <g key={i} className="group cursor-pointer">
                                                        <circle cx={p.x} cy={p.y} r="25" fill="transparent" /> {/* Hover zone */}
                                                        <circle cx={p.x} cy={p.y} r="6" fill="white" stroke="var(--brand-primary)" strokeWidth="3" className="transition-all duration-300 group-hover:r-[9px] group-hover:shadow-[0_0_12px_var(--brand-primary)]" />
                                                        
                                                        {/* Tooltip */}
                                                        <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none drop-shadow-md z-50">
                                                            <rect x={p.x - 45} y={p.y - 45} width="90" height="30" rx="6" fill="#1f2937" className="shadow-lg" />
                                                            <text x={p.x} y={p.y - 25} textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">
                                                                {activeChartMetric === 'revenue' || activeChartMetric === 'avgOrder' ? '$' : ''}{p.val.toLocaleString(undefined, {minimumFractionDigits: activeChartMetric === 'avgOrder' ? 2 : 0, maximumFractionDigits: 2})}
                                                            </text>
                                                        </g>
                                                    </g>
                                                ))}
                                            </svg>
                                        </div>
                                        <div className="flex justify-between mt-4 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider border-t border-[var(--glass-border)] pt-4 relative">
                                            {chartData.map((d, i) => (
                                                <span key={i} className={`flex-1 text-center truncate ${i === 0 ? 'text-left' : ''} ${i === chartData.length - 1 ? 'text-right' : ''}`}>
                                                    {d.label}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </section>
                    )}
                </div>

                {/* Sidebar / Insights */}
                <div className="space-y-8">
                    <section>
                        <h2 className="text-xl font-bold text-[var(--text-main)] mb-4 flex items-center gap-2">
                            <span>📢</span> Updates & Activity
                        </h2>
                        
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
                                                <div className="text-[10px] text-[var(--text-muted)] font-medium italic truncate w-40">{order.items}</div>
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
                    </section>
                </div>
            </div>
        </div>
    );
};


export default MerchantDashboard;
