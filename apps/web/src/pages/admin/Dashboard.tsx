import React, { useMemo } from 'react';
import '../../styles/design-system.css';
import { useMarketplace } from '../../context/MarketplaceContext';

const AdminDashboard: React.FC = () => {
    const { stores } = useMarketplace();

    // specific aggregation logic
    const stats = useMemo(() => {
        const allStores = Object.values(stores);
        const totalStores = allStores.length;
        const totalProducts = allStores.reduce((acc: number, store: any) => acc + (store.products?.length || 0), 0);
        const totalDeals = allStores.reduce((acc: number, store: any) =>
            acc + (store.oneDayOffers?.length || 0) + (store.saleItems?.length || 0), 0);
        // Active flyers calculation (valid date)
        const activeFlyers = allStores.filter((store: any) => store.flyer?.title && new Date(store.flyer.validUntil) > new Date()).length;

        return [
            { label: 'Registered Stores', value: totalStores.toString(), change: '+2 pending approval', icon: '🏪', color: 'bg-blue-100 text-blue-700' },
            { label: 'Total Products', value: totalProducts.toLocaleString(), change: 'Across Platform', icon: '📦', color: 'bg-purple-100 text-purple-700' },
            { label: 'Active Deals', value: totalDeals.toString(), change: 'Live Offers', icon: '🏷️', color: 'bg-orange-100 text-orange-700' },
            { label: 'Platform Revenue', value: '$45,200', change: '+12% vs last month', icon: '💰', color: 'bg-green-100 text-green-700' } // Mock revenue for now
        ];
    }, [stores]);

    return (
        <div className="p-6 animate-fade-in pb-20">
            {/* Platform Hero */}
            <div className="mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-dark)] p-8 text-white shadow-lg">
                <div className="relative z-10 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold mb-2 text-white">🛡️ System Administration</h1>
                        <p className="opacity-70 text-lg">Monitoring platform health and merchant activity.</p>
                    </div>
                    <div className="text-right">
                        <div className="text-sm opacity-60 uppercase tracking-wider font-medium">System Status</div>
                        <div className="text-2xl font-bold flex items-center gap-2 text-green-400">
                            <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]"></span>
                            All Systems Operational
                        </div>
                    </div>
                </div>
            </div>

            {/* Platform Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {stats.map((stat, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-xl border border-[var(--glass-border)] shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${stat.color}`}>
                                {stat.icon}
                            </div>
                        </div>
                        <div className="mt-2">
                            <p className="text-[var(--text-muted)] text-sm font-medium">{stat.label}</p>
                            <h3 className="text-2xl font-bold text-[var(--text-main)]">{stat.value}</h3>
                            <p className="text-xs text-[var(--text-muted)] mt-1">{stat.change}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Store Performance Leaderboard */}
                <div className="bg-white rounded-xl border border-[var(--glass-border)] p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-[var(--text-main)]">Platform Activity</h2>
                        <span className="text-xs font-bold bg-[var(--surface-1)] px-2 py-1 rounded text-[var(--text-muted)]">Live Feed</span>
                    </div>
                    <div className="space-y-4">
                        {/* Dynamically Map top 5 stores based on stats */}
                        {Object.values(stores).slice(0, 5).map((store: any, idx) => (
                            <div key={store.id} className="flex items-center justify-between p-3 hover:bg-[var(--surface-1)] rounded-lg transition-colors border border-transparent hover:border-[var(--glass-border)]">
                                <div className="flex items-center gap-3">
                                    <div className="font-bold text-[var(--text-muted)] w-4 text-center">{idx + 1}</div>
                                    <img src={store.logo} className="w-10 h-10 rounded-full object-cover bg-gray-100" alt={store.name} />
                                    <div>
                                        <div className="font-bold text-sm text-[var(--text-main)]">{store.name}</div>
                                        <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                                            <span>📦 {store.products?.length || 0} Products</span>
                                            {store.flyer?.title && <span className="text-green-600"> • Has Flyer</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-bold">
                                        ⭐ {store.rating}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* System Health / Logs */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-[var(--glass-border)] p-6 shadow-sm">
                        <h2 className="text-xl font-bold text-[var(--text-main)] mb-4">System Health</h2>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">API Latency</span>
                                <div className="flex-1 mx-4 h-2 bg-[var(--surface-1)] rounded-full overflow-hidden">
                                    <div className="w-[15%] h-full bg-green-500 rounded-full"></div>
                                </div>
                                <span className="text-xs font-bold text-green-600">24ms</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Database Load</span>
                                <div className="flex-1 mx-4 h-2 bg-[var(--surface-1)] rounded-full overflow-hidden">
                                    <div className="w-[45%] h-full bg-blue-500 rounded-full"></div>
                                </div>
                                <span className="text-xs font-bold text-blue-600">45%</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Storage Usage</span>
                                <div className="flex-1 mx-4 h-2 bg-[var(--surface-1)] rounded-full overflow-hidden">
                                    <div className="w-[72%] h-full bg-yellow-500 rounded-full"></div>
                                </div>
                                <span className="text-xs font-bold text-yellow-600">72%</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl">
                        <div className="flex items-start gap-4">
                            <span className="text-2xl">⚡</span>
                            <div>
                                <h3 className="font-bold text-blue-900 mb-1">Pending Actions</h3>
                                <p className="text-sm text-blue-800 mb-3">
                                    There are <strong>2 new merchant applications</strong> requiring review.
                                </p>
                                <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-700 transition-colors">
                                    Review Applications
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
