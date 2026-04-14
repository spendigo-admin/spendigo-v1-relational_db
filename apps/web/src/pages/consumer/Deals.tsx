import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useLocation } from '../../context/LocationContext';
import '../../styles/design-system.css';
import SEO from '../../components/SEO';
import { filterActiveDeals } from '../../utils/date-helpers';

const Deals: React.FC = () => {
    const navigate = useNavigate();
    const { stores, loading } = useMarketplace();
    const { userCoords, userPostalCode, searchDistance, calculateDistance } = useLocation();

    const storesWithDeals = Object.values(stores || {}).filter((store: any) => {
        const activeDeals = filterActiveDeals([...(store.oneDayOffers || []), ...(store.saleItems || [])]);
        if (activeDeals.length === 0) return false;

        if (userCoords && searchDistance > 0 && store.coordinates) {
            const distance = calculateDistance(userCoords.lat, userCoords.lng, store.coordinates.lat, store.coordinates.lng);
            if (distance > searchDistance) {
                if (userPostalCode && store.postalCode) {
                    const userFSA = userPostalCode.trim().substring(0, 3).toUpperCase();
                    const storeFSA = store.postalCode.trim().substring(0, 3).toUpperCase();
                    if (userFSA === storeFSA && /^[A-Z]\d[A-Z]$/.test(userFSA)) {
                        return true;
                    }
                }
                return false;
            }
        }

        return true;
    }).map((store: any) => ({
        ...store,
        activeDealsCount: filterActiveDeals([...(store.oneDayOffers || []), ...(store.saleItems || [])]).length
    }));

    return (
        <div className="animate-fade-in pb-20">
            <SEO title="Active Deals" description="Discover hot deals and sale items from local grocery stores near you. Save more with Spendigo SmartCart." path="/deals" />
            
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
                            <span className="text-2xl">🔥</span> Hot Deals Near You
                        </h1>
                        <p className="text-xs text-[var(--text-muted)]">{storesWithDeals.length} stores with active deals</p>
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
                ) : storesWithDeals.length === 0 ? (
                    <div className="text-center py-20">
                        <p className="text-5xl mb-4">🏷️</p>
                        <h2 className="text-xl font-bold text-[var(--text-main)] mb-2">No active deals found</h2>
                        <p className="text-[var(--text-muted)]">Check back later for new savings!</p>
                        <button 
                            onClick={() => navigate('/')}
                            className="mt-6 px-6 py-2 bg-[var(--brand-primary)] text-white font-bold rounded-lg"
                        >
                            Back to Stores
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {storesWithDeals.map((store: any) => (
                            <div
                                key={store.id}
                                onClick={() => navigate(`/store/${store.id}`, { state: { initialTab: 'offers' } })}
                                className="glass-panel overflow-hidden cursor-pointer group hover:border-[var(--brand-primary)] hover:shadow-lg transition-all duration-300"
                            >
                                <div className="h-48 relative overflow-hidden bg-[var(--surface-2)]">
                                    <img 
                                        src={store.image} 
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
                                                    {store.activeDealsCount} Exclusive Deals
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="absolute top-3 right-3 bg-green-600 text-white text-[10px] uppercase font-bold px-2 py-1 rounded shadow-lg">
                                        Active Deals
                                    </div>
                                </div>
                                <div className="p-4 bg-white">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1">
                                            <span className="text-yellow-500 text-sm">★</span>
                                            <span className="text-xs font-bold text-[var(--text-main)]">{store.rating || '0.0'}</span>
                                            <span className="text-[10px] text-[var(--text-muted)]">({store.reviewCount || 0})</span>
                                        </div>
                                        <button className="text-xs font-bold text-[var(--brand-primary)] group-hover:translate-x-1 transition-transform">
                                            View Deals →
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

export default Deals;
