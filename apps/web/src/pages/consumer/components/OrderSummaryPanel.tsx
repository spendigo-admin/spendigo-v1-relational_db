import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSmartInsights } from '../../../hooks/useSmartInsights';
import { OptimizedWishlistItem } from '../../../types/smartCart';
import { useCart } from '../../../context/CartContext';
import { useWishlist } from '../../../context/WishlistContext';

interface OrderSummaryPanelProps {
    optimizerItems: (OptimizedWishlistItem | undefined)[];
    validCartItems: any[];
    totalCost: number;
    potentialSavings: number;
    dealSavings: number;
    optimizerRecommendation: 'single_store' | 'optimized_multi_store' | 'optimized_multi_store_only_feasible' | null;
    bestSingleStore: {
        id: string;
        name: string;
        cost: number | null;
        missingItems: string[];
    } | null;
    singleStoreAlternatives: Array<{
        id: string;
        name: string;
        cost: number | null;
        missingItems: string[];
        isBest: boolean;
    }>;
}

export const OrderSummaryPanel: React.FC<OrderSummaryPanelProps> = ({
    optimizerItems,
    validCartItems,
    totalCost,
    potentialSavings,
    dealSavings,
    optimizerRecommendation,
    bestSingleStore,
    singleStoreAlternatives,
}) => {
    const { addItemsToCart } = useCart();
    const { items: wishlistItems } = useWishlist();
    const navigate = useNavigate();

    const matchedCount = validCartItems.length;
    const storeCount = new Set(validCartItems.map(i => i.storeId)).size;
    const missingCount = optimizerItems.filter(i => i && i.options.length === 0).length;

    const { insights, loading: insightsLoading } = useSmartInsights({
        items: (optimizerItems.filter(i => i !== undefined) as OptimizedWishlistItem[]).map(i => ({
            name: i.name,
            category: i.category || 'Grocery',
            options: i.options.map(o => ({ storeName: o.storeName, price: o.price }))
        })),
        totalCost,
        storeCount,
        potentialSavings: potentialSavings + dealSavings,
        missingCount
    });

    const handleAddAllToCart = async () => {
        if (validCartItems.length > 0) {
            await addItemsToCart(validCartItems, potentialSavings > 0 ? parseFloat(potentialSavings.toFixed(2)) : undefined);
            navigate('/cart');
        }
    };

    return (
        <div className="glass-panel sticky top-8 border-[var(--glass-border)] shadow-xl bg-white/50 backdrop-blur-xl overflow-hidden">
            {/* Panel Header */}
            <div className="bg-[#112244] p-5 mb-5">
                <h2 className="text-lg font-black text-white italic tracking-tighter uppercase">The SmartCart Report</h2>
                <p className="text-white/70 text-[9px] font-black uppercase tracking-widest mt-1">Live AI Optimization</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="rounded-2xl border border-blue-100 bg-white/80 p-3">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#007AFF]">Split Total</div>
                    <div className="mt-1 text-2xl font-black text-[#112244] italic tracking-tighter">${totalCost.toFixed(2)}</div>
                    <div className="text-[10px] font-bold text-[#007AFF]/60 uppercase tracking-tight">{storeCount} store{storeCount !== 1 ? 's' : ''}</div>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white/80 p-3">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Best Single Store</div>
                    <div className="mt-1 text-2xl font-black text-[#112244] italic tracking-tighter">
                        {bestSingleStore?.cost !== null && bestSingleStore?.cost !== undefined ? `$${bestSingleStore.cost.toFixed(2)}` : 'N/A'}
                    </div>
                    <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tight truncate">{bestSingleStore?.name || 'No full basket'}</div>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white/80 p-3">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Matched</div>
                    <div className="mt-1 text-2xl font-black text-[#112244] italic tracking-tighter">{matchedCount}</div>
                    <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tight">{missingCount} missing</div>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600">Savings</div>
                    <div className="mt-1 text-2xl font-black text-emerald-600 italic tracking-tighter">
                        {(dealSavings > 0 || potentialSavings > 0) ? `$${(dealSavings + Math.max(0, potentialSavings)).toFixed(2)}` : '$0.00'}
                    </div>
                    <div className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-tight">
                        {dealSavings > 0 ? 'from active deals' : 'vs best single store'}
                    </div>
                </div>
            </div>

            {/* Store sub-totals breakdown */}
            {validCartItems.length > 0 && (
                <div className="mb-4 space-y-2">
                    {Object.values(
                        validCartItems.reduce<Record<string, { name: string; total: number; count: number }>>((acc, item) => {
                            if (!acc[item.storeId]) acc[item.storeId] = { name: item.storeName, total: 0, count: 0 };
                            acc[item.storeId].total += item.price;
                            acc[item.storeId].count += item.quantity;
                            return acc;
                        }, {})
                    ).map((store) => (
                        <div key={store.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-base flex-shrink-0">🏪</span>
                                <span className="text-[var(--text-main)] font-medium truncate">{store.name}</span>
                                <span className="text-[11px] text-gray-400 flex-shrink-0">({store.count})</span>
                            </div>
                            <span className="font-semibold text-[var(--text-main)] flex-shrink-0 ml-2">${store.total.toFixed(2)}</span>
                        </div>
                    ))}
                    <div className="border-t border-[var(--glass-border)] pt-2 mt-2 flex items-center justify-between">
                        <span className="text-[var(--text-muted)] text-sm">Total</span>
                        <span className="text-2xl font-bold text-[var(--text-main)]">${totalCost.toFixed(2)}</span>
                    </div>
                </div>
            )}

            {potentialSavings > 0 && (
                <div className="flex items-center justify-between mb-4 text-emerald-600 text-[10px] bg-emerald-50 rounded-lg px-3 py-2 font-black uppercase tracking-widest border border-emerald-100">
                    <span className="font-black">Protocol Savings Optimized</span>
                    <span className="font-black">-${potentialSavings.toFixed(2)}</span>
                </div>
            )}

            <div className="border-t border-[var(--glass-border)] my-5 pt-5">
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg animate-pulse">✨</span>
                    <h3 className="text-[10px] font-black text-[#112244] uppercase tracking-[0.2em] italic">AI Smart Insights</h3>
                </div>
                
                {insightsLoading ? (
                    <div className="space-y-2">
                        <div className="h-3 bg-gray-100 rounded-full w-full animate-pulse"></div>
                        <div className="h-3 bg-gray-100 rounded-full w-4/5 animate-pulse"></div>
                    </div>
                ) : insights.length > 0 ? (
                    <div className="space-y-2">
                         {insights.map((insight, idx) => (
                            <div key={idx} className="flex gap-2 items-start group">
                                <span className="text-[#007AFF] text-xs mt-1">✦</span>
                                <p className="text-xs text-[#112244] leading-relaxed group-hover:text-[#007AFF] transition-colors font-medium">
                                    {insight}
                                </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-[var(--text-muted)] italic">
                        Select more items to unlock AI-powered shopping insights.
                    </p>
                )}
            </div>

            <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/30 p-4">
                <h3 className="text-[10px] font-black text-[#007AFF] uppercase tracking-widest mb-2 italic">AI Trip Recommendation</h3>
                <div className="flex items-start gap-2">
                    <span className="text-base flex-shrink-0 mt-0.5">
                        {optimizerRecommendation === 'optimized_multi_store' ? '🛒' : optimizerRecommendation === 'single_store' ? '🏪' : optimizerRecommendation === 'optimized_multi_store_only_feasible' ? '🔀' : '⏳'}
                    </span>
                    <div>
                        <p className="text-sm font-black text-[#112244] italic tracking-tight">
                            {optimizerRecommendation === 'optimized_multi_store' && `Split across ${storeCount} stores to save $${(dealSavings + Math.max(0, potentialSavings)).toFixed(2)}.`}
                            {optimizerRecommendation === 'single_store' && `One-stop shop recommended — savings are too small to justify multiple trips.`}
                            {optimizerRecommendation === 'optimized_multi_store_only_feasible' && 'Multi-store trip is the only full-basket option.'}
                            {!optimizerRecommendation && 'Recommendation will appear once matches are available.'}
                        </p>
                        {bestSingleStore?.cost !== null && bestSingleStore && (
                            <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                                Best single-store: {bestSingleStore.name} at ${bestSingleStore.cost?.toFixed(2)}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {singleStoreAlternatives.length > 0 && (
                <div className="mb-5 rounded-xl border border-[var(--glass-border)] bg-white/70 p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <h3 className="text-sm font-bold text-[var(--text-main)]">Single-Store Alternatives</h3>
                        <span className="text-[11px] text-[var(--text-muted)]">Trip saver baseline</span>
                    </div>
                    <div className="space-y-2">
                        {singleStoreAlternatives.slice(0, 4).map(store => (
                            <div
                                key={store.id}
                                className={`rounded-xl border px-3 py-3 ${
                                    store.isBest
                                        ? 'border-[#007AFF] bg-blue-50/50'
                                        : 'border-gray-100 bg-gray-50/50'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="font-semibold text-[var(--text-main)]">{store.name}</div>
                                        <div className="text-xs text-[var(--text-muted)]">
                                            {store.cost !== null ? 'Full basket available' : `${store.missingItems.length} item${store.missingItems.length !== 1 ? 's' : ''} missing`}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-[var(--text-main)]">
                                            {store.cost !== null ? `$${store.cost.toFixed(2)}` : 'N/A'}
                                        </div>
                                        {store.isBest && (
                                            <div className="text-[9px] font-black uppercase tracking-[0.12em] text-[#007AFF]">
                                                Best single store
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="border-t border-[var(--glass-border)] my-4"></div>

            <button
                onClick={handleAddAllToCart}
                disabled={validCartItems.length === 0}
                className={`w-full text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2 ${validCartItems.length === 0 ? 'bg-gray-300 cursor-not-allowed shadow-none' : 'bg-[#112244] shadow-blue-500/10 active:scale-95 hover:bg-black'}`}
            >
                <span>Add Selected to Cart</span>
                <span className="bg-white/20 px-2 py-0.5 rounded text-[10px]">{validCartItems.length}</span>
            </button>

            <p className="text-xs text-[var(--text-muted)] text-center mt-3">
                Proceed to cart to verify availability
            </p>
        </div>
    );
};
