import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useLocation } from '../../context/LocationContext';
import '../../styles/design-system.css';
import SEO from '../../components/SEO';
import { filterActiveDeals } from '../../utils/date-helpers';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../components/ui/EmptyState';

const FILTERS = ['All', 'Flash Sales', 'Sale Items', 'Percentage Off', 'Fixed Price'];

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
            <div className="bg-[var(--surface-0)] border-b border-[var(--glass-border)] sticky top-0 z-30 px-4 py-4 backdrop-blur-md bg-white/80">
                <div className="max-w-5xl mx-auto flex items-center gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="w-10 h-10 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--surface-1)] transition-colors border border-[var(--glass-border)]"
                    >
                        ←
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
                            <span className="text-2xl">🔥</span> {t('activeDeals')}
                        </h1>
                        <p className="text-xs text-[var(--text-muted)]">{totalDealsCount} deal{totalDealsCount !== 1 ? 's' : ''} available nearby</p>
                    </div>
                </div>

                {/* Filter pills */}
                <div className="max-w-5xl mx-auto mt-3 overflow-x-auto scrollbar-hide">
                    <div className="flex gap-2 min-w-max">
                        {FILTERS.map(f => (
                            <button
                                key={f}
                                onClick={() => setActiveFilter(f)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${activeFilter === f ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-md shadow-[var(--brand-primary)]/20' : 'bg-white text-[var(--text-muted)] border-[var(--glass-border)] hover:bg-[var(--surface-1)]'}`}
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
                        heading="No active deals found"
                        subtext="We couldn't find any active deals matching your filters in your area. Try adjusting your radius or checking back later."
                        action={
                            <button onClick={() => navigate('/')} className="btn-primary">
                                Back to Stores
                            </button>
                        }
                    />
                ) : (
                    <div className="space-y-10">
                        {storesWithDeals.map((store: any) => (
                            <section key={store.id} className="animate-slide-up">
                                <div className="px-4 flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-white border border-[var(--glass-border)] flex items-center justify-center overflow-hidden shadow-sm">
                                            {store.logoUrl && (store.logoUrl.startsWith('http') || store.logoUrl.startsWith('/') || store.logoUrl.startsWith('data:')) ? (
                                                <img src={store.logoUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-xs">🏪</span>
                                            )}
                                        </div>
                                        {store.name}
                                        <span className="text-xs font-normal text-[var(--text-muted)] px-2 py-0.5 bg-[var(--surface-2)] rounded-full">{store.deals.length}</span>
                                    </h3>
                                    <button 
                                        onClick={() => navigate(`/store/${store.id}`)}
                                        className="text-xs font-bold text-[var(--brand-primary)] hover:underline"
                                    >
                                        Visit Store →
                                    </button>
                                </div>

                                <div className="flex gap-4 overflow-x-auto pb-4 px-4 scrollbar-hide snap-x">
                                    {store.deals.map((deal: any) => {
                                        const discount = deal.type === 'percentage'
                                            ? `${deal.value}% OFF`
                                            : deal.type === 'fixed'
                                            ? `$${deal.value} OFF`
                                            : 'BOGO';
                                        
                                        // Robust data mapping
                                        const productName = deal.productName || deal.name || 'Product';
                                        const productImage = deal.productImage || deal.image;
                                        const salePrice = deal.salePrice ?? deal.price;
                                        const originalPrice = deal.originalPrice;
                                        
                                        const savings = originalPrice && salePrice
                                            ? (originalPrice - salePrice).toFixed(2)
                                            : null;

                                        return (
                                            <div
                                                key={`${deal.storeId}-${deal.id}`}
                                                onClick={() => navigate(`/store/${deal.storeId}`, { state: { initialTab: 'offers' } })}
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

                                                <div className="p-3">
                                                    <p className="text-xs font-bold text-[var(--text-main)] leading-tight line-clamp-2 h-8 group-hover:text-[var(--brand-primary)] transition-colors">{productName}</p>
                                                    <div className="flex items-center gap-1.5 mt-2">
                                                        <span className="text-lg font-black text-green-600">${salePrice?.toFixed(2)}</span>
                                                        {originalPrice && (
                                                            <span className="text-xs text-[var(--text-muted)] line-through">${originalPrice.toFixed(2)}</span>
                                                        )}
                                                    </div>
                                                    {savings && savings !== '0.00' && (
                                                        <p className="text-xs font-semibold text-green-600 mt-1">You Save ${savings}</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
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
