import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../../styles/design-system.css';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useLocation } from '../../context/LocationContext';
import AdCarousel from '../../components/AdCarousel';
import { useTranslation } from 'react-i18next';

const CATEGORIES = ['All', 'Fastest', 'Offers', 'Low Prices', 'Grocery', 'Convenience', 'Wholesale'];

// Helper to parse delivery time range and get min minutes
const parseDeliveryTime = (timeStr: string): number => {
    const match = timeStr.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 60;
};

const getValidFlyerImage = (imageUrl?: string): string | undefined => {
    if (!imageUrl) return undefined;
    if (imageUrl.includes('.gemini/antigravity/brain')) {
        if (imageUrl.includes('produce')) return '/assets/flyers/fresh_produce.png';
        if (imageUrl.includes('meat')) return '/assets/flyers/meat_bbq.png';
        if (imageUrl.includes('bakery')) return '/assets/flyers/bakery_breakfast.png';
        if (imageUrl.includes('deals')) return '/assets/flyers/weekly_deals.png';
        if (imageUrl.includes('spices')) return '/assets/flyers/ethnic_spices.png';
        return '/assets/flyers/fresh_produce.png';
    }
    return imageUrl;
};

const StoreList: React.FC = () => {
    const navigate = useNavigate();
    const { stores, loading } = useMarketplace();
    const { userCoords, userPostalCode, address, setAddress, searchDistance, setSearchDistance, isLocating, handleLocateMe, handleSearch, calculateDistance } = useLocation();
    const { t } = useTranslation();

    const allStores = useMemo(() => {
        if (!stores) return [];
        const activeStores = Object.values(stores).filter((s: any) => s.status === 'active' || !s.status);
        let mappedStores = activeStores.map((store: any) => {
            let distanceVal = 'Distance unknown';
            let distanceNum = 9999;

            if (userCoords && store.coordinates) {
                distanceNum = calculateDistance(userCoords.lat, userCoords.lng, store.coordinates.lat, store.coordinates.lng);
                distanceVal = `${distanceNum.toFixed(1)} km`;
            }

            return {
                id: store.id,
                name: store.name,
                distance: distanceVal,
                distanceNum: distanceNum,
                postalCode: store.postalCode || null,
                image: store.image,
                logoUrl: store.logoUrl || store.logo,
                tags: store.tags || [],
                deliveryTime: store.deliveryTime,
                deliveryFee: store.deliveryFee || '$3.99',
                rating: store.rating || 0,
                reviewCount: store.reviewCount || 0,
                hasFlyer: store.flyer?.validUntil ? (() => {
                    const validUntil = new Date(store.flyer.validUntil);
                    validUntil.setHours(23, 59, 59, 999);
                    return validUntil >= new Date();
                })() : false,
                flyerImage: getValidFlyerImage(store.flyer?.image),
                activeDealsCount: [...(store.oneDayOffers || []), ...(store.saleItems || [])].filter((d: any) => {
                    if (!d.validUntil) return true;
                    const validUntil = new Date(d.validUntil);
                    validUntil.setHours(23, 59, 59, 999);
                    return validUntil >= new Date();
                }).length,
                productCount: store.productCount || store.products?.length || 0
            };
        });

        if (userCoords && searchDistance > 0) {
            mappedStores = mappedStores.filter(store => {
                if (store.distanceNum <= searchDistance) return true;
                
                // Fallback: If distance calculation places them outside the radius
                // but they share the same FSA (first 3 chars of postal code), we include them.
                if (userPostalCode && store.postalCode) {
                    const userFSA = userPostalCode.trim().substring(0, 3).toUpperCase();
                    const storeFSA = store.postalCode.trim().substring(0, 3).toUpperCase();
                    // Basic sanity check that it looks like an FSA
                    if (userFSA === storeFSA && /^[A-Z]\d[A-Z]$/.test(userFSA)) {
                        return true;
                    }
                }
                return false;
            });
        }
        return mappedStores;
    }, [stores, userCoords, userPostalCode, searchDistance]);

    const stats = useMemo(() => {
        return {
            totalStores: allStores.length,
            totalFlyers: allStores.filter(s => s.hasFlyer).length,
            totalDeals: allStores.reduce((acc, s) => acc + s.activeDealsCount, 0),
            totalProducts: allStores.reduce((acc, s) => acc + s.productCount, 0)
        };
    }, [allStores]);

    const [activeCategory, setActiveCategory] = useState('All');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const filteredStores = useMemo(() => {
        let result = [...allStores];
        switch (activeCategory) {
            case 'Fastest':
                result = result.sort((a, b) => parseDeliveryTime(a.deliveryTime) - parseDeliveryTime(b.deliveryTime))
                    .filter(store => parseDeliveryTime(store.deliveryTime) <= 25);
                break;
            case 'Offers':
                result = result.filter(store => store.activeDealsCount > 0 || store.hasFlyer || store.tags.some((tag: string) => ['Deals', 'Offers', 'Sale', 'Wholesale'].includes(tag)));
                break;
            case 'Low Prices':
                result = result.filter(store => store.deliveryFee?.includes('Free') || (store.deliveryFee?.includes('$') && parseFloat(store.deliveryFee.replace(/[^0-9.]/g, '')) <= 2.5));
                break;
            case 'Grocery':
                result = result.filter(store => store.tags.some((tag: string) => ['Grocery', 'Organic', 'Farmers Market'].includes(tag)));
                break;
            case 'Convenience':
                result = result.filter(store => store.tags.some((tag: string) => ['Convenience', '24/7', 'Local'].includes(tag)));
                break;
            case 'Wholesale':
                result = result.filter(store => store.tags.some((tag: string) => ['Wholesale', 'Bulk'].includes(tag)));
                break;
            default: break;
        }
        if (userCoords) {
            result.sort((a, b) => a.distanceNum - b.distanceNum);
        }
        return result;
    }, [activeCategory, allStores, userCoords]);

    return (
        <div className="animate-fade-in">
            {loading && (
                <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="animate-spin text-4xl">⏳</div>
                </div>
            )}

            <AdCarousel
                handleSearch={handleSearch}
                address={address}
                setAddress={setAddress}
                isLocating={isLocating}
                handleLocateMe={handleLocateMe}
            />

            <section className="py-8 px-4 bg-[var(--surface-1)] border-b border-[var(--glass-border)]">
                <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                        <p className="text-3xl font-bold text-[var(--brand-primary)]">{stats.totalStores}</p>
                        <p className="text-sm text-[var(--text-muted)]">{t('localGrocers')}</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-[var(--brand-primary)]">{stats.totalFlyers}</p>
                        <p className="text-sm text-[var(--text-muted)]">{t('activeFlyers')}</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-[var(--brand-primary)]">{stats.totalDeals}</p>
                        <p className="text-sm text-[var(--text-muted)]">{t('activeDeals')}</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-[var(--brand-primary)]">
                            {stats.totalProducts >= 1000 ? `${(stats.totalProducts / 1000).toFixed(1)}k+` : stats.totalProducts}
                        </p>
                        <p className="text-sm text-[var(--text-muted)]">{t('productsAvailable')}</p>
                    </div>
                </div>
            </section>

            {allStores.filter(s => s.hasFlyer).length > 0 && (
                <section className="py-6 px-4 bg-[var(--surface-0)] border-b border-[var(--glass-border)]">
                    <div className="max-w-5xl mx-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span className="text-2xl">📰</span> {t('weeklyFlyers')}
                            </h2>
                            <Link to="/flyers" className="text-sm text-[var(--brand-primary)] font-medium hover:underline">{t('viewAll')}</Link>
                        </div>
                        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
                            {allStores.filter(s => s.hasFlyer).map(store => (
                                <div
                                    key={store.id}
                                    onClick={() => navigate(`/store/${store.id}`, { state: { initialTab: 'flyer' } })}
                                    className="min-w-[280px] md:min-w-[320px] bg-white rounded-xl border border-[var(--glass-border)] shadow-sm hover:shadow-md transition-all cursor-pointer snap-center group overflow-hidden"
                                >
                                    <div className="relative h-40">
                                        <img src={store.flyerImage || store.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                                            <div>
                                                <h3 className="text-white font-bold text-lg drop-shadow-md">{store.name}</h3>
                                                <p className="text-white/90 text-xs">{t('expiresSoon')}</p>
                                            </div>
                                        </div>
                                        <div className="absolute top-3 right-3 bg-red-600 text-white text-[10px] uppercase font-bold px-2 py-1 rounded shadow-sm animate-pulse">{t('liveFlyer')}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            <section className="py-4 px-4 bg-[var(--surface-0)] sticky top-16 z-40 border-b border-[var(--glass-border)]">
                <div className="max-w-5xl mx-auto overflow-x-auto scrollbar-hide">
                    <div className="flex gap-2 min-w-max">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-1)] hover:text-[var(--text-main)]'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-8 px-4">
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-[var(--text-main)]">{activeCategory === 'All' ? t('storesNearYou') : `${activeCategory} ${t('storesWord')}`}</h2>
                        <div className="flex items-center gap-4">
                            <select 
                                value={searchDistance} 
                                onChange={(e) => setSearchDistance(Number(e.target.value))}
                                className="text-sm bg-[var(--surface-2)] border border-[var(--glass-border)] rounded-md px-2 py-1 text-[var(--text-main)] outline-none cursor-pointer"
                            >
                                <option value={5}>{t('within5km')}</option>
                                <option value={10}>{t('within10km')}</option>
                                <option value={25}>{t('within25km')}</option>
                                <option value={50}>{t('within50km')}</option>
                            </select>
                            <span className="text-sm text-[var(--text-muted)] hidden sm:inline">{filteredStores.length} {t('storesCount')}</span>
                            <div className="flex bg-[var(--surface-2)] rounded-lg p-1 border border-[var(--glass-border)]">
                                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-[var(--brand-primary)]' : 'text-gray-400 hover:text-gray-600'}`}>
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                                </button>
                                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-[var(--brand-primary)]' : 'text-gray-400 hover:text-gray-600'}`}>
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-4"}>
                            {[1, 2, 3, 4, 5, 6].map((n) => (
                                <div key={n} className={`bg-gray-100 rounded-xl animate-pulse border border-gray-200 ${viewMode === 'grid' ? 'h-80' : 'h-36 flex'}`}>
                                    <div className={`bg-gray-200 ${viewMode === 'grid' ? 'h-40 w-full mb-4' : 'w-32 h-full'}`}></div>
                                    <div className={`px-4 ${viewMode === 'grid' ? '' : 'flex flex-col justify-center flex-1'}`}>
                                        <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredStores.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-5xl mb-4">🔍</p>
                            <p className="text-[var(--text-muted)]">{t('noStoresMatch')}</p>
                        </div>
                    ) : (
                        <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-4"}>
                            {filteredStores.map(store => (
                                <div
                                    key={store.id}
                                    onClick={() => navigate(`/store/${store.id}`)}
                                    className={`glass-panel overflow-hidden cursor-pointer group hover:border-[var(--brand-primary)] hover:shadow-lg hover:shadow-[var(--brand-primary)]/10 transition-all duration-300 relative ${viewMode === 'list' ? 'flex flex-row items-stretch' : ''}`}
                                >
                                    <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 items-end">
                                        {store.hasFlyer && <span className="bg-red-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded shadow-sm">{t('newFlyer')}</span>}
                                        {store.activeDealsCount > 0 && <span className="bg-green-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded shadow-sm">{store.activeDealsCount} {t('dealsWord')}</span>}
                                    </div>

                                    <div className={`bg-[var(--surface-2)] relative overflow-hidden ${viewMode === 'list' ? 'w-32 md:w-48 shrink-0' : 'h-36'}`}>
                                        <img src={store.image} alt={store.name} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 will-change-transform" />
                                        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-md text-xs text-white font-medium">{store.deliveryTime}</div>
                                    </div>

                                    <div className={`p-4 relative flex-1 ${viewMode === 'list' ? 'flex flex-col justify-center' : ''}`}>
                                        <div className={`w-12 h-12 rounded-xl bg-[var(--surface-0)] border-2 border-[var(--glass-border)] flex items-center justify-center text-2xl shadow-lg overflow-hidden ${viewMode === 'list' ? 'hidden' : 'absolute -top-6 left-4'}`}>
                                            {store.logoUrl && store.logoUrl.startsWith('http') ? <img src={store.logoUrl} alt="Logo" loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <span>{store.logoUrl || '🏪'}</span>}
                                        </div>

                                        <div className={`${viewMode === 'list' ? '' : 'ml-14'}`}>
                                            <h3 className="font-bold text-lg text-[var(--text-main)] group-hover:text-[var(--brand-primary)] transition-colors">{store.name}</h3>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm text-[var(--text-muted)]">{store.distance} {t('away')}</p>
                                                <span className="text-xs font-semibold flex items-center gap-0.5 bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                                                    ★ {store.rating > 0 ? store.rating.toFixed(1) : '0.0'} <span className="opacity-70 font-normal">({store.reviewCount || 0})</span>
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 mt-3 flex-wrap">
                                            {store.tags.map((tag: string) => (
                                                <span key={tag} className="text-xs bg-[var(--surface-2)] px-2 py-1 rounded-full text-[var(--text-muted)]">{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            <section className="py-8 px-4">
                <div className="max-w-5xl mx-auto">
                    <div className="glass-panel p-6 md:p-8 bg-gradient-to-r from-[var(--brand-primary)]/20 to-[var(--brand-secondary)]/20 border-[var(--brand-primary)]/30">
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            <div className="text-5xl">🛒✨</div>
                            <div className="flex-1 text-center md:text-left">
                                <h3 className="text-xl font-bold text-[var(--text-main)] mb-2">{t('optimizerTitle')}</h3>
                                <p className="text-[var(--text-muted)]">
                                    {t('optimizerDesc')}<br/>
                                    {t('optimizerSave1')} <span className="text-[var(--brand-secondary)] font-bold">15%</span> {t('optimizerSave2')}
                                </p>
                            </div>
                            <Link to="/how-it-works" className="px-6 py-3 bg-[var(--brand-primary)] text-white font-bold rounded-full hover:brightness-110 transition-all whitespace-nowrap">
                                {t('learnMore')}
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default StoreList;
