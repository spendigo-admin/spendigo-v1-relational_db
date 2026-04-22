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
    <section className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-teal-500 py-12 md:py-20 px-4 flex items-center justify-center">
        {/* Background Decorative Elements */}
        <div className="absolute inset-0 z-0">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/5 rounded-full blur-[100px] -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-black/5 rounded-full blur-[80px] -ml-24 -mb-24"></div>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center w-full">
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-4 leading-tight tracking-tighter drop-shadow-lg">
                {t('shopLocal')}<br />
                <span className="text-yellow-400 drop-shadow-md">{t('everyoneWins')}</span>
            </h1>
            
            <p className="text-white/90 text-sm md:text-lg mb-8 max-w-2xl mx-auto font-medium">
                {t('supportLocal')}
            </p>

            {/* Premium Search Interaction */}
            <div className="group relative max-w-3xl mx-auto">
                <div className="relative flex items-center bg-white rounded-full p-1 md:p-1.5 shadow-2xl transition-all duration-300 group-hover:scale-[1.01]">
                    <div 
                        onClick={handleLocateMe}
                        className={`pl-4 pr-1 md:pr-2 flex items-center text-red-500 cursor-pointer hover:scale-125 transition-all active:scale-95 group/loc ${isLocating ? 'animate-bounce' : ''}`}
                        title="Locate Me"
                    >
                        <span className="text-lg">📍</span>
                    </div>
                    <input
                        type="text"
                        placeholder="Laval, Quebec"
                        className="flex-1 py-2 md:py-3 px-1 md:px-2 bg-transparent outline-none text-gray-900 font-medium placeholder-gray-400 text-xs md:text-base min-w-0"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    
                    {/* Radius Selector Integrated */}
                    <div className="flex items-center gap-1 md:gap-2 px-2 md:px-4 border-l border-gray-100 h-8 md:h-10">
                        <span className="hidden md:inline text-[9px] font-black text-gray-400 tracking-widest uppercase">Radius</span>
                        <select 
                            value={searchDistance} 
                            onChange={(e) => setSearchDistance(Number(e.target.value))}
                            className="text-[10px] md:text-xs font-black bg-transparent border-none outline-none text-blue-600 cursor-pointer focus:ring-0 text-center"
                        >
                            <option value={5}>5km</option>
                            <option value={10}>10km</option>
                            <option value={20}>20km</option>
                            <option value={50}>50km</option>
                        </select>
                    </div>

                    <button
                        onClick={() => handleSearch()}
                        disabled={isLocating}
                        className="bg-blue-600 text-white px-4 md:px-10 py-2.5 md:py-3 rounded-full font-bold text-[10px] md:text-sm hover:bg-blue-700 transition-all shadow-lg active:scale-95 shrink-0"
                    >
                        {isLocating ? '...' : 'Search'}
                    </button>
                </div>
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
        if (ads.length > 0) {
            const ad = ads[currentIndex];
            updateDoc(doc(db, 'ads', ad.id), {
                views: increment(1)
            }).catch(console.error);
        }
    }, [currentIndex, ads]);

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
        <section className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-teal-500 py-10 md:py-16 px-4 flex items-center justify-center group">
            {/* Background Image with Blur/Gradient */}
            <div className="absolute inset-0 z-0">
                <img
                    src={currentAd.imageUrl}
                    alt={currentAd.title}
                    className="w-full h-full object-cover opacity-20 transition-all duration-1000 transform scale-105"
                    key={currentAd.id}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/40 to-teal-500/40"></div>
            </div>

            <div className="relative z-10 max-w-5xl mx-auto text-center w-full">
                <h1 className="text-3xl md:text-5xl font-black text-white mb-6 leading-tight tracking-tighter drop-shadow-lg">
                    {currentAd.title}
                </h1>

                {/* Search Bar pass-through overlay */}
                <div className="group relative max-w-3xl mx-auto">
                    <div className="relative flex items-center bg-white rounded-full p-1 md:p-1.5 shadow-2xl transition-all duration-300 group-hover:scale-[1.01]">
                        <div 
                            onClick={props.handleLocateMe}
                            className={`pl-4 pr-1 md:pr-2 flex items-center text-red-500 cursor-pointer hover:scale-125 transition-all active:scale-95 group/loc ${props.isLocating ? 'animate-bounce' : ''}`}
                            title="Locate Me"
                        >
                            <span className="text-lg">📍</span>
                        </div>
                        <input
                            type="text"
                            placeholder="Type postal code or address..."
                            className="flex-1 py-2 md:py-3 px-1 md:px-2 bg-transparent outline-none text-gray-900 font-medium placeholder-gray-400 text-xs md:text-base min-w-0"
                            value={props.address}
                            onChange={(e) => props.setAddress(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && props.handleSearch()}
                        />

                        {/* Radius Selector Integrated */}
                        <div className="flex items-center gap-1 md:gap-2 px-2 md:px-4 border-l border-gray-100 h-8 md:h-10">
                            <span className="hidden md:inline text-[9px] font-black text-gray-400 tracking-widest uppercase">Radius</span>
                            <select 
                                value={props.searchDistance} 
                                onChange={(e) => props.setSearchDistance(Number(e.target.value))}
                                className="text-[10px] md:text-xs font-black bg-transparent border-none outline-none text-blue-600 cursor-pointer focus:ring-0 text-center"
                            >
                                <option value={5}>5km</option>
                                <option value={10}>10km</option>
                                <option value={20}>20km</option>
                                <option value={50}>50km</option>
                            </select>
                        </div>

                        <button
                            onClick={() => props.handleSearch()}
                            disabled={props.isLocating}
                            className="bg-blue-600 text-white px-4 md:px-10 py-2.5 md:py-3 rounded-full font-bold text-[10px] md:text-sm tracking-wide hover:bg-blue-700 transition-all shadow-xl active:scale-95 shrink-0"
                        >
                            {props.isLocating ? '...' : 'Search'}
                        </button>
                    </div>
                </div>

                {currentAd.linkUrl && (
                    <button
                        onClick={() => handleAdClick(currentAd)}
                        className="mt-6 px-8 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/30 rounded-full font-bold text-xs tracking-widest transition-all shadow-xl active:scale-95"
                    >
                        View Offer &rarr;
                    </button>
                )}
            </div>

            {/* Dots */}
            {ads.length > 1 && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-20">
                    {ads.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentIndex(idx)}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentIndex ? 'bg-white w-4' : 'bg-white/40 hover:bg-white/60'}`}
                        />
                    ))}
                </div>
            )}
        </section>
    );
};

export default AdCarousel;
