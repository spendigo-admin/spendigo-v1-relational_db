import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useTranslation } from 'react-i18next';
import { useLocation } from '../context/LocationContext';
import { useMarketplace } from '../context/MarketplaceContext';
import '../styles/design-system.css';

interface AdCampaign {
    id: string;
    title: string;
    description?: string;
    imageUrl: string;
    mobileImageUrl?: string;
    linkUrl?: string;
    status: 'active' | 'draft' | 'archived';
    startDate: string;
    endDate: string;
    priority: number;
    scope?: 'global' | 'local';
    targetAddress?: string;
    targetLat?: number;
    targetLng?: number;
    targetRadius?: number;
}

const DefaultHero = () => {
    const { t } = useTranslation();
    return (
    <section className="relative overflow-hidden bg-white py-12 md:py-24 min-h-[250px] md:min-h-[340px] px-4 flex items-center justify-center">
        {/* Background Decorative Elements */}
        <div className="absolute inset-0 z-0">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,var(--brand-primary-light),transparent_70%)]" />
            <div className="absolute top-1/4 -right-20 w-64 h-64 md:w-[500px] md:h-[500px] bg-blue-100/50 rounded-full blur-[120px] opacity-60 animate-pulse" />
            <div className="absolute bottom-0 -left-20 w-64 h-64 md:w-[400px] md:h-[400px] bg-purple-100/50 rounded-full blur-[100px] opacity-60 animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto text-center w-full px-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-white shadow-sm border border-gray-100 mb-6 md:mb-10 animate-fade-in mx-auto">
                <span className="flex h-2 w-2 rounded-full bg-[var(--brand-primary)] animate-ping" />
                <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    Local Savings Platform
                </span>
            </div>

            <h1 className="text-4xl md:text-7xl font-black text-[var(--text-main)] mb-6 leading-[1.05] tracking-tighter italic">
                {t('shopLocal')}<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--brand-primary)] to-indigo-600">
                    {t('everyoneWins')}
                </span>
            </h1>
            
            <p className="text-[var(--text-muted)] text-base md:text-xl mb-10 md:mb-14 max-w-2xl mx-auto font-bold leading-relaxed">
                {t('supportLocal')} <span className="text-[var(--brand-secondary)] font-black italic">Guaranteed lower prices</span> across the marketplace.
            </p>


            
            <div className="mt-12 md:mt-16 flex flex-wrap items-center justify-center gap-8 md:gap-12 opacity-50 grayscale hover:grayscale-0 transition-all duration-700">
                <span className="text-sm md:text-base font-black tracking-tighter text-[var(--text-main)] italic">Verified Local Shops</span>
                <div className="w-1.5 h-1.5 bg-gray-300 rounded-full"></div>
                <span className="text-sm md:text-base font-black tracking-tighter text-[var(--text-main)] italic">Real-Time Savings</span>
                <div className="w-1.5 h-1.5 bg-gray-300 rounded-full"></div>
                <span className="text-sm md:text-base font-black tracking-tighter text-[var(--text-main)] italic">Canadian Owned 🍁</span>
            </div>
        </div>
    </section>
    );
};

const AdCarousel: React.FC = () => {
    const { t } = useTranslation();
    const { userCoords, calculateDistance } = useLocation();
    const { stores } = useMarketplace();
    const [ads, setAds] = useState<AdCampaign[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const timerRef = useRef<any>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [mediaLoaded, setMediaLoaded] = useState(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isVideo = (url?: string) => {
        if (!url) return false;
        return url.toLowerCase().endsWith('.mp4') || url.includes('.mp4?') || url.includes('mp4?');
    };

    // Fetch Ads
    useEffect(() => {
        const fetchAds = async () => {
            const today = new Date().toISOString().split('T')[0];
            try {
                const simpleQ = query(collection(db, 'ads'), where('status', '==', 'active'));
                const snapshot = await getDocs(simpleQ);

                const validAds = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as AdCampaign))
                    .filter(ad => ad.endDate >= today && ad.startDate <= today)
                    .filter(ad => {
                        if (!ad.scope || ad.scope === 'global') return true;
                        if (ad.scope === 'local') {
                            if (!userCoords) return false;
                            if (!ad.targetLat || !ad.targetLng || !ad.targetRadius) return false;
                            const distance = calculateDistance(userCoords.lat, userCoords.lng, ad.targetLat, ad.targetLng);
                            return distance <= ad.targetRadius;
                        }
                        return false;
                    })
                    .filter(ad => {
                        // If ad points to a specific store, verify that store is active
                        if (!ad.linkUrl) return true;
                        const storeIdMatch = ad.linkUrl.match(/\/store\/([^\/\?]+)/);
                        if (storeIdMatch) {
                            const sid = storeIdMatch[1];
                            const linkedStore = stores[sid];
                            // If we have the store data and it's NOT active, hide the ad
                            if (linkedStore && linkedStore.status !== 'active') return false;
                        }
                        return true;
                    })
                    .sort((a, b) => b.priority - a.priority);

                setAds(validAds);
            } catch (err) {
                console.error("Failed to load ads", err);
            } finally {
                setLoading(false);
            }
        };

        fetchAds();
    }, [userCoords, calculateDistance]);

    // Auto-Rotate
    useEffect(() => {
        if (ads.length <= 1) return;

        timerRef.current = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % ads.length);
        }, 5000);

        return () => clearInterval(timerRef.current);
    }, [ads]);

    // Track View (Impression)
    useEffect(() => {
        if (ads.length > 0 && mediaLoaded) {
            const ad = ads[currentIndex];
            updateDoc(doc(db, 'ads', ad.id), {
                views: increment(1)
            }).catch(console.error);
        }
    }, [currentIndex, ads, mediaLoaded]);

    const handleAdClick = async (ad: AdCampaign) => {
        await updateDoc(doc(db, 'ads', ad.id), {
            clicks: increment(1)
        });

        if (ad.linkUrl) {
            window.location.href = ad.linkUrl;
        }
    };

    if (loading || ads.length === 0) {
        return <DefaultHero />;
    }

    const currentAd = ads[currentIndex];

    return (
        <div className="relative overflow-hidden">
            {/* Seamless Transition Overlay */}
            <div className={`absolute inset-0 z-50 transition-all duration-[1500ms] ease-in-out ${mediaLoaded ? 'opacity-0 pointer-events-none scale-105' : 'opacity-100 scale-100'}`}>
                <DefaultHero />
            </div>

        <section className={`relative overflow-hidden group bg-white flex flex-col items-center justify-center min-h-[250px] md:min-h-[340px] transition-all duration-[1500ms] ease-in-out ${mediaLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
            {/* Background Blur Effect (Stays Absolute) */}
            <div className="absolute inset-0 z-0 opacity-40 blur-2xl scale-110">
                {ads.map((ad, idx) => {
                    const isActive = idx === currentIndex;
                    const src = isMobile && ad.mobileImageUrl ? ad.mobileImageUrl : ad.imageUrl;
                    const isVid = isVideo(src);
                    
                    return (
                        <div key={ad.id} className={`absolute inset-0 transition-opacity duration-1000 ${isActive ? 'opacity-100' : 'opacity-0'}`}>
                            {isVid ? (
                                <video src={src} className="w-full h-full object-cover" muted loop autoPlay playsInline />
                            ) : (
                                <img src={src} alt="" className="w-full h-full object-cover" />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Main Banner Image (Defines the Height) */}
            <div className="relative z-10 w-full flex items-center justify-center">
                {ads.map((ad, idx) => {
                    const isActive = idx === currentIndex;
                    const src = isMobile && ad.mobileImageUrl ? ad.mobileImageUrl : ad.imageUrl;
                    const isVid = isVideo(src);

                    return (
                        <div 
                            key={ad.id} 
                            className={`
                                transition-opacity duration-1000 w-full flex items-center justify-center
                                ${isActive ? 'relative opacity-100 z-10' : 'absolute inset-0 opacity-0 z-0 pointer-events-none'}
                            `}
                        >
                            {isVid ? (
                                <video 
                                    src={src} 
                                    className="w-full h-auto block max-h-[50vh] object-contain mx-auto shadow-2xl" 
                                    muted 
                                    loop 
                                    autoPlay 
                                    playsInline 
                                    onLoadedData={() => { if (isActive) setMediaLoaded(true); }}
                                />
                            ) : (
                                <img
                                    src={src}
                                    alt={ad.title}
                                    className="w-full h-auto block max-h-[50vh] object-contain mx-auto shadow-2xl"
                                    onLoad={() => { if (isActive) setMediaLoaded(true); }}
                                />
                            )}
                        </div>
                    );
                })}
                
                {/* Content Overlay (Centered) */}
                <div className="absolute inset-0 flex flex-col items-center justify-center px-4 bg-gradient-to-t from-black/40 via-transparent to-black/20 z-20 pointer-events-none">
                    {currentAd.linkUrl && (
                        <button
                            onClick={() => handleAdClick(currentAd)}
                            className="mb-8 px-10 py-3.5 bg-white text-[var(--brand-primary)] rounded-full font-black text-xs md:text-sm tracking-[0.2em] transition-all shadow-2xl hover:scale-105 active:scale-95 pointer-events-auto uppercase"
                        >
                            View Exclusive Offer &rarr;
                        </button>
                    )}


                </div>
            </div>

            {/* Dots */}
            {ads.length > 1 && (
                <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-3 z-20">
                    {ads.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentIndex(idx)}
                            className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentIndex ? 'bg-[var(--brand-primary)] w-8' : 'bg-white/30 w-1.5 hover:bg-white/50'}`}
                        />
                    ))}
                </div>
            )}
        </section>
        </div>
    );
};

export default AdCarousel;
