import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import '../../styles/design-system.css';

const StoreDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const { getStore } = useMarketplace();

    const store = getStore(id || '') || null;

    const [activeTab, setActiveTab] = useState<'products' | 'flyer' | 'offers'>('products');
    const [activeCategory, setActiveCategory] = useState('All');

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

    const filteredProducts = activeCategory === 'All'
        ? (store.products || [])
        : (store.products || []).filter((p: any) => p.category === activeCategory);

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
                <img src={store.image} alt={store.name} className="w-full h-full object-cover opacity-80" />
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
                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white border-2 border-[var(--glass-border)] flex items-center justify-center text-3xl md:text-4xl shadow-lg">
                            {store.logo}
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
                    <span className="font-medium text-[var(--text-main)]">{store.rating}</span>
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

            {/* MAIN TABS: Products | Flyer | Offers */}
            <div className="px-4 py-3 sticky top-14 z-40 bg-[var(--surface-0)] border-b border-[var(--glass-border)]">
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
                </div>
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
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeCategory === cat ? 'bg-[var(--text-main)] text-white' : 'bg-white text-[var(--text-muted)] border border-[var(--glass-border)]'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Product Grid */}
                    <div className="p-4">
                        {filteredProducts.length === 0 ? (
                            <div className="text-center py-10 text-[var(--text-muted)]">No products found in this category.</div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {filteredProducts.map((product: any) => (
                                    <div key={product.id} className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden group shadow-sm hover:shadow-md transition-shadow">
                                        <div onClick={() => navigate(`/product/${product.id}`)} className="h-32 md:h-40 bg-[var(--surface-1)] relative cursor-pointer overflow-hidden">
                                            <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
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
                                            <button onClick={() => handleQuickAdd(product)} className="w-full mt-3 py-2 bg-[var(--brand-primary)] text-white text-sm font-medium rounded-lg hover:brightness-110 transition-all">
                                                + Add to Cart
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'flyer' && (
                <div className="p-4">
                    {/* Flyer Card */}
                    {store.flyer?.validUntil ? (
                        <div className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden shadow-sm">
                            <img src={store.flyer.image} alt={store.flyer.title} className="w-full h-48 object-cover" />
                            <div className="p-4">
                                <h3 className="text-xl font-bold text-[var(--text-main)]">{store.flyer.title}</h3>
                                <p className="text-sm text-[var(--text-muted)] mt-1">Valid until {store.flyer.validUntil}</p>
                                <button className="mt-4 w-full py-3 bg-[var(--brand-primary)] text-white font-medium rounded-lg hover:brightness-110">
                                    View Full Flyer
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <p className="text-4xl mb-4">📰</p>
                            <p className="text-[var(--text-muted)]">No active flyer for this week.</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'offers' && (
                <div className="p-4 space-y-6">
                    {/* One Day Offers */}
                    {store.oneDayOffers && store.oneDayOffers.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-xl">⏰</span>
                                <h3 className="text-lg font-bold text-[var(--text-main)]">One-Day Offers</h3>
                                <span className="ml-auto text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">Limited Time</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {store.oneDayOffers.map((offer: any) => (
                                    <div key={offer.id} className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border border-red-100 p-3">
                                        <img src={offer.image} alt={offer.name} className="w-full h-24 object-cover rounded-lg mb-2" />
                                        <p className="font-medium text-sm text-[var(--text-main)] truncate">{offer.name}</p>
                                        <div className="flex items-baseline gap-2 mt-1">
                                            <span className="font-bold text-red-600">${offer.price.toFixed(2)}</span>
                                            {offer.originalPrice && (
                                                <span className="text-xs text-[var(--text-muted)] line-through">${offer.originalPrice.toFixed(2)}</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-red-500 mt-1">⏱ Ends in {offer.endsIn}</p>
                                        <button onClick={() => handleQuickAdd(offer)} className="w-full mt-2 py-2 bg-red-500 text-white text-xs font-medium rounded-lg">
                                            + Add
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Sale Items */}
                    {store.saleItems && store.saleItems.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-xl">🏷️</span>
                                <h3 className="text-lg font-bold text-[var(--text-main)]">Items on Sale</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {store.saleItems.map((item: any) => (
                                    <div key={item.id} className="bg-white rounded-xl border border-[var(--glass-border)] p-3 shadow-sm">
                                        <div className="relative">
                                            <img src={item.image} alt={item.name} className="w-full h-24 object-cover rounded-lg mb-2" />
                                            {item.discount && (
                                                <span className="absolute top-1 left-1 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">{item.discount}</span>
                                            )}
                                        </div>
                                        <p className="font-medium text-sm text-[var(--text-main)] truncate">{item.name}</p>
                                        <div className="flex items-baseline gap-2 mt-1">
                                            <span className="font-bold text-green-600">${item.price.toFixed(2)}</span>
                                            <span className="text-xs text-[var(--text-muted)] line-through">${item.originalPrice.toFixed(2)}</span>
                                        </div>
                                        <button onClick={() => handleQuickAdd(item)} className="w-full mt-2 py-2 bg-[var(--brand-primary)] text-white text-xs font-medium rounded-lg">
                                            + Add
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {(!store.oneDayOffers?.length && !store.saleItems?.length) && (
                        <div className="text-center py-10">
                            <p className="text-4xl mb-4">🍂</p>
                            <p className="text-[var(--text-muted)]">No special deals available right now.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default StoreDetail;
