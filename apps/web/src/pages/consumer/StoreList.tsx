import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation as useRouterLocation } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useLocation } from '../../context/LocationContext';
import { Skeleton } from '../../components/ui/Skeleton';
import { filterActiveDeals } from '../../utils/date-helpers';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';

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
    const { t } = useTranslation();
    const {
        userCoords,
        calculateDistance,
    } = useLocation();

    const [activeCategory, setActiveCategory] = useState('All');
    const carouselRef = useRef<HTMLDivElement>(null);
    const [activeStatIndex, setActiveStatIndex] = useState(0);

    // Auto-swipe for Market Intelligence Carousel
    useEffect(() => {
        const interval = setInterval(() => {
            if (window.innerWidth < 768 && carouselRef.current) {
                const nextIndex = (activeStatIndex + 1) % 4;
                const scrollAmount = nextIndex * (window.innerWidth - 48 + 16); // width + gap
                carouselRef.current.scrollTo({
                    left: scrollAmount,
                    behavior: 'smooth'
                });
                setActiveStatIndex(nextIndex);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [activeStatIndex]);

    // Handle Hash Scrolling (e.g., for #local-merchants)
    const routerLocation = useRouterLocation();
    useEffect(() => {
        if (window.location.hash) {
            const id = window.location.hash.substring(1);
            const element = document.getElementById(id);
            if (element) {
                setTimeout(() => {
                    element.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
        }
    }, [routerLocation]);

    // BACKEND AD CAROUSEL STATE
    const [ads, setAds] = useState<any[]>([]);
    const [currentAdIndex, setCurrentAdIndex] = useState(0);
    const adTimerRef = useRef<any>(null);



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



    return (
        <div className="min-h-screen bg-transparent">
            <SEO title="Home" path="/" />
            {/* HERO SECTION */}
            <section className="relative pt-6 md:pt-10 pb-4 md:pb-8 overflow-hidden bg-gradient-to-b from-[#F5F3FF]/50 to-transparent">
                <div className="max-w-7xl mx-auto px-6 md:px-12">
                    <div className="flex flex-col lg:flex-row items-center gap-8 md:gap-12">
                        <div className="flex-1 text-center lg:text-left">
                            <span className="inline-block bg-[#F5F3FF] text-[#007AFF] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                                {t('heroTitle')}
                            </span>
                            <h1 className="text-3xl md:text-5xl font-black leading-[1.05] tracking-tighter text-[var(--brand-navy)] mb-4">
                                <span className="text-[var(--brand-primary)]">{t('shopLocal')}</span><br className="hidden md:block" /> {t('heroThinkAI')}
                            </h1>
                            <p className="text-[var(--text-muted)] text-xs md:text-sm font-medium max-w-xl mx-auto lg:mx-0 mb-6 leading-relaxed">
                                {t('heroDesc')}
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

            {/* MARKET INTELLIGENCE DASHBOARD */}
            <section className="max-w-7xl mx-auto px-6 md:px-12 -mt-6 md:-mt-10 relative z-20">
                <h2 className="text-2xl md:text-5xl font-black text-[#112244] mb-6 tracking-tighter">{t('statMarketIntelligence')}</h2>
                <div className="md:bg-transparent rounded-3xl md:p-0">
                    <div 
                        ref={carouselRef}
                        id="market-stats-carousel"
                        className="flex md:grid md:grid-cols-4 gap-4 md:gap-6 overflow-x-auto md:overflow-visible pb-6 md:pb-0 scrollbar-hide snap-x snap-mandatory -mx-6 px-6 md:mx-0 md:px-0"
                    >
                        {[
                            {
                                label: t('statLocalStores'),
                                value: stats.totalStores || '0',
                                badge: t('statActive'),
                                badgeStyles: 'bg-emerald-700 text-white',
                                cardBg: 'bg-[#F0F7FF]',
                                textColor: 'text-[#112244]',
                                labelColor: 'text-[#007AFF]',
                                iconStyles: 'bg-white text-blue-600 shadow-sm',
                                icon: <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            },
                            {
                                label: t('statNewFlyers'),
                                value: stats.totalFlyers || '0',
                                badge: t('statLive'),
                                badgeStyles: 'bg-orange-600 text-white',
                                cardBg: 'bg-[#FFF9F2]',
                                textColor: 'text-[#112244]',
                                labelColor: 'text-[#007AFF]',
                                iconStyles: 'bg-white text-orange-600 shadow-sm',
                                icon: <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                            },
                            {
                                label: t('statFlashDeals'),
                                value: stats.totalDeals.toLocaleString() || '0',
                                badge: t('statHot'),
                                badgeStyles: 'bg-red-600 text-white',
                                cardBg: 'bg-[#FFF5F5]',
                                textColor: 'text-[#112244]',
                                labelColor: 'text-[#007AFF]',
                                iconStyles: 'bg-white text-red-600 shadow-sm',
                                icon: <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.99 7.99 0 0120 13a7.98 7.98 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.879 16.121A3 3 0 1012.015 11L11 14l2.828.828" /></svg>
                            },
                            {
                                label: t('statTrackedItems'),
                                value: stats.totalProducts > 1000 ? `${(stats.totalProducts / 1000).toFixed(1)}k` : stats.totalProducts || '0',
                                badge: t('statMarketSafe'),
                                badgeStyles: 'bg-gray-600 text-white',
                                cardBg: 'bg-gray-50',
                                textColor: 'text-[#112244]',
                                labelColor: 'text-[#007AFF]',
                                iconStyles: 'bg-white text-gray-500 shadow-sm',
                                icon: <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                            }
                        ].map((stat, i) => (
                            <div key={i} className={`${stat.cardBg} flex-shrink-0 w-[calc(50vw-28px)] md:w-auto snap-start rounded-[1.5rem] md:rounded-[2.5rem] p-4 md:p-8 flex flex-col border border-white shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-1`}>
                                <div className="flex items-start justify-between mb-3 md:mb-10">
                                    <div className="w-8 h-8 md:w-14 md:h-14 rounded-lg md:rounded-2xl flex items-center justify-center bg-white text-blue-600 shadow-sm">
                                        <div className="scale-75 md:scale-100">{stat.icon}</div>
                                    </div>
                                    {stat.badge && (
                                        <span className={`px-2 py-0.5 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest ${stat.badgeStyles}`}>
                                            {stat.badge}
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <p className={`text-2xl md:text-5xl font-black ${stat.textColor} leading-none tracking-tighter mb-1`}>{stat.value}</p>
                                    <p className={`text-[10px] md:text-sm font-bold ${stat.labelColor} uppercase tracking-[0.1em] truncate`}>{stat.label}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FLASH INVENTORY */}
            {flashInventory.length > 0 && (
                <section className="max-w-7xl mx-auto px-6 md:px-12 mt-4 md:mt-16">
                    <div className="flex items-center justify-between mb-6 md:mb-10">
                        <div className="flex items-center gap-4">
                            <div className="w-7 h-7 md:w-10 md:h-10 bg-red-600 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-red-600/20">
                                <svg className="w-4 h-4 md:w-6 md:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <h2 className="text-2xl md:text-5xl font-black text-[#112244] tracking-tighter">{t('badgeFlash')}</h2>
                            <span className="bg-red-600 text-white text-[9px] md:text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-[0.2em] animate-pulse">{t('badgeEndingSoon')}</span>
                        </div>
                        <Link to="/deals" className="text-[var(--brand-primary)] text-xs md:text-sm font-black tracking-[0.2em] uppercase hover:translate-x-2 transition-transform inline-flex items-center gap-2">
                            See All <span className="text-lg">›</span>
                        </Link>
                    </div>

                    <div className="flex lg:grid lg:grid-cols-5 gap-2 md:gap-6 overflow-x-auto lg:overflow-visible pb-8 lg:pb-0 scrollbar-hide -mx-6 px-6 lg:mx-0 lg:px-0">
                        {flashInventory.map((item, i) => {
                            const effectivePrice = item.salePrice || item.price || 0;
                            const discount = item.originalPrice ? Math.round(((item.originalPrice - effectivePrice) / item.originalPrice) * 100) : 0;
                            return (
                                <div key={i} onClick={() => navigate(`/store/${item.storeId}`)} className="flex-shrink-0 w-[105px] md:w-[220px] lg:w-auto bg-white rounded-[0.75rem] md:rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 group cursor-pointer">
                                    <div className="aspect-square relative flex items-center justify-center p-2 md:p-8 bg-gray-50">
                                        {discount > 0 && (
                                            <div className="absolute top-1 left-1 md:top-4 md:left-4 bg-red-600 text-white text-[6px] md:text-[9px] font-black px-1.5 py-0.5 md:px-3 md:py-1.5 rounded-md md:rounded-xl">
                                                -{discount}%
                                            </div>
                                        )}
                                        <img src={item.productImage || item.image} alt={item.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
                                    </div>
                                    <div className="p-3 md:p-6">
                                        <p className="text-[9px] font-black text-[var(--brand-primary)] uppercase tracking-widest mb-0.5">{item.storeName}</p>
                                        <h3 className="font-bold text-xs md:text-base text-[var(--brand-navy)] mb-1 md:mb-3 truncate group-hover:text-[var(--brand-primary)] transition-colors">{item.productName || item.name}</h3>
                                        <div className="flex items-center gap-1.5 md:gap-3">
                                            <span className="text-red-500 font-black text-sm md:text-lg">${effectivePrice.toFixed(2)}</span>
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
            <section id="local-merchants" className="max-w-7xl mx-auto px-6 md:px-12 mt-8 md:mt-20 scroll-mt-24 md:scroll-mt-28">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-6 md:mb-12">
                    <div>
                        <h2 className="text-2xl md:text-5xl font-black text-[#112244] tracking-tighter mb-2">{t('localMerchantsTitle')}</h2>
                        <p className="text-gray-400 font-medium">{t('localMerchantsSubtitle')}</p>
                    </div>

                    <div className="grid grid-cols-5 md:flex gap-1 md:gap-2 bg-gray-50 p-1 md:p-2 rounded-[1.5rem] md:rounded-3xl w-full md:w-auto">
                        {[
                            { value: 'All', label: t('filterAll') },
                            { value: 'Top Rated', label: t('filterTopRated') },
                            { value: 'Fastest', label: t('filterFastest') },
                            { value: 'Offers', label: t('filterOffers') },
                            { value: 'Flyers', label: t('filterFlyers') },
                        ].map(cat => (
                            <button
                                key={cat.value}
                                onClick={() => setActiveCategory(cat.value)}
                                className={`px-1 md:px-8 py-2.5 md:py-3 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-tighter md:tracking-widest transition-all whitespace-nowrap flex items-center justify-center ${activeCategory === cat.value
                                    ? 'bg-[var(--brand-navy)] text-white shadow-lg shadow-[var(--brand-navy)]/20'
                                    : 'text-gray-400 hover:text-[var(--brand-navy)]'}`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-2 gap-2 md:gap-8">
                    {loading ? (
                        [1, 2, 3, 4].map(i => <StoreCardSkeleton key={i} />)
                    ) : filteredStores.length === 0 ? (
                        <div className="col-span-full py-20 text-center bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-100">
                            <p className="text-xl font-bold text-[#112244] mb-2">{t('noMerchantsFound')}</p>
                            <p className="text-gray-400">{t('noMerchantsHint')}</p>
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
                                        <span className="badge-deal text-[8px] uppercase tracking-widest px-3 py-1 animate-pulse">{t('badgeWeeklyFlyer')}</span>
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
                                    <div className="flex items-center justify-center md:justify-start gap-1.5 mb-1 md:mb-2">
                                        <h3 className="font-bold text-base sm:text-lg md:text-2xl text-[var(--brand-navy)] group-hover:text-[var(--brand-primary)] transition-colors truncate">{store.name}</h3>
                                        {store.kybStatus === 'approved' && store.subscriptionTier === 'pro' && (
                                            <span title="Spendigo Verified Business" className="shrink-0 inline-flex items-center justify-center w-4 h-4 md:w-5 md:h-5 bg-teal-500 rounded-full">
                                                <svg className="w-2.5 h-2.5 md:w-3 md:h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </span>
                                        )}
                                    </div>

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
                                        <div className="flex items-center justify-center md:justify-start flex-wrap gap-1.5 md:gap-3 text-[10px] sm:text-[11px] md:text-xs font-black text-gray-400 mb-2 md:mb-6">
                                            <span className="text-yellow-500 text-[10px] md:text-sm">★</span> {store.rating || 'New'}
                                            <span className="w-1 h-1 md:w-1.5 md:h-1.5 bg-gray-200 rounded-full"></span>
                                            {(store.deliveryTime || '25-45').toString().replace(' min', '')} min
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

                                    <span className="bg-[#112244] text-white px-2 sm:px-3 md:px-6 py-1 md:py-2 rounded-full text-[9px] sm:text-[10px] md:text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
                                        {activeCategory === 'Offers' ? t('badgeFeaturedOffer') : (store.business_category || store.category || t('badgeLocalShop'))}
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
                            <h2 className="text-3xl md:text-5xl font-black text-[var(--brand-navy)] tracking-tighter mb-6">{t('whyPayRetail')}</h2>
                            <p className="text-lg md:text-xl font-medium text-[var(--brand-navy)]/60 leading-relaxed mb-10 max-w-2xl">
                                Our AI scans {stats.totalProducts > 0 ? stats.totalProducts.toLocaleString() : '25,000'}+ products in real-time to find you instant <span className="text-[var(--brand-primary)] font-black underline decoration-4 underline-offset-8">15% savings</span> at check-out.
                            </p>
                            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
                                <Link to="/smartcart" className="bg-gradient-to-r from-[var(--brand-primary)] to-[#5856D6] text-white px-8 py-4 rounded-xl font-black text-[10px] md:text-xs tracking-[0.2em] shadow-xl shadow-blue-500/40 hover:scale-105 transition-all uppercase">
                                    {t('btnActivateOptimizer')}
                                </Link>
                                {!user && (
                                    <Link to="/register" className="bg-white text-[var(--brand-navy)] px-8 py-4 rounded-xl font-black text-[10px] md:text-xs tracking-widest hover:bg-gray-50 transition-all uppercase">
                                        {t('btnJoinMarketplace')}
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
