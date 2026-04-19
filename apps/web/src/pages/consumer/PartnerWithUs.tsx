import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/design-system.css';
import SEO from '../../components/SEO';

const steps = [
    {
        icon: '📝',
        title: 'Instant Business Signup',
        description: 'Register in seconds. Our automated geocoding instantly verifies your store location so you are discoverable immediately.'
    },
    {
        icon: '🏪',
        title: 'Branded Digital Storefront',
        description: 'Upload your logo and hours. Our premium retail layout makes your local shop look like a first-class digital destination.'
    },
    {
        icon: '📦',
        title: 'Smart Inventory Sync',
        description: 'Link your items to our 10,000+ item Master Catalog. Update prices and stock levels instantly via our integrated barcode scanner.'
    },
    {
        icon: '📣',
        title: 'Proximity Promotions',
        description: 'Create deals and flyers. We automatically notify shoppers walking within your configurable radius using geo-fencing alerts.'
    },
    {
        icon: '🛒',
        title: 'Seamless Order Flow',
        description: 'Manage reservations and orders via your dashboard with real-time push notifications and audible order alerts.'
    },
    {
        icon: '📈',
        title: 'Insightful Growth',
        description: 'Access market price benchmarks and traffic analytics to optimize your pricing and outperform the competition.'
    }
];

const benefits = [
    { icon: '📍', label: 'Proximity Marketing', detail: 'Our platform notifies local shoppers when they are near your store with active offers.' },
    { icon: '🆓', label: 'Zero Startup Fees', detail: 'First 100 stores get a 90-day free trial. No credit card required to list.' },
    { icon: '📊', label: 'Smart Insights', detail: 'See how your prices compare to regional averages with our Market Price benchmarks.' },
    { icon: '📱', label: 'Mobile-First', detail: 'Manage your entire inventory and fulfill orders directly from your smartphone.' },
    { icon: '💳', label: 'Stripe Connect', detail: 'Secure, instant payouts directly to your business account with Standard Connect.' },
    { icon: '⚖️', label: 'Audit Ready', detail: 'Full forensic logging and compliance tools for marketplace and local evidence.' },
];

const PartnerWithUs: React.FC = () => {
    return (
        <div className="animate-fade-in pb-20">
            <SEO 
                title="Partner with Us" 
                description="Join Spendigo as a local merchant. Reach nearby shoppers with proximity alerts, manage inventory with barcode scanning, and grow your business with AI insights — for free." 
                path="/partner" 
            />
            {/* HERO */}
            <div className="bg-gradient-to-br from-[var(--brand-primary)] via-[var(--brand-secondary)] to-purple-600 text-white py-16 px-4 text-center">
                <div className="max-w-3xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
                        Grow Your Store with Spendigo
                    </h1>
                    <p className="text-lg md:text-xl text-white/85 mb-8 max-w-2xl mx-auto leading-relaxed">
                        Join Canada's marketplace for local convenience stores, dépanneurs, and independent grocers.
                        Get discovered by nearby shoppers — for free.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            to="/register/business"
                            className="inline-flex items-center justify-center px-8 py-4 bg-white text-[var(--brand-primary)] font-bold text-lg rounded-2xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
                        >
                            🚀 Get Started Free
                        </Link>
                        <Link
                            to="/how-it-works"
                            className="inline-flex items-center justify-center px-8 py-4 bg-white/15 text-white font-bold text-lg rounded-2xl border-2 border-white/30 hover:bg-white/25 transition-all"
                        >
                            Learn How Shoppers Use Spendigo
                        </Link>
                    </div>
                </div>
            </div>

            {/* HOW IT WORKS STEPS */}
            <div className="max-w-4xl mx-auto px-4 py-16">
                <h2 className="text-3xl font-extrabold text-center text-[var(--text-main)] mb-2">How It Works</h2>
                <p className="text-center text-[var(--text-muted)] mb-12">From signup to your first order in 6 simple steps.</p>

                <div className="space-y-6">
                    {steps.map((step, i) => (
                        <div key={i} className="flex items-start gap-5 p-5 rounded-2xl bg-white border border-[var(--glass-border)] shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-[var(--brand-primary)]/10 flex items-center justify-center text-3xl">
                                {step.icon}
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold text-[var(--brand-primary)] bg-[var(--brand-primary)]/10 px-2 py-0.5 rounded-full">
                                        Step {i + 1}
                                    </span>
                                    <h3 className="font-bold text-lg text-[var(--text-main)]">{step.title}</h3>
                                </div>
                                <p className="text-[var(--text-muted)] leading-relaxed">{step.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* BENEFITS GRID */}
            <div className="bg-[var(--surface-1)] py-16 px-4">
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-3xl font-extrabold text-center text-[var(--text-main)] mb-2">Why Merchants Love Spendigo</h2>
                    <p className="text-center text-[var(--text-muted)] mb-12">Everything you need to compete with the big chains — without the big budget.</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {benefits.map((b, i) => (
                            <div key={i} className="bg-white rounded-2xl border border-[var(--glass-border)] p-5 shadow-sm hover:shadow-md transition-shadow">
                                <div className="text-3xl mb-3">{b.icon}</div>
                                <h3 className="font-bold text-[var(--text-main)] mb-1">{b.label}</h3>
                                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{b.detail}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* CTA */}
            <div className="max-w-3xl mx-auto px-4 py-16 text-center">
                <h2 className="text-3xl font-extrabold text-[var(--text-main)] mb-4">Ready to Reach More Customers?</h2>
                <p className="text-[var(--text-muted)] mb-8 max-w-xl mx-auto">
                    Join hundreds of local merchants already growing their business on Spendigo.
                    No contracts, no hidden fees — just more customers walking through your door.
                </p>
                <Link
                    to="/register/business"
                    className="inline-flex items-center justify-center px-10 py-4 bg-[var(--brand-primary)] text-white font-bold text-lg rounded-2xl shadow-xl shadow-[var(--brand-primary)]/20 hover:brightness-110 hover:scale-105 active:scale-95 transition-all"
                >
                    Create Your Free Store →
                </Link>
            </div>
        </div>
    );
};

export default PartnerWithUs;
