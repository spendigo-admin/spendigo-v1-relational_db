import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { STORE_DATA } from '../../data/productData';
import '../../styles/design-system.css';

// Build all products from STORE_DATA
const buildAllProducts = () => {
    const products: Array<{
        id: string;
        name: string;
        price: number;
        originalPrice?: number;
        storeId: string;
        storeName: string;
        category: string;
        image: string;
    }> = [];

    Object.values(STORE_DATA).forEach((store: any) => {
        store.products?.forEach((product: any) => {
            products.push({
                id: product.id,
                name: product.name,
                price: product.price,
                originalPrice: product.originalPrice,
                storeId: store.id,
                storeName: store.name,
                category: product.category,
                image: product.image
            });
        });
    });

    return products;
};

const ALL_PRODUCTS = buildAllProducts();

// Extract unique categories from products
const CATEGORIES = ['All', ...Array.from(new Set(ALL_PRODUCTS.map(p => p.category))).sort()];

const Search: React.FC = () => {
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [sortBy, setSortBy] = useState<'relevance' | 'price_low' | 'price_high'>('relevance');

    // Read query parameter from URL on mount
    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const query = params.get('q');
        if (query) {
            setSearchQuery(query);
        }
    }, []);

    const filteredProducts = useMemo(() => {
        let results = ALL_PRODUCTS;

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            results = results.filter(p =>
                p.name.toLowerCase().includes(query) ||
                p.category.toLowerCase().includes(query) ||
                p.storeName.toLowerCase().includes(query)
            );
        }

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
    }, [searchQuery, selectedCategory, sortBy]);

    // Group by store
    const groupedByStore = useMemo(() => {
        const groups: Record<string, typeof ALL_PRODUCTS> = {};
        filteredProducts.forEach(product => {
            if (!groups[product.storeName]) {
                groups[product.storeName] = [];
            }
            groups[product.storeName].push(product);
        });
        return groups;
    }, [filteredProducts]);

    const handleQuickAdd = (product: typeof ALL_PRODUCTS[0]) => {
        addToCart({
            productId: product.id,
            productName: product.name,
            price: product.price,
            quantity: 1,
            storeId: product.storeId,
            storeName: product.storeName,
            image: product.image
        });
    };

    return (
        <div className="animate-fade-in pb-20">
            {/* Search Header */}
            <div className="sticky top-14 z-30 bg-white border-b border-[var(--glass-border)] p-4">
                <div className="max-w-3xl mx-auto">
                    <form
                        className="relative"
                        onSubmit={(e) => { e.preventDefault(); (document.activeElement as HTMLElement)?.blur(); }}
                    >
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">🔍</span>
                        <input
                            type="text"
                            inputMode="search"
                            enterKeyHint="search"
                            placeholder="Search products..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-10 py-3 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-xl text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--brand-primary)]"
                            autoFocus
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-gray-200 rounded-full text-xs text-gray-600 hover:bg-gray-300 transition-colors"
                            >
                                ✕
                            </button>
                        )}
                    </form>

                    {/* Category Filters */}
                    <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${selectedCategory === cat ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
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
                    <div className="text-center py-16">
                        <p className="text-5xl mb-4">🔍</p>
                        <p className="text-lg font-medium text-[var(--text-main)]">No products found</p>
                        <p className="text-sm text-[var(--text-muted)]">Try a different search term or category</p>
                    </div>
                ) : (
                    Object.entries(groupedByStore).map(([storeName, products]) => (
                        <div key={storeName}>
                            <h3 className="text-lg font-bold text-[var(--text-main)] mb-3 flex items-center gap-2">
                                <span className="text-xl">🏪</span> {storeName}
                                <span className="text-sm font-normal text-[var(--text-muted)]">({products.length})</span>
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {products.map(product => (
                                    <div key={product.id} className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden shadow-sm">
                                        <div onClick={() => navigate(`/product/${product.id}`)} className="h-28 bg-[var(--surface-1)] cursor-pointer">
                                            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="p-3">
                                            <p className="font-medium text-sm text-[var(--text-main)] truncate">{product.name}</p>
                                            <div className="flex items-baseline gap-2 mt-1">
                                                <span className="font-bold text-[var(--brand-primary)]">${product.price.toFixed(2)}</span>
                                                {product.originalPrice && (
                                                    <span className="text-xs text-[var(--text-muted)] line-through">${product.originalPrice.toFixed(2)}</span>
                                                )}
                                            </div>
                                            <button onClick={() => handleQuickAdd(product)} className="w-full mt-2 py-2 bg-[var(--brand-primary)] text-white text-xs font-medium rounded-lg">
                                                + Add
                                            </button>
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
