import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useOrders } from '../../context/OrderContext';
import { useAuth } from '../../context/AuthContext';
import '../../styles/design-system.css';

const Checkout: React.FC = () => {
    const { items, subtotal, clearCart } = useCart();
    const { addOrder, profile } = useOrders();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [paymentMethod, setPaymentMethod] = useState<'card' | 'in_store'>('in_store');
    const [isProcessing, setIsProcessing] = useState(false);
    const [orderComplete, setOrderComplete] = useState(false);

    // Group items by store for split payment breakdown
    const groupedItems = items.reduce((acc, item) => {
        if (!acc[item.storeId]) {
            acc[item.storeId] = { storeName: item.storeName, total: 0, items: [] };
        }
        acc[item.storeId].total += item.price * item.quantity;
        acc[item.storeId].items.push(item);
        return acc;
    }, {} as Record<string, { storeName: string; total: number; items: any[] }>);

    const taxRate = 0.13; // 13% HST Ontario
    const taxAmount = subtotal * taxRate;
    const grandTotal = subtotal + taxAmount; // No Service Fee

    const handlePayment = async () => {
        setIsProcessing(true);

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Create an order for EACH store (Split Orders)
        Object.entries(groupedItems).forEach(([storeId, data]) => {
            addOrder({
                storeId,
                storeName: data.storeName,
                status: 'placed',
                items: data.items.map(i => ({
                    productId: i.id,
                    productName: i.name,
                    price: i.price,
                    quantity: i.quantity,
                    image: i.image
                })),
                subtotal: data.total,
                tax: data.total * taxRate,
                deliveryFee: 0, // Mock delivery fee
                total: data.total * (1 + taxRate),
                paymentMethod: paymentMethod,
                paymentStatus: paymentMethod === 'card' ? 'paid' : 'pending',
                deliveryAddress: profile.addresses.find(a => a.isDefault) || profile.addresses[0] || {
                    id: 'temp', label: 'Home', street: '123 Queen St', city: 'Toronto', province: 'ON', postalCode: 'M5V 2A2', isDefault: true
                }
            });
        });

        clearCart();
        setIsProcessing(false);
        setOrderComplete(true);
    };

    if (orderComplete) {
        return (
            <div className="animate-fade-in flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
                <div className="text-6xl mb-4">✅</div>
                <h2 className="text-2xl font-bold text-[var(--text-main)] mb-2">Order Placed!</h2>
                <p className="text-[var(--text-muted)] mb-6">
                    {paymentMethod === 'in_store'
                        ? 'Please pay directly at the store or upon delivery.'
                        : 'Your payment has been processed securely.'}
                </p>
                <div className="flex gap-4">
                    <Link
                        to="/consumer" // Redirect to Consumer Home
                        className="px-6 py-3 bg-gray-100 text-[var(--text-main)] font-bold rounded-full hover:bg-gray-200 transition-all"
                    >
                        Home
                    </Link>
                    <Link
                        to="/consumer/orders" // Redirect to Order Tracking
                        className="px-6 py-3 bg-[var(--brand-primary)] text-white font-bold rounded-full hover:brightness-110 transition-all"
                    >
                        Track Order
                    </Link>
                </div>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <p className="text-[var(--text-muted)] text-lg mb-4">Your cart is empty.</p>
                <Link to="/consumer" className="text-[var(--brand-primary)] font-bold hover:underline">Start Shopping</Link>
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
                            <span className="text-[var(--text-muted)]">HST (13%)</span>
                            <span className="text-[var(--text-main)]">${taxAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between pt-4 border-t border-[var(--glass-border)]">
                            <span className="font-bold text-lg text-[var(--text-main)]">Total</span>
                            <span className="font-bold text-lg text-[var(--brand-primary)]">${grandTotal.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* PAYMENT METHOD (Fixed) */}
                <div className="glass-panel p-6 mb-6">
                    <h2 className="font-bold text-lg text-[var(--text-main)] mb-4">Payment Method</h2>

                    <div className="flex items-start gap-3 p-4 rounded-xl border-2 border-[var(--brand-primary)] bg-[var(--brand-primary)]/5">
                        <div className="w-5 h-5 rounded-full border-2 border-[var(--brand-primary)] mt-1 flex items-center justify-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-[var(--brand-primary)]" />
                        </div>
                        <div className="flex-1">
                            <div className="font-bold text-[var(--text-main)] flex items-center gap-2">
                                <span>💵</span> Pay at Store / On Delivery
                            </div>
                            <p className="text-sm text-[var(--text-muted)] mt-1">
                                Please pay the merchant directly via Cash, Debit, or Credit upon receipt.
                                Spendigo does not process payments.
                            </p>
                        </div>
                    </div>
                </div>

                {/* LEGAL DISCLAIMER */}
                <div className="bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-lg p-4 mb-6">
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        <strong>Legal Notice:</strong> Spendigo SmartCart is a marketplace facilitator for product discovery and order routing only.
                        All payments, refunds, taxes, and fulfillment are handled directly by participating stores.
                    </p>
                </div>
            </div>

            {/* FIXED PAY BUTTON */}
            <div className="fixed bottom-20 left-0 right-0 p-4 bg-[var(--surface-0)] border-t border-[var(--glass-border)]">
                <div className="max-w-3xl mx-auto">
                    <button
                        onClick={handlePayment}
                        disabled={isProcessing}
                        className="w-full py-4 bg-[var(--brand-primary)] text-white font-bold text-lg rounded-2xl hover:brightness-110 transition-all active:scale-95 shadow-lg shadow-[var(--brand-primary)]/30 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? (
                            <span>Processing...</span>
                        ) : (
                            <>
                                <span>Place Order</span>
                                <span className="font-mono">${grandTotal.toFixed(2)}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Checkout;
