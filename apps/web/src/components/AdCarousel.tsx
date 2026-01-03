import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, getDocs, updateDoc, doc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
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

const DefaultHero = ({ onSearch, address, setAddress, isLocating, handleLocateMe }: any) => (
    <section className="relative overflow-hidden bg-gradient-to-br from-[var(--brand-primary)] via-[#4f46e5] to-[var(--brand-secondary)] py-12 px-4 pt-safe min-h-[400px] flex items-center justify-center">
        {/* Animated background shapes */}
        <div className="absolute inset-0 overflow-hidden opacity-20">
            <div className="absolute -top-20 -left-20 w-72 h-72 bg-white rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center w-full">
            <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-6 leading-tight tracking-tight drop-shadow-sm">
                When You Shop Local,<br />
                <span className="text-yellow-300">Everyone Wins.</span>
            </h1>
            <p className="text-white/90 text-lg md:text-xl mb-8 max-w-2xl mx-auto font-medium">
                Supporting local businesses while rewarding shoppers.
            </p>
            {/* Search Bar pass-through */}
            <div className="flex items-center bg-white rounded-full p-2 max-w-xl mx-auto shadow-xl">
                <button
                    onClick={handleLocateMe}
                    className={`px-4 transition-colors ${address === "Current Location" ? 'text-[var(--brand-primary)]' : 'text-gray-400 hover:text-gray-600'}`}
                    title="Use my current location"
                >
                    {isLocating && address === "Current Location" ? '⌛' : '📍'}
                </button>
                <input
                    type="text"
                    placeholder="Type postal code or address..."
                    className="flex-1 py-3 px-2 bg-transparent outline-none text-gray-800 placeholder-gray-400"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                />
                <button
                    onClick={onSearch}
                    disabled={isLocating}
                    className="bg-[var(--brand-primary)] text-white px-6 py-3 rounded-full font-bold hover:brightness-110 transition-all flex items-center justify-center min-w-[100px]"
                >
                    {isLocating && address !== "Current Location" ? '...' : 'Search'}
                </button>
            </div>
        </div>
    </section>
);

interface AdCarouselProps {
    handleSearch: () => void;
    address: string;
    setAddress: (val: string) => void;
    isLocating: boolean;
    handleLocateMe: () => void;
}

const AdCarousel: React.FC<AdCarouselProps> = (props) => {
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
        <section className="relative overflow-hidden min-h-[400px] md:h-[500px] flex items-center justify-center bg-gray-900 group">
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

            <div className="relative z-10 max-w-4xl mx-auto text-center w-full px-4 pt-10">
                <span className="inline-block py-1 px-3 rounded-full bg-white/20 backdrop-blur-md text-white/80 text-xs font-bold mb-4 border border-white/10 uppercase tracking-widest">
                    Sponsored
                </span>

                <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-6 leading-tight drop-shadow-lg animate-fade-in-up">
                    {currentAd.title}
                </h1>

                {/* Search Bar pass-through overlay */}
                <div className="flex items-center bg-white/95 backdrop-blur rounded-full p-2 max-w-xl mx-auto shadow-2xl transform transition-transform group-hover:scale-[1.02]">
                    <button
                        onClick={props.handleLocateMe}
                        className={`px-4 transition-colors ${props.address === "Current Location" ? 'text-[var(--brand-primary)]' : 'text-gray-400 hover:text-gray-600'}`}
                        title="Use my current location"
                    >
                        {props.isLocating && props.address === "Current Location" ? '⌛' : '📍'}
                    </button>
                    <input
                        type="text"
                        placeholder="Type postal code or address..."
                        className="flex-1 py-3 px-2 bg-transparent outline-none text-gray-800 placeholder-gray-400"
                        value={props.address}
                        onChange={(e) => props.setAddress(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && props.handleSearch()}
                    />
                    <button
                        onClick={props.handleSearch}
                        disabled={props.isLocating}
                        className="bg-[var(--brand-primary)] text-white px-6 py-3 rounded-full font-bold hover:brightness-110 transition-all flex items-center justify-center min-w-[100px]"
                    >
                        {props.isLocating && props.address !== "Current Location" ? '...' : 'Search'}
                    </button>
                </div>

                {currentAd.linkUrl && (
                    <button
                        onClick={() => handleAdClick(currentAd)}
                        className="mt-8 text-white font-bold hover:underline text-sm opacity-80 hover:opacity-100 transition-opacity"
                    >
                        Learn More &rarr;
                    </button>
                )}
            </div>

            {/* Tagline Watermark: Moved to Section Root for correct positioning */}
            <div className="absolute bottom-12 left-0 right-0 text-center pointer-events-none z-20">
                <p className="text-white/70 text-[10px] uppercase tracking-[0.2em] font-medium drop-shadow-md">
                    Spendigo • When You Shop Local, <span className="text-white">Everyone Wins</span>
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
