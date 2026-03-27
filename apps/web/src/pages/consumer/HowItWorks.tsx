import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../../styles/design-system.css';

const HowItWorks: React.FC = () => {
    const { t } = useTranslation();
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    // SEO: Dynamic meta tags and structured data
    useEffect(() => {
        // Page title
        document.title = 'How It Works — Spendigo | Compare Grocery Prices & Save Money in Canada';

        // Meta description
        const setMeta = (name: string, content: string, property?: boolean) => {
            const attr = property ? 'property' : 'name';
            let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
            if (!el) {
                el = document.createElement('meta');
                el.setAttribute(attr, name);
                document.head.appendChild(el);
            }
            el.content = content;
        };

        setMeta('description', 'Learn how Spendigo helps Canadian shoppers save money on groceries. Compare real-time prices across local stores, browse all weekly flyers in one place, and save up to 15% automatically.');
        setMeta('keywords', 'grocery price comparison Canada, save money groceries, compare grocery prices, cheap groceries near me, SmartCart, grocery optimizer, local grocery deals, Spendigo');
        setMeta('robots', 'index, follow');

        // Open Graph
        setMeta('og:title', 'How Spendigo Works — Real-Time Prices & Weekly Flyers', true);
        setMeta('og:description', 'Spendigo compares grocery prices across your local stores in real-time. Browse all weekly flyers and build the cheapest cart automatically.', true);
        setMeta('og:url', 'https://spendigo.ca/how-it-works', true);
        setMeta('og:type', 'website', true);

        // Twitter
        setMeta('twitter:title', 'How Spendigo Works — Compare Prices, Save on Groceries');
        setMeta('twitter:description', 'Compare grocery prices across local stores and save. Learn how Spendigo SmartCart optimizer works.');

        // Canonical URL
        let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
        if (!canonical) {
            canonical = document.createElement('link');
            canonical.rel = 'canonical';
            document.head.appendChild(canonical);
        }
        canonical.href = 'https://spendigo.ca/how-it-works';

        // JSON-LD Structured Data: FAQPage (Google rich results)
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

        // JSON-LD Structured Data: WebPage + HowTo
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

        // Cleanup on unmount
        return () => {
            document.title = 'Spendigo — Shop Smarter, Save More';
            document.getElementById('ld-faq')?.remove();
            document.getElementById('ld-howto')?.remove();
            document.querySelector('link[rel="canonical"]')?.remove();
        };
    }, []);

    const steps = [
        {
            step: 1,
            icon: '🛒',
            title: t('hiwStep1Title'),
            desc: t('hiwStep1Desc'),
            detail: t('hiwStep1Detail')
        },
        {
            step: 2,
            icon: '🧠',
            title: t('hiwStep2Title'),
            desc: t('hiwStep2Desc'),
            detail: t('hiwStep2Detail')
        },
        {
            step: 3,
            icon: '⚡',
            title: t('hiwStep3Title'),
            desc: t('hiwStep3Desc'),
            detail: t('hiwStep3Detail')
        },
        {
            step: 4,
            icon: '✅',
            title: t('hiwStep4Title'),
            desc: t('hiwStep4Desc'),
            detail: t('hiwStep4Detail')
        },
    ];

    const features = [
        { icon: '🔍', title: t('hiwFeat1'), desc: t('hiwFeat1Desc') },
        { icon: '📊', title: t('hiwFeat2'), desc: t('hiwFeat2Desc') },
        { icon: '🏪', title: t('hiwFeat3'), desc: t('hiwFeat3Desc') },
        { icon: '📱', title: t('hiwFeat4'), desc: t('hiwFeat4Desc') },
        { icon: '🏷️', title: t('hiwFeat5'), desc: t('hiwFeat5Desc') },
        { icon: '⚡', title: t('hiwFeat6'), desc: t('hiwFeat6Desc') },
    ];

    const faqs = [
        { q: t('hiwQ1'), a: t('hiwA1') },
        { q: t('hiwQ2'), a: t('hiwA2') },
        { q: t('hiwQ3'), a: t('hiwA3') },
        { q: t('hiwQ4'), a: t('hiwA4') },
        { q: t('hiwQ5'), a: t('hiwA5') },
        { q: t('hiwQ6'), a: t('hiwA6') },
    ];

    return (
        <div className="animate-fade-in pb-24">
            {/* Hero */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[var(--brand-primary)] via-[#2d8a55] to-[#4f46e5] text-white py-20 px-4">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 50%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                <div className="max-w-3xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-medium mb-6">
                        <span>🇨🇦</span> {t('hiwBuiltFor')}
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black mb-4 leading-tight">
                        {t('hiwTitle1')}<br />{t('hiwTitle2')}
                    </h1>
                    <p className="text-lg text-white/85 max-w-xl mx-auto leading-relaxed">
                        {t('hiwSubtitle1')}
                        <strong className="text-white"> {t('hiwSubtitle2')}</strong> {t('hiwSubtitle3')}
                    </p>
                    <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                        <Link
                            to="/stores"
                            className="px-8 py-3.5 bg-white text-[var(--brand-primary)] font-bold rounded-full hover:scale-105 transition-transform shadow-lg shadow-black/20"
                        >
                            {t('hiwBrowseStores')}
                        </Link>
                        <Link
                            to="/smartcart"
                            className="px-8 py-3.5 bg-white/15 backdrop-blur-sm text-white font-bold rounded-full border border-white/30 hover:bg-white/25 transition-all"
                        >
                            {t('hiwTrySmartCart')}
                        </Link>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto p-4 space-y-10 mt-8">

                {/* Steps */}
                <section>
                    <h2 className="text-2xl font-black text-[var(--text-main)] mb-8 text-center">{t('hiwHowItWorks')}</h2>
                    <div className="space-y-5">
                        {steps.map((item, idx) => (
                            <div key={item.step} className="relative">
                                {idx < steps.length - 1 && (
                                    <div className="absolute left-6 top-14 bottom-0 w-0.5 bg-gradient-to-b from-[var(--brand-primary)]/30 to-transparent" style={{ height: 'calc(100% + 6px)' }} />
                                )}
                                <div className="flex gap-4 bg-white rounded-2xl border border-[var(--glass-border)] p-5 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--brand-primary)] to-[#4f46e5] flex items-center justify-center text-2xl shadow-md shadow-[var(--brand-primary)]/20">
                                        {item.icon}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 rounded-md bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] text-xs font-bold">{t('stepWord')} {item.step}</span>
                                            <h3 className="font-bold text-[var(--text-main)]">{item.title}</h3>
                                        </div>
                                        <p className="text-sm text-[var(--text-muted)] leading-relaxed">{item.desc}</p>
                                        <p className="text-xs text-[var(--text-muted)]/70 mt-2 italic">{item.detail}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Stats */}
                <section className="grid grid-cols-3 gap-3">
                    {[
                        { value: t('hiwFree'), label: t('hiwForShoppers'), color: 'text-green-600' },
                        { value: t('hiwLive'), label: t('hiwStorePrices'), color: 'text-blue-600' },
                        { value: t('hiwLocal'), label: t('hiwPartnerStores'), color: 'text-purple-600' },
                    ].map(stat => (
                        <div key={stat.label} className="bg-white rounded-2xl border border-[var(--glass-border)] p-5 text-center shadow-sm">
                            <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                            <p className="text-xs text-[var(--text-muted)] mt-1 font-medium">{stat.label}</p>
                        </div>
                    ))}
                </section>

                {/* Savings Example */}
                <section className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-200 p-6 shadow-sm">
                    <h2 className="text-xl font-black text-green-800 mb-5 flex items-center gap-2">
                        <span className="text-2xl">💡</span> {t('hiwSmartCartAction')}
                    </h2>
                    <p className="text-sm text-green-700 mb-4">
                        {t('hiwTypicalRun')}
                    </p>
                    <div className="space-y-3">
                        {[
                            { item: 'Basmati Rice 10lb', store: 'Hasty Mart', price: '$12.99', was: '$18.99' },
                            { item: 'Olive Oil 1L', store: 'Fresh Farms', price: '$6.49', was: '$9.99' },
                            { item: 'Eggs (12pk)', store: 'Hasty Mart', price: '$4.99', was: '$7.49' },
                            { item: 'Greek Yogurt 500g', store: 'Valley Grocers', price: '$3.99', was: '$5.49' },
                        ].map((row, i) => (
                            <div key={i} className="flex items-center justify-between bg-white/60 rounded-xl px-4 py-3">
                                <div>
                                    <span className="font-medium text-green-800 text-sm">{row.item}</span>
                                    <span className="text-xs text-green-600 ml-2 bg-green-100 px-2 py-0.5 rounded-full">{row.store}</span>
                                </div>
                                <div className="text-right flex items-center gap-2">
                                    <span className="text-green-700 font-bold">{row.price}</span>
                                    <span className="text-xs text-green-400 line-through">{row.was}</span>
                                </div>
                            </div>
                        ))}
                        <div className="border-t border-green-300 pt-4 mt-4 flex justify-between items-center">
                            <div>
                                <span className="font-bold text-green-800">{t('hiwYouSave')}</span>
                                <span className="text-xs text-green-600 ml-2">{t('hiwAcrossStores')}</span>
                            </div>
                            <span className="text-xl font-black text-green-600 bg-green-100 px-4 py-1 rounded-full">$13.50</span>
                        </div>
                    </div>
                </section>

                {/* Features Grid */}
                <section className="bg-white rounded-2xl border border-[var(--glass-border)] p-6 shadow-sm">
                    <h2 className="text-xl font-black text-[var(--text-main)] mb-5">{t('hiwWhySpendigo')}</h2>
                    <div className="grid grid-cols-2 gap-5">
                        {features.map(feature => (
                            <div key={feature.title} className="flex items-start gap-3">
                                <span className="text-2xl flex-shrink-0">{feature.icon}</span>
                                <div>
                                    <p className="font-bold text-sm text-[var(--text-main)]">{feature.title}</p>
                                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">{feature.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* For Merchants CTA */}
                <section className="bg-gradient-to-r from-[#4f46e5] to-[var(--brand-primary)] rounded-2xl p-6 text-white shadow-lg shadow-[var(--brand-primary)]/20">
                    <div className="flex items-center gap-4">
                        <span className="text-4xl">🏪</span>
                        <div className="flex-1">
                            <h3 className="font-black text-lg">{t('hiwOwnStore')}</h3>
                            <p className="text-white/80 text-sm mt-1">
                                {t('hiwOwnStoreDesc')}
                            </p>
                        </div>
                        <Link
                            to="/register"
                            className="flex-shrink-0 px-5 py-2.5 bg-white text-[var(--brand-primary)] font-bold rounded-full text-sm hover:scale-105 transition-transform shadow-md"
                        >
                            {t('hiwJoinFree')}
                        </Link>
                    </div>
                </section>

                {/* FAQ */}
                <section className="bg-white rounded-2xl border border-[var(--glass-border)] p-6 shadow-sm">
                    <h2 className="text-xl font-black text-[var(--text-main)] mb-5">{t('hiwFaqTitle')}</h2>
                    <div className="space-y-1">
                        {faqs.map((faq, i) => (
                            <div key={i} className="border-b border-gray-100 last:border-0">
                                <button
                                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                    className="w-full flex items-center justify-between py-4 text-left hover:text-[var(--brand-primary)] transition-colors"
                                >
                                    <span className="font-medium text-sm text-[var(--text-main)] pr-4">{faq.q}</span>
                                    <span className={`text-lg text-[var(--text-muted)] transition-transform duration-200 flex-shrink-0 ${openFaq === i ? 'rotate-45' : ''}`}>+</span>
                                </button>
                                <div className={`overflow-hidden transition-all duration-200 ${openFaq === i ? 'max-h-40 pb-4' : 'max-h-0'}`}>
                                    <p className="text-sm text-[var(--text-muted)] leading-relaxed">{faq.a}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Final CTA */}
                <section className="text-center py-4">
                    <h2 className="text-2xl font-black text-[var(--text-main)] mb-3">{t('hiwReady')}</h2>
                    <p className="text-[var(--text-muted)] mb-6 text-sm">{t('hiwReadyDesc')}</p>
                    <Link
                        to="/smartcart"
                        className="inline-block px-10 py-4 bg-[var(--brand-primary)] text-white font-bold rounded-2xl text-lg hover:brightness-110 transition-all shadow-lg shadow-[var(--brand-primary)]/30 hover:scale-105"
                    >
                        {t('hiwStartShop')}
                    </Link>
                </section>
            </div>
        </div>
    );
};

export default HowItWorks;
