import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useCatalog } from '../../hooks/useCatalog';
import { useStoreProducts } from '../../hooks/useStoreProducts'; // Standalone hook
import ReviewList from '../../components/ReviewList';
import ReviewForm from '../../components/ReviewForm';
import StarRating from '../../components/StarRating';
import { useReviews } from '../../context/ReviewContext';
import '../../styles/design-system.css';

import { useEffect } from 'react';

// New FlyerTab Component
const FlyerTab: React.FC<{ storeId: string; storeName: string; summary: any; viewMode: 'grid' | 'list' }> = ({ storeId, storeName, summary, viewMode }) => {
    const { subscribeToFlyers } = useMarketplace();
    const { addToCart } = useCart();
    const [flyer, setFlyer] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = subscribeToFlyers(storeId, (flyers) => {
            // Find active flyer (status=active OR if summary exists match it)
            // Simplified: Just take the first active one or the one matching summary
            const active = flyers.find(f => f.status === 'active') || flyers.find(f => f.title === summary?.title);
            setFlyer(active);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [storeId, subscribeToFlyers, summary]);

    const handleAdd = (item: any) => {
        addToCart({
            productId: item.productId,
            productName: item.name,
            price: item.salePrice,
            quantity: 1,
            storeId,
            storeName,
            image: item.image
        });
    };

    if (loading) return <div className="p-10 text-center text-gray-400">Loading flyer...</div>;

    if (!flyer) return (
        <div className="text-center py-10">
            <p className="text-4xl mb-4">📰</p>
            <p className="text-[var(--text-muted)]">No active flyer details found.</p>
        </div>
    );

    return (
        <div className="p-4 space-y-6">
            <div className="relative rounded-xl overflow-hidden shadow-sm h-48">
                <img src={flyer.coverImage} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">{flyer.title}</h2>
                        <p className="text-white/80 text-sm">Valid {new Date(flyer.validFrom).toLocaleDateString()} - {new Date(flyer.validUntil).toLocaleDateString()}</p>
                    </div>
                </div>
            </div>

            {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {flyer.items?.map((item: any, idx: number) => (
                        <div key={idx} className="bg-white rounded-xl border border-[var(--glass-border)] shadow-sm overflow-hidden group">
                            <div className="relative h-32 bg-gray-100">
                                <img src={item.image} className="w-full h-full object-cover" />
                                {item.salePrice < item.originalPrice && (
                                    <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        SAVE {Math.round(((item.originalPrice - item.salePrice) / item.originalPrice) * 100)}%
                                    </span>
                                )}
                            </div>
                            <div className="p-3">
                                <p className="font-bold text-sm text-[var(--text-main)] truncate">{item.name}</p>
                                <div className="flex items-baseline gap-2 mt-1 mb-3">
                                    <span className="text-lg font-bold text-[var(--brand-primary)]">${item.salePrice.toFixed(2)}</span>
                                    <span className="text-xs text-[var(--text-muted)] line-through">${item.originalPrice.toFixed(2)}</span>
                                </div>
                                <button
                                    onClick={() => handleAdd(item)}
                                    className="w-full py-2 bg-[var(--brand-primary)] text-white text-xs font-bold rounded-lg hover:brightness-110 active:scale-95 transition-all"
                                >
                                    + Add to Cart
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* List View */
                <div className="space-y-3">
                    {flyer.items?.map((item: any, idx: number) => (
                        <div key={idx} className="bg-white rounded-xl border border-[var(--glass-border)] p-3 flex gap-4 items-center shadow-sm">
                            <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0 relative overflow-hidden">
                                <img src={item.image} className="w-full h-full object-cover" />
                                {item.salePrice < item.originalPrice && (
                                    <span className="absolute top-0 left-0 bg-red-500 text-white text-[8px] font-bold px-1 rounded-br">-{Math.round(((item.originalPrice - item.salePrice) / item.originalPrice) * 100)}%</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-[var(--text-main)] truncate">{item.name}</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-sm font-bold text-[var(--brand-primary)]">${item.salePrice.toFixed(2)}</span>
                                    <span className="text-[10px] text-[var(--text-muted)] line-through">${item.originalPrice.toFixed(2)}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => handleAdd(item)}
                                className="px-4 py-2 bg-[var(--brand-primary)] text-white text-xs font-bold rounded-lg hover:brightness-110 active:scale-95 transition-all"
                            >
                                + Add
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {(!flyer.items || flyer.items.length === 0) && (
                <div className="text-center py-8 text-gray-500 italic">
                    This flyer has no items listed yet. Check the image above for details.
                </div>
            )}
        </div>
    );
};



// New OffersTab Component
const OffersTab: React.FC<{ storeId: string, storeName: string; viewMode: 'grid' | 'list' }> = ({ storeId, storeName, viewMode }) => {
    const { subscribeToDeals } = useMarketplace();
    const { addToCart } = useCart();
    const [deals, setDeals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = subscribeToDeals(storeId, (data) => {
            setDeals(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [storeId, subscribeToDeals]);

    const handleQuickAdd = (item: any) => {
        addToCart({
            productId: item.productId,
            productName: item.productName || item.name,
            price: item.salePrice,
            quantity: 1,
            storeId,
            storeName,
            image: item.productImage || item.image
        });
    };

    if (loading) return <div className="p-10 text-center text-[var(--text-muted)]">Loading deals...</div>;

    const oneDayOffers = deals.filter(d => d.status === 'active' && d.isFlashSale);
    const saleItems = deals.filter(d => d.status === 'active' && !d.isFlashSale);

    if (oneDayOffers.length === 0 && saleItems.length === 0) {
        return (
            <div className="text-center py-10">
                <p className="text-4xl mb-4">🍂</p>
                <p className="text-[var(--text-muted)]">No special deals available right now.</p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-6">
            {/* One Day Offers */}
            {oneDayOffers.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">⏰</span>
                        <h3 className="text-lg font-bold text-[var(--text-main)]">Flash Sales</h3>
                        <span className="ml-auto text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">Limited Time</span>
                    </div>

                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-2 gap-3">
                            {oneDayOffers.map((offer: any) => (
                                <div key={offer.id} className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border border-red-100 p-3">
                                    <img src={offer.productImage} alt={offer.productName} className="w-full h-24 object-cover rounded-lg mb-2 bg-white" />
                                    <p className="font-medium text-sm text-[var(--text-main)] truncate">{offer.productName}</p>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="font-bold text-red-600">${offer.salePrice.toFixed(2)}</span>
                                        {offer.originalPrice && (
                                            <span className="text-xs text-[var(--text-muted)] line-through">${offer.originalPrice.toFixed(2)}</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-red-500 mt-1">Ends {new Date(offer.endDate).toLocaleDateString()}</p>
                                    <button onClick={() => handleQuickAdd(offer)} className="w-full mt-2 py-2 bg-red-500 text-white text-xs font-medium rounded-lg hover:brightness-110">
                                        + Add
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* List View for Flash Sales */
                        <div className="space-y-2">
                            {oneDayOffers.map((offer: any) => (
                                <div key={offer.id} className="bg-gradient-to-l from-red-50 to-orange-50 rounded-xl border border-red-100 p-2 flex gap-3 items-center">
                                    <img src={offer.productImage} alt={offer.productName} className="w-12 h-12 object-cover rounded bg-white shadow-sm" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm text-[var(--text-main)] truncate">{offer.productName}</p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="font-bold text-red-600">${offer.salePrice.toFixed(2)}</span>
                                            <p className="text-[10px] text-red-500 uppercase font-bold">Flash</p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleQuickAdd(offer)} className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg shadow-sm">
                                        + Add
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Sale Items */}
            {saleItems.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">🏷️</span>
                        <h3 className="text-lg font-bold text-[var(--text-main)]">Items on Sale</h3>
                    </div>
                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-2 gap-3">
                            {saleItems.map((item: any) => (
                                <div key={item.id} className="bg-white rounded-xl border border-[var(--glass-border)] p-3 shadow-sm">
                                    <div className="relative">
                                        <img src={item.productImage} alt={item.productName} className="w-full h-24 object-cover rounded-lg mb-2" />
                                        {item.value && (
                                            <span className="absolute top-1 left-1 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                                                {item.type === 'percentage' ? `${item.value}% OFF` : 'SALE'}
                                            </span>
                                        )}
                                    </div>
                                    <p className="font-medium text-sm text-[var(--text-main)] truncate">{item.productName}</p>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="font-bold text-green-600">${item.salePrice.toFixed(2)}</span>
                                        <span className="text-xs text-[var(--text-muted)] line-through">${item.originalPrice.toFixed(2)}</span>
                                    </div>
                                    <button onClick={() => handleQuickAdd(item)} className="w-full mt-2 py-2 bg-[var(--brand-primary)] text-white text-xs font-medium rounded-lg hover:brightness-110">
                                        + Add
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* List View for Sale Items */
                        <div className="space-y-2">
                            {saleItems.map((item: any) => (
                                <div key={item.id} className="bg-white rounded-xl border border-[var(--glass-border)] p-2 flex gap-3 items-center shadow-sm">
                                    <div className="relative">
                                        <img src={item.productImage} alt={item.productName} className="w-12 h-12 object-cover rounded shadow-sm" />
                                        {item.value && (
                                            <span className="absolute -top-1 -left-1 bg-green-500 text-white text-[8px] font-bold px-1 rounded">
                                                {item.type === 'percentage' ? `${item.value}%` : 'SALE'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm text-[var(--text-main)] truncate">{item.productName}</p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="font-bold text-green-600 text-sm">${item.salePrice.toFixed(2)}</span>
                                            <span className="text-[10px] text-[var(--text-muted)] line-through">${item.originalPrice.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => handleQuickAdd(item)} className="px-3 py-1.5 bg-[var(--brand-primary)] text-white text-xs font-bold rounded-lg hover:brightness-110 active:scale-95 transition-all">
                                        + Add
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const StoreDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation(); // Add useLocation import
    const { addToCart } = useCart();
    const { getStore } = useMarketplace();
    const { reviews } = useReviews();

    const store = getStore(id || '') || null;
    const { products: catalogProducts, loading: loadingProducts } = useStoreProducts(id || '');

    // Check for initial tab in state
    const [activeTab, setActiveTab] = useState<'products' | 'flyer' | 'offers' | 'reviews'>((location.state as any)?.initialTab || 'products');
    const [activeCategory, setActiveCategory] = useState('All');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    if (!store) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <p className="text-4xl mb-4">🏪</p>
                    <p className="text-[var(--text-muted)] mb-4">Store not found.</p>
                    <button onClick={() => navigate('/')} className="text-[var(--brand-primary)] hover:underline">Return Home</button>
                </div>
            </div>
        );
    }

    // Merge or Override products
    // Only fallback to legacy if the store hasn't been migrated (indicated by missing productCount)
    // If productCount is 0, it means it's a migrated store with empty inventory, so show empty.
    const isMigrated = store.productCount !== undefined;
    const displayProducts = isMigrated ? catalogProducts : (catalogProducts.length > 0 ? catalogProducts : (store.products || []));

    const filteredProducts = activeCategory === 'All'
        ? displayProducts
        : displayProducts.filter((p: any) => {
            // map category ID to name if needed, or simple check
            // For now assuming category field matches or we need a map
            // The hook returns 'category' as 'cat-id', but UI expects 'Dairy'. 
            // We might need to fetch category map. For now let's just show all if name mismatch or fix in hook.
            // Simplified:
            return p.category === activeCategory || (p.category && p.category.includes(activeCategory));
        });

    const handleQuickAdd = (product: any) => {
        addToCart({
            productId: product.id,
            productName: product.name,
            price: product.price,
            quantity: 1,
            storeId: store.id,
            storeName: store.name,
            image: product.image
        });
    };

    return (
        <div className="animate-fade-in pb-20">
            {/* STORE HEADER */}
            <div className="relative h-48 md:h-64 bg-[var(--surface-2)]">
                <img src={store.image} alt={store.name} className="w-full h-full object-cover opacity-80" decoding="async" />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-0)] via-transparent to-transparent"></div>

                {/* Back Button */}
                <button
                    onClick={() => navigate('/')}
                    className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/90 shadow-lg text-[var(--text-main)] flex items-center justify-center hover:bg-white transition-colors"
                >
                    ←
                </button>

                {/* Store Info Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
                    <div className="flex items-end gap-4">
                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white border-2 border-[var(--glass-border)] flex items-center justify-center text-3xl md:text-4xl shadow-lg overflow-hidden">
                            {(store.logoUrl || store.logo || '').startsWith('http') ? (
                                <img src={store.logoUrl || store.logo} alt="Logo" className="w-full h-full object-cover" decoding="async" />
                            ) : (
                                <span>{store.logo || store.logoUrl || '🏪'}</span>
                            )}
                        </div>
                        <div className="flex-1">
                            <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-main)]">{store.name}</h1>
                            <p className="text-sm text-[var(--text-muted)]">{store.tagline}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* STORE STATS */}
            <div className="px-4 py-4 flex items-center gap-4 text-sm border-b border-[var(--glass-border)] overflow-x-auto">
                <div className="flex items-center gap-1 whitespace-nowrap">
                    <span className="text-yellow-500">★</span>
                    <span className="font-medium text-[var(--text-main)]">
                        {reviews.length > 0 
                            ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) 
                            : store.rating}
                    </span>
                </div>
                <div className="w-px h-4 bg-[var(--glass-border)]"></div>
                <div className="flex items-center gap-1 whitespace-nowrap">
                    <span>🚚</span>
                    <span className="text-[var(--text-muted)]">{store.deliveryTime}</span>
                </div>
                <div className="w-px h-4 bg-[var(--glass-border)]"></div>
                <div className="flex items-center gap-1 whitespace-nowrap">
                    <span>💰</span>
                    <span className="text-[var(--text-muted)]">{store.deliveryFee}</span>
                </div>
            </div>

            <div className="px-4 py-3 sticky top-14 z-40 bg-[var(--surface-0)] border-b border-[var(--glass-border)] flex items-center justify-between">
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('products')}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'products' ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
                    >
                        🛒 Products
                    </button>
                    <button
                        onClick={() => setActiveTab('flyer')}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'flyer' ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
                    >
                        📰 Weekly Flyer {store.flyer?.validUntil && '🔴'}
                    </button>
                    <button
                        onClick={() => setActiveTab('offers')}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'offers' ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
                    >
                        🔥 Deals {((store.oneDayOffers?.length || 0) + (store.saleItems?.length || 0) > 0) && '🔴'}
                    </button>
                    <button
                        onClick={() => setActiveTab('reviews')}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'reviews' ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
                    >
                        ⭐ Reviews
                    </button>
                </div>

                {/* Shared View Toggle UI */}
                {(activeTab === 'products' || activeTab === 'flyer' || activeTab === 'offers') && (
                    <div className="flex items-center gap-1 bg-[var(--surface-2)] p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-[var(--brand-primary)]' : 'text-[var(--text-muted)]'}`}
                            title="Grid View"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-[var(--brand-primary)]' : 'text-[var(--text-muted)]'}`}
                            title="List View"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>

            {/* TAB CONTENT */}
            {activeTab === 'products' && (
                <>
                    {/* Category Filters */}
                    <div className="px-4 py-3 bg-[var(--surface-1)] border-b border-[var(--glass-border)]">
                        <div className="overflow-x-auto scrollbar-hide">
                            <div className="flex gap-2 min-w-max">
                                {store.categories.map((cat: string) => (
                                    <button
                                        key={cat}
                                        onClick={() => setActiveCategory(cat)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${activeCategory === cat ? 'bg-[var(--text-main)] text-white' : 'bg-white text-[var(--text-muted)] border border-[var(--glass-border)]'}`}
                                    >
                                        {cat.replace(/^cat-/, '').replace(/-/g, ' ')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Product Grid/List View */}
                    <div className="p-4">
                        {filteredProducts.length === 0 ? (
                            <div className="text-center py-10 text-[var(--text-muted)]">No products found in this category.</div>
                        ) : viewMode === 'grid' ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {filteredProducts.map((product: any) => (
                                    <div key={product.id} className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden group shadow-sm hover:shadow-md transition-shadow">
                                        <div onClick={() => navigate(`/product/${product.id}`)} className="h-32 md:h-40 bg-[var(--surface-1)] relative cursor-pointer overflow-hidden">
                                            <img
                                                src={product.image}
                                                alt={product.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                loading="lazy"
                                                decoding="async"
                                            />
                                            {product.originalPrice && (
                                                <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">SALE</div>
                                            )}
                                        </div>
                                        <div className="p-3">
                                            <p onClick={() => navigate(`/product/${product.id}`)} className="font-medium text-sm text-[var(--text-main)] truncate cursor-pointer hover:text-[var(--brand-primary)]">{product.name}</p>
                                            <div className="flex items-baseline gap-2 mt-1">
                                                <span className="font-bold text-[var(--brand-primary)]">${product.price.toFixed(2)}</span>
                                                {product.originalPrice && (
                                                    <span className="text-xs text-[var(--text-muted)] line-through">${product.originalPrice.toFixed(2)}</span>
                                                )}
                                            </div>
                                            {(() => {
                                                const isOutOfStock = product.available_quantity !== undefined && product.available_quantity <= 0;
                                                return (
                                                    <button
                                                        onClick={() => !isOutOfStock && handleQuickAdd(product)}
                                                        disabled={isOutOfStock}
                                                        className={`w-full mt-3 py-2 text-white text-sm font-medium rounded-lg transition-all ${isOutOfStock
                                                            ? 'bg-gray-400 cursor-not-allowed'
                                                            : 'bg-[var(--brand-primary)] hover:brightness-110'
                                                            }`}
                                                    >
                                                        {isOutOfStock ? 'Out of Stock' : '+ Add to Cart'}
                                                    </button>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            /* List View */
                            <div className="space-y-3">
                                {filteredProducts.map((product: any) => (
                                    <div key={product.id} className="bg-white rounded-xl border border-[var(--glass-border)] p-3 flex gap-4 items-center shadow-sm hover:shadow-md transition-shadow">
                                        <div onClick={() => navigate(`/product/${product.id}`)} className="w-16 h-16 rounded-lg bg-[var(--surface-1)] flex-shrink-0 cursor-pointer overflow-hidden">
                                            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p onClick={() => navigate(`/product/${product.id}`)} className="font-medium text-[var(--text-main)] truncate cursor-pointer">{product.name}</p>
                                            <div className="flex items-baseline gap-2">
                                                <span className="font-bold text-[var(--brand-primary)] text-sm">${product.price.toFixed(2)}</span>
                                                {product.originalPrice && (
                                                    <span className="text-[10px] text-[var(--text-muted)] line-through">${product.originalPrice.toFixed(2)}</span>
                                                )}
                                            </div>
                                        </div>
                                        {(() => {
                                            const isOutOfStock = product.available_quantity !== undefined && product.available_quantity <= 0;
                                            return (
                                                <button
                                                    onClick={() => !isOutOfStock && handleQuickAdd(product)}
                                                    disabled={isOutOfStock}
                                                    className={`px-4 py-2 text-white text-xs font-bold rounded-lg transition-all ${isOutOfStock
                                                        ? 'bg-gray-400 cursor-not-allowed'
                                                        : 'bg-[var(--brand-primary)] hover:brightness-110 active:scale-95'
                                                        }`}
                                                >
                                                    {isOutOfStock ? 'Out' : '+ Add'}
                                                </button>
                                            );
                                        })()}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'flyer' && (
                <FlyerTab storeId={store.id} storeName={store.name} summary={store.flyer} viewMode={viewMode} />
            )}

            {activeTab === 'offers' && (
                <OffersTab storeId={store.id} storeName={store.name} viewMode={viewMode} />
            )}

            {activeTab === 'reviews' && (
                <div className="p-4 max-w-2xl mx-auto space-y-8">
                    {/* Rating Distribution Summary */}
                    <div className="bg-white p-6 rounded-2xl border border-[var(--glass-border)] shadow-sm">
                        <div className="flex flex-col md:flex-row gap-8 items-center">
                            <div className="text-center">
                                <h4 className="text-5xl font-black text-[var(--text-main)] mb-1">
                                    {reviews.length > 0 
                                        ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) 
                                        : store.rating}
                                </h4>
                                <StarRating 
                                    rating={reviews.length > 0 
                                        ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length 
                                        : store.rating} 
                                    size="md" 
                                />
                                <p className="text-xs text-[var(--text-muted)] mt-2 font-medium uppercase tracking-wider">
                                    {reviews.length || store.reviewCount || 0} REVIEWS
                                </p>
                            </div>

                            <div className="flex-1 w-full space-y-2">
                                {[5, 4, 3, 2, 1].map(stars => {
                                    const count = reviews.filter(r => Math.round(r.rating) === stars).length;
                                    const pct = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0;

                                    return (
                                        <div key={stars} className="flex items-center gap-3">
                                            <span className="text-xs font-bold text-[var(--text-muted)] w-3">{stars}</span>
                                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-yellow-400 rounded-full"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-medium text-gray-400 w-8">{pct}%</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Review Form */}
                    <ReviewForm targetId={store.id} targetType="store" />

                    {/* Review List */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-[var(--text-main)]">Customer Reviews</h3>
                            <select className="text-xs font-bold bg-[var(--surface-2)] px-2 py-1 rounded-lg border-none outline-none text-[var(--text-muted)]">
                                <option>Most Recent</option>
                                <option>Highest Rated</option>
                                <option>Most Helpful</option>
                            </select>
                        </div>
                        <ReviewList targetId={store.id} targetType="store" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default StoreDetail;
