import React, { useMemo, useState } from 'react';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useOrders } from '../../context/OrderContext';
import '../../styles/design-system.css';

const StoreInsights: React.FC = () => {
    const { stores } = useMarketplace();
    const { orders } = useOrders();
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'sales' | 'orders' | 'products' | 'rating'>('sales');

    const storeList = Object.values(stores);

    // Aggregate stats per store
    const storeStats = useMemo(() => {
        const stats: Record<string, {
            orderCount: number;
            totalSales: number;
            activeShoppers: Set<string>;
            recentOrders: number;
        }> = {};

        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        orders.forEach(order => {
            if (!stats[order.storeId]) {
                stats[order.storeId] = {
                    orderCount: 0,
                    totalSales: 0,
                    activeShoppers: new Set(),
                    recentOrders: 0
                };
            }

            stats[order.storeId].orderCount++;
            stats[order.storeId].totalSales += order.total || 0;
            stats[order.storeId].activeShoppers.add(order.customerId);

            if (new Date(order.date) > twentyFourHoursAgo) {
                stats[order.storeId].recentOrders++;
            }
        });

        return stats;
    }, [orders]);

    const enrichedStores = useMemo(() => {
        return storeList.map(store => {
            const stats = storeStats[store.id] || {
                orderCount: 0,
                totalSales: 0,
                activeShoppers: new Set(),
                recentOrders: 0
            };

            // Calculate popularity score (weighted)
            // 40% Sales, 30% Rating, 20% Product Count, 10% Recent Activity
            const normalizedSales = Math.min(stats.totalSales / 1000, 1);
            const normalizedRating = (store.rating || 0) / 5;
            const normalizedProducts = Math.min((store.productCount || store.products?.length || 0) / 500, 1);
            const normalizedActivity = Math.min(stats.recentOrders / 10, 1);

            const popularityScore = (
                normalizedSales * 0.4 +
                normalizedRating * 0.3 +
                normalizedProducts * 0.2 +
                normalizedActivity * 0.1
            ) * 100;

            return {
                ...store,
                ...stats,
                popularityScore: Math.round(popularityScore)
            };
        }).filter(store => 
            store.name.toLowerCase().includes(searchTerm.toLowerCase())
        ).sort((a, b) => {
            if (sortBy === 'sales') return b.totalSales - a.totalSales;
            if (sortBy === 'orders') return b.orderCount - a.orderCount;
            if (sortBy === 'products') return (b.productCount || b.products?.length || 0) - (a.productCount || a.products?.length || 0);
            if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
            return 0;
        });
    }, [storeList, storeStats, searchTerm, sortBy]);

    // Platform level totals
    const totals = useMemo(() => {
        return {
            sales: enrichedStores.reduce((acc, s) => acc + s.totalSales, 0),
            orders: enrichedStores.reduce((acc, s) => acc + s.orderCount, 0),
            activeUsers: new Set(orders.map(o => o.customerId)).size
        };
    }, [enrichedStores, orders]);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-main)]">Store Performance Insights</h1>
                    <p className="text-[var(--text-muted)] text-sm">Analyze merchant productivity and shopper engagement</p>
                </div>
            </div>

            {/* Platform Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-[var(--glass-border)] shadow-sm">
                    <p className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider mb-1">Total Marketplace Sales</p>
                    <p className="text-3xl font-bold text-[var(--brand-primary)]">${totals.sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <p className="text-[10px] text-green-600 font-bold mt-2 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Live Transactions
                    </p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-[var(--glass-border)] shadow-sm">
                    <p className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider mb-1">Total Orders</p>
                    <p className="text-3xl font-bold text-[var(--text-main)]">{totals.orders.toLocaleString()}</p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-2">Across {enrichedStores.length} Stores</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-[var(--glass-border)] shadow-sm">
                    <p className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider mb-1">Active Shoppers (Unique)</p>
                    <p className="text-3xl font-bold text-indigo-600">{totals.activeUsers.toLocaleString()}</p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-2">Based on order history</p>
                </div>
            </div>

            {/* Filters & Controls */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-[var(--glass-border)] shadow-sm">
                <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                    <input
                        type="text"
                        placeholder="Search stores..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--text-muted)] uppercase">Sort By:</span>
                    <select
                        className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] bg-white text-sm font-medium"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                    >
                        <option value="sales">Sales Volume</option>
                        <option value="orders">Order Count</option>
                        <option value="products">Product Inventory</option>
                        <option value="rating">Customer Rating</option>
                    </select>
                </div>
            </div>

            {/* Insights Table */}
            <div className="glass-panel overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[var(--surface-2)] text-[var(--text-muted)] text-[10px] uppercase tracking-wider font-bold">
                            <tr>
                                <th className="p-4">Store Identity</th>
                                <th className="p-4 text-center">Products</th>
                                <th className="p-4 text-center">Orders</th>
                                <th className="p-4 text-center">Total Sales</th>
                                <th className="p-4 text-center">Rating</th>
                                <th className="p-4 text-center">Active Users</th>
                                <th className="p-4 text-center">Popularity</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--glass-border)]">
                            {enrichedStores.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-[var(--text-muted)] italic">
                                        No performance data found.
                                    </td>
                                </tr>
                            ) : (
                                enrichedStores.map((store) => (
                                    <tr key={store.id} className="hover:bg-[var(--surface-1)] transition-colors group">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-xl overflow-hidden shadow-sm shrink-0">
                                                    {store.logoUrl ? <img src={store.logoUrl} alt="" className="w-full h-full object-cover" /> : <span>{store.logo || '🏪'}</span>}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-[var(--text-main)] group-hover:text-[var(--brand-primary)] transition-colors">{store.name}</div>
                                                    <div className="text-[10px] text-[var(--text-muted)]">{store.businessType || 'General Retail'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="font-mono font-bold text-sm">{store.productCount || store.products?.length || 0}</span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="font-mono font-bold text-sm text-blue-600">{store.orderCount}</span>
                                            {store.recentOrders > 0 && (
                                                <div className="text-[9px] text-green-600 font-bold mt-0.5">+{store.recentOrders} new (24h)</div>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="font-mono font-bold text-sm">${store.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <div className="text-sm font-bold flex items-center gap-1">
                                                    ⭐ {(store.rating || 0).toFixed(1)}
                                                </div>
                                                <div className="text-[10px] text-[var(--text-muted)]">{store.reviewCount || 0} reviews</div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="font-bold text-sm">{store.activeShoppers.size}</span>
                                                <span className="text-[9px] text-[var(--text-muted)] uppercase">Unique</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full transition-all duration-1000 ${
                                                            store.popularityScore > 75 ? 'bg-green-500' :
                                                            store.popularityScore > 40 ? 'bg-blue-500' :
                                                            'bg-orange-500'
                                                        }`}
                                                        style={{ width: `${store.popularityScore}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-[10px] font-bold text-[var(--text-muted)]">{store.popularityScore}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StoreInsights;
