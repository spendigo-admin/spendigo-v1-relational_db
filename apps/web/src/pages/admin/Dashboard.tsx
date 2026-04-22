import React, { useMemo, useState, useEffect } from 'react';
import '../../styles/design-system.css';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, functions } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useAudit } from '../../context/AuditContext';
import { useNotifications } from '../../context/NotificationContext';
import { useConfirmation } from '../../context/ConfirmationContext';

import { useAuth } from '../../context/AuthContext';
import { useTrafficStats } from '../../hooks/useTrafficStats';
import { Link } from 'react-router-dom';

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

    const trafficStats = useTrafficStats(); // Real-time hook

    // Real-time active deal count from subcollections
    const [liveDealsCount, setLiveDealsCount] = useState<number | null>(null);
    useEffect(() => {
        const storeIds = Object.keys(stores);
        if (storeIds.length === 0) return;

        const now = new Date();
        const counts: Record<string, number> = {};
        const unsubscribes: (() => void)[] = [];

        storeIds.forEach(storeId => {
            const dealsRef = collection(db, 'stores', storeId, 'deals');
            const unsub = onSnapshot(dealsRef, (snap) => {
                counts[storeId] = snap.docs.filter(d => {
                    const data = d.data();
                    if (data.status !== 'active') return false;
                    if (data.endDate && new Date(data.endDate) < now) return false;
                    return true;
                }).length;
                setLiveDealsCount(Object.values(counts).reduce((a, b) => a + b, 0));
            });
            unsubscribes.push(unsub);
        });

        return () => unsubscribes.forEach(u => u());
    }, [Object.keys(stores).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

    const [trafficRange, setTrafficRange] = useState<'24h' | '7d' | '30d' | '365d'>('24h');

    // specific aggregation logic
    const stats = useMemo(() => {
        const allStores = Object.values(stores || {});
        const totalStores = allStores.length;
        const pendingStores = allStores.filter((s: any) => s.status === 'pending').length;
        const totalProducts = allStores.reduce((acc: number, store: any) => acc + (store.productCount || store.products?.length || 0), 0);
        const totalDeals = liveDealsCount !== null
            ? liveDealsCount
            : allStores.reduce((acc: number, store: any) =>
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
                value: liveDealsCount === null ? '...' : totalDeals.toString(),
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
    }, [stores, trafficStats, trafficRange, liveDealsCount]);

    return (
        <div className="p-4 md:p-6 animate-fade-in pb-20">
            {/* Platform Hero */}
            <div className="mb-6 md:mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-dark)] p-6 md:p-8 text-white shadow-lg">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold mb-2 text-white">🛡️ Welcome, {user?.name || 'Administrator'}</h1>
                        <p className="text-blue-100 text-base md:text-lg font-medium">Monitoring platform health and activities.</p>
                    </div>
                    <div className="w-full md:w-auto p-4 bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
                        <div className="text-[10px] opacity-80 uppercase tracking-widest font-bold mb-1">System Status</div>
                        <div className="text-xl font-bold flex items-center gap-2 text-green-400">
                            <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]"></span>
                            Operational
                        </div>
                    </div>
                </div>
            </div>

            {/* Platform Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-6 mb-8 md:mt-[-2rem]">
                {stats.map((stat, idx) => (
                    <div key={idx} className={`bg-white p-4 md:p-6 rounded-2xl border border-[var(--glass-border)] shadow-sm hover:shadow-md transition-all relative overflow-hidden group ${idx === 4 ? 'col-span-2 md:col-span-1' : ''}`}>
                        {stat.isTraffic && (
                            <div className="absolute top-2 right-2 md:top-4 md:right-4 flex items-center gap-1 md:gap-2">
                                <button 
                                    onClick={trafficStats.refreshStats}
                                    disabled={trafficStats.isSyncing}
                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition-all
                                        ${trafficStats.isSyncing ? 'bg-gray-50 text-gray-400 border-gray-100' : 
                                        'bg-blue-50 text-blue-600 border-blue-100'}`}
                                >
                                    {trafficStats.isSyncing ? '⌛' : '↻'}
                                </button>
                                <select
                                    className="text-[9px] border-none bg-gray-50 rounded p-1 font-bold text-gray-500 outline-none"
                                    value={trafficRange}
                                    onChange={(e) => setTrafficRange(e.target.value as any)}
                                >
                                    <option value="24h">24H</option>
                                    <option value="7d">7D</option>
                                    <option value="30d">30D</option>
                                </select>
                            </div>
                        )}
                        <div className="flex justify-between items-start mb-2">
                            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-xl md:text-2xl ${stat.color}`}>
                                {stat.icon}
                            </div>
                        </div>
                        <div className="mt-2">
                            <p className="text-[var(--text-muted)] text-[9px] md:text-[10px] uppercase font-bold tracking-wider mb-0.5">{stat.label}</p>
                            <h3 className="text-xl md:text-2xl font-bold text-[var(--text-main)] truncate">{stat.value}</h3>
                            <div className="flex flex-col gap-0.5 mt-1">
                                <p className="text-[10px] text-[var(--text-muted)] font-medium truncate">{stat.change}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pending Actions Banner */}
            <div className="mb-8">
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
                            <Link to="/admin/stores?status=pending" className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-700 transition-colors inline-block">
                                Review Applications
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-[var(--glass-border)] p-6 shadow-sm h-full">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-[var(--text-main)]">Platform Activity</h2>
                            <span className="text-xs font-bold bg-[var(--surface-1)] px-2 py-1 rounded text-[var(--text-muted)]">Live Feed</span>
                        </div>
                        <div className="space-y-4">
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
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-[var(--glass-border)] p-6 shadow-sm h-full">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-[var(--text-main)]">System Events</h2>
                            <span className="text-xs font-bold text-green-600 animate-pulse">● Realtime</span>
                        </div>
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                            <RecentActivityFeed />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
