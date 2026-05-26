import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import '../../styles/design-system.css';

const Subscription: React.FC = () => {
    const { user, can } = useAuth();
    const { stores } = useMarketplace();
    const { addNotification } = useNotifications();
    const { confirm } = useConfirmation();
    const [searchParams, setSearchParams] = useSearchParams();

    const currentTier = user?.subscriptionTier || 'free';
    const storeId = user?.storeId || '';
    const isLocked = storeId ? stores[storeId]?.status === 'pending_deletion' : false;


    const [processingId, setProcessingId] = React.useState<string | null>(null);
    const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
    const [payments, setPayments] = React.useState<any[]>([]);
    const [loadingPayments, setLoadingPayments] = React.useState(true);

    // Promo Code Logic
    const [promoCode, setPromoCode] = React.useState('');
    const [activePromo, setActivePromo] = React.useState(''); // None applied by default
    const [customPromoData, setCustomPromoData] = React.useState<any>(null);

    // 1. Check for success from Stripe
    React.useEffect(() => {
        const sessionId = searchParams.get('session_id');
        if (sessionId) {
            setSuccessMessage("🎉 Payment Received! We are activating your new features...");
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('session_id');
            setSearchParams(newParams);
            setTimeout(() => setSuccessMessage(null), 8000);
        }
    }, [searchParams]);

    // 2. Fetch Payment History
    React.useEffect(() => {
        const fetchHistory = async () => {
            if (!user) return;
            try {
                const { getFunctions, httpsCallable } = await import('firebase/functions');
                const functions = getFunctions();
                const getPaymentHistory = httpsCallable(functions, 'getPaymentHistory');
                const { data }: any = await getPaymentHistory();
                setPayments(data.payments || []);
            } catch (error) {
                console.error("Failed to fetch payment history:", error);
            } finally {
                setLoadingPayments(false);
            }
        };
        fetchHistory();
    }, [user?.id, currentTier]);

    // 3. Keep UI consistent
    React.useEffect(() => {
        if (processingId && currentTier === processingId) {
            setProcessingId(null);
            setSuccessMessage("🚀 Plan Upgraded! You now have access to all features.");
        }
    }, [currentTier, processingId]);

    const handleApplyPromo = async () => {
        const code = promoCode.trim().toUpperCase();
        if (code === '') {
            setActivePromo('');
            setCustomPromoData(null);
            addNotification({ type: 'system', title: 'Promo Cleared', message: 'Promo code cleared.' });
            return;
        }



        if (code === 'FIRST100') {
            setActivePromo('FIRST100');
            setCustomPromoData(null);
            addNotification({ type: 'system', title: 'Offer Applied', message: '3-Month Free Trial applied!' });
            return;
        }

        // Dynamic Lookup from Firestore
        try {
            const promoRef = doc(db, 'promo_codes', code);
            const promoSnap = await getDoc(promoRef);

            if (promoSnap.exists()) {
                const promoData = promoSnap.data();
                if (promoData && promoData.active) {
                    setActivePromo(code);
                    setCustomPromoData(promoData);
                    addNotification({
                        type: 'system',
                        title: 'Promo Applied 🎟️',
                        message: `Stripe coupon '${code}' applied successfully!`
                    });
                } else {
                    setActivePromo('');
                    setCustomPromoData(null);
                    addNotification({ type: 'alert', title: 'Inactive Promo', message: 'This promo code is no longer active.' });
                }
            } else {
                setActivePromo('');
                setCustomPromoData(null);
                addNotification({ type: 'alert', title: 'Invalid Code', message: 'Code not recognized.' });
            }
        } catch (error: any) {
            console.error("Error validating promo code:", error);
            addNotification({ type: 'alert', title: 'Verification Error', message: 'Failed to verify promo code. Please try again.' });
        }
    };

    const handleRemovePromo = () => {
        setActivePromo('');
        setPromoCode('');
        setCustomPromoData(null);
        addNotification({ type: 'system', title: 'Promo Removed', message: 'Returned to standard pricing.' });
    };

    const TIER_ORDER: Record<string, number> = { free: 0, core: 1, growth: 2, pro: 3 };

    const tiers = [
        {
            id: 'core',
            name: 'Core',
            basePrice: '$49',
            period: '/month',
            description: 'Recommended for active stores.',
            color: 'bg-blue-50 border-blue-200',
            features: [
                '✅ Unlimited Products',
                '✅ Pickup + Delivery Toggle',
                '✅ Order Management Dashboard',
                '✅ Basic Analytics'
            ]
        },
        {
            id: 'growth',
            name: 'Growth',
            basePrice: '$99',
            period: '/month',
            description: 'Maximize sales & visibility.',
            color: 'bg-purple-50 border-purple-200 ring-2 ring-purple-500',
            recommended: true,
            features: [
                '✅ Everything in Core',
                '✅ Flyer Highlighting',
                '✅ Advanced Analytics',
                '❌ Deals & Flash Sales',
                '❌ Featured Placement'
            ]
        },
        {
            id: 'pro',
            name: 'Pro',
            basePrice: '$149',
            period: '/month',
            description: 'Full digital marketing suite for ambitious brands.',
            color: 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300',
            badge: 'Marketing Suite',
            features: [
                '✅ Everything in Growth',
                '✅ Deals & Flash Sales',
                '✅ Featured Placement',
                '✅ Push Campaign Access',
                '✅ 200 Campaigns / 24 h',
                '✅ 1% Commission Rate'
            ]
        }
    ];

    const isViewOnly = !can('subscription:write') || isLocked;

    const handleUpgrade = async (tierId: string, price: string) => {
        const isFree = tierId === 'free';

        let confirmOptions: any = {
            title: 'Confirm Upgrade',
            message: `Subscribe to ${price}${price === '$0' ? '' : '/month'}? This will redirect you to Stripe Checkout.`,
            confirmText: 'Proceed to Checkout',
            type: 'info'
        };

        if (isFree) {
            confirmOptions = {
                title: 'Confirm Cancellation',
                message: "Downgrade to Free tier? Your subscription will be cancelled immediately and you will receive a prorated refund for the remaining days of the current month.",
                confirmText: 'Cancel Subscription',
                type: 'warning'
            };
        } else if (user?.subscriptionStatus === 'active') {
            const isUpgrade = (TIER_ORDER[tierId] ?? 0) > (TIER_ORDER[user?.subscriptionTier ?? 'free'] ?? 0);
            confirmOptions = {
                title: isUpgrade ? 'Confirm Upgrade' : 'Confirm Downgrade',
                message: isUpgrade
                    ? `Upgrade to ${tierId === 'core' ? 'Core' : tierId === 'growth' ? 'Growth' : 'Pro'}? You will be charged the prorated difference for the remaining days of this month immediately.`
                    : `Downgrade to ${tierId === 'core' ? 'Core' : tierId === 'growth' ? 'Growth' : 'Pro'}? You will be refunded the prorated difference directly to your card immediately.`,
                confirmText: isUpgrade ? 'Upgrade Now' : 'Downgrade Now',
                type: 'info'
            };
        }

        const confirmed = await confirm(confirmOptions);

        if (confirmed) {
            setProcessingId(tierId);
            try {
                const { getFunctions, httpsCallable } = await import('firebase/functions');
                const functions = getFunctions();

                if (user?.subscriptionStatus === 'active' || isFree) {
                    const updateSubscriptionPlan = httpsCallable(functions, 'updateSubscriptionPlan');
                    const result: any = await updateSubscriptionPlan({ newTier: tierId });
                    if (result.data.success) {
                        addNotification({ type: 'system', title: 'Subscription Updated', message: result.data.message });
                    }
                    setProcessingId(null);
                    return;
                }

                const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');
                const { data }: any = await createCheckoutSession({
                    tier: tierId,
                    promoCode: activePromo // Send the validated code
                });

                if (data && data.url) {
                    window.location.href = data.url;
                } else {
                    throw new Error("No checkout URL returned");
                }
            } catch (error: any) {
                console.error("Payment Error:", error);
                addNotification({ type: 'alert', title: 'Payment Error', message: `Failed to process: ${error.message}` });
                setProcessingId(null);
            }
        }
    };

    return (
        <div className="p-6 h-[calc(100vh-64px)] overflow-y-auto animate-fade-in relative">
            {processingId && (
                <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center flex-col">
                    <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                    <div className="text-xl font-bold text-indigo-900">Redirecting to Stripe...</div>
                    <p className="text-indigo-600">Secure Checkout</p>
                </div>
            )}

            {successMessage && (
                <div className="max-w-6xl mx-auto mb-6">
                    <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-xl flex items-center justify-between animate-bounce-in">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">🌟</span>
                            <span className="font-bold">{successMessage}</span>
                        </div>
                        <button onClick={() => setSuccessMessage(null)} className="text-green-600 hover:text-green-800 font-bold">Close</button>
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-10">
                    <h1 className="page-headline mb-2">Store Subscription — Starter</h1>
                    <p className="text-[var(--text-muted)]">Choose the plan that fits your business needs. Upgrade or downgrade anytime. Starter plan comes by default (up to 10 products).</p>
                </div>

                {isViewOnly && (
                    <div className="mb-8 p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-center gap-2 text-orange-800">
                        <span className="text-xl">🔒</span>
                        <span className="font-medium">
                            {isLocked 
                                ? 'Subscription management is disabled during the store deletion grace period.' 
                                : 'Subscription management is restricted to Owners.'}
                        </span>
                    </div>
                )}

                <div className="grid md:grid-cols-3 gap-6">
                    {tiers.map((tier) => {
                        // Calculate Display Price
                        let displayPrice = tier.basePrice;
                        let originalPrice = null;
                        let trialText = '';

                        if (activePromo === 'FIRST100') {
                            originalPrice = tier.basePrice;
                            displayPrice = '$0.00';
                            trialText = 'first 3 months';
                        } else if (customPromoData) {
                            originalPrice = tier.basePrice;
                            const priceVal = tier.id === 'core' ? 49 : tier.id === 'growth' ? 99 : 149;
                            if (customPromoData.percentOff) {
                                const discounted = priceVal * (1 - customPromoData.percentOff / 100);
                                displayPrice = `$${discounted.toFixed(2)}`;
                            } else if (customPromoData.amountOff) {
                                const discounted = Math.max(0, priceVal - customPromoData.amountOff);
                                displayPrice = `$${discounted.toFixed(2)}`;
                            }
                            if (customPromoData.duration === 'repeating') {
                                trialText = `for ${customPromoData.durationInMonths} mos`;
                            } else if (customPromoData.duration === 'once') {
                                trialText = '1st month';
                            }
                        }

                        return (
                            <div
                                key={tier.id}
                                className={`relative rounded-2xl p-6 border-2 transition-all ${currentTier === tier.id ? 'border-[var(--brand-primary)] shadow-lg scale-[1.02] z-10' : 'border-transparent bg-white shadow-sm hover:shadow-md'
                                    }`}
                            >
                                {tier.recommended && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                                        Recommended
                                    </div>
                                )}
                                {tier.badge && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                                        {tier.badge}
                                    </div>
                                )}

                                <h3 className="text-xl font-bold text-[var(--text-main)] mb-2">{tier.name}</h3>
                                <div className="flex items-baseline gap-2 mb-4">
                                    {originalPrice && (
                                        <span className="text-lg text-gray-400 line-through font-medium">{originalPrice}</span>
                                    )}
                                    <span className={`text-3xl font-bold ${originalPrice ? 'text-green-600' : 'text-[var(--text-main)]'}`}>
                                        {displayPrice}
                                    </span>
                                    <span className="text-[var(--text-muted)]">
                                        {trialText ? `${tier.period} (${trialText})` : tier.period}
                                    </span>
                                </div>
                                <p className="text-sm text-[var(--text-muted)] mb-6 h-10">{tier.description}</p>

                                <div className="mb-6">
                                    {currentTier === tier.id ? (
                                        <div className="w-full py-3 rounded-lg bg-green-50 border border-green-200 text-green-700 font-bold text-center">
                                            Current Plan
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleUpgrade(tier.id, displayPrice)}
                                            disabled={isViewOnly || !!processingId}
                                            className={`w-full py-3 rounded-lg font-bold transition-all ${isViewOnly
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                : 'bg-[var(--brand-primary)] text-white hover:brightness-110'
                                                }`}
                                        >
                                            {isViewOnly
                                                ? 'Contact Owner'
                                                : tier.id === 'free' ? 'Downgrade' : `Subscribe (${displayPrice})`
                                            }
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    {tier.features.map((feature, i) => (
                                        <div key={i} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                                            <span className={feature.startsWith('❌') ? 'opacity-50' : ''}>{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {currentTier !== 'free' && (
                    <div className="mt-8 text-center bg-gray-50 border border-gray-200/50 rounded-xl p-4 max-w-md mx-auto">
                        <p className="text-sm text-[var(--text-muted)] font-medium">
                            Need to pause or downgrade? You can{' '}
                            <button
                                onClick={() => handleUpgrade('free', '$0')}
                                disabled={isViewOnly || !!processingId}
                                className="text-indigo-600 hover:text-indigo-800 font-semibold underline bg-transparent border-none p-0 cursor-pointer transition-colors"
                            >
                                downgrade to the Starter plan
                            </button>
                            .
                        </p>
                    </div>
                )}

                <div className="mt-12 bg-gray-50 rounded-xl p-6 text-center border border-gray-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl rotate-12">🎟️</div>
                    <h3 className="font-bold text-[var(--text-main)] mb-2">Have a Promo Code?</h3>
                    <p className="text-[var(--text-muted)] mb-4 text-sm">Enter your code below to unlock special offers.</p>
                    <div className="flex gap-2 max-w-sm mx-auto">
                        <input
                            type="text"
                            placeholder="e.g. WELCOME2026"
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-center font-bold tracking-widest uppercase"
                        />
                        <button
                            onClick={handleApplyPromo}
                            className="px-6 py-2 bg-gray-800 text-white rounded-lg font-bold hover:bg-black transition-colors"
                        >
                            Apply
                        </button>
                    </div>

                    {activePromo === 'FIRST100' && (
                        <div className="mt-4 bg-green-50 text-green-800 p-4 rounded-xl text-sm border border-green-200 max-w-sm mx-auto">
                            <div className="flex items-center justify-between gap-4 mb-2">
                                <p className="font-bold text-green-900 flex items-center gap-1.5">
                                    <span className="text-base">✅</span> 'FIRST100' Applied!
                                </p>
                                <button
                                    onClick={handleRemovePromo}
                                    className="text-xs px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg font-bold transition-all cursor-pointer border border-red-300/30"
                                >
                                    Remove
                                </button>
                            </div>
                            <ul className="text-left mt-1 list-disc list-inside space-y-1 text-green-700">
                                <li><strong>All Plans:</strong> 3-Month Free Trial ($0.00 for the first 3 months)</li>
                            </ul>
                        </div>
                    )}
                    {customPromoData && (
                        <div className="mt-4 bg-green-50 text-green-800 p-4 rounded-xl text-sm border border-green-200 max-w-sm mx-auto animate-fade-in">
                            <div className="flex items-center justify-between gap-4 mb-2">
                                <p className="font-bold text-green-900 flex items-center gap-1.5">
                                    <span className="text-base">✅</span> '{activePromo}' Applied!
                                </p>
                                <button
                                    onClick={handleRemovePromo}
                                    className="text-xs px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg font-bold transition-all cursor-pointer border border-red-300/30"
                                >
                                    Remove
                                </button>
                            </div>
                            <div className="text-left mt-1 text-green-700 space-y-1">
                                <p><strong>Offer details:</strong></p>
                                <ul className="list-disc list-inside space-y-0.5 pl-1">
                                    <li>
                                        Discount: {customPromoData.percentOff 
                                            ? `${customPromoData.percentOff}% Off` 
                                            : `CA$${customPromoData.amountOff?.toFixed(2)} Off`
                                        }
                                    </li>
                                    <li>
                                        Duration: <span className="capitalize">{customPromoData.duration}</span>
                                        {customPromoData.duration === 'repeating' && ` (${customPromoData.durationInMonths} Months)`}
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                {/* Payment History Section */}
                <div className="mt-12">
                    <h2 className="text-xl font-bold text-[var(--text-main)] mb-6 flex items-center gap-2">
                        💳 Payment History
                    </h2>
                    <div className="bg-white rounded-2xl border border-[var(--glass-border)] overflow-hidden shadow-sm">
                        {loadingPayments ? (
                            <div className="p-12 text-center text-[var(--text-muted)]">Loading history...</div>
                        ) : payments.length === 0 ? (
                            <div className="p-12 text-center text-[var(--text-muted)]">No successful payments found yet.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-[var(--surface-1)] border-b border-[var(--glass-border)]">
                                        <tr>
                                            <th className="p-4 text-xs font-bold text-[var(--text-muted)] uppercase">Date</th>
                                            <th className="p-4 text-xs font-bold text-[var(--text-muted)] uppercase">Plan</th>
                                            <th className="p-4 text-xs font-bold text-[var(--text-muted)] uppercase">Amount</th>
                                            <th className="p-4 text-xs font-bold text-[var(--text-muted)] uppercase">Invoice / Receipt</th>
                                            <th className="p-4 text-xs font-bold text-[var(--text-muted)] uppercase">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--glass-border)]">
                                        {payments.map((payment) => {
                                            const isRefund = payment.type === 'refund' || payment.amount < 0;
                                            return (
                                                <tr key={payment.id} className="hover:bg-gray-50/50">
                                                    <td className="p-4 text-sm text-[var(--text-secondary)]">
                                                        {new Date(payment.date).toLocaleDateString(undefined, {
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric'
                                                        })}
                                                    </td>
                                                    <td className="p-4 text-sm capitalize text-[var(--text-main)] font-medium">
                                                        {payment.tier}
                                                    </td>
                                                    <td className={`p-4 text-sm font-bold ${isRefund ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                        {isRefund ? `-$${Math.abs(payment.amount).toFixed(2)}` : `$${payment.amount.toFixed(2)}`}
                                                    </td>
                                                    <td className="p-4 text-sm">
                                                        {payment.pdf ? (
                                                            <a 
                                                                href={payment.pdf} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer" 
                                                                className="text-indigo-600 hover:text-indigo-800 font-semibold hover:underline inline-flex items-center gap-1.5 transition-colors"
                                                            >
                                                                <span>📄</span>
                                                                <span>{isRefund ? 'Receipt' : 'Invoice'}</span>
                                                            </a>
                                                        ) : (
                                                            <span className="text-gray-400">—</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border capitalize transition-all ${
                                                            isRefund 
                                                                ? 'bg-rose-50 text-rose-700 border-rose-200/50' 
                                                                : payment.status === 'partially refunded'
                                                                ? 'bg-amber-50 text-amber-700 border-amber-200/50'
                                                                : 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                                                        }`}>
                                                            {payment.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Subscription;
