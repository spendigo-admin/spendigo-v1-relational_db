import React from 'react';
import { useAuth } from '../../context/AuthContext';
import '../../styles/design-system.css';

const Subscription: React.FC = () => {
    const { user, updateSubscription } = useAuth();
    const currentTier = user?.subscriptionTier || 'free';

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

    return (
        <div className="p-6 h-[calc(100vh-64px)] overflow-y-auto animate-fade-in">
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
                                onClick={() => updateSubscription(tier.id as any)}
                                disabled={currentTier === tier.id || isViewOnly}
                                className={`w-full py-3 rounded-lg font-bold mb-6 transition-all ${currentTier === tier.id
                                    ? 'bg-green-100 text-green-700 cursor-default'
                                    : isViewOnly
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-[var(--brand-primary)] text-white hover:brightness-110'
                                    }`}
                            >
                                {currentTier === tier.id ? 'Current Plan' : isViewOnly ? 'Contact Owner' : 'Switch Plan'}
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
            </div>
        </div>
    );
};

export default Subscription;
