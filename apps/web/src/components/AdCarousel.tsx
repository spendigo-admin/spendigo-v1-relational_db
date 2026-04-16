import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, getDocs, updateDoc, doc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useTranslation } from 'react-i18next';
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
}

const DefaultHero = ({ handleSearch, address, setAddress, isLocating, handleLocateMe }: any) => {
    const { t } = useTranslation();
    return (
    <section className="relative overflow-hidden bg-gray-900 py-2 md:py-4 px-4 min-h-[100px] flex items-center justify-center">
        {/* Immersive Background */}
        <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-600/20 via-gray-900 to-gray-900"></div>
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-600/10 rounded-full blur-[120px] -mr-64 -mt-64 animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[100px] -ml-48 -mb-48 animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center w-full">
            <div className="inline-block py-1 px-4 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-white/60 text-[10px] font-black tracking-[0.3em] mb-8 animate-fade-in">
                Spendigo Powered by Smartcart AI
            </div>
            
            <h1 className="text-4xl md:text-6xl font-black text-white mb-8 leading-[0.9] tracking-tighter drop-shadow-2xl italic">
                {t('shopLocal')}<br />
                <span className="text-teal-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">{t('everyoneWins')}</span>
            </h1>
            
            <p className="text-white/60 text-base md:text-xl mb-12 max-w-2xl mx-auto font-bold tracking-wide">
                Experience the highest quality local commerce. <span className="text-white font-black">Compare. Shop. Save.</span>
            </p>

            {/* Premium Search Interaction */}
            <div className="group relative max-w-2xl mx-auto">
                <div className="absolute -inset-1 bg-gradient-to-r from-teal-600 to-teal-400 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative flex items-center bg-white rounded-full p-2.5 shadow-2xl transition-all duration-300 group-hover:scale-[1.01]">
                    <button
                        onClick={handleLocateMe}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${address === "Current Location" ? 'bg-teal-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                        title="Use my current location"
                    >
                        {isLocating && address === "Current Location" ? <span className="animate-spin text-lg">⏳</span> : <span className="text-lg">📍</span>}
                    </button>
                    <input
                        type="text"
                        placeholder="Enter your postal code or address..."
                        className="flex-1 py-3 px-4 bg-transparent outline-none text-gray-900 font-bold placeholder-gray-300 text-sm md:text-base"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <button
                        onClick={() => handleSearch()}
                        disabled={isLocating}
                        className="bg-gray-900 text-white px-8 md:px-10 py-3.5 rounded-full font-black text-xs tracking-widest hover:bg-black transition-all shadow-xl disabled:bg-gray-200 active:scale-95"
                    >
                        {isLocating && address !== "Current Location" ? 'Searching...' : 'Find Grocers'}
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
}

const AdCarousel: React.FC<AdCarouselProps> = (props) => {
    const { t } = useTranslation();
    const [ads, setAds] = useState<AdCampaign[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const timerRef = useRef<any>(null);

    // Fetch Ads
    useEffect(() => {
        const fetchAds = async () => {
            const today = new Date().toISOString().split('T')[0];
            const q = query(
                collection(db, 'ads'),
                where('status', '==', 'active'),
                where('endDate', '>=', today),
                orderBy('endDate', 'desc'), // Firestore restriction: first orderBy must match inequality filter
                orderBy('priority', 'desc')
            );

            // Note: If you get a "Missing Index" error, removing `orderBy('priority')` is the quick fix until index is built.
            // For now, let's just fetch active ones and sort in JS to avoid index errors immediately.
            try {
                // Simplified query to avoid complex index requirements initially
                const simpleQ = query(collection(db, 'ads'), where('status', '==', 'active'));
                const snapshot = await getDocs(simpleQ);

                const validAds = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as AdCampaign))
                    .filter(ad => ad.endDate >= today && ad.startDate <= today)
                    .sort((a, b) => b.priority - a.priority);

                setAds(validAds);
            } catch (err) {
                console.error("Failed to load ads", err);
            } finally {
                setLoading(false);
            }
        };

        fetchAds();
    }, []);

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
            // Fire and forget update
            updateDoc(doc(db, 'ads', ad.id), {
                views: increment(1)
            }).catch(console.error);
        }
    }, [currentIndex, ads]);

    const handleAdClick = async (ad: AdCampaign) => {
        // Track Click
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
        <section className="relative overflow-hidden min-h-[110px] md:h-[125px] flex items-center justify-center bg-gray-900 group">
            {/* Background Image with Blur/Gradient */}
            <div className="absolute inset-0 z-0">
                <img
                    src={currentAd.imageUrl}
                    alt={currentAd.title}
                    className="w-full h-full object-cover opacity-60 transition-all duration-1000 transform scale-105"
                    key={currentAd.id} // Force re-render for animation
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent"></div>
            </div>

            <div className="relative z-10 max-w-5xl mx-auto text-center w-full px-4 pt-16">
                <div className="inline-block py-1 px-4 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/80 text-[10px] font-black tracking-[0.3em] mb-6">
                    Featured Spotlight
                </div>

                <h1 className="text-3xl md:text-5xl font-black text-white mb-8 leading-[0.9] tracking-tighter italic animate-fade-in-up drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                    {currentAd.title}
                </h1>

                {/* Search Bar pass-through overlay */}
                <div className="group relative max-w-2xl mx-auto">
                    <div className="absolute -inset-1 bg-gradient-to-r from-teal-600 to-teal-400 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative flex items-center bg-white/95 backdrop-blur-md rounded-full p-2.5 shadow-2xl transition-all duration-300 group-hover:scale-[1.01]">
                        <button
                            onClick={props.handleLocateMe}
                            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${props.address === "Current Location" ? 'bg-teal-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                            title="Use my current location"
                        >
                            {props.isLocating && props.address === "Current Location" ? <span className="animate-spin text-lg">⏳</span> : <span className="text-lg">📍</span>}
                        </button>
                        <input
                            type="text"
                            placeholder="Type postal code or address..."
                            className="flex-1 py-3 px-4 bg-transparent outline-none text-gray-900 font-bold placeholder-gray-300 text-sm md:text-base"
                            value={props.address}
                            onChange={(e) => props.setAddress(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && props.handleSearch()}
                        />
                        <button
                            onClick={() => props.handleSearch()}
                            disabled={props.isLocating}
                            className="bg-gray-900 text-white px-8 md:px-10 py-3.5 rounded-full font-black text-xs tracking-widest hover:bg-black transition-all shadow-xl active:scale-95"
                        >
                            {props.isLocating && props.address !== "Current Location" ? '...' : 'Re-Search'}
                        </button>
                    </div>
                </div>

                {currentAd.linkUrl && (
                    <button
                        onClick={() => handleAdClick(currentAd)}
                        className="mt-10 px-8 py-3 bg-white text-gray-900 rounded-full font-black text-[10px] tracking-widest hover:bg-teal-600 hover:text-white transition-all shadow-xl active:scale-95 border-b-4 border-gray-200 hover:border-teal-800"
                    >
                        Explore Exclusive Offer &rarr;
                    </button>
                )}
            </div>

            {/* Tagline Watermark: Moved to Section Root for correct positioning */}
            <div className="absolute bottom-12 left-0 right-0 text-center pointer-events-none z-20">
                <p className="text-white/70 text-[10px] tracking-[0.2em] font-medium drop-shadow-md">
                    Spendigo • Powered by Smartcart AI
                </p>
            </div>

            {/* Dots */}
            {ads.length > 1 && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-20">
                    {ads.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentIndex(idx)}
                            className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? 'bg-white w-6' : 'bg-white/40 hover:bg-white/60'}`}
                        />
                    ))}
                </div>
            )}
        </section>
    );
};

export default AdCarousel;
