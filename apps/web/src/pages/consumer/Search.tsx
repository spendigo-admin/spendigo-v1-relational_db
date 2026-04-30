import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useCatalog } from '../../hooks/useCatalog';
import { useLocation } from '../../context/LocationContext';
import { useDebounce } from '../../hooks/useDebounce';
import SEO from '../../components/SEO';

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



    // Sync URL parameter if submitted search query changes
    useEffect(() => {
        if (activeSearchQuery !== initialQuery) {
            if (activeSearchQuery) {
                setSearchParams({ q: activeSearchQuery }, { replace: true });
            } else {
                setSearchParams({}, { replace: true });
            }
        }
    }, [activeSearchQuery, setSearchParams, initialQuery]);

    const filteredProducts = useMemo(() => {
        let results = allProducts;

        // Filter by store distance
        if (userCoords && searchDistance > 0) {
            results = results.filter(p => {
                const store = stores[p.storeId];
                if (!store || !store.coordinates) return false;
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand-primary)]"></div>
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
                    <form
                        className="flex gap-3"
                        onSubmit={(e) => { 
                            e.preventDefault(); 
                            (document.activeElement as HTMLElement)?.blur(); 
                            setActiveSearchQuery(searchQuery.trim());
                        }}
                    >
                        <div className="relative flex-1 group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-gray-400 group-focus-within:text-[var(--brand-primary)] transition-colors">🔍</span>
                            <input
                                type="text"
                                inputMode="search"
                                enterKeyHint="search"
                                placeholder="What are you looking for today?"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-10 py-4 bg-white/60 backdrop-blur-md border-2 border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.03)] rounded-2xl text-[var(--text-main)] font-medium placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[var(--brand-primary)]/10 focus:border-[var(--brand-primary)] focus:bg-white transition-all duration-300"
                                autoFocus
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setActiveSearchQuery('');
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-gray-200 rounded-full text-xs text-gray-600 hover:bg-gray-300 transition-colors"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                        <button 
                            type="submit" 
                            className="hidden md:flex items-center justify-center px-8 py-4 bg-gradient-to-br from-[var(--brand-primary)] to-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 active:scale-95 transition-all duration-300 whitespace-nowrap"
                        >
                            Search
                        </button>
                    </form>

                    {/* Category Filters */}
                    <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 md:mx-0 md:px-0 mask-image-linear-edge">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-300 transform active:scale-95 hover:-translate-y-0.5 border ${
                                    selectedCategory === cat 
                                    ? 'bg-gray-900 border-gray-900 text-white shadow-md' 
                                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:shadow-sm hover:text-gray-900'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sort & Results Count */}
            <div className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between animate-fade-in-up">
                <p className="text-sm text-[var(--text-muted)]">
                    {filteredProducts.length} result{filteredProducts.length !== 1 ? 's' : ''}
                </p>
                <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as any)}
                    className="text-sm bg-transparent text-[var(--text-muted)] border-none cursor-pointer"
                >
                    <option value="relevance">Relevance</option>
                    <option value="price_low">Price: Low to High</option>
                    <option value="price_high">Price: High to Low</option>
                </select>
            </div>

            {/* Results */}
            <div className="max-w-5xl mx-auto px-4 space-y-12">
                {filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
                        <div className="relative w-32 h-32 mb-8">
                            <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-20"></div>
                            <div className="relative w-full h-full rounded-full bg-white flex items-center justify-center shadow-xl shadow-gray-200/50 border border-gray-100 animate-float">
                                <span className="text-6xl">🔍</span>
                            </div>
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">No products found</h3>
                        <p className="text-base text-gray-500 text-center max-w-sm">We couldn't find anything matching your search. Try a different term or check another category.</p>
                    </div>
                ) : (
                    Object.entries(groupedByStore).map(([storeName, products]) => (
                        <div key={storeName} className="animate-fade-in-up">
                            <div className="flex items-center gap-4 mb-6">
                                <h3 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                                    <span className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 text-2xl">🏪</span> 
                                    {storeName}
                                    <span className="text-sm font-semibold px-3 py-1 bg-gray-100 text-gray-600 rounded-full">{products.length}</span>
                                </h3>
                                <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent"></div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                                {products.map((product, index) => (
                                    <div key={product.id} 
                                         className="group bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-500 flex flex-col justify-between"
                                         style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                                    >
                                        <div onClick={() => navigate(`/product/${product.id}`)} className="aspect-[4/3] bg-gray-50 cursor-pointer overflow-hidden relative">
                                            {product.discount && (
                                                <div className="absolute top-3 left-3 z-20 px-2.5 py-1 bg-red-500 text-white text-xs font-black tracking-wider rounded-lg shadow-lg">
                                                    {product.discount}
                                                </div>
                                            )}
                                            <div className="absolute bottom-3 left-3 z-20 px-2.5 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold tracking-wider rounded-lg shadow-sm border border-white/20 flex items-center gap-1.5">
                                                <span className="text-[10px]">🏪</span> {storeName}
                                            </div>
                                            <div className="absolute inset-0 bg-black/5 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                            <img src={product.image} alt={product.name} className="w-full h-full object-contain p-4 transform group-hover:scale-110 transition-transform duration-700 ease-out mix-blend-multiply" />
                                        </div>
                                        <div className="p-4 md:p-5 flex flex-col flex-grow">
                                            <div className="flex-grow">
                                                <p className="font-bold text-sm md:text-base text-gray-900 line-clamp-2 leading-tight group-hover:text-[var(--brand-primary)] transition-colors">{product.name}</p>
                                                {product.is_canadian_local && (
                                                    <span className="inline-flex mt-2 px-2 py-1 bg-red-50 text-red-700 text-[10px] md:text-xs font-bold rounded-md shadow-sm border border-red-100 uppercase items-center gap-1.5 w-max">
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
                                                        className="w-full md:w-auto px-5 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl transform active:scale-95 hover:bg-[var(--brand-primary)] hover:shadow-lg hover:shadow-[var(--brand-primary)]/20 transition-all duration-300"
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
