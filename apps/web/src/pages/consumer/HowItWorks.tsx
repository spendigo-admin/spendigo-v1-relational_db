import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import '../../styles/design-system.css';
import SEO from '../../components/SEO';

const HowItWorks: React.FC = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    // SEO: JSON-LD Structured Data
    useEffect(() => {
        const faqStructuredData = {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
                { '@type': 'Question', name: 'Is Spendigo free to use?', acceptedAnswer: { '@type': 'Answer', text: 'Yes! Spendigo is completely free for shoppers. We partner with local stores who pay a small commission — you never pay extra.' } },
                { '@type': 'Question', name: 'How does the SmartCart Optimizer work?', acceptedAnswer: { '@type': 'Answer', text: 'When you add items to your wishlist, our algorithm compares prices across all partner stores and finds the combination that gives you the lowest total. It can split your order across multiple stores if that saves you money.' } },
                { '@type': 'Question', name: 'Which stores are available on Spendigo?', acceptedAnswer: { '@type': 'Answer', text: 'We partner with local grocery stores, ethnic food shops, specialty stores, and more in your area. New stores are added regularly.' } },
                { '@type': 'Question', name: 'Do I have to visit multiple stores?', acceptedAnswer: { '@type': 'Answer', text: 'That is up to you! The optimizer shows you both the cheapest split-store option and a convenient single-store option. You decide what matters more — maximum savings or minimum trips.' } },
                { '@type': 'Question', name: 'How are prices kept up to date?', acceptedAnswer: { '@type': 'Answer', text: 'Partner stores manage their own prices and inventory directly on Spendigo. Prices reflect what is currently available in-store.' } },
            ]
        };

        const howToStructuredData = {
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: 'How to Save Money on Groceries with Spendigo',
            description: 'Use Spendigo SmartCart to compare grocery prices across local Canadian stores and automatically find the cheapest combination.',
            step: [
                { '@type': 'HowToStep', position: 1, name: 'Browse & Build Your List', text: 'Search for groceries across all local partner stores from one place. Add items to your SmartCart wishlist.' },
                { '@type': 'HowToStep', position: 2, name: 'AI-Powered Optimization', text: 'Our SmartCart algorithm analyzes prices across every partner store and calculates the cheapest combination.' },
                { '@type': 'HowToStep', position: 3, name: 'Review Your Savings', text: 'See a clear breakdown of where each item is cheapest and how much you are saving.' },
                { '@type': 'HowToStep', position: 4, name: 'Add to Cart & Checkout', text: 'One tap adds your optimized selection to the cart. Confirm your order and we handle the rest.' },
                { '@type': 'HowToStep', position: 5, name: 'Automated Tracking & Alerts', text: 'Receive real-time push notifications for order status and proximity-based deals.' },
            ]
        };

        const addJsonLd = (data: object, id: string) => {
            let script = document.getElementById(id) as HTMLScriptElement;
            if (!script) {
                script = document.createElement('script');
                script.id = id;
                script.type = 'application/ld+json';
                document.head.appendChild(script);
            }
            script.textContent = JSON.stringify(data);
        };

        addJsonLd(faqStructuredData, 'ld-faq');
        addJsonLd(howToStructuredData, 'ld-howto');

        return () => {
            document.getElementById('ld-faq')?.remove();
            document.getElementById('ld-howto')?.remove();
        };
    }, []);

    const steps = [
        {
            step: 1,
            icon: '🛒',
            title: t('hiwStep1Title'),
            desc: t('hiwStep1Desc'),
            detail: t('hiwStep1Detail'),
            color: 'from-[#007AFF] to-[#112244]'
        },
        {
            step: 2,
            icon: '🧠',
            title: t('hiwStep2Title'),
            desc: t('hiwStep2Desc'),
            detail: t('hiwStep2Detail'),
            color: 'from-[#112244] to-[#007AFF]'
        },
        {
            step: 3,
            icon: '⚡',
            title: t('hiwStep3Title'),
            desc: t('hiwStep3Desc'),
            detail: t('hiwStep3Detail'),
            color: 'from-[#007AFF] to-[#E5F1FF]'
        },
        {
            step: 4,
            icon: '✅',
            title: t('hiwStep4Title'),
            desc: t('hiwStep4Desc'),
            detail: t('hiwStep4Detail'),
            color: 'from-[#112244] to-[#34C759]'
        },
    ];

    const features = [
        { icon: '🔍', title: t('hiwFeat1'), desc: t('hiwFeat1Desc') },
        { icon: '📊', title: t('hiwFeat2'), desc: t('hiwFeat2Desc') },
        { icon: '🏪', title: t('hiwFeat3'), desc: t('hiwFeat3Desc') },
        { icon: '📱', title: t('hiwFeat4'), desc: t('hiwFeat4Desc') },
        { icon: '🏷️', title: t('hiwFeat5'), desc: t('hiwFeat5Desc') },
        { icon: '⚡', title: t('hiwFeat6'), desc: t('hiwFeat6Desc') },
        { icon: '📍', title: t('hiwFeat7'), desc: t('hiwFeat7Desc') },
        { icon: '📈', title: t('hiwFeat8'), desc: t('hiwFeat8Desc') },
        { icon: '✨', title: t('hiwFeat9'), desc: t('hiwFeat9Desc') },
    ];

    const faqs = [
        { q: t('hiwQ1'), a: t('hiwA1') },
        { q: t('hiwQ2'), a: t('hiwA2') },
        { q: t('hiwQ3'), a: t('hiwA3') },
        { q: t('hiwQ4'), a: t('hiwA4') },
        { q: t('hiwQ5'), a: t('hiwA5') },
        { q: t('hiwQ6'), a: t('hiwA6') },
        { q: t('hiwQ7'), a: t('hiwA7') },
    ];

    return (
        <div className="bg-[var(--surface-0)] min-h-screen">
            <SEO
                title="How It Works"
                description="Learn how Spendigo uses AI and proximity alerts to help Canadian shoppers save money. Compare real-time prices across local stores, get market insights, and save up to 15% automatically."
                path="/how-it-works"
            />

            {/* Hero Section */}
            <div className="relative pt-12 pb-16 md:pt-32 md:pb-40 overflow-hidden">
                {/* Background Decor */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,var(--brand-primary-light),transparent_70%)]" />
                    <div className="absolute top-1/4 -right-20 w-64 h-64 md:w-96 md:h-96 bg-blue-50/50 rounded-full blur-3xl opacity-50 animate-pulse" />
                    <div className="absolute bottom-0 -left-20 w-64 h-64 md:w-96 md:h-96 bg-blue-100/30 rounded-full blur-3xl opacity-50 animate-pulse" style={{ animationDelay: '2s' }} />
                </div>

                <div className="max-w-7xl mx-auto px-4 relative z-10 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-white shadow-sm border border-gray-100 mb-6 md:mb-8 animate-fade-in">
                        <span className="flex h-2 w-2 rounded-full bg-[var(--brand-primary)] animate-ping" />
                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            {t('hiwBuiltFor')}
                        </span>
                    </div>

                    <h1 className="text-3xl sm:text-4xl md:text-7xl font-black tracking-tight text-[var(--text-main)] mb-4 md:mb-6 leading-[1.15] md:leading-[1.1]">
                        {t('hiwTitle1')} <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#112244] to-[#007AFF]">
                            {t('hiwTitle2')}
                        </span>
                    </h1>

                    <p className="text-base md:text-xl text-[var(--text-muted)] max-w-2xl mx-auto mb-8 md:mb-10 leading-relaxed px-2">
                        {t('hiwSubtitle1')} <span className="font-bold text-[var(--text-main)]">{t('hiwSubtitle2')}</span> {t('hiwSubtitle3')}
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4 px-4 sm:px-0">
                        <Link to="/" className="w-full sm:w-auto px-8 md:px-10 py-3.5 md:py-4 bg-[#112244] text-white font-black rounded-2xl shadow-xl shadow-blue-500/10 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm md:text-base text-center uppercase tracking-widest">
                            {t('hiwBrowseStores')}
                        </Link>
                        <Link to="/smartcart" className="w-full sm:w-auto px-8 md:px-10 py-3.5 md:py-4 bg-white text-[#112244] font-black rounded-2xl border-2 border-gray-100 hover:border-[#007AFF] transition-all text-sm md:text-base text-center uppercase tracking-widest">
                            {t('hiwTrySmartCart')}
                        </Link>
                    </div>
                </div>
            </div>

            {/* Steps Section - Alternating Layout */}
            <section className="py-16 md:py-24 bg-white relative">
                <div className="max-w-5xl mx-auto px-4">
                    <div className="text-center mb-12 md:mb-20">
                        <h2 className="text-2xl md:text-4xl font-black text-[#112244] mb-4">{t('hiwHowItWorks')}</h2>
                        <div className="w-16 md:w-20 h-1.5 bg-[#007AFF] mx-auto rounded-full" />
                    </div>

                    <div className="space-y-16 md:space-y-32">
                        {steps.map((item, idx) => (
                            <div key={item.step} className={`flex flex-col ${idx % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-8 md:gap-20`}>
                                <div className="flex-1 text-center md:text-left">
                                    <div className={`inline-flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-2xl md:rounded-3xl bg-gradient-to-br ${item.color} text-2xl md:text-3xl text-white shadow-lg mb-4 md:mb-6 transform rotate-3 hover:rotate-0 transition-transform`}>
                                        {item.icon}
                                    </div>
                                    <div className="flex items-center justify-center md:justify-start gap-3 mb-3 md:mb-4">
                                        <span className="text-[#007AFF] font-black text-[10px] md:text-sm uppercase tracking-widest">{t('stepWord')} 0{item.step}</span>
                                        <div className="h-px w-6 md:w-8 bg-[#007AFF]/30" />
                                    </div>
                                    <h3 className="text-xl md:text-3xl font-black text-[var(--text-main)] mb-3 md:mb-4">{item.title}</h3>
                                    <p className="text-base md:text-lg text-[var(--text-muted)] leading-relaxed mb-4 md:mb-6">{item.desc}</p>
                                    <div className="p-4 bg-[var(--surface-1)] rounded-xl md:rounded-2xl border border-[var(--glass-border)] text-xs md:text-sm text-[var(--text-muted)] italic leading-relaxed">
                                        {item.detail}
                                    </div>
                                </div>
                                <div className="flex-1 w-full relative">
                                    <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-10 blur-3xl -z-10`} />
                                    <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] border border-[var(--glass-border)] p-6 md:p-8 shadow-xl md:shadow-2xl relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <span className="text-7xl md:text-9xl font-black">{item.step}</span>
                                        </div>
                                        {/* Simplified Step Illustration */}
                                        <div className="h-40 md:h-64 flex items-center justify-center text-6xl md:text-8xl grayscale group-hover:grayscale-0 transition-all duration-500 scale-105 group-hover:scale-110">
                                            {item.icon}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Smart Receipt Visualization */}
            <section className="py-16 md:py-24 bg-[var(--surface-1)]">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="bg-white rounded-3xl md:rounded-[2.5rem] shadow-xl md:shadow-2xl overflow-hidden border border-gray-100">
                        <div className="bg-[#112244] p-6 md:p-8 text-white text-center">
                            <h2 className="text-xl md:text-2xl font-black mb-1 md:mb-2 text-white italic uppercase tracking-widest">{t('hiwReceiptTitle')}</h2>
                            <p className="text-white/70 text-[10px] md:text-sm font-bold uppercase tracking-widest">{t('hiwReceiptSubtitle')}</p>
                        </div>
                        
                        <div className="p-5 md:p-12 relative">
                            {/* Receipt "Jagged" edge effect */}
                            <div className="absolute -top-3 left-0 right-0 h-3 flex overflow-hidden">
                                {Array.from({ length: 30 }).map((_, i) => (
                                    <div key={i} className="flex-shrink-0 w-6 h-6 bg-white rotate-45 -translate-y-3 shadow-[-2px_-2px_4px_rgba(0,0,0,0.02)]" />
                                ))}
                            </div>

                            <p className="text-center text-[var(--text-muted)] text-xs md:text-sm mb-8 md:mb-10 leading-relaxed max-w-lg mx-auto px-2">
                                {t('hiwTypicalRun')}
                            </p>

                            <div className="space-y-5 md:space-y-6">
                                {[
                                    { item: 'Basmati Rice 10lb', stores: [{ name: 'Hasty Mart', price: 12.99, best: true }, { name: 'Superstore', price: 18.99 }] },
                                    { item: 'Olive Oil 1L', stores: [{ name: 'Fresh Farms', price: 6.49, best: true }, { name: 'Metro', price: 10.99 }] },
                                    { item: 'Large Eggs (12pk)', stores: [{ name: 'Hasty Mart', price: 4.99, best: true }, { name: 'Walmart', price: 7.49 }] },
                                    { item: 'Greek Yogurt 500g', stores: [{ name: 'Valley Grocers', price: 3.99, best: true }, { name: 'Loblaws', price: 5.99 }] },
                                ].map((row, i) => (
                                    <div key={i} className="group">
                                        <div className="flex items-center justify-between mb-2 md:mb-3">
                                            <span className="font-bold text-sm md:text-base text-[var(--text-main)]">{row.item}</span>
                                            <div className="flex items-center gap-2 md:gap-3">
                                                <span className="text-[10px] md:text-xs text-[var(--text-muted)] line-through">
                                                    ${row.stores.find(s => !s.best)?.price}
                                                </span>
                                                <span className="text-base md:text-lg font-black text-[#007AFF]">
                                                    ${row.stores.find(s => s.best)?.price}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 md:gap-2">
                                            {row.stores.map((s, j) => (
                                                <div key={j} className={`text-[9px] md:text-[10px] uppercase tracking-tighter px-1.5 py-0.5 md:px-2 md:py-1 rounded-md font-bold ${s.best ? 'bg-blue-50 text-[#007AFF] border border-blue-100' : 'bg-gray-50 text-gray-400 border border-gray-100'}`}>
                                                    {s.name}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t-2 border-dashed border-gray-100 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4 md:gap-6">
                                <div className="text-center sm:text-left w-full sm:w-auto">
                                    <h4 className="text-xl md:text-2xl font-black text-[#007AFF] mb-1">{t('hiwYouSave')} $13.50</h4>
                                    <p className="text-[10px] md:text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">{t('hiwAcrossStores')}</p>
                                </div>
                                <div className="w-full sm:w-auto px-4 md:px-6 py-3 md:py-4 bg-[var(--surface-1)] rounded-xl md:rounded-2xl border border-[var(--glass-border)] text-center">
                                    <p className="text-[var(--text-main)] font-black text-[10px] md:text-sm">{t('hiwTotalPotential')}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-16 md:py-24 bg-white">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="text-center mb-10 md:mb-16">
                        <h2 className="text-2xl md:text-3xl font-black text-[var(--text-main)] mb-3 md:mb-4">{t('hiwWhySpendigo')}</h2>
                        <p className="text-sm md:text-base text-[var(--text-muted)] max-w-xl mx-auto px-4">{t('supportLocal')}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                        {features.map((feature, i) => (
                            <div key={i} className="p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] bg-[var(--surface-1)] border border-[var(--glass-border)] hover:bg-white hover:shadow-lg md:hover:shadow-xl transition-all group">
                                <div className="text-3xl md:text-4xl mb-4 md:mb-6 transform group-hover:scale-110 transition-transform">
                                    {feature.icon}
                                </div>
                                <h3 className="text-lg md:text-xl font-bold text-[var(--text-main)] mb-2 md:mb-3">{feature.title}</h3>
                                <p className="text-xs md:text-sm text-[var(--text-muted)] leading-relaxed">
                                    {feature.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* For Merchants CTA - Brand Navy & White */}
            <section className="max-w-7xl mx-auto px-4 py-12 md:py-20">
                <div className="relative rounded-[2.5rem] md:rounded-[4rem] bg-[var(--brand-navy)] p-8 md:p-20 overflow-hidden text-white shadow-2xl shadow-blue-500/20">
                    {/* Glowing Decorative Blurs */}
                    <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/20 rounded-full blur-[80px] animate-pulse" />
                    <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-blue-400/20 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '2s' }} />
                    
                    <div className="relative z-10 flex flex-col lg:flex-row items-center gap-8 md:gap-16">
                        <div className="relative">
                            <div className="w-24 h-24 md:w-40 md:h-40 bg-white/10 backdrop-blur-2xl rounded-[2rem] md:rounded-[3rem] flex items-center justify-center text-5xl md:text-7xl shadow-2xl border border-white/20 transform -rotate-6">
                                🏪
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-10 h-10 md:w-16 md:h-16 bg-white rounded-2xl md:rounded-3xl flex items-center justify-center text-xl md:text-3xl shadow-lg transform rotate-12">
                                ✨
                            </div>
                        </div>
                        
                        <div className="flex-1 text-center lg:text-left">
                            <h2 className="text-3xl md:text-6xl font-black mb-4 md:mb-6 tracking-tighter leading-none italic uppercase">
                                {t('hiwOwnStore')}
                            </h2>
                            <p className="text-lg md:text-2xl text-white/90 leading-relaxed max-w-2xl font-medium">
                                {t('hiwOwnStoreDesc')}
                            </p>
                            <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-4">
                                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full border border-white/20 text-xs font-black uppercase tracking-widest">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    Active Platform
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full border border-white/20 text-xs font-black uppercase tracking-widest">
                                    🚀 Rapid Growth
                                </div>
                            </div>
                        </div>
                        
                        <div className="shrink-0 w-full lg:w-auto">
                            <Link to={user?.role === 'merchant' ? '/merchant/dashboard' : '/register/business'} className="group relative inline-flex items-center justify-center w-full lg:w-auto px-12 py-5 bg-white text-[#112244] font-black rounded-2xl md:rounded-[2rem] hover:scale-105 transition-all shadow-[0_20px_50px_rgba(255,255,255,0.2)] text-xl uppercase tracking-widest overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                                <span className="relative z-10">{t('hiwJoinFree')} →</span>
                            </Link>
                            <p className="text-center mt-4 text-xs font-bold text-white/60 uppercase tracking-widest">No hidden setup fees</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="py-16 md:py-24 bg-white">
                <div className="max-w-3xl mx-auto px-4">
                    <h2 className="text-2xl md:text-3xl font-black text-[var(--text-main)] mb-10 md:mb-12 text-center">{t('hiwFaqTitle')}</h2>
                    <div className="space-y-3 md:space-y-4">
                        {faqs.map((faq, i) => (
                            <div key={i} className={`rounded-2xl md:rounded-3xl border transition-all duration-300 ${openFaq === i ? 'bg-[var(--surface-1)] border-[var(--brand-primary)]/30' : 'bg-white border-[var(--glass-border)]'}`}>
                                <button
                                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                    className="w-full flex items-center justify-between p-5 md:p-6 text-left"
                                >
                                    <span className="font-bold text-sm md:text-base text-[var(--text-main)] pr-4">{faq.q}</span>
                                    <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-transform duration-300 ${openFaq === i ? 'bg-[var(--brand-primary)] text-white rotate-180' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}>
                                        <span className="text-base md:text-xl leading-none">↓</span>
                                    </div>
                                </button>
                                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openFaq === i ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                                    <div className="px-5 md:px-6 pb-5 md:pb-6 pt-1 md:pt-2 text-sm text-[var(--text-muted)] leading-relaxed">
                                        {faq.a}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-20 md:py-24 bg-[radial-gradient(circle_at_50%_100%,var(--brand-primary-light),transparent_60%)]">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-3xl md:text-5xl font-black text-[var(--text-main)] mb-4 md:mb-6 leading-tight">{t('hiwReady')}</h2>
                    <p className="text-base md:text-lg text-[var(--text-muted)] mb-8 md:mb-10 max-w-xl mx-auto px-4">
                        {t('hiwReadyDesc')}
                    </p>
                    <Link
                        to="/smartcart"
                        className="inline-flex items-center gap-3 px-10 py-4 md:px-12 md:py-5 bg-[#112244] text-white font-black rounded-2xl md:rounded-[2rem] text-lg md:text-xl shadow-2xl shadow-blue-500/10 hover:scale-105 active:scale-95 transition-all w-full sm:w-auto justify-center uppercase tracking-widest"
                    >
                        {t('hiwStartShop')}
                    </Link>
                </div>
            </section>
        </div>
    );
};

export default HowItWorks;
