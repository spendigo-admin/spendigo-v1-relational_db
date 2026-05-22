import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { STORE_DATA } from '../../data/productData';
import '../../styles/design-system.css';
import SEO from '../../components/SEO';
import { EmptyState } from '../../components/ui/EmptyState';
import { useTranslation } from 'react-i18next';

const Cart: React.FC = () => {
    const navigate = useNavigate();
    const { items, updateQuantity, removeFromCart, subtotal, clearCart } = useCart();
    const { t } = useTranslation();

    // Group items by store
    const groupedItems = items.reduce((acc, item) => {
        if (!acc[item.storeId]) {
            acc[item.storeId] = { storeName: item.storeName, items: [] };
        }
        acc[item.storeId].items.push(item);
        return acc;
    }, {} as Record<string, { storeName: string; items: typeof items }>);

    const storeCount = Object.keys(groupedItems).length;

    // Calculate real savings by comparing cart prices against max prices across all stores
    const estimatedSavings = useMemo(() => {
        let totalSavings = 0;

        items.forEach(cartItem => {
            // Priority 1: Use specific item-level originalPrice (Deal Savings)
            if (cartItem.originalPrice && cartItem.originalPrice > cartItem.price) {
                totalSavings += (cartItem.originalPrice - cartItem.price) * cartItem.quantity;
                return;
            }

            // Priority 2: Use STORE_DATA comparison (Legacy/Fallback)
            const allPrices: number[] = [];
            Object.values(STORE_DATA).forEach((store: any) => {
                const product = store.products?.find((p: any) => p.name === cartItem.productName);
                if (product) {
                    allPrices.push(product.price);
                }
            });

            if (allPrices.length > 0) {
                const maxPrice = Math.max(...allPrices);
                const savings = (maxPrice - cartItem.price) * cartItem.quantity;
                if (savings > 0) totalSavings += savings;
            }
        });

        return totalSavings.toFixed(2);
    }, [items]);

    if (items.length === 0) {
        return (
            <div className="animate-fade-in min-h-[60vh] flex items-center justify-center">
                <EmptyState
                    icon="🛒"
                    heading={t('cartEmpty')}
                    subtext={t('cartEmptyHint')}
                    action={<Link to="/" className="btn-primary">{t('browseStores')}</Link>}
                />
            </div>
        );
    }

    return (
        <div className="animate-fade-in pb-12">
            <SEO title="Your Cart" description="Review your shopping cart and proceed to checkout on Spendigo." path="/cart" noIndex />
            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* PAGE HEADER */}
                <div className="mb-6">
                    <h1 className="text-4xl md:text-5xl font-black text-[#112244] tracking-tighter italic mb-1">{t('cartTitle')}</h1>
                    <p className="text-gray-400 font-bold tracking-widest uppercase text-xs">
                        {items.length} item{items.length !== 1 ? 's' : ''} from {storeCount} store{storeCount !== 1 ? 's' : ''}
                    </p>
                </div>

                {/* SAVINGS BANNER */}
                <div className="mb-8 rounded-3xl p-6 bg-gradient-to-r from-[#112244] to-[#007AFF] text-white flex items-center gap-4 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                    <div className="text-4xl relative z-10">🎉</div>
                    <div className="flex-1 relative z-10">
                        <p className="font-black text-lg md:text-xl tracking-tight text-white drop-shadow-md">
                            {t('cartSavings', { amount: estimatedSavings })}
                        </p>
                        <p className="text-sm font-bold text-white/95 mt-1">
                            {t('cartAIOptimized')}
                        </p>
                    </div>
                </div>

                <div className="lg:grid lg:grid-cols-12 lg:gap-8 bg relative">

                    {/* LEFT COLUMN: ITEMS ONLY (Span 8) */}
                    <div className="lg:col-span-8 space-y-6">

                        {/* GROUPED ITEMS BY STORE */}
                        <div className="space-y-6">
                            {Object.entries(groupedItems).map(([storeId, { storeName, items: storeItems }]) => (
                                <div key={storeId} className="glass-panel overflow-hidden">
                                    {/* Store Header */}
                                    <div className="p-4 bg-[var(--surface-2)]/50 border-b border-[var(--glass-border)] flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-[var(--brand-primary)]/20 flex items-center justify-center text-xl">
                                            🏪
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-[var(--text-main)]">{storeName}</h3>
                                            <p className="text-xs text-[var(--text-muted)]">{storeItems.length} item{storeItems.length !== 1 ? 's' : ''}</p>
                                        </div>
                                    </div>

                                    {/* Items List */}
                                    <div className="divide-y divide-[var(--glass-border)]">
                                        {storeItems.map(item => (
                                            <div key={item.id} className="p-4 flex gap-4">
                                                {/* Image */}
                                                <div className="w-20 h-20 rounded-lg bg-[var(--surface-2)] overflow-hidden flex-shrink-0">
                                                    {item.image && <img src={item.image} alt="" className="w-full h-full object-cover" />}
                                                </div>

                                                {/* Details */}
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium text-[var(--text-main)] truncate flex items-center gap-1.5">
                                                        <span>{item.productName}</span>
                                                        {item.is_canadian_local && (
                                                            <span className="text-xs" title="Canadian Local">🍁</span>
                                                        )}
                                                    </h4>
                                                    <p className="text-[var(--brand-primary)] font-bold">${item.price.toFixed(2)}</p>

                                                    {/* Quantity Controls */}
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <button
                                                            onClick={() => updateQuantity(item.id, -1)}
                                                            className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-base md:text-sm hover:bg-[var(--surface-1)] transition-colors"
                                                        >
                                                            −
                                                        </button>
                                                        <span className="w-8 text-center font-mono">{item.quantity}</span>
                                                        <button
                                                            onClick={() => updateQuantity(item.id, 1)}
                                                            className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-base md:text-sm hover:bg-[var(--surface-1)] transition-colors"
                                                        >
                                                            +
                                                        </button>
                                                        <button
                                                            onClick={() => removeFromCart(item.id)}
                                                            className="ml-auto text-[var(--status-error)] text-sm font-bold py-2 px-3 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            {t('cartRemove')}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Line Total */}
                                                <div className="text-right">
                                                    <p className="font-bold text-[var(--text-main)]">${(item.price * item.quantity).toFixed(2)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: CHECKOUT SUMMARY (Span 4) */}
                    <div className="lg:col-span-4 mt-8 lg:mt-0">
                        <div className="glass-panel p-6 sticky top-[calc(6.5rem+var(--safe-area-top))] border-[var(--glass-border)] shadow-xl bg-white/50 backdrop-blur-xl">
                            <h2 className="text-xl font-bold text-[var(--text-main)] mb-4">{t('orderSummaryTitle')}</h2>

                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[var(--text-muted)]">{t('orderSubtotal')}</span>
                                <span className="text-xl font-bold text-[var(--text-main)]">${subtotal.toFixed(2)}</span>
                            </div>

                            <div className="flex items-center justify-between mb-6 text-green-600 text-sm">
                                <span>{t('orderTotalSavings')}</span>
                                <span>-${estimatedSavings}</span>
                            </div>

                            <div className="border-t border-[var(--glass-border)] my-4"></div>

                            <button
                                onClick={() => navigate('/checkout')}
                                className="w-full py-4 bg-[#112244] text-white font-black text-sm tracking-[0.2em] uppercase rounded-2xl hover:bg-[#007AFF] transition-all active:scale-95 shadow-xl shadow-blue-900/20 mb-3"
                            >
                                {t('proceedCheckout')}
                            </button>

                            <p className="text-xs text-[var(--text-muted)] text-center">
                                {t('taxNote')}
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Cart;
