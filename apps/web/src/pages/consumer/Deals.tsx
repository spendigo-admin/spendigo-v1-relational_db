import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useLocation } from '../../context/LocationContext';
import '../../styles/design-system.css';
import SEO from '../../components/SEO';
import { filterActiveDeals } from '../../utils/date-helpers';

const FILTERS = ['All', 'Flash Sales', 'Sale Items', 'Percentage Off', 'Fixed Price'];

const Deals: React.FC = () => {
    const navigate = useNavigate();
    const { stores, loading } = useMarketplace();
    const { userCoords, userPostalCode, searchDistance, calculateDistance } = useLocation();
    const [activeFilter, setActiveFilter] = useState('All');

    const dealProducts = useMemo(() => {
        return Object.values(stores || {}).flatMap((store: any) => {
            // Distance filter
            if (userCoords && searchDistance > 0 && store.coordinates) {
                const distance = calculateDistance(userCoords.lat, userCoords.lng, store.coordinates.lat, store.coordinates.lng);
                if (distance > searchDistance) {
                    if (userPostalCode && store.postalCode) {
                        const userFSA = userPostalCode.trim().substring(0, 3).toUpperCase();
                        const storeFSA = store.postalCode.trim().substring(0, 3).toUpperCase();
                        if (!(userFSA === storeFSA && /^[A-Z]\d[A-Z]$/.test(userFSA))) return [];
                    } else {
                        return [];
                    }
                }
            }

            return filterActiveDeals([...(store.oneDayOffers || []), ...(store.saleItems || [])]).map((deal: any) => ({
                ...deal,
                storeName: store.name,
                storeId: store.id,
                storeLogoUrl: store.logoUrl || store.logo,
            }));
        });
    }, [stores, userCoords, userPostalCode, searchDistance, calculateDistance]);

    const filteredProducts = useMemo(() => {
        switch (activeFilter) {
            case 'Flash Sales': return dealProducts.filter((d: any) => d.isFlashSale);
            case 'Sale Items': return dealProducts.filter((d: any) => !d.isFlashSale);
            case 'Percentage Off': return dealProducts.filter((d: any) => d.type === 'percentage');
            case 'Fixed Price': return dealProducts.filter((d: any) => d.type === 'fixed');
            default: return dealProducts;
        }
    }, [dealProducts, activeFilter]);

    return (
        <div className="animate-fade-in pb-20">
            <SEO title="Active Deals" description="Discover hot deals and sale items from local grocery stores near you. Save more with Spendigo SmartCart." path="/deals" />

            {/* Header */}
            <div className="bg-[var(--surface-0)] border-b border-[var(--glass-border)] sticky top-0 z-30 px-4 py-4">
                <div className="max-w-5xl mx-auto flex items-center gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="w-10 h-10 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--surface-1)] transition-colors"
                    >
                        ←
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
                            <span className="text-2xl">🔥</span> Hot Deals Near You
                        </h1>
                        <p className="text-xs text-[var(--text-muted)]">{filteredProducts.length} deal{filteredProducts.length !== 1 ? 's' : ''} available</p>
                    </div>
                </div>

                {/* Filter pills */}
                <div className="max-w-5xl mx-auto mt-3 overflow-x-auto scrollbar-hide">
                    <div className="flex gap-2 min-w-max">
                        {FILTERS.map(f => (
                            <button
                                key={f}
                                onClick={() => setActiveFilter(f)}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${activeFilter === f ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-1)]'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <main className="max-w-5xl mx-auto p-4 md:p-6">
                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                            <div key={n} className="h-56 bg-[var(--surface-2)] rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="text-center py-20">
                        <p className="text-5xl mb-4">🏷️</p>
                        <h2 className="text-xl font-bold text-[var(--text-main)] mb-2">No active deals found</h2>
                        <p className="text-[var(--text-muted)]">Check back later for new savings!</p>
                        <button
                            onClick={() => navigate('/')}
                            className="mt-6 px-6 py-2 bg-[var(--brand-primary)] text-white font-bold rounded-lg"
                        >
                            Back to Stores
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {filteredProducts.map((deal: any) => {
                            const discount = deal.type === 'percentage'
                                ? `${deal.value}% off`
                                : deal.type === 'fixed'
                                ? `$${deal.value} off`
                                : 'BOGO';
                            const savings = deal.originalPrice && deal.salePrice
                                ? (deal.originalPrice - deal.salePrice).toFixed(2)
                                : null;

                            return (
                                <div
                                    key={`${deal.storeId}-${deal.id}`}
                                    onClick={() => navigate(`/store/${deal.storeId}`, { state: { initialTab: 'offers' } })}
                                    className="bg-white rounded-2xl border border-[var(--glass-border)] shadow-sm hover:shadow-lg transition-all cursor-pointer group overflow-hidden"
                                >
                                    {/* Product image */}
                                    <div className="relative h-36 bg-[var(--surface-2)]">
                                        {deal.productImage ? (
                                            <img
                                                src={deal.productImage}
                                                alt={deal.productName}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-5xl">🏷️</div>
                                        )}
                                        <div className="absolute top-2 left-2 bg-green-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow">
                                            {discount}
                                        </div>
                                        {deal.isFlashSale && (
                                            <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow animate-pulse">
                                                ⚡ Flash
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="p-3">
                                        <p className="text-xs font-bold text-[var(--text-main)] leading-tight line-clamp-2 mb-2">{deal.productName}</p>
                                        <div className="flex items-baseline gap-1.5 mb-1">
                                            <span className="text-base font-black text-green-600">${deal.salePrice?.toFixed(2)}</span>
                                            {deal.originalPrice && (
                                                <span className="text-xs text-[var(--text-muted)] line-through">${deal.originalPrice.toFixed(2)}</span>
                                            )}
                                        </div>
                                        {savings && (
                                            <p className="text-[10px] font-semibold text-green-600 mb-1">Save ${savings}</p>
                                        )}

                                        {/* Store attribution */}
                                        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[var(--glass-border)]">
                                            <div className="w-4 h-4 rounded-full bg-[var(--surface-2)] flex items-center justify-center overflow-hidden flex-shrink-0">
                                                {deal.storeLogoUrl && deal.storeLogoUrl.startsWith('http') ? (
                                                    <img src={deal.storeLogoUrl} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-[8px]">🏪</span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-[var(--text-muted)] truncate">{deal.storeName}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
};

export default Deals;
