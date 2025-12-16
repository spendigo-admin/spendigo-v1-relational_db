import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import '../../styles/design-system.css';

const Cart: React.FC = () => {
    const navigate = useNavigate();
    const { items, updateQuantity, removeFromCart, subtotal, clearCart } = useCart();

    // Group items by store
    const groupedItems = items.reduce((acc, item) => {
        if (!acc[item.storeId]) {
            acc[item.storeId] = { storeName: item.storeName, items: [] };
        }
        acc[item.storeId].items.push(item);
        return acc;
    }, {} as Record<string, { storeName: string; items: typeof items }>);

    const storeCount = Object.keys(groupedItems).length;
    const estimatedSavings = (subtotal * 0.15).toFixed(2); // Mock 15% savings

    if (items.length === 0) {
        return (
            <div className="animate-fade-in flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
                <div className="text-6xl mb-4">🛒</div>
                <h2 className="text-2xl font-bold text-[var(--text-main)] mb-2">Your cart is empty</h2>
                <p className="text-[var(--text-muted)] mb-6">Start shopping to add items to your cart.</p>
                <Link
                    to="/"
                    className="px-6 py-3 bg-[var(--brand-primary)] text-white font-bold rounded-full hover:brightness-110 transition-all"
                >
                    Browse Stores
                </Link>
            </div>
        );
    }

    return (
        <div className="animate-fade-in pb-40">
            {/* HEADER */}
            <div className="px-4 py-6">
                <div className="max-w-3xl mx-auto">
                    <h1 className="text-3xl font-bold text-[var(--text-main)] mb-1">Your Cart</h1>
                    <p className="text-[var(--text-muted)]">
                        {items.length} item{items.length !== 1 ? 's' : ''} from {storeCount} store{storeCount !== 1 ? 's' : ''}
                    </p>
                </div>
            </div>

            {/* SAVINGS BANNER */}
            <div className="px-4 mb-6">
                <div className="max-w-3xl mx-auto">
                    <div className="glass-panel p-4 bg-gradient-to-r from-[var(--status-success)]/20 to-[var(--brand-primary)]/20 border-[var(--status-success)]/30 flex items-center gap-4">
                        <div className="text-3xl">🎉</div>
                        <div className="flex-1">
                            <p className="font-bold text-[var(--text-main)]">
                                You're saving ~${estimatedSavings} by shopping smart!
                            </p>
                            <p className="text-sm text-[var(--text-muted)]">
                                Spendigo optimizes your order across multiple stores.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* GROUPED ITEMS BY STORE */}
            <div className="px-4">
                <div className="max-w-3xl mx-auto space-y-6">
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
                                            <h4 className="font-medium text-[var(--text-main)] truncate">{item.productName}</h4>
                                            <p className="text-[var(--brand-primary)] font-bold">${item.price.toFixed(2)}</p>

                                            {/* Quantity Controls */}
                                            <div className="flex items-center gap-2 mt-2">
                                                <button
                                                    onClick={() => updateQuantity(item.id, -1)}
                                                    className="w-8 h-8 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-sm hover:bg-[var(--surface-1)] transition-colors"
                                                >
                                                    −
                                                </button>
                                                <span className="w-8 text-center font-mono">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.id, 1)}
                                                    className="w-8 h-8 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-sm hover:bg-[var(--surface-1)] transition-colors"
                                                >
                                                    +
                                                </button>
                                                <button
                                                    onClick={() => removeFromCart(item.id)}
                                                    className="ml-auto text-[var(--status-error)] text-sm hover:underline"
                                                >
                                                    Remove
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

            {/* FIXED CHECKOUT FOOTER */}
            <div className="fixed bottom-20 left-0 right-0 p-4 bg-[var(--surface-0)] border-t border-[var(--glass-border)]">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[var(--text-muted)]">Subtotal</span>
                        <span className="text-2xl font-bold text-[var(--text-main)]">${subtotal.toFixed(2)}</span>
                    </div>
                    <button
                        onClick={() => navigate('/checkout')}
                        className="w-full py-4 bg-[var(--brand-primary)] text-white font-bold text-lg rounded-2xl hover:brightness-110 transition-all active:scale-95 shadow-lg shadow-[var(--brand-primary)]/30"
                    >
                        Proceed to Checkout
                    </button>
                    <p className="text-xs text-[var(--text-muted)] text-center mt-2">
                        Taxes and delivery fees calculated at checkout
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Cart;
