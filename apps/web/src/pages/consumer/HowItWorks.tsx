import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/design-system.css';

const HowItWorks: React.FC = () => {
    return (
        <div className="animate-fade-in pb-20">
            {/* Hero Section */}
            <div className="bg-gradient-to-br from-[var(--brand-primary)] via-[#4f46e5] to-[var(--brand-secondary)] text-white py-16 px-4">
                <div className="max-w-3xl mx-auto text-center">
                    <span className="text-5xl mb-4 block">✨</span>
                    <h1 className="text-3xl md:text-4xl font-bold mb-4">Spendigo Optimizer</h1>
                    <p className="text-lg text-white/90 max-w-xl mx-auto">
                        Our algorithm automatically splits your order across stores to maximize savings.
                        Customers save an average of <strong>15%</strong> per order.
                    </p>
                </div>
            </div>

            <div className="max-w-3xl mx-auto p-4 space-y-8">
                {/* How It Works Steps */}
                <section className="bg-white rounded-xl border border-[var(--glass-border)] p-6">
                    <h2 className="text-2xl font-bold text-[var(--text-main)] mb-6 text-center">How It Works</h2>

                    <div className="space-y-6">
                        {[
                            { step: 1, icon: '📝', title: 'Create Your Wishlist', desc: 'Add all the items you need to your wishlist. No need to visit each store individually.' },
                            { step: 2, icon: '🔍', title: 'We Compare Prices', desc: 'Our algorithm scans prices across all partner stores in real-time to find the best deals.' },
                            { step: 3, icon: '🧮', title: 'Smart Optimization', desc: 'We calculate the optimal combination of stores to minimize your total cost, factoring in delivery fees.' },
                            { step: 4, icon: '🛒', title: 'One-Click Checkout', desc: 'Add the optimized cart with a single click. We handle the split orders automatically.' },
                        ].map(item => (
                            <div key={item.step} className="flex gap-4">
                                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[var(--brand-primary)]/10 flex items-center justify-center text-2xl">
                                    {item.icon}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="w-6 h-6 rounded-full bg-[var(--brand-primary)] text-white text-sm font-bold flex items-center justify-center">{item.step}</span>
                                        <h3 className="font-bold text-[var(--text-main)]">{item.title}</h3>
                                    </div>
                                    <p className="text-sm text-[var(--text-muted)]">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Stats */}
                <section className="grid grid-cols-3 gap-4">
                    {[
                        { value: '15%', label: 'Average Savings' },
                        { value: '7+', label: 'Partner Stores' },
                        { value: '1000+', label: 'Products Compared' },
                    ].map(stat => (
                        <div key={stat.label} className="bg-white rounded-xl border border-[var(--glass-border)] p-4 text-center">
                            <p className="text-2xl font-bold text-[var(--brand-primary)]">{stat.value}</p>
                            <p className="text-xs text-[var(--text-muted)]">{stat.label}</p>
                        </div>
                    ))}
                </section>

                {/* Example Savings */}
                <section className="bg-green-50 rounded-xl border border-green-200 p-6">
                    <h2 className="text-xl font-bold text-green-800 mb-4 flex items-center gap-2">
                        <span>💰</span> Example Savings
                    </h2>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-green-700">Avocados (5pk)</span>
                            <div className="text-right">
                                <span className="text-green-600 font-bold">$5.99</span>
                                <span className="text-sm text-green-500 ml-2 line-through">$8.99</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-green-700">Bananas (bunch)</span>
                            <div className="text-right">
                                <span className="text-green-600 font-bold">$2.49</span>
                                <span className="text-sm text-green-500 ml-2 line-through">$2.99</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-green-700">Eggs (12pk)</span>
                            <div className="text-right">
                                <span className="text-green-600 font-bold">$5.99</span>
                                <span className="text-sm text-green-500 ml-2 line-through">$8.99</span>
                            </div>
                        </div>
                        <div className="border-t border-green-300 pt-3 mt-3 flex justify-between font-bold">
                            <span className="text-green-800">Your Savings</span>
                            <span className="text-green-600">$6.50 saved!</span>
                        </div>
                    </div>
                </section>

                {/* Features */}
                <section className="bg-white rounded-xl border border-[var(--glass-border)] p-6">
                    <h2 className="text-xl font-bold text-[var(--text-main)] mb-4">Why Choose Spendigo?</h2>
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { icon: '⚡', title: 'Real-Time Prices', desc: 'Prices updated hourly' },
                            { icon: '🏪', title: 'Local Stores', desc: 'Support your community' },
                            { icon: '🚚', title: 'Smart Delivery', desc: 'Optimized routes' },
                            { icon: '💳', title: 'Split Payments', desc: 'One checkout, multiple stores' },
                            { icon: '🔔', title: 'Price Alerts', desc: 'Never miss a deal' },
                            { icon: '📊', title: 'Savings Tracker', desc: 'See your total savings' },
                        ].map(feature => (
                            <div key={feature.title} className="flex items-start gap-3">
                                <span className="text-2xl">{feature.icon}</span>
                                <div>
                                    <p className="font-medium text-[var(--text-main)]">{feature.title}</p>
                                    <p className="text-xs text-[var(--text-muted)]">{feature.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* CTA */}
                <section className="text-center">
                    <Link
                        to="/smartcart"
                        className="inline-block px-8 py-4 bg-[var(--brand-primary)] text-white font-bold rounded-xl text-lg hover:brightness-110 transition-all"
                    >
                        Try SmartCart Now →
                    </Link>
                    <p className="text-sm text-[var(--text-muted)] mt-3">No account required. Start saving today!</p>
                </section>

                {/* FAQ */}
                <section className="bg-white rounded-xl border border-[var(--glass-border)] p-6">
                    <h2 className="text-xl font-bold text-[var(--text-main)] mb-4">FAQ</h2>
                    <div className="space-y-4">
                        {[
                            { q: 'Is there an extra fee for using SmartCart?', a: 'No! SmartCart is completely free for customers. We make money from a small commission paid by partner stores.' },
                            { q: 'What if a store is out of stock?', a: 'Our algorithm automatically finds the next best option and recalculates your savings.' },
                            { q: 'How do split deliveries work?', a: 'Each store fulfills their portion of your order. You may receive multiple deliveries, but you only pay once at checkout.' },
                            { q: 'Can I remove stores from comparison?', a: 'Yes! You can exclude any store from your SmartCart optimization in settings.' },
                        ].map((faq, i) => (
                            <div key={i}>
                                <p className="font-medium text-[var(--text-main)]">{faq.q}</p>
                                <p className="text-sm text-[var(--text-muted)] mt-1">{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default HowItWorks;
