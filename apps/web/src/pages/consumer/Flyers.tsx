import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useLocation } from '../../context/LocationContext';
import '../../styles/design-system.css';

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

const Flyers: React.FC = () => {
    const navigate = useNavigate();
    const { stores, loading } = useMarketplace();
    const { userCoords, searchDistance, calculateDistance } = useLocation();

    const activeFlyerStores = Object.values(stores || {}).filter((store: any) => {
        if (!store.flyer || !store.flyer.validUntil) return false;
        const validUntil = new Date(store.flyer.validUntil);
        // Set to end of day to be inclusive
        validUntil.setHours(23, 59, 59, 999);
        if (validUntil < new Date()) return false;

        if (userCoords && searchDistance > 0 && store.coordinates) {
            const distance = calculateDistance(userCoords.lat, userCoords.lng, store.coordinates.lat, store.coordinates.lng);
            if (distance > searchDistance) return false;
        }

        return true;
    });

    return (
        <div className="animate-fade-in pb-20">
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
                            <span className="text-2xl">📰</span> All Weekly Flyers
                        </h1>
                        <p className="text-xs text-[var(--text-muted)]">{activeFlyerStores.length} flyers active this week</p>
                    </div>
                </div>
            </div>

            <main className="max-w-5xl mx-auto p-4 md:p-6">
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(n => (
                            <div key={n} className="h-64 bg-[var(--surface-2)] rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : activeFlyerStores.length === 0 ? (
                    <div className="text-center py-20">
                        <p className="text-5xl mb-4">📭</p>
                        <h2 className="text-xl font-bold text-[var(--text-main)] mb-2">No active flyers found</h2>
                        <p className="text-[var(--text-muted)]">Check back later for new weekly deals!</p>
                        <button 
                            onClick={() => navigate('/')}
                            className="mt-6 px-6 py-2 bg-[var(--brand-primary)] text-white font-bold rounded-lg"
                        >
                            Back to Stores
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {activeFlyerStores.map((store: any) => (
                            <div
                                key={store.id}
                                onClick={() => navigate(`/store/${store.id}`, { state: { initialTab: 'flyer' } })}
                                className="glass-panel overflow-hidden cursor-pointer group hover:border-[var(--brand-primary)] hover:shadow-lg transition-all duration-300"
                            >
                                <div className="h-48 relative overflow-hidden bg-[var(--surface-2)]">
                                    <img 
                                        src={getValidFlyerImage(store.flyer?.image) || store.image} 
                                        alt={store.name}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                    
                                    <div className="absolute bottom-4 left-4 right-4">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-lg bg-white border border-[var(--glass-border)] flex items-center justify-center text-xl shadow-lg overflow-hidden">
                                                {store.logoUrl && store.logoUrl.startsWith('http') ? (
                                                    <img src={store.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span>{store.logoUrl || '🏪'}</span>
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="text-white font-bold drop-shadow-md">{store.name}</h3>
                                                <p className="text-white/80 text-[10px] uppercase font-bold tracking-wider">
                                                    Valid until {new Date(store.flyer.validUntil).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="absolute top-3 right-3 bg-red-600 text-white text-[10px] uppercase font-bold px-2 py-1 rounded shadow-lg animate-pulse">
                                        Weekly Flyer
                                    </div>
                                </div>
                                <div className="p-4 bg-white">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1">
                                            <span className="text-yellow-500 text-xs text-sm">★</span>
                                            <span className="text-xs font-bold text-[var(--text-main)]">{store.rating || '0.0'}</span>
                                        </div>
                                        <button className="text-xs font-bold text-[var(--brand-primary)] group-hover:translate-x-1 transition-transform">
                                            View Flyer →
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default Flyers;
