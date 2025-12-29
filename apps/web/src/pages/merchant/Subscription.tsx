import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import '../../styles/design-system.css';

const Subscription: React.FC = () => {
    const { user, updateSubscription } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const currentTier = user?.subscriptionTier || 'free';

    const [processingId, setProcessingId] = React.useState<string | null>(null);
    const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
    const [payments, setPayments] = React.useState<any[]>([]);
    const [loadingPayments, setLoadingPayments] = React.useState(true);

    // 1. Check for success from Stripe
    React.useEffect(() => {
        const sessionId = searchParams.get('session_id');
        if (sessionId) {
            setSuccessMessage("🎉 Payment Received! We are activating your new features...");
            // Clean up URL
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('session_id');
            setSearchParams(newParams);

            // Auto-hide success message after 8 seconds
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
    }, [user?.id, currentTier]); // Refresh when tier changes

    // 3. Clear processing state if the tier changes (real-time via AuthContext)
    React.useEffect(() => {
        if (processingId && currentTier === processingId) {
            setProcessingId(null);
            setSuccessMessage("🚀 Plan Upgraded! You now have access to all features.");
        }
    }, [currentTier, processingId]);

    const tiers = [
        {
            id: 'free',
            name: 'Starter',
            price: '$0',
            period: '/month',
            description: 'Essential tools to get visible.',
            color: 'bg-gray-100 border-gray-200',
            features: [
                '✅ Store Profile',
                '✅ Up to 50 Products',
                '✅ Pickup Orders Only',
                '❌ Delivery Toggle',
                '❌ Promos & Analytics'
            ]
        },
        {
            id: 'core',
            name: 'Core Store',
            price: '$49',
            period: '/month',
            description: 'Recommended for active stores.',
            color: 'bg-blue-50 border-blue-200 ring-2 ring-blue-500',
            recommended: true,
            features: [
                '✅ Unlimited Products',
                '✅ Pickup + Delivery Toggle',
                '✅ Order Management Dashboard',
                '✅ Basic Analytics',
                '✅ SMS Order Alerts'
            ]
        },
        {
            id: 'growth',
            name: 'Growth',
            price: '$99',
            period: '/month',
            description: 'Maximize sales & visibility.',
            color: 'bg-purple-50 border-purple-200',
            features: [
                '✅ Everything in Core',
                '✅ Featured Placement',
                '✅ Flyer Highlighting',
                '✅ Advanced Analytics',
                '✅ Custom Promo Codes'
            ]
        }
    ];

    const isViewOnly = user?.merchantRole === 'STAFF';



    const handleUpgrade = async (tierId: string, price: string) => {
        if (price === '$0') {
            // Free tier - instant switch (handled by logic or separate mechanism if needed)
            // For now, allow simple downgrade via AuthContext (but in prod, cancel stripe sub via portal)
            if (confirm("Downgrade to Free tier? This will cancel your current subscription at the end of the billing period.")) {
                updateSubscription('free');
                alert("Switched to Starter plan.");
            }
            return;
        }

        // Paid tier - Real Stripe Checkout Flow
        if (confirm(`Subscribe to ${price}${price === '$0' ? '' : '/month'}? This will redirect you to Stripe Checkout.`)) {
            setProcessingId(tierId);

            try {
                // Dynamically import firebase functions to keep bundle light
                const { getFunctions, httpsCallable } = await import('firebase/functions');
                const functions = getFunctions();
                const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');

                const { data }: any = await createCheckoutSession({ tier: tierId });

                if (data && data.url) {
                    // Redirect to Stripe
                    window.location.href = data.url;
                } else {
                    throw new Error("No checkout URL returned");
                }
            } catch (error: any) {
                console.error("Payment Error:", error);
                alert(`Failed to initialize payment: ${error.message}`);
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
                    <h1 className="text-3xl font-bold text-[var(--text-main)] mb-2">Store Subscription</h1>
                    <p className="text-[var(--text-muted)]">Choose the plan that fits your business needs. Upgrade or downgrade anytime.</p>
                </div>

                {isViewOnly && (
                    <div className="mb-8 p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-center gap-2 text-orange-800">
                        <span className="text-xl">🔒</span>
                        <span className="font-medium">Subscription management is restricted to Owners and Managers. Contact your administrator to change plans.</span>
                    </div>
                )}

                <div className="grid md:grid-cols-3 gap-6">
                    {tiers.map((tier) => (
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

                            <h3 className="text-xl font-bold text-[var(--text-main)] mb-2">{tier.name}</h3>
                            <div className="flex items-baseline gap-1 mb-4">
                                <span className="text-3xl font-bold text-[var(--text-main)]">{tier.price}</span>
                                <span className="text-[var(--text-muted)]">{tier.period}</span>
                            </div>
                            <p className="text-sm text-[var(--text-muted)] mb-6 h-10">{tier.description}</p>

                            <button
                                onClick={() => handleUpgrade(tier.id, tier.price)}
                                disabled={currentTier === tier.id || isViewOnly || !!processingId}
                                className={`w-full py-3 rounded-lg font-bold mb-6 transition-all ${currentTier === tier.id
                                    ? 'bg-green-100 text-green-700 cursor-default'
                                    : isViewOnly
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-[var(--brand-primary)] text-white hover:brightness-110'
                                    }`}
                            >
                                {currentTier === tier.id ? 'Current Plan' : isViewOnly ? 'Contact Owner' : `Subscribe (${tier.price})`}
                            </button>

                            <div className="space-y-3">
                                {tier.features.map((feature, i) => (
                                    <div key={i} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                                        <span className={feature.startsWith('❌') ? 'opacity-50' : ''}>{feature}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-12 bg-gray-50 rounded-xl p-6 text-center border border-gray-100">
                    <h3 className="font-bold text-[var(--text-main)] mb-2">Need a Custom Plan?</h3>
                    <p className="text-[var(--text-muted)] mb-4">For multi-location franchises or enterprise needs, contact our sales team.</p>
                    <button className="text-[var(--brand-primary)] font-bold hover:underline">Contact Sales</button>
                </div>

                {/* Payment History Section */}
                <div className="mt-12">
                    <h2 className="text-xl font-bold text-[var(--text-main)] mb-6 flex items-center gap-2">
                        💳 Payment History
                        <span className="text-xs font-normal text-[var(--text-muted)] bg-white px-2 py-0.5 rounded-full border">Last 12 Successful</span>
                    </h2>

                    <div className="bg-white rounded-2xl border border-[var(--glass-border)] overflow-hidden shadow-sm">
                        {loadingPayments ? (
                            <div className="p-12 text-center text-[var(--text-muted)]">
                                <div className="w-8 h-8 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                Loading history...
                            </div>
                        ) : payments.length === 0 ? (
                            <div className="p-12 text-center text-[var(--text-muted)]">
                                <div className="text-3xl mb-2">📄</div>
                                No successful payments found yet.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-[var(--surface-1)] border-b border-[var(--glass-border)]">
                                        <tr>
                                            <th className="p-4 text-xs font-bold text-[var(--text-muted)] uppercase">Date</th>
                                            <th className="p-4 text-xs font-bold text-[var(--text-muted)] uppercase">Plan / Description</th>
                                            <th className="p-4 text-xs font-bold text-[var(--text-muted)] uppercase">Amount</th>
                                            <th className="p-4 text-xs font-bold text-[var(--text-muted)] uppercase">Status</th>
                                            <th className="p-4 text-xs font-bold text-[var(--text-muted)] uppercase">Invoice</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--glass-border)]">
                                        {payments.map((payment) => (
                                            <tr key={payment.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="p-4 text-sm whitespace-nowrap">
                                                    {new Date(payment.date).toLocaleDateString(undefined, {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric'
                                                    })}
                                                </td>
                                                <td className="p-4 text-sm font-medium">
                                                    <span className="capitalize">{payment.tier}</span>
                                                </td>
                                                <td className="p-4 text-sm font-bold">
                                                    ${payment.amount.toFixed(2)} {payment.currency}
                                                </td>
                                                <td className="p-4">
                                                    <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase">
                                                        {payment.status}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    {payment.pdf ? (
                                                        <a
                                                            href={payment.pdf}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-[var(--brand-primary)] hover:underline text-sm font-medium flex items-center gap-1"
                                                        >
                                                            PDF <span>↗️</span>
                                                        </a>
                                                    ) : (
                                                        <span className="text-gray-400 text-sm italic">Not available</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    <p className="mt-4 text-xs text-[var(--text-muted)] text-center">
                        Secure payments handled by Stripe. Need a formal receipt for tax purposes? Click "PDF" to download the official invoice.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Subscription;
