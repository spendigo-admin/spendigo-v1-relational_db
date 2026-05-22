import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import '../../styles/design-system.css';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useNotifications } from '../../context/NotificationContext';
import SEO from '../../components/SEO';

interface LedgerEntry {
    id: string;
    storeId: string;
    storeName: string;
    userId: string;
    userEmail: string;
    type: 'charge' | 'refund';
    amount: number;
    tier: string;
    stripeChargeId: string;
    stripeInvoiceId?: string;
    billingReason?: string;
    timestamp: any;
    status: string;
    description?: string;
}

interface MerchantSubInfo {
    uid: string;
    tier: string;
    status: string;
    end: string;
    ownerEmail: string;
    stripeCustomerId?: string;
    bn?: string;
}

const BillingLedger: React.FC = () => {
    const { stores } = useMarketplace();
    const { addNotification } = useNotifications();
    const storeList = Object.values(stores);

    // Tab management: 'ledger' or 'subscriptions'
    const [activeTab, setActiveTab] = useState<'ledger' | 'subscriptions'>('ledger');

    // States
    const [ledger, setLedger] = useState<LedgerEntry[]>([]);
    const [merchants, setMerchants] = useState<Record<string, MerchantSubInfo[]>>({});
    const [loadingLedger, setLoadingLedger] = useState(true);
    const [loadingMerchants, setLoadingMerchants] = useState(true);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'charge' | 'refund'>('all');
    const [tierFilter, setTierFilter] = useState<'all' | 'core' | 'growth' | 'pro' | 'free'>('all');

    // 1. Fetch Ledger Entries in Real Time
    useEffect(() => {
        const q = query(collection(db, 'billing_ledger'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const entries: LedgerEntry[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                entries.push({
                    id: doc.id,
                    storeId: data.storeId || 'unknown',
                    storeName: data.storeName || 'Unknown Store',
                    userId: data.userId || '',
                    userEmail: data.userEmail || '',
                    type: data.type || 'charge',
                    amount: data.amount || 0,
                    tier: data.tier || 'core',
                    stripeChargeId: data.stripeChargeId || '',
                    stripeInvoiceId: data.stripeInvoiceId,
                    billingReason: data.billingReason,
                    timestamp: data.timestamp,
                    status: data.status || 'succeeded',
                    description: data.description
                });
            });
            setLedger(entries);
            setLoadingLedger(false);
        }, (error) => {
            console.error("Failed to load billing ledger:", error);
            addNotification({ type: 'alert', title: 'Data Load Error', message: 'Could not synchronize transactions ledger.' });
            setLoadingLedger(false);
        });

        return () => unsubscribe();
    }, []);

    // 2. Fetch Merchant Users (for Active Subscription Details)
    useEffect(() => {
        const q = query(collection(db, 'users'), where('role', '==', 'merchant'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const storeIdMap: Record<string, MerchantSubInfo[]> = {};

            snapshot.forEach((doc) => {
                const data = doc.data();
                const subInfo: MerchantSubInfo = {
                    uid: doc.id,
                    tier: data.subscriptionTier || 'free',
                    status: data.subscriptionStatus || 'inactive',
                    end: data.subscriptionEnd || '',
                    ownerEmail: data.email || doc.id,
                    stripeCustomerId: data.stripeCustomerId,
                    bn: data.businessRegistrationNumber || data.bn
                };

                if (data.storeId) {
                    if (!storeIdMap[data.storeId]) {
                        storeIdMap[data.storeId] = [];
                    }
                    storeIdMap[data.storeId].push(subInfo);
                }
            });
            setMerchants(storeIdMap);
            setLoadingMerchants(false);
        }, (error) => {
            console.error("Failed to load merchant users:", error);
            setLoadingMerchants(false);
        });

        return () => unsubscribe();
    }, []);

    // Helper for date formatting
    const formatTimestamp = (ts: any) => {
        if (!ts) return 'Pending...';
        // If it's a Firestore Timestamp
        if (ts.toDate && typeof ts.toDate === 'function') {
            return ts.toDate().toLocaleString();
        }
        // If it has seconds (standard serialised Firestore timestamp)
        if (ts.seconds) {
            return new Date(ts.seconds * 1000).toLocaleString();
        }
        try {
            return new Date(ts).toLocaleString();
        } catch {
            return 'N/A';
        }
    };

    const formatDateOnly = (dateStr: string) => {
        if (!dateStr) return 'N/A';
        try {
            return new Date(dateStr).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    // join Stores list with Merchant User Subscriptions
    const storeSubscriptions = useMemo(() => {
        return storeList.map((store: any) => {
            const storeOwners = merchants[store.id] || [];
            // Prefer owner role, fallback to first merchant
            const owner = storeOwners.find(u => u.uid) || storeOwners[0];

            return {
                id: store.id,
                name: store.name || 'Unknown Store',
                merchantEmail: store.merchantEmail || 'N/A',
                status: store.status || 'active',
                tier: owner?.tier || 'free',
                subStatus: owner?.status || 'inactive',
                renewalDate: owner?.end || '',
                stripeCustomerId: owner?.stripeCustomerId || '',
                bn: owner?.bn || ''
            };
        });
    }, [storeList, merchants]);

    // KPI Metrics calculation
    const metrics = useMemo(() => {
        let totalRevenue = 0;
        let totalRefunds = 0;
        let activeCore = 0;
        let activeGrowth = 0;
        let activePro = 0;

        // Cumulative totals from ledger
        ledger.forEach(entry => {
            if (entry.status === 'succeeded') {
                if (entry.type === 'charge') {
                    totalRevenue += entry.amount;
                } else if (entry.type === 'refund') {
                    totalRefunds += entry.amount;
                }
            }
        });

        // Tiers count from active subscriptions
        storeSubscriptions.forEach(sub => {
            if (sub.subStatus === 'active') {
                if (sub.tier === 'core') activeCore++;
                else if (sub.tier === 'growth') activeGrowth++;
                else if (sub.tier === 'pro') activePro++;
            }
        });

        // Base/Rack Rates MRR: Core = $49, Growth = $99, Pro = $149
        const baseMRR = (activeCore * 49) + (activeGrowth * 99) + (activePro * 149);

        // Net/Discount Rates MRR (with standard WELCOME2026 90% discount): Core = $4.99, Growth = $9.90, Pro = $14.90
        const netMRR = (activeCore * 4.99) + (activeGrowth * 9.90) + (activePro * 14.90);

        return {
            totalRevenue,
            totalRefunds,
            activeCount: activeCore + activeGrowth + activePro,
            activeCore,
            activeGrowth,
            activePro,
            baseMRR,
            netMRR
        };
    }, [ledger, storeSubscriptions]);

    // Filtered Ledger History
    const filteredLedger = useMemo(() => {
        return ledger.filter(entry => {
            const matchesSearch =
                (entry.storeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (entry.userEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (entry.stripeChargeId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (entry.description || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesType = typeFilter === 'all' || entry.type === typeFilter;
            const matchesTier = tierFilter === 'all' || entry.tier === tierFilter;

            return matchesSearch && matchesType && matchesTier;
        });
    }, [ledger, searchTerm, typeFilter, tierFilter]);

    // Filtered Store Subscriptions
    const filteredSubscriptions = useMemo(() => {
        return storeSubscriptions.filter(sub => {
            const matchesSearch =
                (sub.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (sub.merchantEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (sub.stripeCustomerId || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesTier = tierFilter === 'all' || sub.tier === tierFilter;

            return matchesSearch && matchesTier;
        });
    }, [storeSubscriptions, searchTerm, tierFilter]);

    // Export to CSV Function
    const handleExportCSV = () => {
        if (activeTab === 'ledger') {
            const headers = ['Transaction ID', 'Store ID', 'Store Name', 'Merchant Email', 'Type', 'Amount (CAD)', 'Plan Tier', 'Stripe Charge ID', 'Stripe Invoice ID', 'Billing Reason', 'Timestamp', 'Status', 'Description'];
            const rows = filteredLedger.map(e => [
                e.id,
                e.storeId,
                e.storeName,
                e.userEmail,
                e.type.toUpperCase(),
                e.amount,
                e.tier.toUpperCase(),
                e.stripeChargeId,
                e.stripeInvoiceId || 'N/A',
                e.billingReason || 'N/A',
                formatTimestamp(e.timestamp),
                e.status.toUpperCase(),
                e.description || 'N/A'
            ]);

            const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `spendigo_billing_ledger_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            addNotification({ type: 'system', title: 'Export Successful', message: 'Transactions ledger CSV downloaded.' });
        } else {
            const headers = ['Store ID', 'Store Name', 'Merchant Email', 'Business Status', 'Subscription Tier', 'Billing Status', 'Next Renewal / End Date', 'Stripe Customer ID', 'Business Number'];
            const rows = filteredSubscriptions.map(s => [
                s.id,
                s.name,
                s.merchantEmail,
                s.status.toUpperCase(),
                s.tier.toUpperCase(),
                s.subStatus.toUpperCase(),
                s.renewalDate ? formatDateOnly(s.renewalDate) : 'N/A',
                s.stripeCustomerId || 'N/A',
                s.bn || 'N/A'
            ]);

            const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `spendigo_store_subscriptions_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            addNotification({ type: 'system', title: 'Export Successful', message: 'Subscriptions register CSV downloaded.' });
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <SEO title="Billing Ledger | Spendigo Admin" description="Manage plans, review monthly recurring revenue and proration refunds ledger." />

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-blue-50 text-blue-600">💸</span>
                        Billing & Subscription Ledger
                    </h1>
                    <p className="text-slate-500 text-sm">Monitor Monthly Recurring Revenue (MRR), proration refunds, active tiers and transactional history</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExportCSV}
                        disabled={activeTab === 'ledger' ? filteredLedger.length === 0 : filteredSubscriptions.length === 0}
                        className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-all"
                    >
                        📥 Export CSV Ledger
                    </button>
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Net MRR Card */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-blue-400 hover:shadow-md transition-all duration-300">
                    <div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Net Active MRR</span>
                            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">📈</span>
                        </div>
                        <p className="text-3xl font-black text-slate-900 mt-2">${metrics.netMRR.toFixed(2)}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Base Rack MRR:</span>
                        <span className="font-mono font-bold text-slate-700 text-xs">${metrics.baseMRR.toFixed(2)}</span>
                    </div>
                </div>

                {/* Active Subscriptions Card */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-purple-400 hover:shadow-md transition-all duration-300">
                    <div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Paid Subscribers</span>
                            <span className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm">🏪</span>
                        </div>
                        <p className="text-3xl font-black text-slate-900 mt-2">{metrics.activeCount}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-1 text-[9px] text-center font-bold">
                        <div className="bg-blue-50 text-blue-700 p-1 rounded">Core: {metrics.activeCore}</div>
                        <div className="bg-purple-50 text-purple-700 p-1 rounded">Growth: {metrics.activeGrowth}</div>
                        <div className="bg-amber-50 text-amber-700 p-1 rounded">Pro: {metrics.activePro}</div>
                    </div>
                </div>

                {/* Total Net Revenue Card */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-emerald-400 hover:shadow-md transition-all duration-300">
                    <div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Gross Payments</span>
                            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">💰</span>
                        </div>
                        <p className="text-3xl font-black text-slate-900 mt-2">${metrics.totalRevenue.toFixed(2)}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Net Revenue:</span>
                        <span className="font-bold text-emerald-600 font-mono text-xs">${(metrics.totalRevenue - metrics.totalRefunds).toFixed(2)}</span>
                    </div>
                </div>

                {/* Total Refunds Issued Card */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-rose-400 hover:shadow-md transition-all duration-300">
                    <div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Refunds Triggered</span>
                            <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-sm">↩️</span>
                        </div>
                        <p className="text-3xl font-black text-slate-900 mt-2">${metrics.totalRefunds.toFixed(2)}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Proration Refunds count:</span>
                        <span className="font-bold text-rose-600 font-mono text-xs">{ledger.filter(l => l.type === 'refund').length} issued</span>
                    </div>
                </div>
            </div>

            {/* Main Tabs Navigation */}
            <div className="flex border-b border-slate-200 gap-6">
                <button
                    onClick={() => setActiveTab('ledger')}
                    className={`pb-4 text-sm font-bold border-b-2 transition-all relative ${
                        activeTab === 'ledger'
                            ? 'border-slate-950 text-slate-950 font-black'
                            : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                >
                    📜 Transaction History ({filteredLedger.length})
                </button>
                <button
                    onClick={() => setActiveTab('subscriptions')}
                    className={`pb-4 text-sm font-bold border-b-2 transition-all relative ${
                        activeTab === 'subscriptions'
                            ? 'border-slate-950 text-slate-950 font-black'
                            : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                >
                    🏢 Active Store Subscriptions ({filteredSubscriptions.length})
                </button>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex-1 relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                    <input
                        type="text"
                        placeholder={activeTab === 'ledger' ? "Search ledger by Store, Email, Charge ID..." : "Search subscriptions by Store Name, Email, Stripe ID..."}
                        className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50/50"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {activeTab === 'ledger' && (
                    <select
                        className="px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white font-medium"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value as any)}
                    >
                        <option value="all">All Types</option>
                        <option value="charge">Charges / Payments Only</option>
                        <option value="refund">Refunds Only</option>
                    </select>
                )}

                <select
                    className="px-3 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white font-medium"
                    value={tierFilter}
                    onChange={(e) => setTierFilter(e.target.value as any)}
                >
                    <option value="all">All Plan Tiers</option>
                    <option value="free">Starter (Free)</option>
                    <option value="core">Core</option>
                    <option value="growth">Growth</option>
                    <option value="pro">Pro</option>
                </select>
            </div>

            {/* Content Lists */}
            <div className="glass-panel overflow-hidden bg-white border border-slate-100 rounded-2xl shadow-sm">
                {activeTab === 'ledger' ? (
                    /* LEDGER TAB CONTENT */
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                                    <th className="p-4">Merchant / Store</th>
                                    <th className="p-4">Type</th>
                                    <th className="p-4">Plan Tier</th>
                                    <th className="p-4">Amount (CAD)</th>
                                    <th className="p-4">Description</th>
                                    <th className="p-4">Stripe / Charge ID</th>
                                    <th className="p-4">Timestamp</th>
                                    <th className="p-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {loadingLedger ? (
                                    <tr>
                                        <td colSpan={8} className="p-12 text-center text-slate-400 font-medium">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-6 h-6 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                                                Synchronizing payment ledger logs...
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredLedger.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-12 text-center text-slate-400 font-bold italic">
                                            No ledger transaction entries found matching the active filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLedger.map((entry) => (
                                        <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4">
                                                <div className="font-bold text-slate-800">{entry.storeName}</div>
                                                <div className="text-[10px] text-slate-400">{entry.userEmail}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase border ${
                                                    entry.type === 'charge' 
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                                        : 'bg-rose-50 text-rose-700 border-rose-100'
                                                }`}>
                                                    {entry.type}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase border ${
                                                    entry.tier === 'pro' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                    entry.tier === 'growth' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                                    entry.tier === 'core' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                    'bg-slate-50 text-slate-600 border-slate-200'
                                                }`}>
                                                    {entry.tier}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`font-mono font-bold text-sm ${
                                                    entry.type === 'charge' ? 'text-emerald-600' : 'text-rose-600'
                                                }`}>
                                                    {entry.type === 'charge' ? '+' : '-'}${entry.amount.toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-slate-600 max-w-[200px] truncate" title={entry.description}>
                                                    {entry.description || 'Subscription charge'}
                                                </div>
                                                {entry.billingReason && (
                                                    <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1 rounded">
                                                        reason: {entry.billingReason}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="font-mono text-[10px] text-slate-500">{entry.stripeChargeId}</div>
                                                {entry.stripeInvoiceId && (
                                                    <div className="font-mono text-[9px] text-slate-400">Inv: {entry.stripeInvoiceId}</div>
                                                )}
                                            </td>
                                            <td className="p-4 text-slate-500 whitespace-nowrap">
                                                {formatTimestamp(entry.timestamp)}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="px-2 py-0.5 bg-green-50 text-green-700 font-bold border border-green-200 rounded-full text-[9px] uppercase">
                                                    {entry.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    /* STORE SUBSCRIPTIONS TAB CONTENT */
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                                    <th className="p-4">Store Name</th>
                                    <th className="p-4">Owner Email</th>
                                    <th className="p-4">Subscription Plan</th>
                                    <th className="p-4">Billing Status</th>
                                    <th className="p-4">Renewal / End Date</th>
                                    <th className="p-4">Stripe Customer</th>
                                    <th className="p-4 text-center">Marketplace Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {loadingMerchants ? (
                                    <tr>
                                        <td colSpan={7} className="p-12 text-center text-slate-400 font-medium">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-6 h-6 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                                                Analyzing store subscriptions mapping...
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredSubscriptions.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-12 text-center text-slate-400 font-bold italic">
                                            No active store subscriptions matched the selected criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredSubscriptions.map((sub) => (
                                        <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4">
                                                <div className="font-bold text-slate-800">{sub.name}</div>
                                                <div className="flex gap-2 items-center mt-1">
                                                    <span className="text-[9px] font-mono text-slate-400">Store ID: {sub.id.substring(0, 8)}...</span>
                                                    {sub.bn && (
                                                        <span className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">BN: {sub.bn}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 text-slate-600">
                                                {sub.merchantEmail}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase border ${
                                                    sub.tier === 'pro' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                    sub.tier === 'growth' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                                    sub.tier === 'core' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                    'bg-slate-50 text-slate-600 border-slate-200'
                                                }`}>
                                                    {sub.tier === 'free' ? 'Starter (Free)' : sub.tier}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase border ${
                                                    sub.subStatus === 'active' 
                                                        ? 'bg-green-50 text-green-700 border-green-200' 
                                                        : sub.subStatus === 'trialing' 
                                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                        : 'bg-rose-50 text-rose-600 border-rose-200'
                                                }`}>
                                                    {sub.subStatus}
                                                </span>
                                            </td>
                                            <td className="p-4 font-mono text-slate-600 whitespace-nowrap">
                                                {sub.renewalDate ? formatDateOnly(sub.renewalDate) : 'N/A'}
                                            </td>
                                            <td className="p-4">
                                                {sub.stripeCustomerId ? (
                                                    <span className="font-mono text-[10px] text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded" title={sub.stripeCustomerId}>
                                                        {sub.stripeCustomerId}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 italic">No Customer ID</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                                                    sub.status === 'active' 
                                                        ? 'bg-emerald-100 text-emerald-800' 
                                                        : sub.status === 'suspended' 
                                                        ? 'bg-rose-100 text-rose-800' 
                                                        : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {sub.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Informational Footer Section */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 text-xs text-slate-500 space-y-2">
                <h4 className="font-bold text-slate-700 flex items-center gap-1.5">
                    ⚙️ Platform Billing & Proration Protocol
                </h4>
                <p>
                    Spendigo implements a strictly automated billing alignment model. All paid subscription cycles are anchored to the <strong>1st of each month</strong>.
                </p>
                <ul className="list-disc pl-4 space-y-1">
                    <li>
                        <strong>Anchor Calculation:</strong> Initial subscription activations are charged the prorated current-month remainder immediately, with the standard recurring cycle anchored on the 1st of the next month.
                    </li>
                    <li>
                        <strong>Immediate Upgrades:</strong> Upgrades trigger a Stripe invoice generated immediately for the exact remainder of the current tier's billing cycle, based on the seconds left.
                    </li>
                    <li>
                        <strong>Immediate Downgrades & Refunds:</strong> Downgrades take effect immediately. The remaining credit-day value difference is programmatically calculated (accounting for coupon codes like <code>WELCOME2026</code>) and issued as a genuine card refund (Stripe Refunds API) instantly. Proration on Stripe's ledger is bypassed to prevent redundant invoicing credits.
                    </li>
                </ul>
            </div>
        </div>
    );
};

export default BillingLedger;
