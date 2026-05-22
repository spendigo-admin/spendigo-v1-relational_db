import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useLocation } from '../../context/LocationContext';
import '../../styles/design-system.css';
import SEO from '../../components/SEO';
import { isFlyerActive } from '../../utils/date-helpers';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation();
    const { stores, loading } = useMarketplace();
    const { userCoords, userPostalCode, searchDistance, calculateDistance } = useLocation();

    const activeFlyerStores = Object.values(stores || {}).filter((store: any) => {
        if (store.status !== 'active') return false;
        if (!isFlyerActive(store.flyer)) return false;

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
    });

    return (
        <div className="animate-fade-in pb-20">
            <SEO title="Weekly Flyers" description="Browse all weekly grocery flyers from local stores near you. Compare deals and save more with Spendigo." path="/flyers" />
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
                        <h1 className="text-xl font-black text-[var(--brand-navy)] flex items-center gap-2 italic tracking-tighter">
                            <span className="text-2xl">📰</span> {t('flyersAllWeekly')}
                        </h1>
                        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{activeFlyerStores.length} {t('flyersActiveCount')}</p>
                    </div>
                </div>
            </div>

            <main className="max-w-5xl mx-auto p-4 md:p-6">
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(n => (
                            <div key={n} className="glass-panel overflow-hidden rounded-2xl">
                                <Skeleton className="h-48 w-full rounded-none" />
                                <div className="p-4 flex items-center justify-between">
                                    <Skeleton className="h-4 w-16 rounded-full" />
                                    <Skeleton className="h-4 w-20 rounded-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : activeFlyerStores.length === 0 ? (
                    <EmptyState
                        icon="📭"
                        heading={t('flyersNoFlyersFound')}
                        subtext={t('flyersNoFlyersFoundHint')}
                        action={
                            <button onClick={() => navigate('/')} className="btn-primary">
                                {t('flyersBackToStores')}
                            </button>
                        }
                    />
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
                                                {store.logoUrl && (store.logoUrl.startsWith('http') || store.logoUrl.startsWith('/') || store.logoUrl.startsWith('data:')) ? (
                                                    <img src={store.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span>{store.logoUrl || '🏪'}</span>
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="text-white font-bold drop-shadow-md">{store.name}</h3>
                                                <p className="text-white/80 text-xs font-medium">
                                                    {t('flyersValidUntil')} {new Date(store.flyer.validUntil).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="absolute top-3 right-3">
                                        <span className="badge-deal animate-pulse">{t('flyersWeeklyFlyerBadge')}</span>
                                    </div>
                                </div>
                                <div className="p-4 bg-white">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1">
                                            <span className="text-yellow-500 text-xs text-sm">★</span>
                                            <span className="text-xs font-bold text-[var(--text-main)]">{store.rating || '0.0'}</span>
                                        </div>
                                        <button className="text-xs font-bold text-[var(--brand-primary)] group-hover:translate-x-1 transition-transform">
                                            {t('flyersViewFlyer')}
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
