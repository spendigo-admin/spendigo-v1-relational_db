import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/design-system.css';

const steps = [
    {
        icon: '📝',
        title: 'Create Your Account',
        description: 'Sign up for free as a merchant. It only takes 2 minutes — just your name, email, and a password.'
    },
    {
        icon: '🏪',
        title: 'Set Up Your Store',
        description: 'Add your store name, address, business hours, and upload your logo. Tell shoppers what makes your store special.'
    },
    {
        icon: '📦',
        title: 'Add Your Products',
        description: 'Search our master catalog of thousands of products by name or barcode. Set your own prices and stock levels — no manual data entry.'
    },
    {
        icon: '📣',
        title: 'Create Flyers & Deals',
        description: 'Promote weekly specials, bundle deals, and digital flyers to attract nearby shoppers directly through the app.'
    },
    {
        icon: '🛒',
        title: 'Receive Orders',
        description: 'Shoppers reserve items from your store. You get instant notifications and can manage orders from your merchant dashboard.'
    },
    {
        icon: '💰',
        title: 'Grow Your Revenue',
        description: 'Reach new customers who are actively looking for local deals. No commission on pickup orders — you keep 100% of the sale.'
    }
];

const benefits = [
    { icon: '🆓', label: 'Free to Start', detail: 'No upfront costs. Our free tier gets you listed instantly.' },
    { icon: '📊', label: 'Real-Time Dashboard', detail: 'Track orders, inventory, and customer traffic in one place.' },
    { icon: '🔍', label: 'Be Discoverable', detail: 'Shoppers find you by location, product search, and AI-powered SmartCart.' },
    { icon: '🚚', label: 'Delivery Ready', detail: 'Upgrade to offer delivery with configurable fees and minimums.' },
    { icon: '💳', label: 'Stripe Integration', detail: 'Accept online payments seamlessly — funds go directly to your account.' },
    { icon: '🇨🇦', label: 'Built for Canada', detail: 'Provincial tax handling, bilingual support, and local-first design.' },
];

const PartnerWithUs: React.FC = () => {
    return (
        <div className="animate-fade-in pb-20">
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
                            to="/register"
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
                    to="/register"
                    className="inline-flex items-center justify-center px-10 py-4 bg-[var(--brand-primary)] text-white font-bold text-lg rounded-2xl shadow-xl shadow-[var(--brand-primary)]/20 hover:brightness-110 hover:scale-105 active:scale-95 transition-all"
                >
                    Create Your Free Store →
                </Link>
            </div>
        </div>
    );
};

export default PartnerWithUs;
