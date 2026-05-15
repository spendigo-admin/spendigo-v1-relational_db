import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useLocation } from '../../context/LocationContext';
import '../../styles/design-system.css';
import SEO from '../../components/SEO';
import { filterActiveDeals } from '../../utils/date-helpers';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../components/ui/EmptyState';
import { useDealQuality, DealQualityBadge } from '../../hooks/useDealQuality';

const FILTERS = ['All', 'Flash Sales', 'Sale Items', 'Percentage Off', 'Fixed Price'];

const BADGE_STYLES: Record<DealQualityBadge, { bg: string; text: string }> = {
    historic_low:      { bg: 'bg-green-100', text: 'text-green-700' },
    great_deal:        { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    average:           { bg: 'bg-gray-100', text: 'text-gray-500' },
    above_average:     { bg: 'bg-orange-50', text: 'text-orange-500' },
    high_price:        { bg: 'bg-red-50', text: 'text-red-400' },
    insufficient_data: { bg: '', text: '' },
};

interface DealCardProps {
    deal: any;
    onNavigate: (storeId: string) => void;
}

const DealCard: React.FC<DealCardProps> = ({ deal, onNavigate }) => {
    const discount =
        deal.type === 'percentage'
            ? `${deal.value}% OFF`
            : deal.type === 'fixed'
            ? `$${deal.value} OFF`
            : 'BOGO';

    const productName = deal.productName || deal.name || 'Product';
    const productImage = deal.productImage || deal.image;
    const salePrice = deal.salePrice ?? deal.price;
    const originalPrice = deal.originalPrice;
    const savings =
        originalPrice && salePrice ? (originalPrice - salePrice).toFixed(2) : null;

    // Compare against cross-chain Flipp market baseline (retailer='ALL')
    const quality = useDealQuality(productName, 'ALL', salePrice);
    const badgeStyle = quality && quality.badge !== 'insufficient_data'
        ? BADGE_STYLES[quality.badge]
        : null;

    return (
        <div
            onClick={() => onNavigate(deal.storeId)}
            className="min-w-[180px] max-w-[180px] bg-white rounded-2xl border border-[var(--glass-border)] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden flex-shrink-0 group snap-start"
        >
            <div className="relative h-32 bg-[var(--surface-2)]">
                {productImage ? (
                    <img
                        src={productImage}
                        alt={productName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl opacity-40">🏷️</div>
                )}
                <div className="absolute top-2 left-2">
                    <span className="badge-best">{discount}</span>
                </div>
                {deal.isFlashSale && (
                    <div className="absolute top-2 right-2">
                        <span className="badge-deal animate-pulse">⚡ Flash</span>
                    </div>
                )}
            </div>

            <div className="p-4">
                <p className="text-xs font-black text-[var(--brand-navy)] leading-tight line-clamp-2 h-8 group-hover:text-[var(--brand-primary)] transition-colors mb-3 uppercase tracking-tight">{productName}</p>
                <div className="flex items-center gap-2">
                    <span className="text-xl font-black text-[var(--brand-primary)]">${salePrice?.toFixed(2)}</span>
                    {originalPrice && (
                        <span className="text-[10px] font-bold text-[var(--text-muted)] line-through tracking-tighter">${originalPrice.toFixed(2)}</span>
                    )}
                </div>
                {savings && savings !== '0.00' && (
                    <p className="text-[9px] font-black text-green-600 mt-2 uppercase tracking-[0.1em] italic">You Save ${savings}</p>
                )}
                {badgeStyle && quality && (
                    <span className={`inline-block mt-2 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${badgeStyle.bg} ${badgeStyle.text}`}>
                        {quality.label}
                    </span>
                )}
            </div>
        </div>
    );
};

const Deals: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { stores, loading } = useMarketplace();
    const { userCoords, userPostalCode, searchDistance, calculateDistance } = useLocation();
    const [activeFilter, setActiveFilter] = useState('All');

    const storesWithDeals = useMemo(() => {
        return Object.values(stores || {}).filter((s: any) => s.status === 'active').map((store: any) => {
            // Distance filter
            if (userCoords && searchDistance > 0 && store.coordinates) {
                const distance = calculateDistance(userCoords.lat, userCoords.lng, store.coordinates.lat, store.coordinates.lng);
                if (distance > searchDistance) {
                    if (userPostalCode && store.postalCode) {
                        const userFSA = userPostalCode.trim().substring(0, 3).toUpperCase();
                        const storeFSA = store.postalCode.trim().substring(0, 3).toUpperCase();
                        if (!(userFSA === storeFSA && /^[A-Z]\d[A-Z]$/.test(userFSA))) return null;
                    } else {
                        return null;
                    }
                }
            }

            const allDeals = [...(store.oneDayOffers || []), ...(store.saleItems || [])];
            let deals = filterActiveDeals(allDeals);

            // Apply active filter
            if (activeFilter === 'Flash Sales') deals = deals.filter((d: any) => d.isFlashSale);
            else if (activeFilter === 'Sale Items') deals = deals.filter((d: any) => !d.isFlashSale);
            else if (activeFilter === 'Percentage Off') deals = deals.filter((d: any) => d.type === 'percentage');
            else if (activeFilter === 'Fixed Price') deals = deals.filter((d: any) => d.type === 'fixed');

            if (deals.length === 0) return null;

            return {
                ...store,
                deals: deals.map((d: any) => ({
                    ...d,
                    storeName: store.name,
                    storeId: store.id,
                    storeLogoUrl: store.logoUrl || store.logo
                }))
            };
        }).filter(Boolean);
    }, [stores, userCoords, userPostalCode, searchDistance, calculateDistance, activeFilter]);

    const totalDealsCount = useMemo(() => {
        return storesWithDeals.reduce((acc, s) => acc + (s?.deals?.length || 0), 0);
    }, [storesWithDeals]);

    return (
        <div className="animate-fade-in pb-20 bg-[var(--surface-1)] min-h-screen">
            <SEO title="Active Deals" description="Discover hot deals and sale items from local grocery stores near you. Save more with Spendigo SmartCart." path="/deals" />

            {/* Header */}
            <div className="bg-white border-b border-[var(--glass-border)] sticky top-0 z-30 px-4 py-4 backdrop-blur-md bg-white/80">
                <div className="max-w-5xl mx-auto flex items-center gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="w-10 h-10 rounded-xl bg-[var(--surface-1)] flex items-center justify-center text-[var(--brand-navy)] hover:bg-[var(--surface-2)] transition-all border border-[var(--glass-border)] group"
                    >
                        <span className="group-hover:-translate-x-1 transition-transform">←</span>
                    </button>
                    <div>
                        <h1 className="text-xl font-black text-[var(--brand-navy)] flex items-center gap-2 italic tracking-tighter">
                            <span className="text-2xl">🔥</span> {t('activeDeals')}
                        </h1>
                        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{totalDealsCount} {t('dealsAvailableNearby')}</p>
                    </div>
                </div>

                {/* Filter pills */}
                <div className="max-w-5xl mx-auto mt-3 overflow-x-auto scrollbar-hide">
                    <div className="flex gap-2 min-w-max">
                        {FILTERS.map(f => (
                            <button
                                key={f}
                                onClick={() => setActiveFilter(f)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${activeFilter === f ? 'bg-[var(--brand-navy)] text-white border-[var(--brand-navy)] shadow-lg' : 'bg-white text-[var(--text-muted)] border-[var(--glass-border)] hover:border-[var(--brand-primary)]'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <main className="max-w-5xl mx-auto py-6 space-y-8">
                {loading ? (
                    <div className="px-4 space-y-8">
                        {[1, 2, 3].map(n => (
                            <div key={n} className="space-y-4">
                                <div className="h-6 w-48 bg-[var(--surface-2)] rounded animate-pulse" />
                                <div className="flex gap-4 overflow-hidden">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="min-w-[180px] h-56 bg-[var(--surface-2)] rounded-2xl animate-pulse" />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : storesWithDeals.length === 0 ? (
                    <EmptyState
                        icon="🏷️"
                        heading={t('dealsNoDealsFound')}
                        subtext={t('dealsNoDealsFoundHint')}
                        action={
                            <button onClick={() => navigate('/')} className="btn-primary">
                                {t('dealsBackToStores')}
                            </button>
                        }
                    />
                ) : (
                    <div className="space-y-10">
                        {storesWithDeals.map((store: any) => (
                            <section key={store.id} className="animate-slide-up">
                                <div className="px-4 flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-black text-[var(--brand-navy)] flex items-center gap-3 italic tracking-tight">
                                        <div className="w-10 h-10 rounded-xl bg-white border border-[var(--glass-border)] flex items-center justify-center overflow-hidden shadow-sm p-1.5">
                                            {store.logoUrl && (store.logoUrl.startsWith('http') || store.logoUrl.startsWith('/') || store.logoUrl.startsWith('data:')) ? (
                                                <img src={store.logoUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-xs">🏪</span>
                                            )}
                                        </div>
                                        {store.name}
                                        <span className="text-[10px] font-black text-[var(--brand-primary)] px-2.5 py-1 bg-[var(--brand-primary-light)] rounded-full uppercase tracking-widest">{store.deals.length} DEALS</span>
                                    </h3>
                                    <button
                                        onClick={() => navigate(`/store/${store.id}`)}
                                        className="text-[10px] font-black text-[var(--brand-primary)] hover:underline uppercase tracking-[0.2em]"
                                    >
                                        {t('dealsVisitStore')}
                                    </button>
                                </div>

                                <div className="flex gap-4 overflow-x-auto pb-4 px-4 scrollbar-hide snap-x">
                                    {store.deals.map((deal: any) => (
                                        <DealCard
                                            key={`${deal.storeId}-${deal.id}`}
                                            deal={deal}
                                            onNavigate={(storeId) => navigate(`/store/${storeId}`, { state: { initialTab: 'offers' } })}
                                        />
                                    ))}
                                    {/* Visual spacer at end of scroller */}
                                    <div className="min-w-[20px] h-1 flex-shrink-0" />
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default Deals;
