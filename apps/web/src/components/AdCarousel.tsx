import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useTranslation } from 'react-i18next';
import { useLocation } from '../context/LocationContext';
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

const DefaultHero = ({ handleSearch, address, setAddress, isLocating, handleLocateMe, searchDistance, setSearchDistance }: any) => {
    const { t } = useTranslation();
    return (
    <section className="relative overflow-hidden bg-white py-24 md:py-44 min-h-[450px] md:min-h-[600px] px-4 flex items-center justify-center">
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

            {/* PREMIUM SEARCH INTERACTION */}
            <div className="group relative max-w-4xl mx-auto scale-90 sm:scale-100 origin-center">
                <div className="relative flex flex-row items-center bg-white rounded-full p-1 sm:p-2 md:p-3 shadow-2xl border border-gray-100 transition-all duration-500 hover:shadow-blue-500/10 hover:border-blue-100 group-hover:scale-[1.01]">
                    {/* Locate Me */}
                    <div 
                        onClick={handleLocateMe}
                        className={`pl-2 sm:pl-4 pr-1 flex items-center text-red-500 cursor-pointer hover:scale-125 transition-all active:scale-95 group/loc ${isLocating ? 'animate-bounce' : ''}`}
                        title="Locate Me"
                    >
                        <svg className="w-4 h-4 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                        </svg>
                    </div>

                    {/* Input */}
                    <input
                        type="text"
                        placeholder="Postal code..."
                        className="flex-1 py-2 sm:py-4 px-1 sm:px-2 bg-transparent outline-none text-gray-900 font-bold placeholder-gray-400 text-[10px] sm:text-lg min-w-0"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    
                    <div className="flex items-center gap-1 sm:gap-4 ml-auto">
                        {/* Radius Selector */}
                        <div className="flex items-center sm:gap-2 sm:px-4 border-l border-gray-100 h-6 sm:h-10">
                            <select 
                                value={searchDistance} 
                                onChange={(e) => setSearchDistance(Number(e.target.value))}
                                className="text-[10px] sm:text-sm font-black bg-transparent px-1 sm:px-3 py-1 rounded-lg border-none outline-none text-blue-600 cursor-pointer focus:ring-0 transition-all appearance-none sm:appearance-auto"
                            >
                                <option value={5}>5km</option>
                                <option value={10}>10km</option>
                                <option value={20}>20km</option>
                                <option value={50}>50km</option>
                            </select>
                        </div>

                        {/* Search Button */}
                        <button
                            onClick={() => handleSearch()}
                            disabled={isLocating}
                            className="bg-gray-900 text-white px-3 sm:px-12 py-2 sm:py-4 rounded-full font-black text-[10px] sm:text-sm tracking-widest hover:bg-blue-600 transition-all shadow-xl active:scale-95 shrink-0 uppercase border-b-2 sm:border-b-4 border-black"
                        >
                            <span className="sm:inline hidden">Search Stores</span>
                            <span className="sm:hidden">GO</span>
                        </button>
                    </div>
                </div>
            </div>
            
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

interface AdCarouselProps {
    handleSearch: () => void;
    address: string;
    setAddress: (val: string) => void;
    isLocating: boolean;
    handleLocateMe: () => void;
    searchDistance: number;
    setSearchDistance: (val: number) => void;
}

const AdCarousel: React.FC<AdCarouselProps> = (props) => {
    const { t } = useTranslation();
    const { userCoords, calculateDistance } = useLocation();
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
                            if (!userCoords) return false; // If local ad, and user has no coords, hide it
                            if (!ad.targetLat || !ad.targetLng || !ad.targetRadius) return false;
                            const distance = calculateDistance(userCoords.lat, userCoords.lng, ad.targetLat, ad.targetLng);
                            return distance <= ad.targetRadius;
                        }
                        return false;
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
        return <DefaultHero {...props} />;
    }

    const currentAd = ads[currentIndex];

    return (
        <div className="relative overflow-hidden">
            {/* Seamless Transition Overlay */}
            <div className={`absolute inset-0 z-50 transition-all duration-[1500ms] ease-in-out ${mediaLoaded ? 'opacity-0 pointer-events-none scale-105' : 'opacity-100 scale-100'}`}>
                <DefaultHero {...props} />
            </div>

        <section className={`relative overflow-hidden group bg-white flex flex-col items-center justify-center min-h-[450px] md:min-h-[600px] transition-all duration-[1500ms] ease-in-out ${mediaLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
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
                                    className="w-full h-auto block max-h-[65vh] object-contain mx-auto shadow-2xl" 
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
                                    className="w-full h-auto block max-h-[65vh] object-contain mx-auto shadow-2xl"
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

                    {/* Search Bar Container */}
                    <div className="group relative w-full max-w-4xl mx-auto transform translate-y-2 md:translate-y-0 scale-90 md:scale-100 pointer-events-auto">
                        <div className="relative flex flex-row items-center bg-white rounded-full p-1 sm:p-2 md:p-3 shadow-2xl border border-gray-100 transition-all duration-500 hover:shadow-blue-500/10 hover:border-blue-100 group-hover:scale-[1.01]">
                            {/* Locate Me */}
                            <div 
                                onClick={props.handleLocateMe}
                                className={`pl-2 sm:pl-4 pr-1 flex items-center text-red-500 cursor-pointer hover:scale-125 transition-all active:scale-95 group/loc ${props.isLocating ? 'animate-bounce' : ''}`}
                                title="Locate Me"
                            >
                                <svg className="w-4 h-4 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                </svg>
                            </div>

                            {/* Input */}
                            <input
                                type="text"
                                placeholder="Postal code..."
                                className="flex-1 py-2 sm:py-4 px-1 sm:px-2 bg-transparent outline-none text-gray-900 font-bold placeholder-gray-400 text-[10px] sm:text-lg min-w-0"
                                value={props.address}
                                onChange={(e) => props.setAddress(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && props.handleSearch()}
                            />
                            
                            <div className="flex items-center gap-1 sm:gap-4 ml-auto">
                                {/* Radius Selector */}
                                <div className="flex items-center sm:gap-2 sm:px-4 border-l border-gray-100 h-6 sm:h-10">
                                    <select 
                                        value={props.searchDistance} 
                                        onChange={(e) => props.setSearchDistance(Number(e.target.value))}
                                        className="text-[10px] sm:text-sm font-black bg-transparent px-1 sm:px-3 py-1 rounded-lg border-none outline-none text-blue-600 cursor-pointer focus:ring-0 transition-all appearance-none sm:appearance-auto"
                                    >
                                        <option value={5}>5km</option>
                                        <option value={10}>10km</option>
                                        <option value={20}>20km</option>
                                        <option value={50}>50km</option>
                                    </select>
                                </div>

                                {/* Search Button */}
                                <button
                                    onClick={() => props.handleSearch()}
                                    disabled={props.isLocating}
                                    className="bg-gray-900 text-white px-3 sm:px-12 py-2 sm:py-4 rounded-full font-black text-[10px] sm:text-sm tracking-widest hover:bg-blue-600 transition-all shadow-xl active:scale-95 shrink-0 uppercase border-b-2 sm:border-b-4 border-black"
                                >
                                    <span className="sm:inline hidden">Search Stores</span>
                                    <span className="sm:hidden">GO</span>
                                </button>
                            </div>
                        </div>
                    </div>
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
