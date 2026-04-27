import React, { useEffect, useState, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '../../lib/firebase';
import { useComparison } from '../../context/ComparisonContext';
import { doc, onSnapshot } from 'firebase/firestore';
import SEO from '../../components/SEO';
import { calculateUnitPrice } from '../../smartcart/priceNormalization';
import { Link } from 'react-router-dom';

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
                               term.split(' ').some(word => word.length > 3 && lowerName.includes(word));
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
                       termWords.some(word => lowerName.includes(word));
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
                    <h1 className="text-2xl font-black text-[var(--text-main)] mb-2 tracking-tighter">Feature Temporarily Unavailable</h1>
                    <p className="text-[var(--text-muted)] font-medium mb-8">
                        The price comparison tool is currently disabled for maintenance. Please check back later.
                    </p>
                    <Link to="/" className="inline-flex items-center justify-center px-8 py-3 bg-[var(--brand-primary)] text-white font-bold rounded-xl hover:shadow-lg transition-all active:scale-95">
                        Return to Marketplace
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in pb-20 bg-[var(--surface-1)] min-h-screen">
            <SEO title="Compare My List" description="Compare flyer deals for the items on your wishlist." path="/compare" />

            {/* Header */}
            <div className="bg-[var(--surface-0)] border-b border-[var(--glass-border)] sticky top-0 z-30 px-4 py-6 backdrop-blur-md bg-white/90">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 max-w-xl">
                        <h1 className="text-2xl font-black text-[var(--text-main)] flex items-center gap-2 tracking-tighter">
                            <span className="text-3xl">⚖️</span> Compare My List
                        </h1>
                        <p className="text-sm text-[var(--text-muted)] font-medium mt-1">
                            Finding deals for the items on your wishlist. <span className="text-blue-600 bg-blue-50 px-1 rounded">Note:</span> This information is sourced directly from public grocery flyers to help you compare prices. <strong className="text-[var(--text-main)]">Items shown here are for comparison only and cannot be ordered through the platform.</strong>
                        </p>
                    </div>
                </div>
            </div>

            <main className="max-w-5xl mx-auto py-8 px-4 space-y-8">
                {wishlistItems.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-[var(--glass-border)] shadow-sm">
                        <span className="text-5xl mb-4 block">📋</span>
                        <h3 className="text-xl font-bold text-[var(--text-main)] mb-2">Your wishlist is empty</h3>
                        <p className="text-[var(--text-muted)] font-medium mb-6">Add items to your wishlist to compare flyer prices.</p>
                        <Link to="/profile" state={{ activeTab: 'wishlist' }} className="px-6 py-3 bg-[var(--brand-primary)] text-white font-bold rounded-xl hover:bg-[var(--brand-primary)]/90 transition-colors">
                            Manage Wishlist
                        </Link>
                    </div>
                ) : loading ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50">
                        <div className="w-12 h-12 border-4 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="font-bold text-[var(--text-main)] animate-pulse">Scanning flyers for your items...</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {groupedDeals.map(group => (
                            <div key={group.wishlistItem.id} className="bg-white rounded-3xl border border-[var(--glass-border)] shadow-sm overflow-hidden">
                                <div className="bg-[var(--surface-1)] px-6 py-4 border-b border-[var(--glass-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center overflow-hidden border border-[var(--glass-border)] shrink-0">
                                            {group.wishlistItem.image ? (
                                                <img src={group.wishlistItem.image} alt={group.wishlistItem.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-2xl">📦</span>
                                            )}
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-black text-[var(--text-main)] leading-tight">{group.wishlistItem.name}</h2>
                                            <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">{group.wishlistItem.category || 'Item'}</p>
                                        </div>
                                    </div>
                                    <div className="shrink-0">
                                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${group.deals.length > 0 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                                            {group.deals.length} flyer deal{group.deals.length !== 1 ? 's' : ''} found
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="p-6">
                                    {group.deals.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {group.deals.map((deal: any, i: number) => {
                                                const isBest = i === 0;
                                                return (
                                                    <div key={i} className={`flex flex-col p-3 rounded-2xl border ${isBest ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-[var(--surface-0)] border-[var(--glass-border)] hover:border-gray-300'} transition-colors`}>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                {isBest && <span className="text-sm">🏆</span>}
                                                                <span className={`text-sm font-bold truncate ${isBest ? 'text-emerald-800' : 'text-[var(--text-main)]'}`}>
                                                                    {deal.retailer}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1 shrink-0 pl-2">
                                                                {deal.prePriceText && <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">{deal.prePriceText}</span>}
                                                                <span className={`text-xl font-black tracking-tight ${isBest ? 'text-emerald-600' : 'text-[var(--text-main)]'}`}>
                                                                    {deal.currentPrice ? `$${parseFloat(deal.currentPrice).toFixed(2)}` : deal.priceText}
                                                                </span>
                                                                {deal.postPriceText && <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">{deal.postPriceText}</span>}
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex gap-3 border-t border-black/5 pt-2 mt-auto">
                                                            {deal.imageUrl && (
                                                                <div className="w-12 h-12 shrink-0 bg-white rounded-lg border border-[var(--glass-border)] flex items-center justify-center p-1">
                                                                    <img src={deal.imageUrl} alt={deal.name} className="max-w-full max-h-full object-contain mix-blend-multiply" />
                                                                </div>
                                                            )}
                                                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <p className="text-[11px] text-[var(--text-muted)] font-medium line-clamp-2">{deal.name}</p>
                                                                    {(() => {
                                                                        const price = parseDealPrice(deal);
                                                                        if (price >= 9999) return null;
                                                                        const unitPrice = calculateUnitPrice({ price, packageSize: deal.name || deal.description || '' });
                                                                        if (!unitPrice) return null;
                                                                        return (
                                                                            <div className={`shrink-0 px-2 py-0.5 rounded bg-white border border-black/5 text-[10px] font-bold ${isBest ? 'text-emerald-700' : 'text-[var(--text-muted)]'}`}>
                                                                                ${unitPrice.pricePerComparisonUnit.toFixed(2)}/{unitPrice.comparisonUnit}
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </div>
                                                                {deal.validTo && (
                                                                    <p className="text-[9px] font-bold text-red-500 mt-1">
                                                                        Ends {new Date(deal.validTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 px-4 bg-[var(--surface-0)] rounded-2xl border border-dashed border-[var(--glass-border)]">
                                            <p className="text-sm font-bold text-[var(--text-muted)] mb-1">No matches in current flyers</p>
                                            <p className="text-[11px] text-gray-400">Try checking back next Thursday when new flyers are released.</p>
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
