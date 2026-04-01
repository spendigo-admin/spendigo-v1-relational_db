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

    return (
        <div className="animate-fade-in pb-12 lg:pb-12">
            <SEO title="SmartCart Optimizer" description="Compare grocery prices across local stores and build the cheapest cart with Spendigo SmartCart." path="/smartcart" />

            {/* Location Change Toast */}
            {locationChanged && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-blue-600 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium flex items-center gap-2 animate-fade-in">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Location updated — prices recalculated
                </div>
            )}

            {/* Mobile Sticky Bottom Bar */}
            {!inventoryLoading && wishlistItems.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-white border-t border-gray-200 px-4 py-3 pb-safe z-50 flex items-center gap-3 shadow-2xl">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500">Estimated total</p>
                        <p className="text-lg font-bold text-[var(--text-main)]">${totalCost.toFixed(2)}</p>
                    </div>
                    <button
                        onClick={handleAddAllToCart}
                        disabled={validCartItems.length === 0}
                        className={`px-6 py-3 rounded-xl font-bold text-white text-sm transition-all flex items-center gap-2 ${validCartItems.length === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-[var(--brand-primary)] active:scale-95'}`}
                    >
                        Add {validCartItems.length} to Cart
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-secondary)] text-white p-6 shadow-md mb-6">
                <div className="max-w-6xl mx-auto px-4">
                    <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
                        <span>🛒</span> SmartCart Optimizer
                    </h1>
                    <p className="text-white/80 text-sm">Compare prices and choose the best store for each item.</p>
                    {!inventoryLoading && wishlistItems.length > 0 && (
                        <div className="flex items-center gap-3 mt-3 text-sm text-white/90 flex-wrap">
                            <span className="font-semibold">{validCartItems.length} matched</span>
                            <span className="text-white/40">·</span>
                            <span>{storeCount} store{storeCount !== 1 ? 's' : ''}</span>
                            <span className="text-white/40">·</span>
                            <span className="font-bold text-white">Est. ${totalCost.toFixed(2)}</span>
                            {potentialSavings > 0 && (
                                <>
                                    <span className="text-white/40">·</span>
                                    <span className="text-green-300 font-semibold">Save ~${potentialSavings.toFixed(2)}</span>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 pb-28 lg:pb-8">
                {/* Add Items Panel */}
                <AddItemsPanel
                    showAddItems={showAddItems}
                    setShowAddItems={setShowAddItems}
                    availableStaples={availableStaples}
                    AVAILABLE_ITEMS={AVAILABLE_ITEMS}
                />

                {/* Nearby Deals Discovery */}
                {!inventoryLoading && nearbyDeals.length > 0 && (
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
                                    <p className="text-xs font-medium text-gray-800 truncate">{deal.productName}</p>
                                    <p className="text-[10px] text-gray-400 truncate">{deal.storeName}</p>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <span className="text-xs font-bold text-red-600">${deal.salePrice.toFixed(2)}</span>
                                        <span className="text-[10px] text-gray-400 line-through">${deal.originalPrice.toFixed(2)}</span>
                                    </div>
                                    <span className="inline-block mt-1 text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">
                                        {deal.isFlashSale ? '⚡ ' : ''}{deal.discount}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Preferred Store Toggle */}
                {!inventoryLoading && singleStoreAlternatives.length > 0 && (
                    <div className="mb-4 flex items-center gap-2 text-xs">
                        <span className="text-gray-500">Preferred store:</span>
                        <select
                            value={preferredStoreId || ''}
                            onChange={e => setPreferredStore(e.target.value || null)}
                            className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 bg-white"
                        >
                            <option value="">None (pure price optimization)</option>
                            {singleStoreAlternatives.map(store => (
                                <option key={store.id} value={store.id}>{store.name}</option>
                            ))}
                        </select>
                        {preferredStoreId && (
                            <span className="text-[10px] text-gray-400">Picks this store when within 2% of cheapest</span>
                        )}
                    </div>
                )}

                {/* Main Content */}
                {inventoryLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white rounded-xl border border-[var(--glass-border)] p-4 animate-pulse">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-gray-200 rounded w-1/3" />
                                        <div className="h-3 bg-gray-100 rounded w-1/4" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="h-10 bg-gray-100 rounded" />
                                    <div className="h-10 bg-gray-100 rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : wishlistItems.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-[2.5rem] border-2 border-dashed border-gray-100 shadow-inner max-w-2xl mx-auto animate-fade-in">
                        <div className="w-24 h-24 bg-gray-50 rounded-3xl flex items-center justify-center text-5xl mx-auto mb-6 shadow-sm grayscale opacity-60">
                            📋
                        </div>
                        <h2 className="text-2xl font-black text-[var(--text-main)] mb-3 tracking-tight">Wishlist is empty</h2>
                        <p className="text-[var(--text-muted)] max-w-sm mx-auto mb-8 font-medium">Add items from the selector above to start comparing prices across all stores and save big!</p>
                        <button
                            onClick={() => setShowAddItems(true)}
                            className="bg-[var(--brand-primary)] text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-[var(--brand-primary)]/20 hover:scale-105 transition-transform"
                        >
                            Get Started
                        </button>
                    </div>
                ) : (
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
                                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
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
                                            <div key={item!.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                                <div className="flex items-center gap-3">
                                                    <img src={item!.image} alt="" className="w-8 h-8 rounded-md object-cover opacity-40 grayscale" />
                                                    <span className="text-sm text-gray-400 font-medium">{item!.name}</span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const wItem = wishlistItems.find(w => w.name === item!.name);
                                                        if (wItem) removeItem(wItem.id);
                                                    }}
                                                    className="text-gray-300 hover:text-red-400 transition-colors p-1"
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
                )}
            </div>
        </div>
    );
};

export default SmartCartWishlist;
