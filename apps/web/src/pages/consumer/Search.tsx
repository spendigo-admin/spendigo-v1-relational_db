import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useCatalog } from '../../hooks/useCatalog';
import { useLocation } from '../../context/LocationContext';
import { useDebounce } from '../../hooks/useDebounce';
import SEO from '../../components/SEO';
import { EmptyState } from '../../components/ui/EmptyState';

const Search: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { addToCart } = useCart();
    const { stores } = useMarketplace();
    const { userCoords, userPostalCode, searchDistance, calculateDistance } = useLocation();

    const initialQuery = searchParams.get('q') || '';
    const [searchQuery, setSearchQuery] = useState(initialQuery);
    const [activeSearchQuery, setActiveSearchQuery] = useState(initialQuery);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [sortBy, setSortBy] = useState<'relevance' | 'price_low' | 'price_high'>('relevance');

    // Use new global catalog search using the submitted active query
    const { useGlobalCatalog } = useCatalog();
    const { products: allProducts, loading } = useGlobalCatalog(activeSearchQuery, userCoords || undefined, searchDistance);

    // Derived categories
    const categories = useMemo(() => {
        return ['All', ...Array.from(new Set(allProducts.map(p => p.category))).sort()];
    }, [allProducts]);



    // Sync with URL parameter
    useEffect(() => {
        setActiveSearchQuery(initialQuery);
        setSearchQuery(initialQuery);
    }, [initialQuery]);

    const filteredProducts = useMemo(() => {
        let results = allProducts;

        // Filter by store distance
        if (userCoords && searchDistance > 0) {
            results = results.filter(p => {
                const store = stores[p.storeId];
                if (!store || store.status !== 'active' || !store.coordinates) return false;
                const distance = calculateDistance(userCoords.lat, userCoords.lng, store.coordinates.lat, store.coordinates.lng);
                if (distance <= searchDistance) return true;
                
                if (userPostalCode && store.postalCode) {
                    const userFSA = userPostalCode.trim().substring(0, 3).toUpperCase();
                    const storeFSA = store.postalCode.trim().substring(0, 3).toUpperCase();
                    if (userFSA === storeFSA && /^[A-Z]\d[A-Z]$/.test(userFSA)) {
                        return true;
                    }
                }
                
                return false;
            });
        }

        // Note: We do NOT filter by text here because useGlobalCatalog already returned
        // the relevant results from Algolia (which handles fuzzy/brand matching).
        // If we filter again here using .includes(), we break the fuzzy/brand logic.

        // Filter by category
        if (selectedCategory !== 'All') {
            results = results.filter(p => p.category === selectedCategory);
        }

        // Sort
        if (sortBy === 'price_low') {
            results = [...results].sort((a, b) => a.price - b.price);
        } else if (sortBy === 'price_high') {
            results = [...results].sort((a, b) => b.price - a.price);
        }

        return results;
    }, [searchQuery, selectedCategory, sortBy, allProducts, stores, userCoords, userPostalCode, searchDistance, calculateDistance]);

    // Group by store
    const groupedByStore = useMemo(() => {
        const groups: Record<string, typeof allProducts> = {};
        filteredProducts.forEach(product => {
            const actualStoreName = stores[product.storeId]?.name || product.storeName || 'Unknown Store';
            if (!groups[actualStoreName]) {
                groups[actualStoreName] = [];
            }
            groups[actualStoreName].push(product);
        });
        return groups;
    }, [filteredProducts, stores]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#007AFF]"></div>
            </div>
        );
    }

    const handleQuickAdd = (product: any) => {
        const actualStoreName = stores[product.storeId]?.name || product.storeName;
        addToCart({
            productId: product.id,
            productName: product.name,
            price: product.price,
            quantity: 1,
            storeId: product.storeId,
            storeName: actualStoreName,
            image: product.image,
            is_canadian_local: product.is_canadian_local
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-24">
            <SEO title="Search Products" description="Search across all local grocery stores on Spendigo. Find the best prices and compare products." path="/search" />
            
            {/* Search Header - Sticky & Glassmorphic */}
            <div className="sticky top-14 z-30 bg-white/70 backdrop-blur-2xl border-b border-gray-200/50 p-4 shadow-[0_4px_30px_rgba(0,0,0,0.03)] transition-all duration-300">
                <div className="max-w-5xl mx-auto">
                    {activeSearchQuery && (
                        <div className="flex items-center gap-3 bg-[var(--surface-1)] rounded-2xl px-4 py-3 border border-[var(--glass-border)] shadow-inner">
                            <svg className="w-5 h-5 text-[var(--brand-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input
                                type="text"
                                placeholder="Search fresh items, local brands..."
                                className="bg-transparent border-none outline-none flex-1 text-sm font-bold text-[var(--brand-navy)] placeholder:text-[var(--text-muted)]"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    )}
                    <div className="flex gap-2 overflow-x-auto mt-4 scrollbar-hide pb-1">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border ${selectedCategory === cat ? 'bg-[var(--brand-navy)] text-white border-[var(--brand-navy)] shadow-lg' : 'bg-white text-[var(--text-muted)] border-[var(--glass-border)] hover:border-[var(--brand-primary)]'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between">
                <p className="text-sm font-bold text-[var(--text-muted)]">
                    {filteredProducts.length} result{filteredProducts.length !== 1 ? 's' : ''}
                </p>
                <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as any)}
                    className="text-sm font-bold bg-transparent text-[var(--brand-navy)] border-none cursor-pointer outline-none"
                >
                    <option value="relevance">Relevance</option>
                    <option value="price_low">Price: Low to High</option>
                    <option value="price_high">Price: High to Low</option>
                </select>
            </div>

            <div className="max-w-5xl mx-auto px-4 space-y-12">
                {filteredProducts.length === 0 ? (
                    <EmptyState
                        icon="🔍"
                        heading="No products found"
                        subtext="We couldn't find anything matching your search."
                    />
                ) : (
                    Object.entries(groupedByStore).map(([storeName, products]) => (
                        <div key={storeName} className="animate-fade-in-up">
                             <div className="flex items-center gap-4 mb-6">
                                <h3 className="text-xl font-black text-[var(--brand-navy)] flex items-center gap-3">
                                    {storeName}
                                </h3>
                                <div className="flex-1 h-px bg-[var(--glass-border)]"></div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {products.map((product, index) => (
                                    <div key={product.id} 
                                         className="group bg-white rounded-3xl border border-[var(--glass-border)] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col"
                                    >
                                        <div onClick={() => navigate(`/product/${product.id}`)} className="aspect-[4/3] bg-gray-50 cursor-pointer overflow-hidden relative">
                                            <img src={product.image} alt={product.name} className="w-full h-full object-contain group-hover:scale-105 transition-all duration-700" />
                                        </div>
                                        <div className="p-4 md:p-5 flex flex-col flex-grow">
                                            <div className="flex-grow">
                                                <p className="font-bold text-sm md:text-base text-[#112244] line-clamp-2 leading-tight group-hover:text-[#007AFF] transition-colors">{product.name}</p>
                                                {product.is_canadian_local && (
                                                    <span className="inline-flex mt-2 px-2 py-0.5 bg-red-50 text-red-700 text-xs font-semibold rounded-md border border-red-100 items-center gap-1 w-max">
                                                        <span>🍁</span> Local
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-gray-100">
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-0">
                                                    <div className="flex flex-col">
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="font-black text-xl text-gray-900">${product.price.toFixed(2)}</span>
                                                            {product.originalPrice && (
                                                                <span className="text-xs md:text-sm font-semibold text-gray-400 line-through">${product.originalPrice.toFixed(2)}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button onClick={(e) => { e.stopPropagation(); handleQuickAdd(product); }} 
                                                        className="w-full md:w-auto px-5 py-3 md:py-2.5 bg-[#112244] text-white text-xs font-black uppercase tracking-widest rounded-xl transform active:scale-95 hover:bg-black hover:shadow-lg shadow-blue-500/10 transition-all duration-300"
                                                    >
                                                        Add
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Search;
