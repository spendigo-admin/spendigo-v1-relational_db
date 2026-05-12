import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useLocation } from '../../context/LocationContext';
import { Skeleton } from '../../components/ui/Skeleton';
import { filterActiveDeals } from '../../utils/date-helpers';
import { useAuth } from '../../context/AuthContext';

const StoreCardSkeleton = () => (
    <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 p-4">
        <Skeleton className="h-40 w-full mb-4" />
        <Skeleton className="h-6 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2" />
    </div>
);

const StoreList: React.FC = () => {
    const navigate = useNavigate();
    const { allStores, loading } = useMarketplace();
    const { user } = useAuth();
    const { 
        address, 
        setAddress, 
        handleSearch, 
        isLocating, 
        searchDistance, 
        setSearchDistance,
        userCoords,
        calculateDistance,
        handleLocateMe
    } = useLocation();
    
    const [activeCategory, setActiveCategory] = useState('All');
    const [localSearch, setLocalSearch] = useState(address || 'San Francisco, California');
    
    // BACKEND AD CAROUSEL STATE
    const [ads, setAds] = useState<any[]>([]);
    const [currentAdIndex, setCurrentAdIndex] = useState(0);
    const adTimerRef = useRef<any>(null);

    // Sync local search
    useEffect(() => {
        if (address) setLocalSearch(address);
    }, [address]);

    const isVideo = (url?: string) => {
        if (!url) return false;
        return url.toLowerCase().includes('.mp4');
    };

    // FETCH BACKEND ADS
    useEffect(() => {
        const fetchAds = async () => {
            const today = new Date().toISOString().split('T')[0];
            try {
                const q = query(collection(db, 'ads'), where('status', '==', 'active'));
                const snapshot = await getDocs(q);
                const validAds = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter((ad: any) => ad.endDate >= today && ad.startDate <= today)
                    .filter((ad: any) => {
                        if (!ad.scope || ad.scope === 'global') return true;
                        if (ad.scope === 'local' && userCoords) {
                            const dist = calculateDistance(userCoords.lat, userCoords.lng, ad.targetLat, ad.targetLng);
                            return dist <= (ad.targetRadius || 50);
                        }
                        return true;
                    })
                    .sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));
                
                setAds(validAds);
            } catch (err) {
                console.error("Ad fetch failed:", err);
            }
        };
        fetchAds();
    }, [userCoords, calculateDistance]);

    // AD ROTATION LOGIC
    useEffect(() => {
        if (ads.length <= 1) return;
        adTimerRef.current = setInterval(() => {
            setCurrentAdIndex(prev => (prev + 1) % ads.length);
        }, 10000);
        return () => clearInterval(adTimerRef.current);
    }, [ads]);

    const stats = useMemo(() => {
        const stores = allStores || [];
        const flyerCount = stores.filter(s => s.flyer?.image).length;
        const totalDeals = stores.reduce((acc, s) => acc + (s.oneDayOffers?.length || 0) + (s.saleItems?.length || 0), 0);
        const totalProducts = stores.reduce((acc, s) => acc + (s.productCount || 0), 0);

        return {
            totalStores: stores.length || 0,
            totalFlyers: flyerCount || 0,
            totalDeals: totalDeals || 0,
            totalProducts: totalProducts || 0
        };
    }, [allStores]);

    const filteredStores = useMemo(() => {
        let stores = [...(allStores || [])];
        if (activeCategory !== 'All') {
            if (activeCategory === 'Top Rated') {
                stores = stores.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            } else if (activeCategory === 'Fastest') {
                if (userCoords) {
                    stores = stores.sort((a, b) => {
                        const distA = a.coordinates ? calculateDistance(userCoords.lat, userCoords.lng, a.coordinates.lat, a.coordinates.lng) : 999;
                        const distB = b.coordinates ? calculateDistance(userCoords.lat, userCoords.lng, b.coordinates.lat, b.coordinates.lng) : 999;
                        return distA - distB;
                    });
                } else {
                    stores = stores.sort((a, b) => parseInt(a.deliveryTime || '99') - parseInt(b.deliveryTime || '99'));
                }
            } else if (activeCategory === 'Offers') {
                stores = stores.filter(s => {
                    const allDeals = [...(s.oneDayOffers || []), ...(s.saleItems || [])];
                    return filterActiveDeals(allDeals).length > 0;
                });
            } else if (activeCategory === 'Flyers') {
                stores = stores.filter(s => s.flyer && s.flyer.image);
            }
        }
        return stores;
    }, [allStores, activeCategory]);

    const flashInventory = useMemo(() => {
        const allDeals: any[] = [];
        (allStores || []).forEach(store => {
            const deals = [...(store.oneDayOffers || []), ...(store.saleItems || [])];
            deals.forEach(deal => {
                allDeals.push({
                    ...deal,
                    storeId: store.id,
                    storeName: store.name
                });
            });
        });
        return allDeals.slice(0, 5);
    }, [allStores]);

    const onGoClick = async () => {
        setAddress(localSearch);
        await handleSearch(localSearch);
    };

    const handleAdInteraction = async (ad: any) => {
        try {
            await updateDoc(doc(db, 'ads', ad.id), { clicks: increment(1) });
            if (ad.linkUrl) {
                if (ad.linkUrl.startsWith('http')) window.open(ad.linkUrl, '_blank');
                else navigate(ad.linkUrl);
            }
        } catch (e) {
            console.error("Ad click tracking failed", e);
        }
    };

    const cycleDistance = () => {
        const distances = [5, 10, 25, 50];
        const currentIndex = distances.indexOf(searchDistance);
        const nextIndex = (currentIndex + 1) % distances.length;
        setSearchDistance(distances[nextIndex]);
    };

    return (
        <div className="min-h-screen bg-white">
            {/* HERO SECTION */}
            <section className="relative pt-6 md:pt-10 pb-6 md:pb-12 overflow-hidden bg-gradient-to-b from-[#F5F3FF]/50 to-white">
                <div className="max-w-7xl mx-auto px-6 md:px-12">
                    <div className="flex flex-col lg:flex-row items-center gap-8 md:gap-12">
                        <div className="flex-1 text-center lg:text-left">
                            <span className="inline-block bg-[#F5F3FF] text-[#007AFF] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                                Hyper-Local Shopping Intelligence
                            </span>
                            <h1 className="text-3xl md:text-5xl font-black leading-[1.05] tracking-tighter text-[var(--brand-navy)] mb-4">
                                <span className="text-[var(--brand-primary)]">Shop Local.</span><br className="hidden md:block" /> Save Smarter.
                            </h1>
                            <p className="text-[var(--text-muted)] text-sm md:text-base font-bold max-w-xl mx-auto lg:mx-0 mb-6 leading-relaxed">
                                Spendigo connects you with the heartbeat of your neighborhood. Find real-time inventory, exclusive local deals, and optimize your spending with AI-powered insights.
                            </p>
                            

                        </div>

                        {/* RIGHT SIDE PICTURE / AD CAROUSEL */}
                        <div className="hidden lg:block flex-1 relative group">
                            <div className="absolute -inset-10 bg-blue-100 rounded-[5rem] blur-3xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                            <div 
                                className="relative aspect-[4/3] rounded-[3rem] overflow-hidden shadow-2xl border-[12px] border-white/50 bg-gray-50 cursor-pointer" 
                                onClick={() => ads.length > 0 && handleAdInteraction(ads[currentAdIndex])}
                            >
                                {ads.length > 0 ? (
                                    <div className="w-full h-full relative">
                                        {ads.map((ad, idx) => {
                                            const isActive = idx === currentAdIndex;
                                            const isVid = isVideo(ad.imageUrl);
                                            return (
                                                <div 
                                                    key={ad.id} 
                                                    className={`absolute inset-0 transition-opacity duration-1000 ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                                                >
                                                    {isVid ? (
                                                        <video 
                                                            src={ad.imageUrl} 
                                                            className="w-full h-full object-cover" 
                                                            autoPlay 
                                                            muted 
                                                            loop 
                                                            playsInline
                                                        />
                                                    ) : (
                                                        <img 
                                                            src={ad.imageUrl} 
                                                            alt={ad.title} 
                                                            className="w-full h-full object-cover"
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {/* Pagination Dots */}
                                        {ads.length > 1 && (
                                            <div className="absolute top-6 right-8 flex gap-1.5 z-20">
                                                {ads.map((_, i) => (
                                                    <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i === currentAdIndex ? 'bg-white w-6' : 'bg-white/30 w-1'}`} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <img 
                                        src="/grocery_shelf_desktop_hero_1778380928026.png" 
                                        alt="Spendigo Marketplace" 
                                        className="w-full h-full object-cover"
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* STATS STRIP - ONE FRAME ON MOBILE PER USER REQUEST */}
            <section className="max-w-7xl mx-auto px-6 md:px-12 -mt-10 md:-mt-12 relative z-20">
                <div className="bg-[var(--brand-navy)] rounded-3xl p-2 md:p-0 md:bg-transparent shadow-2xl shadow-[var(--brand-navy)]/20">
                    <div className="flex md:grid md:grid-cols-4 gap-1.5 md:gap-6">
                        {[
                            { label: 'STORES', labelColor: 'text-emerald-400', value: stats.totalStores || '0', badge: 'VERIFIED', badgeColor: 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]', bgColor: 'bg-[#0a1122]' },
                            { label: 'FLYERS', labelColor: 'text-indigo-200', value: stats.totalFlyers || '0', badge: 'LIVE', badgeColor: 'bg-white text-[#3730a3] shadow-[0_0_20px_rgba(255,255,255,0.3)]', bgColor: 'bg-[#3730a3]' },
                            { label: 'DEALS', labelColor: 'text-blue-200', value: stats.totalDeals.toLocaleString() || '0', badge: 'LIMITED', badgeColor: 'bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.3)]', bgColor: 'bg-[#1e40af]' },
                            { label: 'ITEMS', labelColor: 'text-white', value: stats.totalProducts > 1000 ? `${(stats.totalProducts / 1000).toFixed(0)}k` : stats.totalProducts || '0', badge: 'AVAILABLE', badgeColor: 'bg-slate-700 text-white border border-white/20', bgColor: 'bg-[#1f2937]' }
                        ].map((stat, i) => (
                            <div key={i} className={`flex-1 md:flex-none ${stat.bgColor} rounded-2xl p-3 md:p-8 flex flex-col justify-between h-24 md:h-auto lg:aspect-auto transition-transform hover:-translate-y-1 md:hover:-translate-y-2 border border-white/5 md:border-none shadow-xl shadow-black/20`}>
                                <div>
                                    <p className={`text-[8px] md:text-sm font-black ${stat.labelColor} tracking-[0.1em] md:tracking-[0.2em] mb-0.5 md:mb-1`}>{stat.label}</p>
                                    <p className="text-xl md:text-5xl font-black text-white leading-none tracking-tighter">{stat.value}</p>
                                </div>
                                <div className={`mt-auto inline-flex items-center px-1.5 py-0.5 md:px-3 md:py-1.5 rounded-[4px] md:rounded-lg text-[7px] md:text-xs font-black w-fit tracking-[0.1em] md:tracking-[0.2em] shadow-sm ${stat.badgeColor}`}>
                                    {stat.badge}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* LOCATION SEARCH BAR */}
            <section className="max-w-7xl mx-auto px-6 md:px-12 mt-8 md:mt-24">
                <div className="bg-white border border-gray-100 rounded-full py-1 pl-4 pr-1 flex flex-row items-center justify-between shadow-2xl shadow-gray-100 gap-2">
                    <div className="flex items-center gap-2 flex-1">
                        <button 
                            onClick={handleLocateMe}
                            className="hover:scale-110 transition-transform active:scale-95 shrink-0"
                        >
                            <svg className={`w-5 h-5 ${isLocating ? 'text-gray-300 animate-spin' : 'text-[#007AFF]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                        </button>
                        <input 
                            type="text" 
                            value={localSearch}
                            onChange={(e) => setLocalSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && onGoClick()}
                            placeholder="Current Location..."
                            className="text-[10px] md:text-base font-bold text-[var(--brand-navy)] outline-none bg-transparent w-full placeholder:text-gray-300 truncate"
                        />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {/* CYCLE DISTANCE BADGE & DOTS */}
                        <button 
                            onClick={cycleDistance}
                            className="flex items-center gap-2 bg-[#EBF5FF] hover:bg-[#D6E9FF] px-3 py-1.5 rounded-full transition-all active:scale-95 group"
                        >
                            <span className="text-[8px] md:text-[10px] font-black text-[#007AFF] tracking-widest uppercase">{searchDistance}KM</span>
                            <div className="flex items-center gap-1">
                                {[5, 10, 25, 50].map(dist => (
                                    <div 
                                        key={dist} 
                                        className={`rounded-full transition-all duration-500 ${searchDistance === dist ? 'bg-[#007AFF] w-1.5 h-1.5 scale-110' : 'bg-[#007AFF]/20 w-1 h-1'}`} 
                                    />
                                ))}
                            </div>
                        </button>
                        <button 
                            onClick={onGoClick}
                            disabled={isLocating}
                            className="bg-[var(--brand-navy)] text-white px-4 md:px-10 py-2.5 md:py-3.5 rounded-full text-[10px] md:text-sm font-black tracking-widest hover:bg-[var(--brand-primary)] transition-all disabled:opacity-50"
                        >
                            {isLocating ? '...' : 'GO'}
                        </button>
                    </div>
                </div>
            </section>

            {/* FLASH INVENTORY */}
            {flashInventory.length > 0 && (
                <section className="max-w-7xl mx-auto px-6 md:px-12 mt-4 md:mt-32">
                    <div className="flex items-center justify-between mb-6 md:mb-12">
                        <div className="flex items-center gap-4">
                            <h2 className="text-lg md:text-5xl font-black text-[var(--brand-navy)] tracking-tight italic">Flash</h2>
                            <span className="bg-orange-500 text-white text-[9px] md:text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-[0.2em] animate-pulse">Ending Soon</span>
                        </div>
                        <Link to="/search" className="text-[var(--brand-primary)] text-xs md:text-sm font-black tracking-[0.2em] uppercase hover:translate-x-2 transition-transform inline-flex items-center gap-2">
                            See All <span className="text-lg">›</span>
                        </Link>
                    </div>

                    <div className="flex lg:grid lg:grid-cols-5 gap-2 md:gap-6 overflow-x-auto lg:overflow-visible pb-8 lg:pb-0 scrollbar-hide -mx-6 px-6 lg:mx-0 lg:px-0">
                        {flashInventory.map((item, i) => {
                            const effectivePrice = item.salePrice || item.price || 0;
                            const discount = item.originalPrice ? Math.round(((item.originalPrice - effectivePrice) / item.originalPrice) * 100) : 0;
                            return (
                                <div key={i} onClick={() => navigate(`/store/${item.storeId}`)} className="flex-shrink-0 w-[78px] md:w-[220px] lg:w-auto bg-white rounded-[0.75rem] md:rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 group cursor-pointer">
                                    <div className="aspect-square relative flex items-center justify-center p-1 md:p-8 bg-gray-50">
                                        {discount > 0 && (
                                            <div className="absolute top-4 left-4 bg-red-600 text-white text-[9px] font-black px-3 py-1.5 rounded-xl">
                                                -{discount}%
                                            </div>
                                        )}
                                        <img src={item.productImage || item.image} alt={item.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
                                    </div>
                                    <div className="p-1.5 md:p-6">
                                        <p className="text-[7px] font-black text-[var(--brand-primary)] uppercase tracking-widest mb-0.5">{item.storeName}</p>
                                        <h3 className="font-bold text-[10px] md:text-base text-[var(--brand-navy)] mb-1 md:mb-3 truncate group-hover:text-[var(--brand-primary)] transition-colors">{item.productName || item.name}</h3>
                                        <div className="flex items-center gap-1.5 md:gap-3">
                                            <span className="text-red-500 font-black text-xs md:text-lg">${effectivePrice.toFixed(2)}</span>
                                            {item.originalPrice && <span className="text-gray-300 font-medium text-[8px] md:text-xs line-through">${item.originalPrice.toFixed(2)}</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* LOCAL MERCHANTS */}
            <section className="max-w-7xl mx-auto px-6 md:px-12 mt-12 md:mt-32">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-6 md:mb-12">
                    <div>
                        <h2 className="text-3xl md:text-5xl font-black text-[#112244] tracking-tight mb-2">Local Merchants</h2>
                        <p className="text-gray-400 font-medium">Trusted neighbors, verified community favorites.</p>
                    </div>
                    
                    <div className="grid grid-cols-5 md:flex gap-1 md:gap-2 bg-gray-50 p-1 md:p-2 rounded-[1.5rem] md:rounded-3xl w-full md:w-auto">
                        {['All', 'Top Rated', 'Fastest', 'Offers', 'Flyers'].map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-1 md:px-8 py-2.5 md:py-3 rounded-xl md:rounded-2xl text-[8px] md:text-xs font-black uppercase tracking-tighter md:tracking-widest transition-all whitespace-nowrap flex items-center justify-center ${activeCategory === cat
                                    ? 'bg-[var(--brand-navy)] text-white shadow-lg shadow-[var(--brand-navy)]/20'
                                    : 'text-gray-400 hover:text-[var(--brand-navy)]'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-2 gap-2 md:gap-8">
                    {loading ? (
                        [1, 2, 3, 4].map(i => <StoreCardSkeleton key={i} />)
                    ) : filteredStores.length === 0 ? (
                        <div className="col-span-full py-20 text-center bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-100">
                            <p className="text-xl font-bold text-[#112244] mb-2">No merchants found</p>
                            <p className="text-gray-400">Try adjusting your filters or checking a different area.</p>
                        </div>
                    ) : (
                        filteredStores.map(store => (
                            <div 
                                key={store.id} 
                                onClick={() => {
                                    if (activeCategory === 'Flyers') {
                                        navigate(`/store/${store.id}`, { state: { initialTab: 'flyer' } });
                                    } else if (activeCategory === 'Offers') {
                                        navigate(`/store/${store.id}`, { state: { initialTab: 'offers' } });
                                    } else {
                                        navigate(`/store/${store.id}`);
                                    }
                                }} 
                                className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-gray-100 p-2 md:p-4 flex flex-col md:flex-row items-center gap-2 md:gap-6 shadow-sm hover:shadow-2xl transition-all duration-500 cursor-pointer group relative overflow-hidden"
                            >
                                {activeCategory === 'Flyers' && (
                                    <div className="absolute top-4 right-4 z-10">
                                        <span className="badge-deal text-[8px] uppercase tracking-widest px-3 py-1 animate-pulse">Weekly Flyer</span>
                                    </div>
                                )}
                                <div className="w-full md:w-32 lg:w-40 aspect-square md:aspect-auto md:h-32 lg:h-40 rounded-xl md:rounded-[2rem] bg-gray-50 overflow-hidden shrink-0 relative">
                                    <img 
                                        src={activeCategory === 'Flyers' && store.flyer?.image ? store.flyer.image : (activeCategory === 'Offers' && [...(store.oneDayOffers || []), ...(store.saleItems || [])][0]?.productImage) || store.image} 
                                        alt={store.name} 
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                                    />
                                    {(activeCategory === 'Flyers' || activeCategory === 'Offers') && (
                                        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                                    )}
                                </div>
                                <div className="flex-1 text-center md:text-left min-w-0 w-full">
                                    <h3 className="font-bold text-xs sm:text-sm md:text-2xl text-[var(--brand-navy)] mb-1 md:mb-2 group-hover:text-[var(--brand-primary)] transition-colors truncate">{store.name}</h3>
                                    
                                    {activeCategory === 'Offers' ? (
                                        <div className="mb-4">
                                            {(() => {
                                                const deals = filterActiveDeals([...(store.oneDayOffers || []), ...(store.saleItems || [])]);
                                                const topDeal = deals[0];
                                                if (!topDeal) return null;
                                                return (
                                                    <div className="flex items-center justify-center md:justify-start gap-2">
                                                        <span className="text-red-600 font-black text-sm md:text-xl">${(topDeal.salePrice || topDeal.price || 0).toFixed(2)}</span>
                                                        <span className="text-[9px] md:text-xs font-bold text-gray-400 line-through">${(topDeal.originalPrice || 0).toFixed(2)}</span>
                                                        <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-[8px] md:text-[10px] font-black uppercase tracking-widest">
                                                            -{topDeal.originalPrice ? Math.round(((topDeal.originalPrice - (topDeal.salePrice || topDeal.price)) / topDeal.originalPrice) * 100) : 0}%
                                                        </span>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center md:justify-start flex-wrap gap-1 md:gap-3 text-[8px] sm:text-[9px] md:text-xs font-black text-gray-400 mb-2 md:mb-6">
                                            <span className="text-yellow-500 text-[10px] md:text-sm">★</span> {store.rating || 'New'} 
                                            <span className="w-1 h-1 md:w-1.5 md:h-1.5 bg-gray-200 rounded-full"></span> 
                                            {store.deliveryTime || '25-45'} min
                                            {userCoords && store.coordinates && (
                                                <>
                                                    <span className="w-1 h-1 md:w-1.5 md:h-1.5 bg-gray-200 rounded-full"></span>
                                                    <span className="flex items-center gap-1 text-[var(--brand-primary)]">
                                                        <svg className="w-2.5 h-2.5 md:w-3 md:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                        </svg>
                                                        {calculateDistance(userCoords.lat, userCoords.lng, store.coordinates.lat, store.coordinates.lng).toFixed(1)} km
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                    
                                    <span className="bg-[var(--brand-primary-light)] text-[var(--brand-primary)] px-2 sm:px-3 md:px-6 py-1 md:py-2 rounded-full text-[7px] sm:text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
                                        {activeCategory === 'Offers' ? 'Featured Offer' : (store.business_category || store.category || 'Local Shop')}
                                    </span>
                                </div>
                                <div className="hidden md:block pr-6">
                                    <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-[#007AFF] group-hover:text-white transition-all">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>

            {/* WHY PAY RETAIL SECTION */}
            <section className="max-w-7xl mx-auto px-6 md:px-12 mt-24 md:mt-32 mb-24">
                <div className="bg-gradient-to-br from-[#EBF5FF] via-[#D6E9FF] to-[#C4DFFF] rounded-3xl p-8 md:p-16 relative overflow-hidden shadow-2xl shadow-blue-100">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full -mr-32 -mt-32 blur-[80px]"></div>
                    <div className="relative z-10 flex flex-col lg:flex-row items-center gap-10">
                        <div className="flex-1 text-center lg:text-left">
                             <div className="flex items-center justify-center lg:justify-start gap-3 mb-6">
                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-xl">
                                    <svg className="w-6 h-6 text-[var(--brand-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <span className="text-[10px] md:text-xs font-black text-[var(--brand-primary)] uppercase tracking-[0.3em] opacity-80">Powered by SmartCart AI</span>
                            </div>
                            <h2 className="text-3xl md:text-5xl font-black text-[var(--brand-navy)] tracking-tighter mb-6">Why Pay Retail?</h2>
                            <p className="text-lg md:text-xl font-medium text-[var(--brand-navy)]/60 leading-relaxed mb-10 max-w-2xl">
                                Our AI scans {stats.totalProducts > 0 ? stats.totalProducts.toLocaleString() : '25,000'}+ products in real-time to find you instant <span className="text-[var(--brand-primary)] font-black underline decoration-4 underline-offset-8">15% savings</span> at check-out.
                            </p>
                            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
                                <Link to="/smartcart" className="bg-gradient-to-r from-[var(--brand-primary)] to-[#5856D6] text-white px-8 py-4 rounded-xl font-black text-[10px] md:text-xs tracking-[0.2em] shadow-xl shadow-blue-500/40 hover:scale-105 transition-all uppercase">
                                    Activate Optimizer
                                </Link>
                                {!user && (
                                    <Link to="/register" className="bg-white text-[var(--brand-navy)] px-8 py-4 rounded-xl font-black text-[10px] md:text-xs tracking-widest hover:bg-gray-50 transition-all uppercase">
                                        Join Marketplace
                                    </Link>
                                )}
                            </div>
                        </div>

                        <div className="hidden lg:block w-full max-w-sm bg-white/40 backdrop-blur-3xl border border-white/40 rounded-3xl p-8 shadow-2xl">
                            <div className="space-y-8">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-[var(--brand-navy)]/40 uppercase tracking-widest">Real-time scan</span>
                                    <span className="flex h-2.5 w-2.5 relative">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--brand-primary)] opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--brand-primary)]"></span>
                                    </span>
                                </div>
                                <div className="flex items-end gap-1">
                                    <span className="text-4xl font-black text-[var(--brand-navy)]">{stats.totalDeals > 1000 ? `${(stats.totalDeals / 1000).toFixed(1)}k` : stats.totalDeals}</span>
                                    <span className="text-sm font-bold text-[var(--brand-navy)]/40 mb-1">active deals</span>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-[var(--brand-navy)]/60">
                                        <span>Current Savings Potential</span>
                                        <span className="text-[var(--brand-primary)]">$42.00</span>
                                    </div>
                                    <div className="h-2 bg-white/50 rounded-full overflow-hidden">
                                        <div className="h-full w-3/4 bg-[var(--brand-primary)] rounded-full"></div>
                                    </div>
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
