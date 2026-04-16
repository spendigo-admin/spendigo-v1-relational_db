import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../../styles/design-system.css';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useLocation } from '../../context/LocationContext';
import AdCarousel from '../../components/AdCarousel';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import { isFlyerActive, filterActiveDeals } from '../../utils/date-helpers';

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
                hasFlyer: isFlyerActive(store.flyer),
                flyerImage: getValidFlyerImage(store.flyer?.image),
                activeDealsCount: filterActiveDeals([...(store.oneDayOffers || []), ...(store.saleItems || [])]).length,
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
            <SEO
                title="Home"
                description="Discover local grocery stores near you. Compare prices, browse weekly flyers, and save money with Spendigo SmartCart."
                path="/"
            />
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

            {/* PREMIUM MARKETPLACE INFO BOARD */}
            <section className="relative z-30 max-w-7xl mx-auto px-4 -mt-8">
                <div className="bg-white rounded-[2rem] shadow-2xl border border-gray-100 p-2 md:p-3 flex flex-wrap lg:flex-nowrap items-stretch gap-1">
                    <div className="flex-1 min-w-[150px] bg-gray-50/50 p-6 rounded-2xl border border-gray-50 flex flex-col items-center justify-center text-center group hover:bg-white hover:shadow-xl transition-all">
                        <span className="text-[10px] font-black text-gray-400 tracking-widest mb-1">Local Grocers</span>
                        <p className="text-3xl font-black text-gray-900 tracking-tighter">{stats.totalStores}</p>
                        <p className="text-[9px] text-gray-400 font-bold mt-1">Verified Partners</p>
                    </div>
                    <div className="w-px bg-gray-100 hidden lg:block my-4"></div>
                    <div className="flex-1 min-w-[150px] bg-gray-50/50 p-6 rounded-2xl border border-gray-50 flex flex-col items-center justify-center text-center group hover:bg-white hover:shadow-xl transition-all">
                        <span className="text-[10px] font-black text-gray-400 tracking-widest mb-1">Active Flyers</span>
                        <p className="text-3xl font-black text-teal-600 tracking-tighter">{stats.totalFlyers}</p>
                        <p className="text-[9px] text-gray-400 font-bold mt-1">Live Circulars</p>
                    </div>
                    <div className="w-px bg-gray-100 hidden lg:block my-4"></div>
                    <div className="flex-1 min-w-[150px] bg-gray-50/50 p-6 rounded-2xl border border-gray-50 flex flex-col items-center justify-center text-center group hover:bg-white hover:shadow-xl transition-all">
                        <span className="text-[10px] font-black text-gray-400 tracking-widest mb-1">Flash Deals</span>
                        <p className="text-3xl font-black text-gray-900 tracking-tighter">{stats.totalDeals}</p>
                        <p className="text-[9px] text-gray-400 font-bold mt-1">Limited Offers</p>
                    </div>
                    <div className="w-px bg-gray-100 hidden lg:block my-4"></div>
                    <div className="flex-1 min-w-[150px] bg-teal-600 p-6 rounded-2xl flex flex-col items-center justify-center text-center shadow-lg group hover:bg-black transition-all">
                        <span className="text-[10px] font-black text-white/70 tracking-widest mb-1">Marketplace Span</span>
                        <p className="text-3xl font-black text-white tracking-tighter font-mono">
                            {stats.totalProducts >= 1000 ? `${(stats.totalProducts / 1000).toFixed(1)}k+` : stats.totalProducts}
                        </p>
                        <p className="text-[9px] text-white/70 font-bold mt-1">Products Available</p>
                    </div>
                </div>
            </section>

            {/* WEEKLY FLYERS RACK */}
            {allStores.filter(s => s.hasFlyer).length > 0 && (
                <section className="py-16 px-4 bg-white overflow-hidden">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b-2 border-gray-100 pb-8">
                            <div>
                                <h2 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tighter leading-none italic">
                                    Weekly Rack <span className="text-teal-600 font-serif">/ Flyers</span>
                                </h2>
                                <p className="text-sm text-gray-400 font-bold tracking-widest mt-3">Browse standard pricing and fresh arrivals</p>
                            </div>
                            <Link to="/flyers" className="px-8 py-3 bg-gray-900 text-white text-[10px] font-black tracking-widest rounded-full hover:bg-teal-600 transition-all shadow-xl active:scale-95">
                                {t('viewAll')} Circulars
                            </Link>
                        </div>
                        <div className="flex gap-8 overflow-x-auto pb-8 scrollbar-hide snap-x perspective-1000">
                            {allStores.filter(s => s.hasFlyer).map(store => (
                                <div
                                    key={store.id}
                                    onClick={() => navigate(`/store/${store.id}`, { state: { initialTab: 'flyer' } })}
                                    className="min-w-[320px] md:min-w-[400px] h-64 bg-gray-100 rounded-[2.5rem] relative group cursor-pointer overflow-hidden shadow-2xl snap-center transition-all duration-500 hover:-translate-y-4 hover:rotate-1"
                                >
                                    <img 
                                        src={store.flyerImage || store.image} 
                                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-80 group-hover:opacity-100" 
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/20 to-transparent"></div>
                                    <div className="absolute bottom-0 left-0 right-0 p-8 flex items-end justify-between">
                                        <div>
                                            <span className="text-[10px] font-black bg-teal-600 text-white px-2 py-1 rounded-sm skew-x-[-12deg] mb-2 inline-block">Live now</span>
                                            <h3 className="text-2xl font-black text-white tracking-tighter italic">{store.name}</h3>
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white font-black text-xl hover:bg-white hover:text-teal-600 transition-all shadow-xl">
                                            →
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* HOT DEALS CAROUSEL */}
            {(() => {
                const storesWithDeals = allStores.map(store => {
                    const deals = filterActiveDeals([...(stores[store.id]?.oneDayOffers || []), ...(stores[store.id]?.saleItems || [])])
                        .map((deal: any) => ({ ...deal, storeName: store.name, storeId: store.id }));
                    return { ...store, deals };
                }).filter(s => s.deals.length > 0);

                if (storesWithDeals.length === 0) return null;

                return (
                    <section className="py-20 px-4 bg-gray-50 overflow-hidden border-t border-gray-200">
                        <div className="max-w-7xl mx-auto">
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b border-gray-200 pb-8">
                                <div>
                                    <h2 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tighter leading-none italic">
                                        Flash <span className="text-teal-600">Inventory</span>
                                    </h2>
                                    <p className="text-sm text-gray-500 font-bold tracking-widest mt-3">High-Impact savings across the marketplace</p>
                                </div>
                                <Link to="/deals" className="px-8 py-3 bg-gray-900 text-white text-[10px] font-black tracking-widest rounded-full hover:bg-teal-600 hover:text-white transition-all shadow-xl active:scale-95">
                                    {t('viewAll')} Bargains
                                </Link>
                            </div>
                            
                            <div className="flex gap-8 overflow-x-auto pb-10 scrollbar-hide snap-x">
                                {storesWithDeals.map(store => (
                                    <div key={store.id} className="flex gap-6 snap-start items-center">
                                        {/* Store Brand Pillar */}
                                        <div 
                                            onClick={() => navigate(`/store/${store.id}`)}
                                            className="flex flex-col items-center justify-center bg-white rounded-[2rem] border border-gray-200 p-6 min-w-[160px] cursor-pointer hover:bg-gray-50 hover:shadow-lg transition-all group shadow-sm"
                                        >
                                            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-4xl overflow-hidden mb-4 shadow-lg ring-4 ring-gray-100 group-hover:scale-110 transition-transform border border-gray-50">
                                                {store.logoUrl && store.logoUrl.startsWith('http') ? (
                                                    <img src={store.logoUrl} alt="" className="w-full h-full object-cover p-2" />
                                                ) : (
                                                    <span className="font-black text-gray-900">{store.logoUrl || '🏪'}</span>
                                                )}
                                            </div>
                                            <span className="text-xs font-black text-gray-900 text-center tracking-tight mb-2">{store.name}</span>
                                            <div className="px-3 py-1 bg-teal-600 text-white text-[9px] font-black rounded shadow-lg animate-pulse">
                                                {store.deals.length} Active
                                            </div>
                                        </div>

                                        {/* Deal Items */}
                                        <div className="flex gap-4">
                                            {store.deals.map((deal: any) => {
                                                const discount = deal.type === 'percentage'
                                                    ? `${deal.value}% OFF`
                                                    : deal.type === 'fixed'
                                                    ? `$${deal.value} OFF`
                                                    : 'BOGO';
                                                
                                                const productName = deal.productName || deal.name || 'Product';
                                                const productImage = deal.productImage || deal.image;
                                                const salePrice = deal.salePrice ?? deal.price;
                                                const originalPrice = deal.originalPrice;

                                                return (
                                                    <div
                                                        key={`${deal.storeId}-${deal.id}`}
                                                        onClick={() => navigate(`/store/${deal.storeId}`, { state: { initialTab: 'offers' } })}
                                                        className="min-w-[200px] max-w-[200px] bg-white rounded-3xl shadow-xl hover:-translate-y-2 transition-all duration-500 cursor-pointer overflow-hidden group/deal"
                                                    >
                                                        <div className="relative h-36 bg-gray-50 p-2">
                                                            {productImage ? (
                                                                <img src={productImage} alt={productName} className="w-full h-full object-contain group-hover/deal:scale-110 transition-transform duration-500" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-5xl opacity-40">🏷️</div>
                                                            )}
                                                            <div className="absolute top-3 left-3 bg-teal-600 text-white text-[9px] font-black px-2 py-1 rounded shadow-lg tracking-wider skew-x-[-12deg]">
                                                                {discount}
                                                            </div>
                                                        </div>
                                                        <div className="p-4">
                                                            <p className="text-xs font-black text-gray-900 tracking-tight line-clamp-2 h-8 group-hover/deal:text-teal-600 transition-colors leading-tight">{productName}</p>
                                                            <div className="flex items-baseline gap-2 mt-3">
                                                                <span className="text-2xl font-black text-gray-900 tracking-tighter">${salePrice?.toFixed(2)}</span>
                                                                {originalPrice && (
                                                                    <span className="text-[10px] text-gray-400 font-bold line-through">${originalPrice.toFixed(2)}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                );
            })()}

            {/* CATEGORY NAV & STORE GRID */}
            <div className="bg-white pt-16">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
                        <div>
                            <h2 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tighter italic m-0">
                                Local <span className="text-teal-600">Grocers</span>
                            </h2>
                            <p className="text-sm text-gray-400 font-bold tracking-[0.2em] mt-2">Verified quality near your location</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100 flex items-center gap-3">
                                <span className="text-[9px] font-black text-gray-400 tracking-widest">Radius:</span>
                                <select 
                                    value={searchDistance} 
                                    onChange={(e) => setSearchDistance(Number(e.target.value))}
                                    className="text-xs font-black bg-transparent border-none outline-none text-gray-900 cursor-pointer"
                                >
                                    <option value={5}>Within 5 KM</option>
                                    <option value={10}>Within 10 KM</option>
                                    <option value={25}>Within 25 KM</option>
                                    <option value={50}>Within 50 KM</option>
                                </select>
                            </div>
                            <div className="flex bg-gray-50 rounded-2xl p-1.5 border border-gray-100">
                                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white shadow-md text-teal-600' : 'text-gray-400 hover:text-gray-600'}`}>
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                                </button>
                                <button onClick={() => setViewMode('list')} className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white shadow-md text-teal-600' : 'text-gray-400 hover:text-gray-600'}`}>
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mb-12 overflow-x-auto scrollbar-hide">
                        <div className="flex gap-3 pb-2">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={`px-6 py-3 rounded-2xl text-[10px] font-black tracking-widest transition-all whitespace-nowrap border-2 ${activeCategory === cat 
                                        ? 'bg-teal-600 text-white border-teal-600 shadow-xl -translate-y-1' 
                                        : 'bg-white text-gray-400 border-gray-50 hover:border-gray-200'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" : "flex flex-col gap-6"}>
                            {[1, 2, 3, 4, 5, 6].map((n) => (
                                <div key={n} className="bg-gray-50 h-80 rounded-[2rem] animate-pulse"></div>
                            ))}
                        </div>
                    ) : (
                        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" : "flex flex-col gap-6"}>
                            {filteredStores.map(store => (
                                <div
                                    key={store.id}
                                    onClick={() => navigate(`/store/${store.id}`)}
                                    className={`group bg-white rounded-[2.5rem] border-2 border-gray-50 shadow-sm hover:shadow-2xl hover:-translate-y-2 lg:hover:w-[102%] lg:hover:-ml-[1%] transition-all duration-500 cursor-pointer overflow-hidden relative ${viewMode === 'list' ? 'flex flex-row h-48' : 'min-h-[380px]'}`}
                                >
                                    {/* Store Graphics */}
                                    <div className={`relative bg-gray-100 overflow-hidden ${viewMode === 'list' ? 'w-48 md:w-80 shrink-0' : 'h-48'}`}>
                                        <img src={store.image} alt={store.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-90 group-hover:opacity-100" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                                        <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] text-white font-black tracking-widest border border-white/20">
                                            {store.deliveryTime}
                                        </div>
                                        {(store.hasFlyer || store.activeDealsCount > 0) && (
                                            <div className="absolute top-4 right-4 flex flex-col gap-2 scale-75 md:scale-100">
                                                {store.hasFlyer && <span className="bg-teal-600 text-white text-[8px] font-black px-2 py-1 rounded shadow-lg tracking-widest skew-x-[-12deg]">Flyer Live</span>}
                                                {store.activeDealsCount > 0 && <span className="bg-gray-900 text-white text-[8px] font-black px-2 py-1 rounded shadow-lg tracking-widest skew-x-[-12deg]">{store.activeDealsCount} Hot Deals</span>}
                                            </div>
                                        )}
                                    </div>

                                    {/* Store Details */}
                                    <div className="p-8 flex flex-col flex-1 relative">
                                        <div className={`w-16 h-16 rounded-[1.5rem] bg-white border-2 border-gray-100 flex items-center justify-center text-4xl shadow-xl overflow-hidden transition-transform duration-500 group-hover:rotate-6 ${viewMode === 'list' ? 'mb-4' : 'absolute -top-8 left-8'}`}>
                                            {store.logoUrl && store.logoUrl.startsWith('http') ? <img src={store.logoUrl} alt="Logo" className="w-full h-full object-cover p-2" /> : <span className="font-black text-gray-900">{store.logoUrl || '🏪'}</span>}
                                        </div>

                                        <div className={viewMode === 'list' ? '' : 'mt-8'}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-black text-2xl text-gray-900 tracking-tighter italic m-0 group-hover:text-teal-600 transition-colors leading-none">{store.name}</h3>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <p className="text-xs font-bold text-gray-400 tracking-widest m-0">{store.distance} Away</p>
                                                <div className="w-1 h-1 bg-gray-200 rounded-full"></div>
                                                <span className="text-[10px] font-black flex items-center gap-1 bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">
                                                    ★ {store.rating > 0 ? store.rating.toFixed(1) : 'NEW'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2 mt-auto pt-6">
                                            {store.tags.slice(0, 3).map((tag: string) => (
                                                <span key={tag} className="text-[8px] font-black text-white bg-gray-900 px-2 py-1 rounded-sm tracking-widest skew-x-[-12deg]">{tag}</span>
                                            ))}
                                            <span className="text-[8px] font-black text-gray-400 bg-gray-50 border border-gray-100 px-2 py-1 rounded-sm tracking-widest ml-auto shadow-inner">{store.deliveryFee} FEE</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* HIGH-IMPACT MARKETPLACE PROMO */}
            <section className="py-32 px-4 bg-white overflow-hidden">
                <div className="max-w-7xl mx-auto">
                    <div className="relative bg-gray-50 rounded-[4rem] p-12 md:p-24 overflow-hidden group shadow-xl border border-gray-200">
                        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-teal-600/5 rounded-full blur-[120px] -mr-96 -mt-96 group-hover:bg-teal-600/10 transition-all duration-700"></div>
                        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[100px] -ml-48 -mb-48"></div>
                        
                        <div className="relative z-10 flex flex-col md:flex-row items-center gap-16">
                            <div className="text-8xl md:text-9xl animate-bounce-slow drop-shadow-xl">🛍️✨</div>
                            <div className="flex-1 text-center md:text-left">
                                <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-3 py-1 rounded shadow-sm tracking-[0.3em] mb-6 inline-block border border-teal-100">Spendigo Smartcart AI</span>
                                <h3 className="text-4xl md:text-7xl font-black text-gray-900 tracking-tighter italic leading-[0.9] mb-8">
                                    Why Pay <span className="text-teal-600 underline decoration-gray-200 underline-offset-8">Retail?</span>
                                </h3>
                                <p className="text-lg md:text-2xl text-gray-500 font-bold tracking-tight max-w-2xl leading-tight">
                                    Our SmartCart engine analyzes {stats.totalProducts}+ products across the marketplace to save you <span className="text-gray-900 font-black">15% or more</span> on every shop.
                                </p>
                                <div className="mt-12 flex flex-wrap gap-6 justify-center md:justify-start">
                                    <Link to="/how-it-works" className="px-12 py-5 bg-gray-900 text-white font-black text-xs tracking-[0.2em] rounded-full hover:bg-teal-600 transition-all shadow-xl active:scale-95 border-b-4 border-gray-800 hover:border-teal-800">
                                        Activate Optimizer
                                    </Link>
                                    <Link to="/register" className="px-12 py-5 bg-white border border-gray-300 text-gray-900 font-black text-xs tracking-[0.2em] rounded-full hover:bg-gray-100 transition-all shadow-sm">
                                        Join Marketplace
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default StoreList;
