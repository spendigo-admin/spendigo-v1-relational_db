import React, { useEffect, useState, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '../../lib/firebase';
import { useComparison } from '../../context/ComparisonContext';
import { doc, onSnapshot } from 'firebase/firestore';
import SEO from '../../components/SEO';
import { calculateUnitPrice } from '../../smartcart/priceNormalization';
import { Link } from 'react-router-dom';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { useTranslation } from 'react-i18next';

// Normalizes a flyer deal's price to a per-unit equivalent.
const parseDealPrice = (deal: any): number => {
    const rawPrice = deal.currentPrice ? parseFloat(deal.currentPrice) : NaN;
    const preQty = deal.prePriceText ? parseFloat(deal.prePriceText) : NaN;
    if (!isNaN(preQty) && preQty > 1 && !isNaN(rawPrice)) return rawPrice / preQty;
    if (!isNaN(rawPrice)) return rawPrice;
    if (typeof deal.priceText === 'string') {
        const multiBuy = deal.priceText.match(/(\d+)\s*(?:\/|for)\s*\$?([\d.]+)/i);
        if (multiBuy) return parseFloat(multiBuy[2]) / parseInt(multiBuy[1]);
        const plain = parseFloat(deal.priceText.replace(/[^\d.]/g, ''));
        if (!isNaN(plain)) return plain;
    }
    return 9999;
};

const PriceCompare = () => {
    const { t } = useTranslation();
    const [deals, setDeals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { items: wishlistItems } = useComparison();
    const [flyerIngestionEnabled, setFlyerIngestionEnabled] = useState(true);
    const [settingsLoading, setSettingsLoading] = useState(true);

    useEffect(() => {
        const unsubSettings = onSnapshot(doc(db, 'settings', 'platform'), (snap) => {
            if (snap.exists()) {
                setFlyerIngestionEnabled(snap.data().flyerIngestionEnabled !== false);
            }
            setSettingsLoading(false);
        });

        const fetchDeals = async () => {
            if (wishlistItems.length === 0) {
                setDeals([]);
                setLoading(false);
                return;
            }

            const listTerms = wishlistItems.map(i => i.name.toLowerCase().trim());
            
            setLoading(true);
            try {
                // Fetch static JSON file instead of running Cloud Function
                // Using direct GCP storage URL instead of Firebase API to avoid 401 token errors
                // Appending a timestamp query param to bypass aggressive browser/CDN caching
                const cacheBuster = Math.floor(Date.now() / 60000); // changes every minute
                const response = await fetch(`https://storage.googleapis.com/spendigo-8540c.firebasestorage.app/public/active_deals.json?v=${cacheBuster}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch active_deals.json: ${response.statusText}`);
                }
                const allDeals = await response.json();
                
                // Perform client-side filtering matching the old backend logic
                const filteredDeals = allDeals.filter((deal: any) => {
                    const lowerName = (deal.name || '').toLowerCase();
                    
                    const matchesList = listTerms.some(term => {
                        return lowerName.includes(term) || term.includes(lowerName) ||
                               term.split(' ').some(word => word.length > 3 && new RegExp(`\\b${word}\\b`).test(lowerName));
                    });
                    
                    return matchesList;
                });
                
                setDeals(filteredDeals.slice(0, 3000));
            } catch (err) {
                console.error("Error fetching public deals from storage:", err);
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchDeals();
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            unsubSettings();
        };
    }, [wishlistItems, flyerIngestionEnabled]);

    // Group flyer deals by wishlist item
    const groupedDeals = useMemo(() => {
        if (!deals || deals.length === 0) return [];

        const groups = wishlistItems.map(item => {
            const term = item.name.toLowerCase().trim();
            const termWords = term.split(' ').filter(w => w.length > 3);

            const matchingDeals = deals.filter(deal => {
                const lowerName = (deal.name || '').toLowerCase();
                return lowerName.includes(term) || term.includes(lowerName) ||
                       termWords.some(word => new RegExp(`\\b${word}\\b`).test(lowerName));
            });

            // Sort deals by parsed price
            matchingDeals.sort((a, b) => parseDealPrice(a) - parseDealPrice(b));

            // Deduplicate by retailer and item name to allow different brands from the same store
            const uniqueDeals = new Map();
            matchingDeals.forEach(deal => {
                const key = `${deal.retailer}-${(deal.name || '').toLowerCase()}`;
                const current = uniqueDeals.get(key);
                if (!current || parseDealPrice(deal) < parseDealPrice(current)) {
                    uniqueDeals.set(key, deal);
                }
            });

            return {
                wishlistItem: item,
                deals: Array.from(uniqueDeals.values())
            };
        });

        // Sort: items with deals first, then by name
        return groups.sort((a, b) => {
            if (a.deals.length > 0 && b.deals.length === 0) return -1;
            if (a.deals.length === 0 && b.deals.length > 0) return 1;
            return a.wishlistItem.name.localeCompare(b.wishlistItem.name);
        });
    }, [deals, wishlistItems]);

    if (!settingsLoading && !flyerIngestionEnabled) {
        return (
            <div className="min-h-screen bg-[var(--surface-1)] flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-3xl border border-[var(--glass-border)] shadow-sm p-8 text-center animate-fade-in">
                    <span className="text-6xl mb-6 block">🚧</span>
                    <h1 className="text-2xl font-black text-[var(--text-main)] mb-2 tracking-tighter">{t('compareFeatureUnavailable')}</h1>
                    <p className="text-[var(--text-muted)] font-medium mb-8">
                        {t('compareFeatureUnavailableDesc')}
                    </p>
                    <Link to="/" className="inline-flex items-center justify-center px-8 py-3 bg-[var(--brand-primary)] text-white font-bold rounded-xl hover:shadow-lg transition-all active:scale-95">
                        {t('compareReturnToMarketplace')}
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[var(--surface-0)] min-h-screen animate-fade-in pb-20">
            <SEO title="Compare My List" description="Compare flyer deals for the items on your wishlist." path="/compare" />

            {/* Premium Hero Section */}
            <section className="relative overflow-hidden pt-12 pb-8 md:pt-20 md:pb-12 px-4 mb-8">
                {/* Background Decorative Elements */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,var(--brand-primary-light),transparent_70%)]" />
                    <div className="absolute top-1/4 -right-20 w-64 h-64 md:w-96 md:h-96 bg-blue-100/30 rounded-full blur-[100px] opacity-60 animate-pulse" />
                    <div className="absolute bottom-0 -left-20 w-64 h-64 md:w-96 md:h-96 bg-purple-100/30 rounded-full blur-[100px] opacity-60 animate-pulse" style={{ animationDelay: '2s' }} />
                </div>

                <div className="max-w-7xl mx-auto relative z-10">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                        <div className="flex-1 max-w-2xl text-center md:text-left">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-white shadow-sm border border-gray-100 mb-6 animate-fade-in">
                                <span className="flex h-2 w-2 rounded-full bg-[var(--brand-primary)] animate-ping" />
                                <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] text-[var(--text-muted)]">
                                    {t('compareFlyerPriceAnalysis')}
                                </span>
                            </div>
                            <h1 className="text-2xl md:text-4xl font-black italic tracking-tighter mb-4 leading-[1.05] text-[var(--brand-navy)]">
                                Price<br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#112244] to-[#007AFF]">Comparison.</span>
                            </h1>
                            <p className="text-xs md:text-sm font-medium text-[var(--text-muted)] max-w-xl mx-auto md:mx-0 leading-relaxed">
                                {t('compareFlyerDesc')}
                                <span className="text-[var(--brand-primary)]"> {t('compareFlyerDescHighlight')}</span>
                            </p>
                        </div>

                        {!loading && deals.length > 0 && (
                            <div className="bg-white rounded-3xl p-8 min-w-[280px] shadow-2xl border-b-8 border-[var(--brand-primary)] relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--brand-primary)]/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
                                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--brand-navy)] mb-2 relative z-10">{t('compareTotalMatches')}</div>
                                <div className="text-6xl font-black text-[var(--brand-navy)] tracking-tighter italic relative z-10">{deals.length}</div>
                                <div className="mt-4 text-[9px] font-black text-white uppercase tracking-widest bg-[var(--brand-primary)] inline-block px-4 py-1.5 rounded-full shadow-lg shadow-blue-500/20 relative z-10">
                                    {t('compareActiveInStore')}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 p-4 rounded-2xl bg-amber-50/50 border border-amber-100 text-amber-800 text-[10px] md:text-xs font-bold uppercase tracking-widest leading-relaxed">
                        <span className="bg-amber-100 px-2 py-0.5 rounded-full mr-2">{t('compareDisclaimer')}</span>
                        {t('compareDisclaimerText')}
                    </div>
                </div>
            </section>

            <main className="max-w-7xl mx-auto py-8 px-4 space-y-8">
                {wishlistItems.length === 0 ? (
                    <EmptyState
                        icon="🔍"
                        heading={t('compareNoItemsToCompare')}
                        subtext={t('compareNoItemsToCompareHint')}
                        action={<Link to="/profile" state={{ activeTab: 'wishlist' }} className="btn-primary">{t('compareManageWishlist')}</Link>}
                    />
                ) : loading ? (
                    <div className="space-y-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white rounded-3xl border border-[var(--glass-border)] overflow-hidden">
                                <div className="px-6 py-4 border-b border-[var(--glass-border)] flex items-center gap-4">
                                    <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 rounded-full w-1/3" />
                                        <Skeleton className="h-3 rounded-full w-1/5" />
                                    </div>
                                </div>
                                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {[1,2,3].map(j => <Skeleton key={j} className="h-24 rounded-2xl" />)}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-6">
                        {groupedDeals.map(group => (
                            <div key={group.wishlistItem.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center overflow-hidden border border-[var(--glass-border)] shrink-0">
                                            {group.wishlistItem.image ? (
                                                <img src={group.wishlistItem.image} alt={group.wishlistItem.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-2xl">📦</span>
                                            )}
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-black text-[var(--brand-navy)] leading-tight italic tracking-tight">{group.wishlistItem.name}</h2>
                                            <p className="text-[10px] text-[var(--brand-primary)] font-black uppercase tracking-widest">{group.wishlistItem.category || 'Item'}</p>
                                        </div>
                                    </div>
                                    <div className="shrink-0">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${group.deals.length > 0 ? 'bg-[#EBF5FF] text-[#007AFF]' : 'bg-gray-100 text-gray-400'}`}>
                                            {group.deals.length} {t('compareFlyerDealsFound')}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="p-6">
                                    {group.deals.length > 0 ? (() => {
                                        // Split deals into same-product-multi-retailer groups vs unique products
                                        const nameMap = new Map<string, any[]>();
                                        group.deals.forEach((deal: any) => {
                                            const key = (deal.name || '').toLowerCase().trim();
                                            if (!nameMap.has(key)) nameMap.set(key, []);
                                            nameMap.get(key)!.push(deal);
                                        });
                                        const headToHeadGroups = Array.from(nameMap.values())
                                            .filter(g => g.length >= 2)
                                            .map(g => [...g].sort((a, b) => parseDealPrice(a) - parseDealPrice(b)));
                                        const uniqueDeals: any[] = Array.from(nameMap.values())
                                            .filter(g => g.length === 1)
                                            .map(g => g[0]);

                                        return (
                                            <div className="space-y-5">
                                                {/* Head-to-head: same product, multiple retailers */}
                                                {headToHeadGroups.map((nameGroup, gi) => {
                                                    const best = nameGroup[0];
                                                    const saving = parseDealPrice(nameGroup[nameGroup.length - 1]) - parseDealPrice(best);
                                                    return (
                                                        <div key={gi} className="rounded-2xl border border-blue-100 bg-blue-50/30 overflow-hidden">
                                                            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--brand-primary)]/10">
                                                                {best.imageUrl && (
                                                                    <div className="w-16 h-16 shrink-0 bg-white rounded-xl border border-[var(--glass-border)] flex items-center justify-center p-1.5">
                                                                        <img src={best.imageUrl} alt={best.name} className="max-w-full max-h-full object-contain mix-blend-multiply" />
                                                                    </div>
                                                                )}
                                                                <p className="text-sm font-bold text-[var(--text-main)] flex-1 leading-snug">{best.name}</p>
                                                                {saving > 0.01 && (
                                                                    <span className="badge-best shrink-0">Save ${saving.toFixed(2)}</span>
                                                                )}
                                                            </div>
                                                            <div className="divide-y divide-[var(--brand-primary)]/10">
                                                                {nameGroup.map((deal: any, ri: number) => {
                                                                    const isWinner = ri === 0;
                                                                    const price = parseDealPrice(deal);
                                                                    const unitPrice = price < 9999 ? calculateUnitPrice({ price, packageSize: deal.name || '' }) : null;
                                                                    return (
                                                                        <div key={ri} className={`flex items-center justify-between px-4 py-2.5 ${isWinner ? 'bg-white/60' : ''}`}>
                                                                            <div className="flex items-center gap-2 min-w-0">
                                                                                {isWinner && <span className="text-base leading-none">🏆</span>}
                                                                                <span className={`text-sm font-bold truncate ${isWinner ? 'text-[#007AFF]' : 'text-[#112244]/60'}`}>
                                                                                    {deal.retailer}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex items-center gap-2 shrink-0 pl-3">
                                                                                {unitPrice && (
                                                                                    <span className="text-xs text-[var(--text-muted)] font-medium hidden sm:inline">
                                                                                        ${unitPrice.pricePerComparisonUnit.toFixed(2)}/{unitPrice.comparisonUnit}
                                                                                    </span>
                                                                                )}
                                                                                {deal.validTo && (
                                                                                    <span className="text-[10px] font-bold text-[var(--status-error)] hidden sm:inline uppercase tracking-widest">
                                                                                        Ends {new Date(deal.validTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                                    </span>
                                                                                )}
                                                                                <span className={`text-lg font-black tracking-tighter italic ${isWinner ? 'text-[var(--brand-primary)]' : 'text-[var(--brand-navy)]'}`}>
                                                                                    {deal.currentPrice ? `$${parseFloat(deal.currentPrice).toFixed(2)}` : deal.priceText}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {/* Unique products — different brands/variants */}
                                                {uniqueDeals.length > 0 && (
                                                    <div>
                                                        {headToHeadGroups.length > 0 && (
                                                            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                                                                {t('compareOtherMatches')}
                                                            </p>
                                                        )}
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                            {uniqueDeals.map((deal: any, i: number) => {
                                                                const isBest = headToHeadGroups.length === 0 && i === 0;
                                                                return (
                                                                    <div key={i} className={`flex flex-col p-3 rounded-2xl border ${isBest ? 'bg-[var(--brand-primary-light)] border-[var(--brand-primary)]/20 shadow-sm' : 'bg-[var(--surface-0)] border-[var(--glass-border)]'} transition-colors`}>
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <div className="flex items-center gap-2 min-w-0">
                                                                                {isBest && <span className="bg-[#007AFF] text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">{t('compareBestPrice')}</span>}
                                                                                <span className={`text-sm font-bold truncate ${isBest ? 'text-[#007AFF]' : 'text-[#112244]'}`}>
                                                                                    {deal.retailer}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex items-center gap-1 shrink-0 pl-2">
                                                                                {deal.prePriceText && <span className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider">{deal.prePriceText}</span>}
                                                                                <span className={`text-xl font-black tracking-tight ${isBest ? 'text-[var(--brand-primary)]' : 'text-[var(--text-main)]'}`}>
                                                                                    {deal.currentPrice ? `$${parseFloat(deal.currentPrice).toFixed(2)}` : deal.priceText}
                                                                                </span>
                                                                                {deal.postPriceText && <span className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider">{deal.postPriceText}</span>}
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex gap-3 border-t border-black/5 pt-3 mt-auto">
                                                                            {deal.imageUrl && (
                                                                                <div className="w-24 h-24 shrink-0 bg-white rounded-xl border border-[var(--glass-border)] flex items-center justify-center p-2">
                                                                                    <img src={deal.imageUrl} alt={deal.name} className="max-w-full max-h-full object-contain mix-blend-multiply" />
                                                                                </div>
                                                                            )}
                                                                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                                                                                <div className="flex items-start justify-between gap-2">
                                                                                    <p className="text-xs text-[var(--text-muted)] font-medium">{deal.name}</p>
                                                                                    {(() => {
                                                                                        const price = parseDealPrice(deal);
                                                                                        if (price >= 9999) return null;
                                                                                        const unitPrice = calculateUnitPrice({ price, packageSize: deal.name || deal.description || '' });
                                                                                        if (!unitPrice) return null;
                                                                                        return (
                                                                                            <div className={`shrink-0 px-2 py-0.5 rounded bg-white border border-black/5 text-xs font-bold ${isBest ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)]'}`}>
                                                                                                ${unitPrice.pricePerComparisonUnit.toFixed(2)}/{unitPrice.comparisonUnit}
                                                                                            </div>
                                                                                        );
                                                                                    })()}
                                                                                </div>
                                                                                {deal.validTo && (
                                                                                    <p className="text-[10px] font-bold text-[var(--status-error)] mt-1">
                                                                                        Ends {new Date(deal.validTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })() : (
                                        <div className="text-center py-6 px-4 bg-[var(--surface-0)] rounded-2xl border border-dashed border-[var(--glass-border)]">
                                            <p className="text-sm font-bold text-[var(--text-muted)] mb-1">{t('compareNoFlyerMatches')}</p>
                                            <p className="text-xs text-[var(--text-muted)]">{t('compareNoFlyerMatchesHint')}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default PriceCompare;
