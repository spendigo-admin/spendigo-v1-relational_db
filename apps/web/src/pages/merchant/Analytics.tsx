import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useOrders } from '../../context/OrderContext';
import '../../styles/design-system.css';

type TimePeriod = 'today' | 'week' | 'month' | 'year';

interface ChartPoint {
    label: string;
    revenue: number;
    orders: number;
}

const MerchantAnalytics: React.FC = () => {
    const { user, can } = useAuth();
    const { orders } = useOrders();
    const storeId = user?.storeId || '1';

    const [period, setPeriod] = useState<TimePeriod>('week');
    const [activeMetric, setActiveMetric] = useState<'revenue' | 'orders'>('revenue');
    const [visitsByDate, setVisitsByDate] = useState<Record<string, number>>({});

    // Fetch real visit data from analytics subcollection
    useEffect(() => {
        if (!storeId) return;
        getDocs(collection(db, 'stores', storeId, 'analytics')).then(snap => {
            const map: Record<string, number> = {};
            snap.forEach(d => { map[d.id] = (d.data().views as number) || 0; });
            setVisitsByDate(map);
        }).catch(() => {});
    }, [storeId]);

    // Filter orders by period
    const filteredOrders = useMemo(() => {
        const now = new Date();
        const startOfPeriod = new Date(now);

        if (period === 'today') startOfPeriod.setHours(0, 0, 0, 0);
        else if (period === 'week') startOfPeriod.setDate(now.getDate() - 7);
        else if (period === 'month') startOfPeriod.setMonth(now.getMonth() - 1);
        else if (period === 'year') startOfPeriod.setFullYear(now.getFullYear() - 1);

        return orders.filter(o => new Date(o.date) >= startOfPeriod);
    }, [orders, period]);

    // Calculate KPIs
    const kpis = useMemo(() => {
        const revenue = filteredOrders.filter(o => o.paymentStatus === 'paid').reduce((sum, o) => sum + o.total, 0);
        const orderCount = filteredOrders.length;
        const avgOrder = orderCount > 0 ? revenue / orderCount : 0;

        const now = new Date();
        const startDate = new Date(now);
        if (period === 'today') startDate.setHours(0, 0, 0, 0);
        else if (period === 'week') startDate.setDate(now.getDate() - 7);
        else if (period === 'month') startDate.setMonth(now.getMonth() - 1);
        else if (period === 'year') startDate.setFullYear(now.getFullYear() - 1);

        const visits = Object.entries(visitsByDate).reduce((sum, [date, count]) => {
            return new Date(date) >= startDate ? sum + count : sum;
        }, 0);
        const conversion = visits > 0 ? (orderCount / visits) * 100 : 0;

        return [
            { label: 'Total Revenue', value: `$${revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: '💰', color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Total Orders', value: orderCount.toString(), icon: '🧾', color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Avg. Order', value: `$${avgOrder.toFixed(2)}`, icon: '📊', color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Store Visits', value: visits.toLocaleString(), icon: '👁️', color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Conversion', value: `${conversion.toFixed(1)}%`, icon: '🎯', color: 'text-indigo-600', bg: 'bg-indigo-50' },
        ];
    }, [filteredOrders, visitsByDate, period]);

    // Generate Chart Data
    const chartData = useMemo(() => {
        const buckets: Record<string, ChartPoint> = {};
        const now = new Date();

        if (period === 'week') {
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                const label = d.toLocaleDateString([], { weekday: 'short' });
                buckets[label] = { label, revenue: 0, orders: 0 };
            }
        } else if (period === 'month') {
            for (let i = 3; i >= 0; i--) {
                const label = `Week ${4 - i}`;
                buckets[label] = { label, revenue: 0, orders: 0 };
            }
        } else if (period === 'year') {
            for (let i = 11; i >= 0; i--) {
                const d = new Date(now);
                d.setMonth(d.getMonth() - i);
                const label = d.toLocaleDateString([], { month: 'short' });
                buckets[label] = { label, revenue: 0, orders: 0 };
            }
        } else {
            // Today - Hourly
            for (let i = 0; i < 6; i++) {
                const label = `${i * 4}h`;
                buckets[label] = { label, revenue: 0, orders: 0 };
            }
        }

        filteredOrders.forEach(o => {
            const date = new Date(o.date);
            let key = '';
            if (period === 'week') key = date.toLocaleDateString([], { weekday: 'short' });
            else if (period === 'month') key = `Week ${Math.min(4, Math.floor((now.getDate() - date.getDate()) / 7) + 1)}`;
            else if (period === 'year') key = date.toLocaleDateString([], { month: 'short' });
            else key = `${Math.floor(date.getHours() / 4) * 4}h`;

            if (buckets[key]) {
                if (o.paymentStatus === 'paid') buckets[key].revenue += o.total;
                buckets[key].orders += 1;
            }
        });

        return Object.values(buckets);
    }, [filteredOrders, period]);

    // Top Products
    const topProducts = useMemo(() => {
        const counts: Record<string, { name: string; sales: number; revenue: number; image?: string }> = {};
        filteredOrders.forEach(o => {
            o.items.forEach(item => {
                if (!counts[item.productId]) {
                    counts[item.productId] = { name: item.productName, sales: 0, revenue: 0, image: item.image };
                }
                counts[item.productId].sales += item.quantity;
                counts[item.productId].revenue += item.price * item.quantity;
            });
        });

        return Object.values(counts)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);
    }, [filteredOrders]);

    // Render SVG Chart
    const renderChart = () => {
        const height = 200;
        const width = 800;
        const padding = 40;
        const maxVal = Math.max(...chartData.map(d => d[activeMetric]), 1) * 1.2;
        
        const points = chartData.map((d, i) => {
            const x = padding + (i * (width - 2 * padding)) / (chartData.length - 1 || 1);
            const y = height - padding - (d[activeMetric] / maxVal) * (height - 2 * padding);
            return { x, y, ...d };
        });

        const pathData = `M ${points[0]?.x} ${points[0]?.y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
        const areaData = pathData + ` L ${points[points.length - 1]?.x} ${height - padding} L ${points[0]?.x} ${height - padding} Z`;

        return (
            <div className="relative w-full h-[300px] bg-white rounded-2xl border border-[var(--glass-border)] p-6 group">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-[var(--text-main)] capitalize">{activeMetric} Trend</h3>
                    <div className="flex gap-2 bg-[var(--surface-1)] p-1 rounded-lg">
                        <button 
                            onClick={() => setActiveMetric('revenue')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeMetric === 'revenue' ? 'bg-white shadow-sm text-[var(--brand-primary)]' : 'text-[var(--text-muted)]'}`}
                        >
                            Revenue
                        </button>
                        <button 
                            onClick={() => setActiveMetric('orders')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeMetric === 'orders' ? 'bg-white shadow-sm text-[var(--brand-primary)]' : 'text-[var(--text-muted)]'}`}
                        >
                            Orders
                        </button>
                    </div>
                </div>
                
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                    <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--brand-primary)" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    
                    {/* Grid Lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
                        const y = height - padding - p * (height - 2 * padding);
                        return (
                            <line key={i} x1={padding} y1={y} x2={width - padding} y2={y} stroke="var(--glass-border)" strokeDasharray="4 4" />
                        );
                    })}

                    <path d={areaData} fill="url(#chartGradient)" className="transition-all duration-500" />
                    <path d={pathData} fill="none" stroke="var(--brand-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-500" />

                    {points.map((p, i) => (
                        <g key={i} className="group/dot">
                            <circle cx={p.x} cy={p.y} r="4" fill="white" stroke="var(--brand-primary)" strokeWidth="2" className="transition-all group-hover/dot:r-6" />
                            <text x={p.x} y={height - 10} textAnchor="middle" className="text-[10px] font-bold fill-[var(--text-muted)] uppercase tracking-wider">{p.label}</text>
                            
                            {/* Tooltip */}
                            <g className="opacity-0 group-hover/dot:opacity-100 transition-opacity pointer-events-none">
                                <rect x={p.x - 40} y={p.y - 35} width="80" height="25" rx="6" fill="black" />
                                <text x={p.x} y={p.y - 18} textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
                                    {activeMetric === 'revenue' ? `$${p.revenue.toFixed(0)}` : `${p.orders} Orders`}
                                </text>
                            </g>
                        </g>
                    ))}
                </svg>
            </div>
        );
    };

    if (!user?.subscriptionTier || user.subscriptionTier === 'free' || user.subscriptionTier === 'core') {
        return (
            <div className="p-4 md:p-8 min-h-[calc(100vh-64px)] flex items-center justify-center bg-gradient-to-tr from-slate-50 via-indigo-50/10 to-blue-50/30">
                <div className="max-w-xl w-full bg-white/80 backdrop-blur-md rounded-3xl p-8 border border-[var(--glass-border)] shadow-xl text-center space-y-6 animate-fade-in relative overflow-hidden group">
                    {/* Floating Glow Orbs */}
                    <div className="absolute -top-12 -right-12 w-40 h-40 bg-[var(--brand-primary)]/10 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500"></div>
                    <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-purple-600/10 rounded-full blur-2xl"></div>

                    <div className="relative w-16 h-16 bg-indigo-50 text-[var(--brand-primary)] rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-md shadow-indigo-100/50 animate-bounce-in">
                        📊
                    </div>

                    <div className="space-y-2 relative z-10">
                        <h2 className="text-2xl font-black text-[var(--text-main)]">
                            {user?.subscriptionTier === 'core' ? 'Upgrade to Advanced Analytics' : 'Unlock Store Analytics'}
                        </h2>
                        <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
                            {user?.subscriptionTier === 'core' 
                                ? 'Your Core plan includes basic analytics on the Dashboard. Upgrade to Growth or Pro to unlock premium interactive charts, conversion tracking, traffic logs, and historical peaks.'
                                : 'Transform raw order data into actionable business intelligence. Upgrade your plan to get deep analytical insights.'}
                        </p>
                    </div>

                    {/* Value Propositions */}
                    <div className="bg-slate-50/50 rounded-2xl p-4 text-left border border-slate-100 space-y-3 relative z-10">
                        <div className="flex gap-3 items-start">
                            <span className="text-lg">💰</span>
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-main)]">Real-time Revenue & Fulfillment Tracking</h4>
                                <p className="text-[10px] text-[var(--text-muted)]">Monitor total sales, average order value, and completion metrics.</p>
                            </div>
                        </div>
                        <div className="flex gap-3 items-start">
                            <span className="text-lg">👁️</span>
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-main)]">Store Traffic & Conversion Funnels</h4>
                                <p className="text-[10px] text-[var(--text-muted)]">Understand how many consumers view your store and make purchases.</p>
                            </div>
                        </div>
                        <div className="flex gap-3 items-start">
                            <span className="text-lg">📈</span>
                            <div>
                                <h4 className="text-xs font-bold text-[var(--text-main)]">Product Performance Intelligence</h4>
                                <p className="text-[10px] text-[var(--text-muted)]">Discover your top-selling products and peak sales windows.</p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 relative z-10">
                        <a 
                            href="/merchant/subscription" 
                            className="inline-block w-full py-3.5 bg-[var(--brand-primary)] text-white font-bold rounded-xl hover:brightness-110 shadow-lg shadow-[var(--brand-primary)]/20 transition-all text-center"
                        >
                            View Plans & Upgrade
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    if (!can('analytics:read')) {
        return (
            <div className="p-6 max-w-xl mx-auto text-center mt-16 space-y-6 animate-fade-in">
                <div className="text-6xl">📊</div>
                <h2 className="text-2xl font-black text-[var(--text-main)]">Access Restricted</h2>
                <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                    Analytics are available to Store Owners, Managers, and Marketing Specialists. Staff and Picker accounts do not have access to analytics data.
                </p>
                <button
                    onClick={() => window.history.back()}
                    className="px-6 py-2.5 bg-[var(--brand-primary)] text-white font-bold rounded-xl shadow-lg shadow-[var(--brand-primary)]/20 hover:brightness-110 active:scale-95 transition-all"
                >
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 animate-fade-in space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="page-headline">Store Analytics</h1>
                    <p className="text-[var(--text-muted)] font-medium">Insights into your store performance and customer trends.</p>
                </div>
                
                <div className="flex bg-white border border-[var(--glass-border)] p-1 rounded-xl shadow-sm">
                    {(['today', 'week', 'month', 'year'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-4 py-2 text-sm font-bold capitalize rounded-lg transition-all ${period === p ? 'bg-[var(--brand-primary)] text-white shadow-md shadow-[var(--brand-primary)]/20' : 'text-[var(--text-muted)] hover:bg-[var(--surface-1)]'}`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {kpis.map((kpi, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-2xl border border-[var(--glass-border)] shadow-sm hover:shadow-md transition-shadow group">
                        <div className={`w-10 h-10 ${kpi.bg} ${kpi.color} rounded-xl flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform`}>
                            {kpi.icon}
                        </div>
                        <p className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">{kpi.label}</p>
                        <h3 className="text-xl font-black text-[var(--text-main)]">{kpi.value}</h3>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Trend Chart */}
                <div className="lg:col-span-2">
                    {renderChart()}
                </div>

                {/* Top Products */}
                <div className="bg-white rounded-2xl border border-[var(--glass-border)] p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-black text-[var(--text-main)]">Top Products</h3>
                        <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">By Revenue</span>
                    </div>
                    
                    <div className="space-y-4">
                        {topProducts.length > 0 ? topProducts.map((p, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-[var(--surface-1)] transition-colors border border-transparent hover:border-[var(--glass-border)] group">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden">
                                        {p.image ? (
                                            <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-lg">📦</div>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-[var(--text-main)] truncate w-32">{p.name}</p>
                                        <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-tighter">{p.sales} Units Sold</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-[var(--brand-primary)]">${p.revenue.toFixed(2)}</p>
                                    <div className="w-12 h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                                        <div 
                                            className="h-full bg-[var(--brand-primary)] rounded-full" 
                                            style={{ width: `${(p.revenue / topProducts[0].revenue) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-10 text-[var(--text-muted)] italic text-sm">
                                No sales data yet.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Order Status Breakdown */}
                <div className="bg-white p-6 rounded-2xl border border-[var(--glass-border)] shadow-sm">
                    <h3 className="text-lg font-black text-[var(--text-main)] mb-6">Order Fulfillment</h3>
                    <div className="space-y-6">
                        {(() => {
                            const statuses = [
                                { label: 'Placed', key: 'placed', color: 'bg-blue-500' },
                                { label: 'Preparing', key: 'preparing', color: 'bg-orange-500' },
                                { label: 'Out for Delivery', key: 'out_for_delivery', color: 'bg-indigo-500' },
                                { label: 'Delivered', key: 'delivered', color: 'bg-green-500' },
                                { label: 'Cancelled', key: 'cancelled', color: 'bg-red-500' },
                            ];
                            const total = filteredOrders.length || 1;
                            
                            return statuses.map(s => {
                                const count = filteredOrders.filter(o => o.status === s.key).length;
                                const pct = (count / total) * 100;
                                return (
                                    <div key={s.key}>
                                        <div className="flex justify-between text-xs font-bold mb-2">
                                            <span className="text-[var(--text-main)]">{s.label}</span>
                                            <span className="text-[var(--text-muted)]">{count} ({pct.toFixed(0)}%)</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div className={`h-full ${s.color} rounded-full transition-all duration-1000`} style={{ width: `${pct}%` }}></div>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>

                {/* Market Insights */}
                <div className="bg-[var(--brand-primary-dark)] p-8 rounded-3xl text-white relative overflow-hidden group shadow-xl">
                    <div className="relative z-10 h-full flex flex-col justify-between">
                        <div>
                            <h3 className="text-2xl font-black mb-2 flex items-center gap-2 text-white">
                                <span>💡</span> Pro Insights
                            </h3>
                            <p className="text-white font-medium leading-relaxed">
                                Your store conversion rate is <strong>{(kpis[4].value)}</strong>. Improving product images or creating a <strong>Flash Deal</strong> could increase this by up to 15%.
                            </p>
                        </div>
                        
                        <div className="mt-8 flex gap-4">
                            <div className="flex-1 bg-black/20 backdrop-blur-md p-4 rounded-2xl border border-white/20">
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/80 mb-1">Peak Day</p>
                                <p className="text-xl font-black text-white">
                                    {chartData.sort((a, b) => b.revenue - a.revenue)[0]?.label || '---'}
                                </p>
                            </div>
                            <div className="flex-1 bg-black/20 backdrop-blur-md p-4 rounded-2xl border border-white/20">
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/80 mb-1">Peak Hour</p>
                                <p className="text-xl font-black text-white">12:00 - 16:00</p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Decor */}
                    <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform"></div>
                    <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-black/10 rounded-full blur-3xl"></div>
                </div>
            </div>
        </div>
    );
};

export default MerchantAnalytics;
