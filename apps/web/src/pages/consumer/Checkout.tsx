import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useOrders } from '../../context/OrderContext';
import { useMarketplace } from '../../context/MarketplaceContext';
// Audit import removed
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { STORE_DATA } from '../../data/productData';
import '../../styles/design-system.css';

const Checkout: React.FC = () => {
    const { items, subtotal, clearCart } = useCart();
    const { addOrder, createBatchOrders, profile } = useOrders();
    const { user } = useAuth();
    const { addNotification } = useNotifications();
    const { getStore } = useMarketplace(); // Moved up
    const navigate = useNavigate();

    // Helper to check if store is open
    const isStoreOpen = (store: any): boolean => {
        if (!store || !store.hours) {
            console.log('Checkout Debug: Store open (default) - no hours data');
            return true;
        }
        const now = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[now.getDay()];

        const todayHours = store.hours.find((h: any) => h.day === currentDay);

        console.log(`Checkout Debug: Checking hours for ${currentDay}`, todayHours);

        if (!todayHours || todayHours.closed) {
            console.log('Checkout Debug: Store closed (explicitly closed or no schedule for today)');
            return false;
        }

        const currentTime = now.getHours() * 60 + now.getMinutes();
        const [openHour, openMin] = todayHours.open.split(':').map(Number);
        const [closeHour, closeMin] = todayHours.close.split(':').map(Number);

        const openTime = openHour * 60 + openMin;
        const closeTime = closeHour * 60 + closeMin;

        const isOpen = currentTime >= openTime && currentTime < closeTime;
        console.log(`Checkout Debug: Time Check ${currentTime} vs [${openTime}, ${closeTime}] -> Open? ${isOpen}`);

        return isOpen;
    };

    // Security Check: Redirect to login if not authenticated
    useEffect(() => {
        if (!user && items.length > 0) {
            navigate('/login?returnUrl=/checkout', { replace: true });
        }
    }, [user, navigate, items.length]);

    // Group items by store
    const groupedItems = items.reduce((acc, item) => {
        const store = getStore(item.storeId);
        if (!acc[item.storeId]) {
            acc[item.storeId] = {
                storeName: item.storeName,
                total: 0,
                items: [],
                tier: store?.subscriptionTier || STORE_DATA[item.storeId]?.subscriptionTier || 'free',
                deliveryEnabled: store?.deliveryEnabled !== false,
                pickupEnabled: store?.pickupEnabled !== false,
                isOpen: isStoreOpen(store),
                acceptsOnlinePayment: !!store?.stripeAccountId && store?.stripeOnboardingStatus === 'complete'
            };
        }
        acc[item.storeId].total += item.price * item.quantity;
        acc[item.storeId].items.push(item);
        return acc;
    }, {} as Record<string, { storeName: string; total: number; items: any[]; tier: string; deliveryEnabled: boolean; pickupEnabled: boolean; isOpen: boolean; acceptsOnlinePayment: boolean }>);

    // State for fulfillment method PER STORE
    const [fulfillmentMethods, setFulfillmentMethods] = useState<Record<string, 'delivery' | 'pickup'>>({});
    // Audit logging removed
    const [isProcessing, setIsProcessing] = useState(false);
    const [orderComplete, setOrderComplete] = useState(false);

    // Initialize fulfillment methods based on tier capabilities
    useEffect(() => {
        const methods: Record<string, 'delivery' | 'pickup'> = {};
        Object.entries(groupedItems).forEach(([storeId, data]) => {
            const store = getStore(storeId);
            const tier = store?.subscriptionTier || data.tier || 'free';
            const deliveryEnabled = store?.deliveryEnabled !== false;
            const pickupEnabled = store?.pickupEnabled !== false;

            // Determine default method
            if (tier !== 'free' && deliveryEnabled) {
                methods[storeId] = 'delivery';
            } else if (pickupEnabled) {
                methods[storeId] = 'pickup';
            } else {
                // Edge case: Both disabled (shouldn't happen in normal flow)
                methods[storeId] = 'pickup';
            }
        });
        setFulfillmentMethods(methods);
    }, [items.length, getStore]);

    const toggleFulfillment = (storeId: string, method: 'delivery' | 'pickup') => {
        const storeData = groupedItems[storeId];

        // Validation: Prevent selecting disabled methods
        if (method === 'delivery' && (storeData.tier === 'free' || !storeData.deliveryEnabled)) return;
        if (method === 'pickup' && !storeData.pickupEnabled) return;

        setFulfillmentMethods(prev => ({
            ...prev,
            [storeId]: method
        }));
    };

    const taxRate = 0.13; // 13% HST Ontario

    // Calculate totals including Delivery Fees
    const { orderSubtotal, deliveryFees, calculatedTax, grandTotal } = React.useMemo(() => {
        let sub = 0;
        let taxableSub = 0;
        let fees = 0;
        let totalCalculatedTax = 0;

        Object.entries(groupedItems).forEach(([storeId, data]) => {
            let storeSubtotal = 0;
            let storeTaxable = 0;

            // Calculate Item Totals & Taxable Portion

            // Calculate Item Totals & Taxable Portion
            data.items.forEach((item: any) => {
                const itemTotal = item.price * item.quantity;
                storeSubtotal += itemTotal;

                // Check if item is taxable (default true if undefined for safety)
                // In a real app, we'd look up the product fresh from context/store, but using cart item snapshot is acceptable for now
                if (item.taxable !== false) {
                    storeTaxable += itemTotal;
                }
            });

            sub += storeSubtotal;

            const store = getStore(storeId);
            const method = fulfillmentMethods[storeId] || 'pickup';
            let fee = 0;

            if (store && method === 'delivery') {
                fee = 3.99;
                if (store.deliveryFeeValue !== undefined) {
                    fee = store.deliveryFeeValue;
                }
                const threshold = store.freeDeliveryThreshold || 0;
                if (threshold > 0 && storeSubtotal >= threshold) {
                    fee = 0;
                }
                fees += fee;
            }

            // Calculate Tax for this specific store based on its province
            const province = store?.province || STORE_DATA[storeId]?.province || 'ON';
            const TAX_RATES: Record<string, number> = { 'ON': 0.13, 'BC': 0.12, 'QC': 0.14975, 'AB': 0.05, 'NS': 0.15, 'NB': 0.15, 'MB': 0.12, 'SK': 0.11, 'PE': 0.15, 'NL': 0.15 };
            const rate = TAX_RATES[province] || 0.13;

            // Tax is applied to taxable items + delivery fee
            // Note: In some jurisdictions delivery might be taxed differently, but for simplicity assuming general sales tax rule
            totalCalculatedTax += (storeTaxable + fee) * rate;
        });

        // Computed totals
        return {
            orderSubtotal: sub,
            deliveryFees: fees,
            calculatedTax: totalCalculatedTax,
            grandTotal: sub + fees + totalCalculatedTax
        };


    }, [groupedItems, fulfillmentMethods, getStore]);

    const handlePayment = async () => {
        // Validation check for minimum orders
        for (const [storeId, data] of Object.entries(groupedItems)) {
            const method = fulfillmentMethods[storeId] || 'pickup';
            const store = getStore(storeId);

            if (method === 'delivery') {
                if (store && store.minDeliveryOrder && data.total < store.minDeliveryOrder) {
                    addNotification({
                        type: 'alert',
                        title: 'Minimum Order Required',
                        message: `${data.storeName} requires a minimum order of $${store.minDeliveryOrder.toFixed(2)} for delivery.`
                    });
                    return;
                }

                if (!profile.addresses || profile.addresses.length === 0) {
                    addNotification({
                        type: 'alert',
                        title: 'Missing Address',
                        message: `Please add a delivery address to your profile before placing a delivery order.`
                    });
                    // Ideally redirect to profile/address page or show modal
                    navigate('/profile/addresses');
                    return;
                }
            }
        }

        setIsProcessing(true);

        try {
            // Prepare orders for batch submission
            const ordersToCreate = Object.entries(groupedItems).map(([storeId, data]) => {
                const method = fulfillmentMethods[storeId] || 'pickup';
                const store = getStore(storeId) || STORE_DATA[storeId];

                // Determine Rate
                const province = store?.province || 'ON';
                const TAX_RATES: Record<string, number> = { 'ON': 0.13, 'BC': 0.12, 'QC': 0.14975, 'AB': 0.05, 'NS': 0.15, 'NB': 0.15, 'MB': 0.12, 'SK': 0.11, 'PE': 0.15, 'NL': 0.15 };
                const rate = TAX_RATES[province] || 0.13;

                // Re-calculate fee for this specific order
                let fee = 0;
                if (method === 'delivery' && store) {
                    fee = store.deliveryFeeValue !== undefined ? store.deliveryFeeValue : 3.99;
                    const threshold = store.freeDeliveryThreshold || 0;
                    if (threshold > 0 && data.total >= threshold) {
                        fee = 0;
                    }
                }

                // Re-calculate tax based on item taxability (OUTSIDE RETURN)
                const taxableAmount = data.items.reduce((sum: number, i: any) => {
                    return (i.taxable !== false) ? sum + (i.price * i.quantity) : sum;
                }, 0);

                // Delivery fee is also taxable
                const taxAmount = (taxableAmount + fee) * rate;

                return {
                    storeId,
                    storeName: data.storeName,
                    storeProvince: province,
                    appliedTaxRate: rate,
                    status: 'placed' as const,
                    items: data.items.map((i: any) => ({
                        productId: i.productId || i.id,
                        productName: i.productName || i.name, // Fallback for safety
                        price: i.price,
                        quantity: i.quantity,
                        image: i.image,
                        taxable: i.taxable !== false
                    })),
                    subtotal: data.total,
                    tax: taxAmount,
                    deliveryFee: fee,
                    total: data.total + taxAmount + fee,
                    paymentMethod: 'in_store' as const,
                    paymentStatus: 'pending' as const,
                    deliveryAddress: method === 'delivery'
                        ? (() => {
                            const addr = (profile.addresses.find(a => a.isDefault) || profile.addresses[0]);
                            if (!addr) return undefined;
                            return {
                                id: String(addr.id || ''),
                                street: String(addr.street || ''),
                                city: String(addr.city || ''),
                                province: String(addr.province || ''),
                                postalCode: String(addr.postalCode || ''),
                                label: String(addr.label || 'Home'),
                                isDefault: !!addr.isDefault
                            };
                        })()
                        : undefined
                };
            });

            console.log(`Submitting batch of ${ordersToCreate.length} orders`);
            await createBatchOrders(ordersToCreate);
            console.log('All orders submitted successfully via batch');

            clearCart();
            setOrderComplete(true);
            // logEvent('checkout_completed', { total_amount: grandTotal, num_stores: Object.keys(groupedItems).length });

        } catch (err: any) {
            console.error('Checkout failed:', err);
            // Show detailed error
            addNotification({
                type: 'alert',
                title: 'Order Failed',
                message: `Failed to place order: ${err.message || JSON.stringify(err)}`
            });
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
                    {Object.entries(groupedItems).map(([storeId, { storeName, total, tier, items, isOpen, deliveryEnabled, pickupEnabled }]) => {
                        const bothDisabled = !deliveryEnabled && !pickupEnabled;
                        const isBlocked = !isOpen || bothDisabled;

                        return (
                            <div key={storeId} className={`glass-panel p-6 ${isBlocked ? 'opacity-70 grayscale-[0.5] border-2 border-red-100' : ''}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-[var(--surface-2)] flex items-center justify-center text-lg">🏪</div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h2 className="font-bold text-[var(--text-main)]">{storeName}</h2>
                                                {groupedItems[storeId].acceptsOnlinePayment && (
                                                    <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                                                        💳 Online Pay
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-[var(--text-muted)]">{items.length} items • ${total.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    {(tier === 'free' || !groupedItems[storeId].deliveryEnabled) && !bothDisabled && (
                                        <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-full uppercase tracking-wider">
                                            Store Pickup Only
                                        </span>
                                    )}
                                    {bothDisabled && (
                                        <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-1 rounded-full uppercase tracking-wider">
                                            ⛔ Ordering Disabled
                                        </span>
                                    )}
                                    {!isOpen && !bothDisabled && (
                                        <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded-full uppercase tracking-wider">
                                            🕒 Closed Now
                                        </span>
                                    )}
                                </div>

                                {/* Fulfillment Toggle */}
                                <div className="bg-[var(--surface-1)] p-1 rounded-lg flex mb-4">
                                    <button
                                        onClick={() => toggleFulfillment(storeId, 'pickup')}
                                        disabled={!pickupEnabled || isBlocked}
                                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${fulfillmentMethods[storeId] === 'pickup'
                                            ? 'bg-white text-[var(--brand-primary)] shadow-sm'
                                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-50 disabled:cursor-not-allowed'
                                            }`}
                                    >
                                        🛍️ Pickup
                                        {(!pickupEnabled) && <span className="text-[8px] border border-gray-300 px-1 rounded">UNAVAILABLE</span>}
                                    </button>
                                    <button
                                        onClick={() => toggleFulfillment(storeId, 'delivery')}
                                        disabled={tier === 'free' || !deliveryEnabled || isBlocked}
                                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${fulfillmentMethods[storeId] === 'delivery'
                                            ? 'bg-white text-[var(--brand-primary)] shadow-sm'
                                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-50 disabled:cursor-not-allowed'
                                            }`}
                                    >
                                        🚚 Delivery
                                        {(tier === 'free' || !deliveryEnabled) && <span className="text-[8px] border border-gray-300 px-1 rounded">UNAVAILABLE</span>}
                                    </button>
                                </div>

                                {/* Item List (Collapsed/Simple) */}
                                < div className="space-y-2 pl-2 border-l-2 border-[var(--glass-border)]" >
                                    {
                                        items.map((item: any, idx) => (
                                            <div key={idx} className="flex justify-between text-sm">
                                                <span className="text-[var(--text-muted)]">{item.quantity}x {item.productName}</span>
                                                <span className="font-mono text-[var(--text-main)]">${(item.price * item.quantity).toFixed(2)}</span>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer Summary */}
                <div className="mt-8 glass-panel p-6">
                    <div className="flex justify-between items-center mb-4">
                        <span className="font-bold text-lg text-[var(--text-main)]">
                            {(() => {
                                const methods = Object.values(fulfillmentMethods);
                                const hasDelivery = methods.includes('delivery');
                                const hasPickup = methods.includes('pickup');

                                if (hasDelivery && hasPickup) return "Total Due (Store & Delivery)";
                                if (hasDelivery) return "Total Due (Pay on Delivery)";
                                return "Total Due (Pay at Store)";
                            })()}
                        </span>
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
                        <div className="flex justify-between text-sm text-[var(--text-muted)] mb-3 pb-3 border-b border-[var(--glass-border)]">
                            <span>Estimated Tax <span className="text-[10px] bg-gray-100 px-1 rounded">VARIES BY PROVINCE</span></span>
                            <span>${calculatedTax.toFixed(2)}</span>
                        </div>
                    </div>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed bg-blue-50 p-4 rounded-xl border border-blue-100 text-blue-800">
                        <strong>Note:</strong> Spendigo is a marketplace facilitator. You are reserving these items directly from the merchants.
                        Please complete payment at the store or with the delivery driver upon receipt.
                    </p>
                </div>
            </div >

            {/* FIXED ACTION BUTTON */}
            < div className="fixed bottom-20 left-0 right-0 p-4 bg-[var(--surface-0)] border-t border-[var(--glass-border)]" >
                <div className="max-w-3xl mx-auto">
                    {(() => {
                        // Check if ANY store blocks the entire checkout
                        const hasBlockers = Object.values(groupedItems).some(g => !g.isOpen || (!g.deliveryEnabled && !g.pickupEnabled));

                        return (
                            <button
                                onClick={handlePayment}
                                disabled={isProcessing || hasBlockers}
                                className={`w-full py-4 text-white font-bold text-lg rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg ${isProcessing || hasBlockers
                                    ? 'bg-gray-400 cursor-not-allowed opacity-80'
                                    : 'bg-[var(--brand-primary)] hover:brightness-110 active:scale-95 shadow-[var(--brand-primary)]/30'
                                    }`}
                            >
                                {isProcessing ? 'Confirming Orders...' :
                                    hasBlockers ? '⚠️ Cannot Checkout (Store Closed or Disabled)' :
                                        `Confirm Reservations • $${grandTotal.toFixed(2)}`}
                            </button>
                        );
                    })()}
                </div>
            </div >
        </div >
    );
};

export default Checkout;
