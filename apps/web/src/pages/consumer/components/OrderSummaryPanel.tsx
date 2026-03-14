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
}

export const OrderSummaryPanel: React.FC<OrderSummaryPanelProps> = ({
    optimizerItems,
    validCartItems,
    totalCost,
    potentialSavings
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
                    <span className="font-medium">Avg. Market Savings</span>
                    <span className="font-bold">-${potentialSavings.toFixed(2)}</span>
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
