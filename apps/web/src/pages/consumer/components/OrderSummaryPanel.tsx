import React, { useMemo } from 'react';
import { useSmartInsights } from '../../../hooks/useSmartInsights';
import { OptimizedWishlistItem } from '../../../types/smartCart';
import { useCart } from '../../../context/CartContext';
import { useWishlist } from '../../../context/WishlistContext';

interface OrderSummaryPanelProps {
    optimizerItems: (OptimizedWishlistItem | undefined)[];
    validCartItems: any[];
    totalCost: number;
    potentialSavings: number;
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
    optimizerRecommendation,
    bestSingleStore,
    singleStoreAlternatives,
}) => {
    const { addItemsToCart } = useCart();
    const { items: wishlistItems } = useWishlist();

    const insightPayload = useMemo(() => ({
        items: optimizerItems.filter(Boolean).map(item => ({
            name: item!.name,
            category: wishlistItems.find(w => w.name === item!.name)?.category ?? '',
            options: item!.options.map(o => ({ storeName: o.storeName, price: o.price }))
        })),
        totalCost,
        storeCount: new Set(validCartItems.map(i => i.storeId)).size,
        potentialSavings,
        missingCount: optimizerItems.filter(i => i && i.options.length === 0).length
    }), [optimizerItems, totalCost, potentialSavings, validCartItems, wishlistItems]);

    const { insights, loading: insightsLoading } = useSmartInsights(insightPayload);
    const matchedCount = validCartItems.length;
    const storeCount = new Set(validCartItems.map(i => i.storeId)).size;
    const missingCount = optimizerItems.filter(i => i && i.options.length === 0).length;

    const handleAddAllToCart = () => {
        if (validCartItems.length > 0) {
            addItemsToCart(validCartItems, potentialSavings > 0 ? parseFloat(potentialSavings.toFixed(2)) : undefined);
        }
    };

    return (
        <div className="glass-panel p-6 sticky top-8 border-[var(--glass-border)] shadow-xl bg-white/50 backdrop-blur-xl">
            {/* Panel Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[var(--text-main)]">Order Summary</h2>
                <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-full border border-purple-100">Smart Insights</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="rounded-2xl border border-[var(--glass-border)] bg-white/80 p-3">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">Split Total</div>
                    <div className="mt-1 text-2xl font-black text-[var(--text-main)]">${totalCost.toFixed(2)}</div>
                    <div className="text-xs text-[var(--text-muted)]">{storeCount} store{storeCount !== 1 ? 's' : ''}</div>
                </div>
                <div className="rounded-2xl border border-[var(--glass-border)] bg-white/80 p-3">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">Best Single Store</div>
                    <div className="mt-1 text-2xl font-black text-[var(--text-main)]">
                        {bestSingleStore?.cost !== null && bestSingleStore?.cost !== undefined ? `$${bestSingleStore.cost.toFixed(2)}` : 'N/A'}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">{bestSingleStore?.name || 'No full basket'}</div>
                </div>
                <div className="rounded-2xl border border-[var(--glass-border)] bg-white/80 p-3">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">Matched</div>
                    <div className="mt-1 text-2xl font-black text-[var(--text-main)]">{matchedCount}</div>
                    <div className="text-xs text-[var(--text-muted)]">{missingCount} missing</div>
                </div>
                <div className="rounded-2xl border border-[var(--glass-border)] bg-[linear-gradient(135deg,rgba(46,125,50,0.12),rgba(255,255,255,0.96))] p-3">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">Savings</div>
                    <div className="mt-1 text-2xl font-black text-[var(--status-success)]">
                        {potentialSavings > 0 ? `$${potentialSavings.toFixed(2)}` : '$0.00'}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">vs best single store</div>
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
                <div className="flex items-center justify-between mb-4 text-green-600 text-sm bg-green-50 rounded-lg px-3 py-2">
                    <span className="font-medium">Savings vs Best Single Store</span>
                    <span className="font-bold">-${potentialSavings.toFixed(2)}</span>
                </div>
            )}

            <div className="mb-4 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-2)]/70 p-4">
                <h3 className="text-sm font-bold text-[var(--text-main)] mb-2">Trip Recommendation</h3>
                <p className="text-sm text-[var(--text-main)]">
                    {optimizerRecommendation === 'optimized_multi_store' && 'Multi-store optimizer recommended.'}
                    {optimizerRecommendation === 'single_store' && 'Single-store trip recommended for convenience.'}
                    {optimizerRecommendation === 'optimized_multi_store_only_feasible' && 'Multi-store trip is the only full-basket option.'}
                    {!optimizerRecommendation && 'Recommendation will appear once matches are available.'}
                </p>
                {bestSingleStore?.cost !== null && bestSingleStore && (
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                        Best single-store alternative: {bestSingleStore.name} at ${bestSingleStore.cost?.toFixed(2)}
                    </p>
                )}
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
                                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                                        : 'border-[var(--glass-border)] bg-[var(--surface-1)]'
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
                                            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)]">
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

            {/* AI Insights Panel */}
            <div className="mb-6 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-purple-200/20 rounded-bl-full -mr-4 -mt-4"></div>

                <h3 className="font-bold text-sm text-purple-900 mb-3 flex items-center gap-2">
                    <span>✨</span> Smart Insights
                </h3>

                {insightsLoading && (
                    <div className="space-y-2 animate-pulse">
                        <div className="h-3 bg-purple-200 rounded w-3/4" />
                        <div className="h-3 bg-purple-200 rounded w-1/2" />
                    </div>
                )}
                {!insightsLoading && insights.map((line, i) => (
                    <p key={i} className="text-xs text-purple-800 mb-2">• {line}</p>
                ))}
            </div>

            <div className="border-t border-[var(--glass-border)] my-4"></div>

            <button
                onClick={handleAddAllToCart}
                disabled={validCartItems.length === 0}
                className={`w-full text-white px-6 py-4 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${validCartItems.length === 0 ? 'bg-gray-300 cursor-not-allowed shadow-none' : 'bg-[var(--brand-primary)] shadow-[var(--brand-primary)]/20 active:scale-95 hover:brightness-110'}`}
            >
                <span>Add Selected to Cart</span>
                <span className="bg-white/20 px-2 py-0.5 rounded text-sm">{validCartItems.length}</span>
            </button>

            <p className="text-xs text-[var(--text-muted)] text-center mt-3">
                Proceed to cart to verify availability
            </p>
        </div>
    );
};
