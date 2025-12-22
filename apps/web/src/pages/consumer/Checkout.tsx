import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useOrders } from '../../context/OrderContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useAudit } from '../../context/AuditContext';
import { useAuth } from '../../context/AuthContext';
import { STORE_DATA } from '../../data/productData';
import '../../styles/design-system.css';

const Checkout: React.FC = () => {
    const { items, subtotal, clearCart } = useCart();
    const { addOrder, profile } = useOrders();
    const { user } = useAuth();
    const navigate = useNavigate();

    // Security Check: Redirect to login if not authenticated
    useEffect(() => {
        if (!user && items.length > 0) {
            navigate('/login?returnUrl=/checkout', { replace: true });
        }
    }, [user, navigate, items.length]);

    // Group items by store
    const groupedItems = items.reduce((acc, item) => {
        if (!acc[item.storeId]) {
            acc[item.storeId] = {
                storeName: item.storeName,
                total: 0,
                items: [],
                tier: STORE_DATA[item.storeId]?.subscriptionTier || 'free' // Default to free if unknown
            };
        }
        acc[item.storeId].total += item.price * item.quantity;
        acc[item.storeId].items.push(item);
        return acc;
    }, {} as Record<string, { storeName: string; total: number; items: any[]; tier: string }>);

    // State for fulfillment method PER STORE
    const [fulfillmentMethods, setFulfillmentMethods] = useState<Record<string, 'delivery' | 'pickup'>>({});
    const { getStore } = useMarketplace();
    const { logEvent } = useAudit();
    const [isProcessing, setIsProcessing] = useState(false);
    const [orderComplete, setOrderComplete] = useState(false);

    // Initialize fulfillment methods based on tier capabilities
    useEffect(() => {
        const methods: Record<string, 'delivery' | 'pickup'> = {};
        Object.entries(groupedItems).forEach(([storeId, data]) => {
            // Free tier = Pickup Only. Others = Default to Delivery.
            if (data.tier === 'free') {
                methods[storeId] = 'pickup';
            } else {
                methods[storeId] = 'delivery';
            }
        });
        setFulfillmentMethods(methods);
    }, [items.length]);

    const toggleFulfillment = (storeId: string, method: 'delivery' | 'pickup') => {
        // Prevent selecting delivery for free tier
        const storeTier = groupedItems[storeId]?.tier;
        if (storeTier === 'free' && method === 'delivery') return;

        setFulfillmentMethods(prev => ({
            ...prev,
            [storeId]: method
        }));
    };

    const taxRate = 0.13; // 13% HST Ontario

    // Calculate totals including Delivery Fees
    const { orderSubtotal, deliveryFees, grandTotal } = React.useMemo(() => {
        let sub = 0;
        let fees = 0;

        Object.entries(groupedItems).forEach(([storeId, data]) => {
            const storeSubtotal = data.items.reduce((acc: any, item: any) => acc + (item.price * item.quantity), 0);
            sub += storeSubtotal;

            const store = getStore(storeId);
            const method = fulfillmentMethods[storeId] || 'pickup';

            if (store && method === 'delivery') {
                let fee = 3.99;
                if (store.deliveryFeeValue !== undefined) {
                    fee = store.deliveryFeeValue;
                }
                const threshold = store.freeDeliveryThreshold || 0;
                if (threshold > 0 && storeSubtotal >= threshold) {
                    fee = 0;
                }
                fees += fee;
            }
        });

        const tax = sub * taxRate;
        return {
            orderSubtotal: sub,
            deliveryFees: fees,
            grandTotal: sub + fees + tax
        };
    }, [groupedItems, fulfillmentMethods, getStore]);

    const handlePayment = async () => {
        // Validation check for minimum orders
        for (const [storeId, data] of Object.entries(groupedItems)) {
            const method = fulfillmentMethods[storeId] || 'pickup';
            const store = getStore(storeId);

            if (method === 'delivery' && store && store.minDeliveryOrder) {
                if (data.total < store.minDeliveryOrder) {
                    alert(`${data.storeName} requires a minimum order of $${store.minDeliveryOrder.toFixed(2)} for delivery.`);
                    return;
                }
            }
        }

        setIsProcessing(true);

        try {
            // Create an order for EACH store
            const orderPromises = Object.entries(groupedItems).map(async ([storeId, data]) => {
                const method = fulfillmentMethods[storeId] || 'pickup';
                const store = getStore(storeId);

                // Re-calculate fee for this specific order
                let fee = 0;
                if (method === 'delivery' && store) {
                    fee = store.deliveryFeeValue !== undefined ? store.deliveryFeeValue : 3.99;
                    const threshold = store.freeDeliveryThreshold || 0;
                    if (threshold > 0 && data.total >= threshold) {
                        fee = 0;
                    }
                }

                console.log(`Submitting order for Store ${storeId}`); // Debug log

                await addOrder({
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
                    deliveryFee: fee,
                    total: data.total + (data.total * taxRate) + fee,
                    paymentMethod: 'in_store', // Forced
                    paymentStatus: 'pending', // Forced
                    deliveryAddress: method === 'delivery'
                        ? (profile.addresses.find(a => a.isDefault) || profile.addresses[0])
                        : undefined // No address for pickup
                });
            });

            await Promise.all(orderPromises);
            console.log('All orders submitted successfully');

            clearCart();
            setOrderComplete(true);
            logEvent('checkout_completed', { total_amount: grandTotal, num_stores: Object.keys(groupedItems).length });

        } catch (err: any) {
            console.error('Checkout failed:', err);
            // Show detailed error
            alert(`Failed to place order: ${err.message || 'Unknown error'}`);
        } finally {
            setIsProcessing(false);
        }
    };

    if (orderComplete) {
        return (
            <div className="animate-fade-in flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
                <div className="glass-panel p-8 rounded-2xl shadow-lg max-w-md w-full">
                    <div className="text-6xl mb-4">🎉</div>
                    <h2 className="text-3xl font-bold text-[var(--text-main)] mb-3">Orders Confirmed!</h2>
                    <p className="text-[var(--text-muted)] mb-6">
                        Your reservations have been successfully placed with the merchants.
                        You will receive a confirmation email shortly.
                    </p>
                    <Link to="/" className="btn-primary w-full px-6 py-3 bg-[var(--brand-primary)] text-white rounded-xl font-bold">Continue Shopping</Link>
                </div>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <p className="text-[var(--text-muted)] text-lg mb-4">Your cart is empty.</p>
                <Link to="/" className="text-[var(--brand-primary)] font-bold hover:underline">Start Shopping</Link>
            </div>
        );
    }

    return (
        <div className="animate-fade-in pb-40">
            <div className="max-w-3xl mx-auto px-4 py-6">
                <h1 className="text-3xl font-bold text-[var(--text-main)] mb-6">Checkout</h1>

                <div className="space-y-6">
                    {/* Iterate over Stores */}
                    {Object.entries(groupedItems).map(([storeId, { storeName, total, tier, items }]) => (
                        <div key={storeId} className="glass-panel p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-[var(--surface-2)] flex items-center justify-center text-lg">🏪</div>
                                    <div>
                                        <h2 className="font-bold text-[var(--text-main)]">{storeName}</h2>
                                        <p className="text-xs text-[var(--text-muted)]">{items.length} items • ${total.toFixed(2)}</p>
                                    </div>
                                </div>
                                {tier === 'free' && (
                                    <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-full uppercase tracking-wider">
                                        Store Pickup Only
                                    </span>
                                )}
                            </div>

                            {/* Fulfillment Toggle */}
                            <div className="bg-[var(--surface-1)] p-1 rounded-lg flex mb-4">
                                <button
                                    onClick={() => toggleFulfillment(storeId, 'pickup')}
                                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${fulfillmentMethods[storeId] === 'pickup'
                                        ? 'bg-white text-[var(--brand-primary)] shadow-sm'
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                                        }`}
                                >
                                    🛍️ Pickup
                                </button>
                                <button
                                    onClick={() => toggleFulfillment(storeId, 'delivery')}
                                    disabled={tier === 'free'}
                                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${fulfillmentMethods[storeId] === 'delivery'
                                        ? 'bg-white text-[var(--brand-primary)] shadow-sm'
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-50 disabled:cursor-not-allowed'
                                        }`}
                                >
                                    🚚 Delivery
                                    {tier === 'free' && <span className="text-[8px] border border-gray-300 px-1 rounded">UNAVAILABLE</span>}
                                </button>
                            </div>

                            {/* Item List (Collapsed/Simple) */}
                            <div className="space-y-2 pl-2 border-l-2 border-[var(--glass-border)]">
                                {items.map((item: any, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span className="text-[var(--text-muted)]">{item.quantity}x {item.productName}</span>
                                        <span className="font-mono text-[var(--text-main)]">${(item.price * item.quantity).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Summary */}
                <div className="mt-8 glass-panel p-6">
                    <div className="flex justify-between items-center mb-4">
                        <span className="font-bold text-lg text-[var(--text-main)]">Total Due (Pay at Store)</span>
                        <span className="font-bold text-2xl text-[var(--brand-primary)]">${grandTotal.toFixed(2)}</span>
                    </div>
                    <div>
                        <div className="flex justify-between text-sm text-[var(--text-muted)] mb-1">
                            <span>Subtotal</span>
                            <span>${orderSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-[var(--text-muted)] mb-3">
                            <span>Delivery Fees</span>
                            <span>${deliveryFees.toFixed(2)}</span>
                        </div>
                    </div>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed bg-blue-50 p-4 rounded-xl border border-blue-100 text-blue-800">
                        <strong>Note:</strong> Spendigo is a marketplace facilitator. You are reserving these items directly from the merchants.
                        Please complete payment at the store or with the delivery driver upon receipt.
                    </p>
                </div>
            </div>

            {/* FIXED ACTION BUTTON */}
            <div className="fixed bottom-20 left-0 right-0 p-4 bg-[var(--surface-0)] border-t border-[var(--glass-border)]">
                <div className="max-w-3xl mx-auto">
                    <button
                        onClick={handlePayment}
                        disabled={isProcessing}
                        className="w-full py-4 bg-[var(--brand-primary)] text-white font-bold text-lg rounded-2xl hover:brightness-110 transition-all active:scale-95 shadow-lg shadow-[var(--brand-primary)]/30 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? 'Confirming Orders...' : `Confirm Reservations • $${grandTotal.toFixed(2)}`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Checkout;
