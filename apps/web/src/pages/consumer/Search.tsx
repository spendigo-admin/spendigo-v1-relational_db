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
            const sName = product.storeName || 'Unknown Store';
            if (!groups[sName]) {
                groups[sName] = [];
            }
            groups[sName].push(product);
        });
        return groups;
    }, [filteredProducts]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand-primary)]"></div>
            </div>
        );
    }

    const handleQuickAdd = (product: any) => {
        addToCart({
            productId: product.id,
            productName: product.name,
            price: product.price,
            quantity: 1,
            storeId: product.storeId,
            storeName: product.storeName,
            image: product.image,
            is_canadian_local: product.is_canadian_local
        });
    };

    return (
        <div className="animate-fade-in pb-20">
            <SEO title="Search Products" description="Search across all local grocery stores on Spendigo. Find the best prices and compare products." path="/search" />
            {/* Search Header */}
            <div className="sticky top-14 z-30 bg-white/80 backdrop-blur-xl border-b border-[var(--glass-border)] p-4 shadow-sm transition-all duration-300">
                <div className="max-w-3xl mx-auto">
                    <form
                        className="flex gap-2"
                        onSubmit={(e) => { 
                            e.preventDefault(); 
                            (document.activeElement as HTMLElement)?.blur(); 
                            setActiveSearchQuery(searchQuery.trim());
                        }}
                    >
                        <div className="relative flex-1">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">🔍</span>
                            <input
                                type="text"
                                inputMode="search"
                                enterKeyHint="search"
                                placeholder="Search products..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-10 py-3.5 bg-white/50 backdrop-blur-sm border border-[var(--glass-border)] rounded-2xl text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/50 focus:border-[var(--brand-primary)] shadow-inner transition-all duration-300"
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
                            className="hidden md:block px-6 py-3.5 bg-gradient-to-r from-[var(--brand-primary)] to-blue-500 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all duration-300 whitespace-nowrap"
                        >
                            Search
                        </button>
                    </form>

                    {/* Category Filters */}
                    <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300 transform active:scale-95 hover:-translate-y-0.5 hover:shadow-md ${selectedCategory === cat ? 'bg-gradient-to-r from-[var(--brand-primary)] to-blue-500 text-white shadow-lg shadow-[var(--brand-primary)]/30' : 'bg-[var(--surface-1)] text-[var(--text-muted)] border border-[var(--glass-border)] hover:border-[var(--brand-primary)]/30'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sort & Results Count */}
            <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
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
            <div className="max-w-3xl mx-auto px-4 space-y-6">
                {filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                        <div className="w-24 h-24 mb-6 rounded-full bg-[var(--surface-1)] flex items-center justify-center animate-bounce shadow-inner border border-[var(--glass-border)]">
                            <span className="text-5xl">🔍</span>
                        </div>
                        <h3 className="text-xl font-bold text-[var(--text-main)] mb-2">No products found</h3>
                        <p className="text-sm text-[var(--text-muted)] text-center max-w-xs">We couldn't find anything matching your search. Try a different term or check another category.</p>
                    </div>
                ) : (
                    Object.entries(groupedByStore).map(([storeName, products]) => (
                        <div key={storeName}>
                            <h3 className="text-lg font-bold text-[var(--text-main)] mb-3 flex items-center gap-2">
                                <span className="text-xl">🏪</span> {storeName}
                                <span className="text-sm font-normal text-[var(--text-muted)]">({products.length})</span>
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                {products.map((product, index) => (
                                    <div key={product.id} 
                                         className="group bg-white rounded-2xl border border-[var(--glass-border)] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 flex flex-col justify-between"
                                         style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                                    >
                                        <div onClick={() => navigate(`/product/${product.id}`)} className="h-32 bg-[var(--surface-1)] cursor-pointer overflow-hidden relative">
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                            <img src={product.image} alt={product.name} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700 ease-out" />
                                        </div>
                                        <div className="p-3.5 flex flex-col flex-grow">
                                            <div className="flex-grow">
                                                <p className="font-semibold text-sm text-[var(--text-main)] line-clamp-2 leading-tight">{product.name}</p>
                                                {product.is_canadian_local && (
                                                    <span className="inline-flex mt-1.5 px-1.5 py-0.5 bg-red-50 text-red-700 text-[10px] font-bold rounded shadow-sm border border-red-100 uppercase items-center gap-1 w-max">
                                                        <span className="text-xs">🍁</span> Canadian Local
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-2">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="font-bold text-lg text-[var(--brand-primary)]">${product.price.toFixed(2)}</span>
                                                    {product.originalPrice && (
                                                        <span className="text-xs text-[var(--text-muted)] line-through">${product.originalPrice.toFixed(2)}</span>
                                                    )}
                                                </div>
                                                <button onClick={() => handleQuickAdd(product)} 
                                                    className="w-full mt-2.5 py-2.5 bg-gradient-to-r from-[var(--brand-primary)] to-[#3b82f6] text-white text-sm font-bold rounded-xl transform active:scale-95 hover:shadow-lg transition-all duration-300"
                                                >
                                                    + Add
                                                </button>
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
