import React, { useState, useEffect } from 'react';
import { useWishlist } from '../../context/WishlistContext';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useOptimizedWishlist } from '../../hooks/useOptimizedWishlist';
import { AddItemsPanel } from './components/AddItemsPanel';
import { WishlistItemCard } from './components/WishlistItemCard';
import { OrderSummaryPanel } from './components/OrderSummaryPanel';
import '../../styles/design-system.css';
import SEO from '../../components/SEO';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

const SmartCartWishlist: React.FC = () => {
    const { items: wishlistItems, removeItem, addItem } = useWishlist();
    const { addItemsToCart } = useCart();
    const navigate = useNavigate();
    const [showAddItems, setShowAddItems] = useState(false);

    // Auto-open add panel when wishlist is empty
    useEffect(() => {
        if (wishlistItems.length === 0) setShowAddItems(true);
    }, [wishlistItems.length]);

    const {
        selections,
        expandedItems,
        toggleExpand,
        inventoryLoading,
        AVAILABLE_ITEMS,
        availableStaples,
        optimizerItems,
        handleSelectionChange,
        totalCost,
        potentialSavings,
        dealSavings,
        validCartItems,
        optimizerRecommendation,
        bestSingleStore,
        singleStoreAlternatives,
        nearbyDeals,
        locationChanged,
        preferredStoreId,
        setPreferredStore,
    } = useOptimizedWishlist();

    const storeCount = new Set(validCartItems.map(i => i.storeId)).size;

    const handleAddAllToCart = async () => {
        if (validCartItems.length > 0) {
            await addItemsToCart(validCartItems, potentialSavings > 0 ? parseFloat(potentialSavings.toFixed(2)) : undefined);
            navigate('/cart');
        }
    };

    // Handle substitution swap: remove current item and add substitute
    const handleSwapItem = (currentId: string, substituteId: string) => {
        const currentWishlistItem = wishlistItems.find(w => w.id === currentId);
        const substituteItem = AVAILABLE_ITEMS.find((item: any) => item.id === substituteId);
        if (currentWishlistItem) removeItem(currentWishlistItem.id);
        if (substituteItem) addItem(substituteItem);
    };

    const dealsSection = (!inventoryLoading && nearbyDeals.length > 0) ? (
        <div className="mb-6 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border border-red-100 p-4">
            <h3 className="text-sm font-bold text-red-700 mb-3 flex items-center gap-2">
                <span className="text-base">🔥</span> Hot Deals Near You
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                {nearbyDeals.map(deal => (
                    <button
                        key={`${deal.storeId}-${deal.id}`}
                        onClick={() => {
                            if (deal.masterProductId) {
                                const catalogItem = AVAILABLE_ITEMS.find((item: any) => item.id === deal.masterProductId);
                                if (catalogItem) addItem(catalogItem);
                            }
                        }}
                        className="flex-shrink-0 w-36 bg-white rounded-lg border border-red-100 p-2.5 hover:shadow-md transition-shadow text-left"
                    >
                        {deal.image && (
                            <img src={deal.image} alt="" className="w-full h-16 object-cover rounded mb-2" />
                        )}
                        <p className="text-xs font-medium text-[var(--text-main)] truncate">{deal.productName}</p>
                        <p className="text-xs text-[var(--text-muted)] truncate">{deal.storeName}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-xs font-bold text-red-600">${deal.salePrice.toFixed(2)}</span>
                            <span className="text-xs text-[var(--text-muted)] line-through">${deal.originalPrice.toFixed(2)}</span>
                        </div>
                        <div className="mt-1">
                            <span className="badge-deal">
                                {deal.isFlashSale ? '⚡ ' : ''}{deal.discount}
                            </span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    ) : null;
    return (
        <div className="bg-[var(--surface-0)] min-h-screen animate-fade-in pb-12 lg:pb-12">
            <SEO title="SmartCart Optimizer" description="Compare grocery prices across local stores and build the cheapest cart with Spendigo SmartCart." path="/smartcart" />

            {/* Location Change Toast */}
            {locationChanged && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-[var(--brand-primary)] text-white px-5 py-3 rounded-xl shadow-xl text-sm font-black flex items-center gap-2 animate-fade-in uppercase tracking-widest">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span>Location updated — Recalculating...</span>
                </div>
            )}

            {/* Mobile Sticky Bottom Bar */}
            {!inventoryLoading && wishlistItems.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-white/90 backdrop-blur-md border-t border-gray-100 px-4 py-3 pb-safe z-50 flex items-center gap-3 shadow-[0_-10px_30px_rgba(0,0,0,0.1)]">
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">Estimated total</p>
                        <p className="text-xl font-black text-[var(--text-main)] tracking-tighter italic">${totalCost.toFixed(2)}</p>
                    </div>
                    <button
                        onClick={handleAddAllToCart}
                        disabled={validCartItems.length === 0}
                        className={`px-8 py-3.5 rounded-2xl font-black text-white text-xs tracking-widest uppercase transition-all flex items-center gap-2 shadow-xl ${validCartItems.length === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#112244] hover:bg-black active:scale-95'}`}
                    >
                        Add {validCartItems.length} to Cart
                    </button>
                </div>
            )}

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
                        <div className="max-w-2xl text-center md:text-left">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-white shadow-sm border border-gray-100 mb-6 animate-fade-in mx-auto md:mx-0">
                                <span className="flex h-2 w-2 rounded-full bg-[#007AFF] animate-ping" />
                                <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
                                    AI-Powered Savings
                                </span>
                            </div>
                            <h1 className="text-2xl md:text-4xl font-black text-[#112244] mb-4 leading-[1.05] tracking-tighter italic">
                                SmartCart<br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#112244] to-[#007AFF]">
                                    Optimizer
                                </span>
                            </h1>
                            <p className="text-[var(--text-muted)] text-xs md:text-sm font-medium leading-relaxed max-w-xl mx-auto md:mx-0">
                                Build your list and we'll find the absolute lowest total across all local stores. 
                                <span className="text-[#007AFF]"> Real-time price matching, automatically.</span>
                            </p>
                        </div>

                        {!inventoryLoading && wishlistItems.length > 0 && (
                            <div className="glass-panel-premium rounded-[2rem] p-6 min-w-[280px] border-blue-100/50 bg-white/40">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Live Estimate</div>
                                    <span className="badge-best italic">Saving ${potentialSavings.toFixed(2)}</span>
                                </div>
                                <div className="text-4xl font-black text-[#112244] tracking-tighter italic">${totalCost.toFixed(2)}</div>
                                <div className="mt-2 flex items-center gap-2 text-xs font-bold text-[var(--text-muted)]">
                                    <span>{validCartItems.length} Matched</span>
                                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                    <span>{storeCount} Stores</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <div className="max-w-7xl mx-auto px-4 pb-28 lg:pb-8">
                {/* Add Items Panel */}
                <AddItemsPanel
                    showAddItems={showAddItems}
                    setShowAddItems={setShowAddItems}
                    availableStaples={availableStaples}
                    AVAILABLE_ITEMS={AVAILABLE_ITEMS}
                />

                {/* Nearby Deals Discovery */}
                {/* Preferred Store Toggle */}
                {!inventoryLoading && singleStoreAlternatives.length > 0 && (
                    <div className="mb-4 flex items-center gap-2 text-xs">
                        <span className="text-[var(--text-muted)]">Preferred store:</span>
                        <select
                            value={preferredStoreId || ''}
                            onChange={e => setPreferredStore(e.target.value || null)}
                            className="border border-[var(--glass-border)] rounded-lg px-2 py-1 text-xs text-[var(--text-main)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                        >
                            <option value="">None (pure price optimization)</option>
                            {singleStoreAlternatives.map(store => (
                                <option key={store.id} value={store.id}>{store.name}</option>
                            ))}
                        </select>
                        {preferredStoreId && (
                            <span className="text-xs text-[var(--text-muted)]">Picks this store when within 2% of cheapest</span>
                        )}
                    </div>
                )}

                {/* Main Content */}
                {inventoryLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white rounded-xl border border-[var(--glass-border)] p-4">
                                <div className="flex items-center gap-3 mb-4">
                                    <Skeleton className="w-12 h-12 rounded-lg" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 rounded-full w-1/3" />
                                        <Skeleton className="h-3 rounded-full w-1/4" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Skeleton className="h-10 rounded-lg" />
                                    <Skeleton className="h-10 rounded-lg" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : wishlistItems.length === 0 ? (
                    <div className="space-y-8 animate-fade-in">
                        <EmptyState
                            icon="📋"
                            heading="Wishlist is empty"
                            subtext="Add items from the selector above to start comparing prices across all stores and save big!"
                            action={
                                <button onClick={() => setShowAddItems(true)} className="btn-primary">
                                    Get Started
                                </button>
                            }
                            className="bg-white rounded-2xl border-2 border-dashed border-gray-100 max-w-2xl mx-auto"
                        />
                        {dealsSection}
                    </div>
                ) : (
                    <div className="space-y-6">
                        {dealsSection}
                        <div className="lg:grid lg:grid-cols-12 lg:gap-8 relative">
                        {/* LEFT COLUMN: Main List */}
                        <div className="lg:col-span-8">
                            <div className="space-y-3">
                                {optimizerItems.filter(item => item && item.options.length > 0).map((item) => {
                                    if (!item) return null;
                                    const isExpanded = expandedItems.has(item.id);
                                    const currentSelection = selections[item.id];

                                    return (
                                        <WishlistItemCard
                                            key={item.id}
                                            item={item}
                                            isExpanded={isExpanded}
                                            toggleExpand={toggleExpand}
                                            currentSelection={currentSelection}
                                            handleSelectionChange={handleSelectionChange}
                                            onSwapItem={handleSwapItem}
                                        />
                                    );
                                })}
                            </div>

                            {/* Unavailable Items */}
                            {optimizerItems.filter(item => item && item.options.length === 0).length > 0 && (
                                <div className="mt-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                                            Not found nearby ({optimizerItems.filter(i => i && i.options.length === 0).length})
                                        </h3>
                                        <button
                                            onClick={() => {
                                                optimizerItems
                                                    .filter(item => item && item.options.length === 0)
                                                    .forEach(item => {
                                                        const wItem = wishlistItems.find(w => w.name === item!.name);
                                                        if (wItem) removeItem(wItem.id);
                                                    });
                                            }}
                                            className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {optimizerItems.filter(item => item && item.options.length === 0).map(item => (
                                            <div key={item!.name} className="flex items-center justify-between p-3 bg-[var(--surface-1)] rounded-lg border border-dashed border-[var(--glass-border)]">
                                                <div className="flex items-center gap-3">
                                                    <img src={item!.image} alt="" className="w-8 h-8 rounded-md object-cover opacity-40 grayscale" />
                                                    <span className="text-sm text-[var(--text-muted)] font-medium">{item!.name}</span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const wItem = wishlistItems.find(w => w.name === item!.name);
                                                        if (wItem) removeItem(wItem.id);
                                                    }}
                                                    className="text-[var(--text-muted)] hover:text-red-400 transition-colors p-1"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* RIGHT COLUMN: Sticky Summary */}
                        <div className="lg:col-span-4 mt-8 lg:mt-0">
                            <OrderSummaryPanel
                                optimizerItems={optimizerItems}
                                validCartItems={validCartItems}
                                totalCost={totalCost}
                                potentialSavings={potentialSavings}
                                dealSavings={dealSavings}
                                optimizerRecommendation={optimizerRecommendation}
                                bestSingleStore={bestSingleStore}
                                singleStoreAlternatives={singleStoreAlternatives}
                            />
                        </div>
                    </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SmartCartWishlist;
