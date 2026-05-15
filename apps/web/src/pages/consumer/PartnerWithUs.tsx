import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/design-system.css';
import SEO from '../../components/SEO';
import { useTranslation } from 'react-i18next';

const steps = [
    {
        step: 1,
        icon: '📝',
        title: 'Instant Business Signup',
        desc: 'Register in seconds. Our automated geocoding instantly verifies your store location so you are discoverable immediately.',
        detail: 'We only require your business registration and store location to get started. No complex paperwork.',
        color: 'from-[#007AFF] to-[#112244]'
    },
    {
        step: 2,
        icon: '🏪',
        title: 'Branded Digital Storefront',
        desc: 'Upload your logo and hours. Our premium retail layout makes your local shop look like a first-class digital destination.',
        detail: 'Customize your storefront with banners, categories, and localized store hours.',
        color: 'from-[#112244] to-[#007AFF]'
    },
    {
        step: 3,
        icon: '📦',
        title: 'Smart Inventory Sync',
        desc: 'Link your items to our 10,000+ item Master Catalog. Update prices and stock levels instantly via our integrated barcode scanner.',
        detail: 'Our AI-powered catalog matching ensures your products are easy for shoppers to find.',
        color: 'from-[#007AFF] to-[#E5F1FF]'
    },
    {
        step: 4,
        icon: '📣',
        title: 'Proximity Promotions',
        desc: 'Create deals and flyers. We automatically notify shoppers walking within your configurable radius using geo-fencing alerts.',
        detail: 'Target local foot traffic with flash sales that appear on shoppers phones when they walk by.',
        color: 'from-[#112244] to-[#34C759]'
    },
    {
        step: 5,
        icon: '🛒',
        title: 'Seamless Order Flow',
        desc: 'Manage reservations and orders via your dashboard with real-time push notifications and audible order alerts.',
        detail: 'Handle high volumes with ease using our merchant-specific dashboard and live order tracking.',
        color: 'from-[#007AFF] to-[#112244]'
    },
    {
        step: 6,
        icon: '📈',
        title: 'Insightful Growth',
        desc: 'Access market price benchmarks and traffic analytics to optimize your pricing and outperform the competition.',
        detail: 'See exactly how your store is performing compared to local market averages.',
        color: 'from-[#112244] to-[#007AFF]'
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
    const { t } = useTranslation();
    return (
        <div className="bg-[var(--surface-0)] min-h-screen">
            <SEO 
                title="Partner with Us" 
                description="Join Spendigo as a local merchant. Reach nearby shoppers with proximity alerts, manage inventory with barcode scanning, and grow your business with AI insights — for free." 
                path="/partner" 
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
                        <span className="flex h-2 w-2 rounded-full bg-[var(--brand-secondary)] animate-ping" />
                        <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            {t('partnerMerchantProgram')}
                        </span>
                    </div>

                    <h1 className="text-3xl sm:text-4xl md:text-7xl font-black tracking-tight text-[var(--text-main)] mb-4 md:mb-6 leading-[1.15] md:leading-[1.1]">
                        Grow Your Store <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#112244] to-[#007AFF]">
                            with Spendigo
                        </span>
                    </h1>

                    <p className="text-base md:text-xl text-[var(--text-muted)] max-w-2xl mx-auto mb-8 md:mb-10 leading-relaxed px-2">
                        {t('partnerHeroDesc')}
                        <span className="font-bold text-[var(--text-main)]"> {t('partnerHeroDescHighlight')}</span>
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4 px-4 sm:px-0">
                        <Link to="/register/business" className="w-full sm:w-auto px-8 md:px-10 py-3.5 md:py-4 bg-[#112244] text-white font-black rounded-2xl shadow-xl shadow-blue-500/10 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm md:text-base text-center uppercase tracking-widest">
                            🚀 {t('partnerGetStartedFree')}
                        </Link>
                        <Link to="/how-it-works" className="w-full sm:w-auto px-8 md:px-10 py-3.5 md:py-4 bg-white text-[#112244] font-black rounded-2xl border-2 border-gray-100 hover:border-[#007AFF] transition-all text-sm md:text-base text-center uppercase tracking-widest">
                            {t('partnerLearnHow')}
                        </Link>
                    </div>
                </div>
            </div>

            {/* How It Works Steps */}
            <section className="py-16 md:py-24 bg-white relative">
                <div className="max-w-5xl mx-auto px-4">
                    <div className="text-center mb-12 md:mb-20">
                        <h2 className="text-2xl md:text-4xl font-black text-[#112244] mb-4">{t('howItWorks')}</h2>
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
                                        <span className="text-[#007AFF] font-black text-[10px] md:text-sm uppercase tracking-widest">Phase 0{item.step}</span>
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

            {/* Benefits Grid */}
            <section className="py-16 md:py-24 bg-[var(--surface-1)]">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="text-center mb-12 md:mb-20">
                        <h2 className="text-2xl md:text-4xl font-black text-[var(--text-main)] mb-4">{t('partnerWhyMerchantsLove')}</h2>
                        <p className="text-sm md:text-base text-[var(--text-muted)] max-w-xl mx-auto px-4">{t('partnerWhyMerchantsLoveDesc')}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        {benefits.map((b, i) => (
                            <div key={i} className="p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] bg-white border border-[var(--glass-border)] hover:bg-[var(--brand-primary-light)] hover:shadow-xl hover:-translate-y-1 transition-all group">
                                <div className="text-3xl md:text-4xl mb-4 md:mb-6 transform group-hover:scale-110 transition-transform">
                                    {b.icon}
                                </div>
                                <h3 className="text-lg md:text-xl font-bold text-[var(--text-main)] mb-2 md:md:mb-3">{b.label}</h3>
                                <p className="text-xs md:text-sm text-[var(--text-muted)] leading-relaxed">
                                    {b.detail}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 md:py-32 bg-white text-center">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="relative rounded-[2rem] md:rounded-[3rem] bg-[#112244] p-8 md:p-20 overflow-hidden text-white shadow-2xl shadow-blue-500/10">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                        <div className="relative z-10">
                            <h2 className="text-3xl md:text-5xl font-black text-white mb-6 leading-tight">{t('partnerReadyToReach')}</h2>
                            <p className="text-lg md:text-xl text-white/80 mb-10 max-w-2xl mx-auto">
                                {t('partnerReadyToReachDesc')}
                            </p>
                            <Link
                                to="/register/business"
                                className="inline-flex items-center justify-center px-10 py-4 bg-[#007AFF] text-white font-black text-lg rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all uppercase tracking-widest"
                            >
                                {t('partnerCreateFreeStore')}
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default PartnerWithUs;
