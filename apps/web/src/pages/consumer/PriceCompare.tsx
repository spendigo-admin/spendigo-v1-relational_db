import React, { useEffect, useState, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { useWishlist } from '../../context/WishlistContext';
import SEO from '../../components/SEO';

const PriceCompare = () => {
    const [deals, setDeals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilters, setActiveFilters] = useState<string[]>([]);
    const [isComparingList, setIsComparingList] = useState(false);
    const { items: wishlistItems } = useWishlist();
    
    const QUICK_FILTERS = ['Milk', 'Cheese', 'Bread', 'Eggs', 'Meat', 'Produce', 'Snacks', 'Coffee'];

    const toggleFilter = (filter: string) => {
        setActiveFilters(prev => 
            prev.includes(filter) 
                ? prev.filter(f => f !== filter)
                : [...prev, filter]
        );
    };

    useEffect(() => {
        const fetchDeals = async () => {
            const listTerms = isComparingList ? wishlistItems.map(i => i.name) : [];
            
            setLoading(true);
            try {
                const searchFn = httpsCallable(functions, 'searchPublicDeals');
                const result = await searchFn({ searchTerm, filters: activeFilters, listTerms });
                const data: any = result.data;
                setDeals(data.deals || []);
            } catch (err) {
                console.error("Error searching public deals:", err);
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchDeals();
        }, 600); // 600ms debounce

        return () => clearTimeout(timeoutId);
    }, [searchTerm, activeFilters, isComparingList, wishlistItems]);

    // Grouping logic using Jaccard Similarity for fuzzy matching
    const { comparisons, singles } = useMemo(() => {
        const processedDeals = deals.map(deal => {
            if (!deal.name) return null;
            // Normalize: lower case, remove punctuation, normalize sizes (e.g., "2 L" -> "2l")
            let normalized = deal.name.toLowerCase()
                .replace(/\b(\d+)\s+(g|kg|ml|l|lb|oz)\b/g, '$1$2')
                .replace(/[^\w\s]/gi, ' ')
                .replace(/\s+/g, ' ')
                .trim();
                
            // Basic singularize (e.g. cucumbers -> cucumber)
            normalized = normalized.split(' ').map((w: string) => {
                if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) {
                    return w.slice(0, -1);
                }
                return w;
            }).join(' ');

            return { ...deal, normalized };
        }).filter(Boolean);

        const groups: any[][] = [];
        const SIMILARITY_THRESHOLD = 0.55; // 55% word overlap required to group

        processedDeals.forEach(deal => {
            let placed = false;
            for (const group of groups) {
                const groupRep = group[0].normalized;
                
                // Calculate Jaccard similarity (word overlap)
                const set1 = new Set(deal.normalized.split(' '));
                const set2 = new Set(groupRep.split(' '));
                const intersection = new Set([...set1].filter(x => set2.has(x)));
                const union = new Set([...set1, ...set2]);
                const similarity = intersection.size / union.size;
                
                // Strict Quantity/Number Check: If both items mention numbers (e.g., 40s vs 125 pack), they MUST share a number
                const extractNumbers = (str: string): string[] => str.match(/\d+(?:\.\d+)?/g) || [];
                const nums1 = extractNumbers(deal.name);
                const nums2 = extractNumbers(group[0].name);
                let numberMatch = true;
                if (nums1.length > 0 && nums2.length > 0) {
                    const sharedNumbers = nums1.filter((n: string) => nums2.includes(n));
                    if (sharedNumbers.length === 0) {
                        numberMatch = false;
                    }
                }
                
                if (similarity >= SIMILARITY_THRESHOLD && numberMatch) {
                    group.push(deal);
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                groups.push([deal]);
            }
        });

        const comparisonsList: any[] = [];
        const singlesList: any[] = [];

        groups.forEach((items) => {
            // Deduplicate by retailer, keeping the cheapest option if multiple exist
            const uniqueRetailers = new Map();
            items.forEach(item => {
                const current = uniqueRetailers.get(item.retailer);
                const parsePrice = (d: any) => parseFloat(d.currentPrice || (d.priceText && typeof d.priceText === 'string' ? d.priceText.replace(/[^0-9.]/g, '') : '9999'));
                
                if (!current) {
                    uniqueRetailers.set(item.retailer, item);
                } else {
                    if (parsePrice(item) < parsePrice(current)) {
                        uniqueRetailers.set(item.retailer, item);
                    }
                }
            });

            const uniqueItems = Array.from(uniqueRetailers.values());

            if (uniqueItems.length > 1) {
                uniqueItems.sort((a, b) => {
                    const parsePrice = (d: any) => parseFloat(d.currentPrice || (d.priceText && typeof d.priceText === 'string' ? d.priceText.replace(/[^0-9.]/g, '') : '9999'));
                    return parsePrice(a) - parsePrice(b);
                });

                const parsePrice = (d: any) => parseFloat(d.currentPrice || (d.priceText && typeof d.priceText === 'string' ? d.priceText.replace(/[^0-9.]/g, '') : '9999'));
                const bestPriceVal = parsePrice(uniqueItems[0]);
                const worstPriceVal = parsePrice(uniqueItems[uniqueItems.length - 1]);
                const savings = worstPriceVal > bestPriceVal && worstPriceVal !== 9999 ? (worstPriceVal - bestPriceVal).toFixed(2) : null;

                comparisonsList.push({
                    originalName: items[0].name, // Keep the most accurate name
                    normalizedName: items[0].normalized,
                    items: uniqueItems,
                    bestPrice: uniqueItems[0].currentPrice || uniqueItems[0].priceText,
                    bestRetailer: uniqueItems[0].retailer,
                    imageUrl: uniqueItems.find(i => i.imageUrl)?.imageUrl,
                    savings
                });
            } else {
                singlesList.push(uniqueItems[0]);
            }
        });

        // Sort comparisons by savings (difference between highest and lowest)
        comparisonsList.sort((a, b) => {
            const parsePrice = (d: any) => parseFloat(d.currentPrice || (d.priceText && typeof d.priceText === 'string' ? d.priceText.replace(/[^0-9.]/g, '') : '0'));
            const savingsA = parsePrice(a.items[a.items.length - 1]) - parsePrice(a.items[0]);
            const savingsB = parsePrice(b.items[b.items.length - 1]) - parsePrice(b.items[0]);
            return savingsB - savingsA;
        });

        return { comparisons: comparisonsList, singles: singlesList };
    }, [deals]);

    return (
        <div className="animate-fade-in pb-20 bg-[var(--surface-1)] min-h-screen">
            <SEO title="Price Compare" description="Compare grocery deals across multiple flyers to find the best prices." path="/compare" />

            {/* Header */}
            <div className="bg-[var(--surface-0)] border-b border-[var(--glass-border)] sticky top-0 z-30 px-4 py-6 backdrop-blur-md bg-white/90">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 max-w-xl">
                        <h1 className="text-2xl font-black text-[var(--text-main)] flex items-center gap-2 tracking-tighter">
                            <span className="text-3xl">⚖️</span> Price Compare
                        </h1>
                        <p className="text-sm text-[var(--text-muted)] font-medium mt-1">
                            Search thousands of deals. <span className="text-blue-600 bg-blue-50 px-1 rounded">Note:</span> This information is sourced directly from public grocery flyers to help you compare prices. <strong className="text-[var(--text-main)]">Items shown here are for comparison only and cannot be ordered through the platform.</strong>
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:flex-none">
                            <input 
                                type="text" 
                                placeholder="Search products..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full md:w-64 pl-10 pr-4 py-2.5 bg-[var(--surface-2)] border border-[var(--glass-border)] rounded-xl text-sm font-bold text-[var(--text-main)] placeholder-[var(--text-muted)] focus:bg-white focus:ring-2 focus:ring-[var(--brand-primary)] outline-none transition-all"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">🔍</span>
                        </div>
                        {wishlistItems.length > 0 && (
                            <button
                                onClick={() => {
                                    setIsComparingList(!isComparingList);
                                    if (!isComparingList) {
                                        setSearchTerm('');
                                        setActiveFilters([]);
                                    }
                                }}
                                className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all border ${isComparingList ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-md' : 'bg-[var(--surface-2)] text-[var(--text-main)] border-[var(--glass-border)] hover:bg-white'}`}
                            >
                                📋 <span className="hidden md:inline">{isComparingList ? 'Clear List' : 'Compare My List'}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Quick Filters */}
                <div className="max-w-5xl mx-auto mt-4 flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                    {QUICK_FILTERS.map(filter => (
                        <button
                            key={filter}
                            onClick={() => toggleFilter(filter)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${activeFilters.includes(filter) ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-md' : 'bg-[var(--surface-1)] text-[var(--text-muted)] border-[var(--glass-border)] hover:bg-[var(--surface-2)]'}`}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>

            <main className="max-w-5xl mx-auto py-8 px-4 space-y-12">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50">
                        <div className="w-12 h-12 border-4 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="font-bold text-[var(--text-main)] animate-pulse">Aggregating thousands of deals...</p>
                    </div>
                ) : (
                    <>
                        {/* Comparisons Section */}
                        {comparisons.length > 0 && (
                            <section>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="h-8 w-1 bg-[var(--brand-primary)] rounded-full" />
                                    <h2 className="text-xl font-black text-[var(--text-main)]">Direct Comparisons</h2>
                                </div>
                                
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {comparisons.map((comp, idx) => (
                                        <div key={idx} className="bg-white rounded-3xl p-6 border border-[var(--glass-border)] shadow-sm hover:shadow-xl transition-all duration-300 group overflow-hidden relative">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />
                                            
                                            <div className="flex gap-4">
                                                {/* Image */}
                                                <div className="w-24 h-24 shrink-0 rounded-2xl bg-[var(--surface-1)] p-2 flex items-center justify-center border border-[var(--glass-border)]">
                                                    {comp.imageUrl ? (
                                                        <img src={comp.imageUrl} alt={comp.originalName} className="max-w-full max-h-full object-contain mix-blend-multiply" />
                                                    ) : (
                                                        <span className="text-3xl opacity-20">🏷️</span>
                                                    )}
                                                </div>
                                                
                                                {/* Details */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-4 mb-3">
                                                        <h3 className="font-bold text-[var(--text-main)] text-lg line-clamp-2 leading-tight">
                                                            {comp.originalName}
                                                        </h3>
                                                        {comp.savings && (
                                                            <div className="bg-emerald-100 text-emerald-800 text-xs font-black px-3 py-1 rounded-full whitespace-nowrap shrink-0 border border-emerald-200">
                                                                Save ${comp.savings}
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="space-y-2">
                                                        {comp.items.map((item: any, i: number) => {
                                                            const isBest = i === 0;
                                                            return (
                                                                    <div key={i} className={`flex flex-col p-2 rounded-xl border ${isBest ? 'bg-emerald-50 border-emerald-200' : 'bg-[var(--surface-0)] border-transparent'}`}>
                                                                        <div className="flex items-center justify-between mb-1">
                                                                            <div className="flex items-center gap-2 min-w-0">
                                                                                {isBest && <span className="text-xs">🏆</span>}
                                                                                <span className={`text-sm font-bold truncate ${isBest ? 'text-emerald-800' : 'text-[var(--text-main)]'}`}>
                                                                                    {item.retailer}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex items-center gap-2 shrink-0 pl-2">
                                                                                {item.prePriceText && <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">{item.prePriceText}</span>}
                                                                                <span className={`text-base font-black tracking-tight ${isBest ? 'text-emerald-600' : 'text-[var(--text-main)]'}`}>
                                                                                    {item.currentPrice ? `$${item.currentPrice}` : item.priceText}
                                                                                </span>
                                                                                {item.postPriceText && <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">{item.postPriceText}</span>}
                                                                            </div>
                                                                        </div>
                                                                        <div className="ml-6 flex flex-col gap-0.5">
                                                                            <p className="text-[10px] text-[var(--text-main)] font-medium line-clamp-1">{item.name}</p>
                                                                            {item.description && (
                                                                                <p className="text-[9px] text-[var(--text-muted)] line-clamp-1">{item.description}</p>
                                                                            )}
                                                                            {item.validTo && (
                                                                                <p className="text-[9px] font-bold text-red-500">
                                                                                    Ends {new Date(item.validTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Singles Section (Hidden by default to focus on Direct Comparisons unless searching) */}
                        {(searchTerm || activeFilters.length > 0 || isComparingList) && singles.length > 0 && (
                            <section className="pt-8 border-t border-[var(--glass-border)]">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="h-8 w-1 bg-blue-500 rounded-full" />
                                    <h2 className="text-xl font-black text-[var(--text-main)]">Unique Flyer Deals</h2>
                                </div>
                                
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {singles.slice(0, 100).map((deal: any, idx: number) => (
                                        <div key={idx} className="bg-white rounded-2xl border border-[var(--glass-border)] overflow-hidden hover:shadow-lg transition-all group flex flex-col">
                                            <div className="h-32 bg-[var(--surface-1)] p-4 flex items-center justify-center relative">
                                                {deal.imageUrl ? (
                                                    <img src={deal.imageUrl} alt={deal.name} className="max-w-full max-h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform" />
                                                ) : (
                                                    <span className="text-4xl opacity-20">🏷️</span>
                                                )}
                                                <div className="absolute top-2 left-2 bg-white/90 backdrop-blur text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded shadow-sm border border-[var(--glass-border)]">
                                                    {deal.retailer}
                                                </div>
                                            </div>
                                            <div className="p-3 flex flex-col flex-1">
                                                <p className="text-xs font-bold text-[var(--text-main)] line-clamp-2 mb-1 group-hover:text-[var(--brand-primary)] transition-colors">{deal.name}</p>
                                                {deal.description && <p className="text-[10px] text-[var(--text-muted)] line-clamp-1 mb-1">{deal.description}</p>}
                                                {deal.validTo && (
                                                    <p className="text-[9px] font-bold text-red-500 mb-2">
                                                        Ends {new Date(deal.validTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                    </p>
                                                )}
                                                <div className="mt-auto flex items-baseline gap-1">
                                                    {deal.prePriceText && <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{deal.prePriceText}</span>}
                                                    <span className="text-lg font-black text-[var(--brand-primary)] tracking-tight">
                                                        {deal.currentPrice ? `$${deal.currentPrice}` : deal.priceText}
                                                    </span>
                                                    {deal.postPriceText && <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{deal.postPriceText}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {singles.length > 100 && (
                                    <div className="text-center mt-8">
                                        <p className="text-sm font-bold text-[var(--text-muted)]">Showing 100 of {singles.length} unique deals. Refine search to see more.</p>
                                    </div>
                                )}
                            </section>
                        )}

                        {comparisons.length === 0 && singles.length === 0 && !loading && (
                            <div className="text-center py-20">
                                <span className="text-5xl opacity-50 mb-4 block">🔍</span>
                                <h3 className="text-xl font-bold text-[var(--text-main)] mb-2">No deals found</h3>
                                <p className="text-[var(--text-muted)] font-medium">Try adjusting your search terms or running the ingestion scraper from the Admin Dashboard.</p>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default PriceCompare;
