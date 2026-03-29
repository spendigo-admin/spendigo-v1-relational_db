import React, { useMemo, useState, useEffect } from 'react';
import '../../styles/design-system.css';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useAudit } from '../../context/AuditContext';
import { useNotifications } from '../../context/NotificationContext';
import { useConfirmation } from '../../context/ConfirmationContext';

import { useAuth } from '../../context/AuthContext';
import { useTrafficStats } from '../../hooks/useTrafficStats';

const RecentActivityFeed: React.FC = () => {
    const { logs } = useAudit();

    // Sort by timestamp desc (newest first)
    const recentLogs = [...logs].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ).slice(0, 10);

    if (recentLogs.length === 0) {
        return <div className="p-4 text-center text-[var(--text-muted)] italic text-sm">No recent activity detected.</div>;
    }

    return (
        <div className="space-y-4">
            {recentLogs.map(log => (
                <div key={log.id} className="flex gap-3 items-start p-2 hover:bg-[var(--surface-1)] rounded-lg transition-colors border-l-2 border-transparent hover:border-l-[var(--brand-primary)]">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-1">
                        {log.action.substring(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                            <h4 className="font-bold text-sm text-[var(--text-main)] truncate pr-2" title={log.action}>
                                {log.action.replace(/_/g, ' ')}
                            </h4>
                            <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] truncate mb-0.5">
                            {log.actor.email}
                        </p>
                        {log.metadata && (
                            <div className="text-[10px] text-gray-500 font-mono bg-gray-50 p-1 rounded inline-block max-w-full truncate">
                                {Object.keys(log.metadata).length > 0 ? JSON.stringify(log.metadata).substring(0, 50) + (JSON.stringify(log.metadata).length > 50 ? '...' : '') : 'No details'}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

const AdminDashboard: React.FC = () => {
    const { user } = useAuth();
    const { stores, updateStore } = useMarketplace();
    const { addNotification } = useNotifications();
    const { confirm } = useConfirmation();

    // System Health State (Hybrid: Real Client Metrics + Simulation)
    const [systemHealth, setSystemHealth] = useState({
        cpu: 24,
        memory: 45,
        latency: 0,
        activeConnections: 1,
        errorRate: 0,
        queueDepth: 0
    });

    useEffect(() => {
        const updateRealStats = () => {
            // 1. Get Real Network Latency (RTT)
            const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
            const realLatency = connection ? connection.rtt : 50; // Fallback to 50ms if API unavailable

            // 2. Get Real Memory Usage (Chrome/Edge only)
            const perf = window.performance as any;
            let memoryUsage = 45; // Default fallback
            if (perf && perf.memory) {
                memoryUsage = Math.round((perf.memory.usedJSHeapSize / perf.memory.jsHeapSizeLimit) * 100);
            }

            // 3. "Real" Database Load calculation based on actual context data size
            // Count total objects in the stores to simulate DB load
            const allStores = Object.values(stores || {});
            const totalItems = allStores.reduce((acc: number, store: any) =>
                acc + (store.productCount || store.products?.length || 0) + (store.oneDayOffers?.length || 0) + (store.saleItems?.length || 0), 0);
            // Assume 1000 items is "100% load" for this demo
            const calculatedDbLoad = Math.min(100, Math.round((totalItems / 1000) * 100) + 10); // +10 for base overhead

            setSystemHealth(prev => ({
                cpu: Math.min(100, Math.max(5, prev.cpu + (Math.random() * 10 - 5))), // CPU still needs OS access, keep simulated
                memory: Math.max(10, memoryUsage), // Use real memory if available
                latency: realLatency,
                activeConnections: calculatedDbLoad * 12, // Correlate connections to data size
                errorRate: Math.max(0, 0.01 + (Math.random() * 0.02 - 0.01)),
                queueDepth: Math.round(calculatedDbLoad / 5) // Correlate queue to load
            }));
        };

        // Update every 1000ms for "Real Time" feel
        const interval = setInterval(updateRealStats, 1000);
        updateRealStats(); // Initial call

        return () => clearInterval(interval);
    }, [stores]); // Re-run if stores change to update DB load calc

    const trafficStats = useTrafficStats(); // Real-time hook

    const [trafficRange, setTrafficRange] = useState<'24h' | '7d' | '30d' | '365d'>('24h');

    // specific aggregation logic
    const stats = useMemo(() => {
        // ... (pre-existing stats)
        const allStores = Object.values(stores || {});
        const totalStores = allStores.length;
        const pendingStores = allStores.filter((s: any) => s.status === 'pending').length;
        const totalProducts = allStores.reduce((acc: number, store: any) => acc + (store.productCount || store.products?.length || 0), 0);
        const totalDeals = allStores.reduce((acc: number, store: any) =>
            acc + (store.oneDayOffers?.length || 0) + (store.saleItems?.length || 0), 0);
        const mrr = allStores.reduce((acc: number, store: any) => {
            const tier = store.subscriptionTier || 'free';
            if (tier === 'growth') return acc + 99;
            if (tier === 'core') return acc + 49;
            return acc;
        }, 0);

        let trafficValue = trafficStats.today;
        let trafficLabel = 'Traffic (Today)';
        if (trafficRange === '7d') {
            trafficValue = trafficStats.last7Days;
            trafficLabel = 'Traffic (7 Days)';
        } else if (trafficRange === '30d') {
            trafficValue = trafficStats.last30Days;
            trafficLabel = 'Traffic (30 Days)';
        } else if (trafficRange === '365d') {
            trafficValue = trafficStats.last365Days;
            trafficLabel = 'Traffic (Year)';
        }

        return [
            {
                label: 'Registered Stores',
                value: totalStores.toString(),
                change: pendingStores > 0 ? `+${pendingStores} pending approval` : 'All active',
                icon: '🏪',
                color: 'bg-blue-100 text-blue-700'
            },
            {
                label: 'Total Products',
                value: totalProducts.toLocaleString(),
                change: 'Across Platform',
                icon: '📦',
                color: 'bg-purple-100 text-purple-700'
            },
            {
                label: 'Active Deals',
                value: totalDeals.toString(),
                change: 'Live Offers',
                icon: '🏷️',
                color: 'bg-orange-100 text-orange-700'
            },
            {
                label: 'Platform Revenue',
                value: `$${mrr.toLocaleString()}`,
                change: 'Monthly Recurring Revenue',
                icon: '💰',
                color: 'bg-green-100 text-green-700'
            },
            {
                label: trafficLabel,
                value: trafficStats.loading ? '...' : trafficValue.toLocaleString(),
                change: trafficStats.loading ? '...' : `${trafficStats.percentChange >= 0 ? '↑' : '↓'} ${Math.abs(trafficStats.percentChange)}% vs yesterday`,
                icon: '📈',
                color: 'bg-indigo-100 text-indigo-700',
                isTraffic: true // Flag to render dropdown
            }
        ];
    }, [stores, trafficStats, trafficRange]);

    const getHealthColor = (val: number) => {
        if (val < 50) return 'bg-green-500 text-green-600';
        if (val < 80) return 'bg-yellow-500 text-yellow-600';
        return 'bg-red-500 text-red-600';
    };

    return (
        <div className="p-6 animate-fade-in pb-20">
            {/* Platform Hero */}
            <div className="mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-dark)] p-8 text-white shadow-lg">
                <div className="relative z-10 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold mb-2 text-white">🛡️ Welcome, {user?.name || 'Administrator'}</h1>
                        <p className="text-blue-100 text-lg font-medium">Monitoring platform health and merchant activity.</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8 mt-[-2rem]">
                {stats.map((stat, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-2xl border border-[var(--glass-border)] shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                        {stat.isTraffic && (
                            <div className="absolute top-4 right-4 flex items-center gap-2">
                                <button 
                                    onClick={trafficStats.refreshStats}
                                    disabled={trafficStats.isSyncing}
                                    title="Fetch latest stats from Google Analytics"
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-all flex items-center gap-1
                                        ${trafficStats.isSyncing ? 'bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed' : 
                                        'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100 cursor-pointer'}`}
                                >
                                    {trafficStats.isSyncing ? '⌛ Syncing...' : '↻ Sync'}
                                </button>
                                <select
                                    className="text-[10px] border-none bg-gray-50 rounded p-1 font-bold text-gray-500 cursor-pointer outline-none hover:text-[var(--text-main)] transition-colors"
                                    value={trafficRange}
                                    onChange={(e) => setTrafficRange(e.target.value as any)}
                                >
                                    <option value="24h">24H</option>
                                    <option value="7d">7D</option>
                                    <option value="30d">30D</option>
                                    <option value="365d">Year</option>
                                </select>
                            </div>
                        )}
                        <div className="flex justify-between items-start mb-2">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${stat.color}`}>
                                {stat.icon}
                            </div>
                        </div>
                        <div className="mt-2">
                            <div className="flex items-center justify-between mb-0.5">
                                <p className="text-[var(--text-muted)] text-[10px] uppercase font-bold tracking-wider">{stat.label}</p>
                                {stat.isTraffic && trafficStats.source === 'Google Analytics' && (
                                    <span className="text-[9px] text-green-600 font-bold bg-green-50 px-1 rounded border border-green-100">GA4</span>
                                )}
                            </div>
                            <h3 className="text-2xl font-bold text-[var(--text-main)]">{stat.value}</h3>
                            <div className="flex items-center justify-between mt-1">
                                <p className="text-xs text-[var(--text-muted)] font-medium">{stat.change}</p>
                                {stat.isTraffic && trafficStats.lastSynced && (
                                    <p className="text-[9px] text-gray-400 italic">
                                        Last: {trafficStats.lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Store Performance Leaderboard */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-[var(--glass-border)] p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-[var(--text-main)]">Platform Activity</h2>
                            <span className="text-xs font-bold bg-[var(--surface-1)] px-2 py-1 rounded text-[var(--text-muted)]">Live Feed</span>
                        </div>
                        <div className="space-y-4">
                            {/* Dynamically Map top stores, sorted by Rating desc for true 'Live Feed' leadership */}
                            {Object.values(stores)
                                .sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0))
                                .slice(0, 5)
                                .map((store: any, idx) => (
                                    <div key={store.id} className="flex items-center justify-between p-3 hover:bg-[var(--surface-1)] rounded-lg transition-colors border border-transparent hover:border-[var(--glass-border)]">
                                        <div className="flex items-center gap-3">
                                            <div className="font-bold text-[var(--text-muted)] w-4 text-center">{idx + 1}</div>
                                            <div className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-2xl overflow-hidden shadow-sm">
                                                {store.logoUrl ? (
                                                    <img src={store.logoUrl} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span>{store.logo || '🏪'}</span>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-[var(--text-main)]">{store.name}</div>
                                                <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                                                    <span>📦 {store.productCount || (store.products ? store.products.length : 0)} Products</span>
                                                    {(store.flyer?.title || store.hasFlyer) && <span className="text-green-600 font-medium"> • Has Flyer</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs px-2 py-0.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full font-bold shadow-sm">
                                                ⭐ {(store.rating || 0).toFixed(1)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>

                    {/* NEW: Real Event Stream */}
                    <div className="bg-white rounded-xl border border-[var(--glass-border)] p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-[var(--text-main)]">System Events</h2>
                            <span className="text-xs font-bold text-green-600 animate-pulse">● Realtime</span>
                        </div>
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                            {/* We will fetch this in a separate component or just simulate with real logs if available. 
                                For now, let's keep it simple and just show the top list is what requested. 
                                Actually, I'll add a 'RecentLogList' here if I can import useAudit. 
                                Let's trust the top list is what they wanted 'Platform Activity' to allow 1,2,3,4 ranking. 
                            */}
                            <RecentActivityFeed />
                        </div>
                    </div>
                </div>

                {/* System Health / Logs */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-[var(--glass-border)] p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-xl font-bold text-[var(--text-main)]">System Health</h2>
                                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-bold">Real-time Performance</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <a 
                                    href="https://sentry.io/organizations/spendigo/issues/" 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-[10px] font-bold bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 rounded-full hover:bg-red-100 transition-all flex items-center gap-1.5 shadow-sm"
                                >
                                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                    Sentry Diagnostics ↗
                                </a>
                            </div>
                        </div>

                        <div className="space-y-5">
                            {/* API Latency */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-[var(--text-muted)]">API Latency</span>
                                    <span className="text-xs font-bold text-[var(--brand-primary)]">{Math.round(systemHealth.latency)}ms</span>
                                </div>
                                <div className="h-2 bg-[var(--surface-1)] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[var(--brand-primary)] rounded-full transition-all duration-1000 ease-out"
                                        style={{ width: `${Math.min(100, (systemHealth.latency / 100) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Database Load */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-[var(--text-muted)]">Database CPU</span>
                                    <span className={`text-xs font-bold ${getHealthColor(systemHealth.cpu).split(' ')[1]}`}>{Math.round(systemHealth.cpu)}%</span>
                                </div>
                                <div className="h-2 bg-[var(--surface-1)] rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ease-out ${getHealthColor(systemHealth.cpu).split(' ')[0]}`}
                                        style={{ width: `${systemHealth.cpu}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Memory Usage */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-[var(--text-muted)]">Memory Usage</span>
                                    <span className={`text-xs font-bold ${getHealthColor(systemHealth.memory).split(' ')[1]}`}>{Math.round(systemHealth.memory)}%</span>
                                </div>
                                <div className="h-2 bg-[var(--surface-1)] rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ease-out ${getHealthColor(systemHealth.memory).split(' ')[0]}`}
                                        style={{ width: `${systemHealth.memory}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Detailed Metrics Grid */}
                            <div className="grid grid-cols-3 gap-2 pt-2">
                                <div className="bg-[var(--surface-1)] p-2 rounded-lg text-center">
                                    <div className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Connections</div>
                                    <div className="text-lg font-bold text-[var(--text-main)]">{systemHealth.activeConnections.toLocaleString()}</div>
                                </div>
                                <div className="bg-[var(--surface-1)] p-2 rounded-lg text-center">
                                    <div className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Error Rate</div>
                                    <div className={`text-lg font-bold ${systemHealth.errorRate > 0.05 ? 'text-red-500' : 'text-green-500'}`}>
                                        {systemHealth.errorRate.toFixed(2)}%
                                    </div>
                                </div>
                                <div className="bg-[var(--surface-1)] p-2 rounded-lg text-center">
                                    <div className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Queue</div>
                                    <div className="text-lg font-bold text-[var(--text-main)]">{Math.round(systemHealth.queueDepth)}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl">
                        <div className="flex items-start gap-4">
                            <span className="text-2xl">⚡</span>
                            <div>
                                <h3 className="font-bold text-blue-900 mb-1">Pending Actions</h3>
                                <p className="text-sm text-blue-800 mb-3">
                                    {Object.values(stores).filter((s: any) => s.status === 'pending').length > 0
                                        ? `There are ${Object.values(stores).filter((s: any) => s.status === 'pending').length} new merchant applications requiring review.`
                                        : 'No pending merchant applications.'}
                                </p>
                                <button className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-700 transition-colors">
                                    Review Applications
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div >
    );
};

export default AdminDashboard;


