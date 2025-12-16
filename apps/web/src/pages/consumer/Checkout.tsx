import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import '../../styles/design-system.css';

const Checkout: React.FC = () => {
    const { items, subtotal, clearCart } = useCart();

    // Group items by store for split payment breakdown
    const groupedItems = items.reduce((acc, item) => {
        if (!acc[item.storeId]) {
            acc[item.storeId] = { storeName: item.storeName, total: 0 };
        }
        acc[item.storeId].total += item.price * item.quantity;
        return acc;
    }, {} as Record<string, { storeName: string; total: number }>);

    const serviceFee = 2.00;
    const taxRate = 0.13; // 13% HST Ontario
    const taxAmount = (subtotal + serviceFee) * taxRate;
    const grandTotal = subtotal + serviceFee + taxAmount;

    const handlePayment = () => {
        // In production: Call Stripe API
        alert('Payment processing would happen here via Stripe Connect');
        clearCart();
    };

    if (items.length === 0) {
        return (
            <div className="animate-fade-in flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
                <div className="text-6xl mb-4">✅</div>
                <h2 className="text-2xl font-bold text-[var(--text-main)] mb-2">Order Complete!</h2>
                <p className="text-[var(--text-muted)] mb-6">Thank you for shopping with Spendigo.</p>
                <Link
                    to="/"
                    className="px-6 py-3 bg-[var(--brand-primary)] text-white font-bold rounded-full hover:brightness-110 transition-all"
                >
                    Continue Shopping
                </Link>
            </div>
        );
    }

    return (
        <div className="animate-fade-in pb-40">
            <div className="max-w-3xl mx-auto px-4 py-6">
                <h1 className="text-3xl font-bold text-[var(--text-main)] mb-6">Checkout</h1>

                {/* ORDER SUMMARY BY STORE */}
                <div className="glass-panel p-6 mb-6">
                    <h2 className="font-bold text-lg text-[var(--text-main)] mb-4">Order Summary</h2>

                    <div className="space-y-4 mb-6">
                        {Object.entries(groupedItems).map(([storeId, { storeName, total }]) => (
                            <div key={storeId} className="flex justify-between items-center py-2 border-b border-[var(--glass-border)]">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-[var(--surface-2)] flex items-center justify-center text-sm">🏪</div>
                                    <span className="text-[var(--text-main)]">{storeName}</span>
                                </div>
                                <span className="font-mono text-[var(--text-main)]">${total.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>

                    {/* Fees & Taxes */}
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-[var(--text-muted)]">Subtotal</span>
                            <span className="text-[var(--text-main)]">${subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--text-muted)]">Service Fee</span>
                            <span className="text-[var(--text-main)]">${serviceFee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--text-muted)]">HST (13%)</span>
                            <span className="text-[var(--text-main)]">${taxAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between pt-4 border-t border-[var(--glass-border)]">
                            <span className="font-bold text-lg text-[var(--text-main)]">Total</span>
                            <span className="font-bold text-lg text-[var(--brand-primary)]">${grandTotal.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* DELIVERY ADDRESS (Mock) */}
                <div className="glass-panel p-6 mb-6">
                    <h2 className="font-bold text-lg text-[var(--text-main)] mb-4">Delivery Address</h2>
                    <div className="flex items-start gap-3">
                        <span className="text-2xl">📍</span>
                        <div>
                            <p className="font-medium text-[var(--text-main)]">123 Queen Street West</p>
                            <p className="text-sm text-[var(--text-muted)]">Toronto, ON M5H 2M9</p>
                            <button className="text-[var(--brand-primary)] text-sm mt-2 hover:underline">Change</button>
                        </div>
                    </div>
                </div>

                {/* PAYMENT METHOD (Mock) */}
                <div className="glass-panel p-6 mb-6">
                    <h2 className="font-bold text-lg text-[var(--text-main)] mb-4">Payment Method</h2>
                    <div className="flex items-center gap-3 p-3 bg-[var(--surface-2)] rounded-lg">
                        <span className="text-2xl">💳</span>
                        <div className="flex-1">
                            <p className="font-medium text-[var(--text-main)]">•••• •••• •••• 4242</p>
                            <p className="text-sm text-[var(--text-muted)]">Expires 12/25</p>
                        </div>
                        <button className="text-[var(--brand-primary)] text-sm hover:underline">Change</button>
                    </div>
                </div>

                {/* TRANSPARENCY DISCLAIMER */}
                <div className="bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-lg p-4 mb-6">
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        <strong>Split Payment Notice:</strong> Your bank statement will show separate charges for each store
                        in your order. This is how our Marketplace Facilitator model works to ensure transparent pricing
                        and direct payment to local merchants.
                    </p>
                </div>
            </div>

            {/* FIXED PAY BUTTON */}
            <div className="fixed bottom-20 left-0 right-0 p-4 bg-[var(--surface-0)] border-t border-[var(--glass-border)]">
                <div className="max-w-3xl mx-auto">
                    <button
                        onClick={handlePayment}
                        className="w-full py-4 bg-[var(--brand-primary)] text-white font-bold text-lg rounded-2xl hover:brightness-110 transition-all active:scale-95 shadow-lg shadow-[var(--brand-primary)]/30 flex items-center justify-center gap-2"
                    >
                        <span>Pay</span>
                        <span className="font-mono">${grandTotal.toFixed(2)}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Checkout;
