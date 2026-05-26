import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db, functions } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import '../../styles/design-system.css';
import { useAuth } from '../../context/AuthContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useNotifications } from '../../context/NotificationContext';
import { useConfirmation } from '../../context/ConfirmationContext';
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
    merchantRole?: string;
}

interface PromoCodeEntry {
    code: string;
    percentOff: number | null;
    amountOff: number | null;
    duration: 'once' | 'repeating' | 'forever';
    durationInMonths: number | null;
    maxRedemptions: number | null;
    expiresAt: string | null;
    active: boolean;
    stripeCouponId: string;
    stripePromoCodeId: string;
    createdAt: any;
}

const BillingLedger: React.FC = () => {
    const { can } = useAuth();
    const { stores } = useMarketplace();
    const { addNotification } = useNotifications();
    const { confirm } = useConfirmation();
    const storeList = Object.values(stores);

    // Tab management: 'ledger' or 'subscriptions' or 'promocodes'
    const [activeTab, setActiveTab] = useState<'ledger' | 'subscriptions' | 'promocodes'>('ledger');

    // States
    const [ledger, setLedger] = useState<LedgerEntry[]>([]);
    const [merchants, setMerchants] = useState<Record<string, MerchantSubInfo[]>>({});
    const [promoCodes, setPromoCodes] = useState<PromoCodeEntry[]>([]);
    const [loadingLedger, setLoadingLedger] = useState(true);
    const [loadingMerchants, setLoadingMerchants] = useState(true);
    const [loadingPromos, setLoadingPromos] = useState(true);

    // Promo Creation Form States
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [deleteLoadingCode, setDeleteLoadingCode] = useState<string | null>(null);
    const [promoForm, setPromoForm] = useState({
        code: '',
        discountType: 'percent' as 'percent' | 'amount',
        value: '',
        duration: 'once' as 'once' | 'repeating' | 'forever',
        durationInMonths: '12',
        maxRedemptions: '',
        expiresAt: ''
    });

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
                    bn: data.businessRegistrationNumber || data.bn,
                    merchantRole: data.merchantRole || ''
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

    // 3. Fetch Promo Codes in Real Time
    useEffect(() => {
        const q = query(collection(db, 'promo_codes'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const promos: PromoCodeEntry[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                promos.push({
                    code: doc.id,
                    percentOff: data.percentOff,
                    amountOff: data.amountOff,
                    duration: data.duration,
                    durationInMonths: data.durationInMonths,
                    maxRedemptions: data.maxRedemptions || null,
                    expiresAt: data.expiresAt || null,
                    active: data.active !== false,
                    stripeCouponId: data.stripeCouponId || '',
                    stripePromoCodeId: data.stripePromoCodeId || '',
                    createdAt: data.createdAt
                });
            });
            // Sort by createdAt descending locally
            promos.sort((a, b) => {
                const t1 = a.createdAt?.seconds || 0;
                const t2 = b.createdAt?.seconds || 0;
                return t2 - t1;
            });
            setPromoCodes(promos);
            setLoadingPromos(false);
        }, (error) => {
            console.error("Failed to load promo codes:", error);
            setLoadingPromos(false);
        });

        return () => unsubscribe();
    }, []);

    const handleCreatePromoCode = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const code = promoForm.code.trim().toUpperCase();
        if (!code) {
            addNotification({ type: 'alert', title: 'Validation Error', message: 'Promo code is required.' });
            return;
        }

        const valueNum = parseFloat(promoForm.value);
        if (isNaN(valueNum) || valueNum <= 0) {
            addNotification({ type: 'alert', title: 'Validation Error', message: 'Discount value must be a positive number.' });
            return;
        }

        if (promoForm.discountType === 'percent' && valueNum > 100) {
            addNotification({ type: 'alert', title: 'Validation Error', message: 'Percentage off cannot exceed 100%.' });
            return;
        }

        const monthsNum = parseInt(promoForm.durationInMonths);
        if (promoForm.duration === 'repeating' && (isNaN(monthsNum) || monthsNum <= 0)) {
            addNotification({ type: 'alert', title: 'Validation Error', message: 'Duration in months is required and must be positive.' });
            return;
        }

        const maxRedsNum = promoForm.maxRedemptions ? parseInt(promoForm.maxRedemptions) : undefined;
        if (promoForm.maxRedemptions && (isNaN(maxRedsNum as number) || (maxRedsNum as number) <= 0)) {
            addNotification({ type: 'alert', title: 'Validation Error', message: 'Max redemptions must be a positive integer.' });
            return;
        }

        if (promoForm.expiresAt) {
            const expTime = new Date(promoForm.expiresAt).getTime();
            if (isNaN(expTime) || expTime <= Date.now()) {
                addNotification({ type: 'alert', title: 'Validation Error', message: 'Expiration date must be a valid future date.' });
                return;
            }
        }

        setCreateLoading(true);
        try {
            const createPromoCodeFn = httpsCallable<any, any>(functions, 'createPromoCode');
            await createPromoCodeFn({
                code: code,
                percentOff: promoForm.discountType === 'percent' ? valueNum : undefined,
                amountOff: promoForm.discountType === 'amount' ? valueNum : undefined,
                duration: promoForm.duration,
                durationInMonths: promoForm.duration === 'repeating' ? monthsNum : undefined,
                maxRedemptions: maxRedsNum,
                expiresAt: promoForm.expiresAt ? new Date(promoForm.expiresAt).toISOString() : undefined
            });

            addNotification({
                type: 'system',
                title: 'Promo Code Created 🎟️',
                message: `Successfully created Stripe promo code ${code}.`
            });
            
            setShowCreateModal(false);
            setPromoForm({
                code: '',
                discountType: 'percent',
                value: '',
                duration: 'once',
                durationInMonths: '12',
                maxRedemptions: '',
                expiresAt: ''
            });
        } catch (error: any) {
            console.error('[createPromoCode] Error:', error);
            addNotification({
                type: 'alert',
                title: 'Creation Failed',
                message: error.message || 'Failed to create Stripe coupon. Please try again.'
            });
        } finally {
            setCreateLoading(false);
        }
    };

    const handleDeletePromoCode = async (code: string) => {
        const confirmed = await confirm({
            title: 'Confirm Deletion',
            message: `Are you sure you want to permanently delete promo code "${code}"? This will deactivate it on Stripe and delete it from Spendigo.`,
            confirmText: 'Delete Code',
            type: 'danger'
        });

        if (!confirmed) {
            return;
        }

        setDeleteLoadingCode(code);
        try {
            const deletePromoCodeFn = httpsCallable<any, any>(functions, 'deletePromoCode');
            await deletePromoCodeFn({ code });

            addNotification({
                type: 'system',
                title: 'Promo Code Deleted 🗑️',
                message: `Successfully deleted promo code ${code}.`
            });
        } catch (error: any) {
            console.error('[deletePromoCode] Error:', error);
            addNotification({
                type: 'alert',
                title: 'Deletion Failed',
                message: error.message || 'Failed to delete promo code. Please try again.'
            });
        } finally {
            setDeleteLoadingCode(null);
        }
    };

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
            // Prefer owner whose UID matches the store's ownerId, or has merchantRole === 'OWNER', fallback to first merchant
            const owner = storeOwners.find(u => u.uid === store.ownerId) || 
                          storeOwners.find(u => u.merchantRole === 'OWNER') || 
                          storeOwners[0];

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

    if (!can('admin:billing')) {
        return (
            <div className="p-8 text-center space-y-4 mt-16 animate-fade-in">
                <div className="text-5xl">🔒</div>
                <h2 className="text-xl font-black text-[var(--text-main)]">Access Restricted</h2>
                <p className="text-sm text-[var(--text-muted)] max-w-xs mx-auto">
                    This section requires the <code className="bg-gray-100 px-1 rounded text-xs">admin:billing</code> permission. Contact your Super Admin.
                </p>
            </div>
        );
    }

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
                    {activeTab === 'promocodes' ? (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all animate-fade-in"
                        >
                            ➕ Create Promo Code
                        </button>
                    ) : (
                        <button
                            onClick={handleExportCSV}
                            disabled={activeTab === 'ledger' ? filteredLedger.length === 0 : filteredSubscriptions.length === 0}
                            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-all"
                        >
                            📥 Export CSV Ledger
                        </button>
                    )}
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
                <button
                    onClick={() => setActiveTab('promocodes')}
                    className={`pb-4 text-sm font-bold border-b-2 transition-all relative ${
                        activeTab === 'promocodes'
                            ? 'border-slate-950 text-slate-950 font-black'
                            : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                >
                    🎟️ Promo Codes ({promoCodes.length})
                </button>
            </div>

            {/* Filters Row */}
            {activeTab !== 'promocodes' && (
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
            )}

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

                {activeTab === 'promocodes' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                                    <th className="p-4">Promo Code</th>
                                    <th className="p-4">Discount</th>
                                    <th className="p-4">Duration</th>
                                    <th className="p-4">Stripe Coupon ID</th>
                                    <th className="p-4">Stripe Promo ID</th>
                                    <th className="p-4">Created At</th>
                                    <th className="p-4 text-center">Status</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {loadingPromos ? (
                                    <tr>
                                        <td colSpan={8} className="p-12 text-center text-slate-400 font-medium">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-6 h-6 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                                                Synchronizing promo codes list...
                                            </div>
                                        </td>
                                    </tr>
                                ) : promoCodes.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-12 text-center text-slate-400 font-bold italic">
                                            No platform promo codes created yet. Click "+ Create Promo Code" above to generate one.
                                        </td>
                                    </tr>
                                ) : (
                                    promoCodes.map((promo) => (
                                        <tr key={promo.code} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4">
                                                <div className="font-bold text-slate-900">{promo.code}</div>
                                                {(promo.maxRedemptions || promo.expiresAt) && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {promo.maxRedemptions && (
                                                            <span className="text-[9px] font-mono text-slate-500 bg-slate-100 border border-slate-200/50 px-1 py-0.2 rounded" title="Global Usage Cap">
                                                                Max: {promo.maxRedemptions}
                                                            </span>
                                                        )}
                                                        {promo.expiresAt && (
                                                            <span className="text-[9px] font-mono text-rose-600 bg-rose-50 border border-rose-100 px-1 py-0.2 rounded" title="Expiration Bounds">
                                                                Expires: {new Date(promo.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                {promo.percentOff ? (
                                                    <span className="px-2.5 py-1 bg-green-50 text-green-700 font-extrabold rounded-lg border border-green-200">
                                                        {promo.percentOff}% OFF
                                                    </span>
                                                ) : promo.amountOff ? (
                                                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-extrabold rounded-lg border border-blue-200">
                                                        ${promo.amountOff.toFixed(2)} OFF
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic">None</span>
                                                )}
                                            </td>
                                            <td className="p-4 font-medium capitalize text-slate-600">
                                                {promo.duration === 'repeating' ? (
                                                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                                                        {promo.durationInMonths} Months
                                                    </span>
                                                ) : (
                                                    promo.duration
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <span className="font-mono text-[10px] text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">
                                                    {promo.stripeCouponId || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className="font-mono text-[10px] text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">
                                                    {promo.stripePromoCodeId || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-slate-500">
                                                {formatTimestamp(promo.createdAt)}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase border ${
                                                    promo.active
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-rose-50 text-rose-700 border-rose-200'
                                                }`}>
                                                    {promo.active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => handleDeletePromoCode(promo.code)}
                                                    disabled={deleteLoadingCode === promo.code}
                                                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-800 rounded-lg text-[10px] font-bold tracking-wider uppercase border border-rose-200/50 hover:border-rose-300 transition-all inline-flex items-center gap-1.5 disabled:opacity-50 animate-fade-in"
                                                >
                                                    {deleteLoadingCode === promo.code ? (
                                                        <>
                                                            <div className="w-3 h-3 border-2 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
                                                            Deleting...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span>🗑️</span> Delete
                                                        </>
                                                    )}
                                                </button>
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

            {/* Create Promo Code Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in text-slate-905">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden text-left">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-black text-slate-950 flex items-center gap-1.5">
                                    🎟️ Create Promo Code
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">Creates a coupon in Stripe and saves it to Firestore</p>
                            </div>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="w-8 h-8 rounded-full border border-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center hover:bg-slate-100 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreatePromoCode} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Code</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. SAVE50"
                                    value={promoForm.code}
                                    onChange={e => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-slate-950 font-bold tracking-wider placeholder-slate-300 bg-slate-50/50"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Type</label>
                                    <select
                                        value={promoForm.discountType}
                                        onChange={e => setPromoForm({ ...promoForm, discountType: e.target.value as any })}
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl outline-none bg-slate-50/50 font-medium"
                                    >
                                        <option value="percent">Percentage Off</option>
                                        <option value="amount">Fixed CAD Off</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Value</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            required
                                            step="any"
                                            placeholder={promoForm.discountType === 'percent' ? '50' : '10.00'}
                                            value={promoForm.value}
                                            onChange={e => setPromoForm({ ...promoForm, value: e.target.value })}
                                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-slate-950 font-bold bg-slate-50/50"
                                        />
                                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                                            {promoForm.discountType === 'percent' ? '%' : '$'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Duration</label>
                                    <select
                                        value={promoForm.duration}
                                        onChange={e => setPromoForm({ ...promoForm, duration: e.target.value as any })}
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl outline-none bg-slate-50/50 font-medium text-xs"
                                    >
                                        <option value="once">Once</option>
                                        <option value="repeating">Repeating</option>
                                        <option value="forever">Forever</option>
                                    </select>
                                </div>
                                {promoForm.duration === 'repeating' ? (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Months</label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            placeholder="12"
                                            value={promoForm.durationInMonths}
                                            onChange={e => setPromoForm({ ...promoForm, durationInMonths: e.target.value })}
                                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-slate-950 font-bold bg-slate-50/50 text-xs"
                                        />
                                    </div>
                                ) : (
                                    <div className="opacity-40">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Months</label>
                                        <input
                                            type="text"
                                            disabled
                                            placeholder="N/A"
                                            className="w-full px-3 py-2.5 border border-slate-100 rounded-xl bg-slate-50 cursor-not-allowed text-xs font-bold"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Max Redemptions</label>
                                    <input
                                        type="number"
                                        min="1"
                                        placeholder="e.g. 100 (Optional)"
                                        value={promoForm.maxRedemptions}
                                        onChange={e => setPromoForm({ ...promoForm, maxRedemptions: e.target.value })}
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-slate-950 font-bold bg-slate-50/50 text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Expiration Date</label>
                                    <input
                                        type="datetime-local"
                                        value={promoForm.expiresAt}
                                        onChange={e => setPromoForm({ ...promoForm, expiresAt: e.target.value })}
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-slate-950 font-bold bg-slate-50/50 text-xs"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createLoading}
                                    className="flex-1 py-2.5 bg-slate-950 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                                >
                                    {createLoading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Creating...
                                        </>
                                    ) : (
                                        'Create Coupon'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BillingLedger;
