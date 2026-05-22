import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useOrders } from '../../context/OrderContext';
import { useWishlist } from '../../context/WishlistContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useLocation } from '../../context/LocationContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { STORE_DATA } from '../../data/productData';
import '../../styles/design-system.css';
import SEO from '../../components/SEO';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePromise } from '../../lib/stripe';
import { collection, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useTranslation } from 'react-i18next';

const Checkout: React.FC = () => {

    const stripe = useStripe();
    const elements = useElements();
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const orderIdParam = searchParams.get('order_id');
    const [isConfirmingSession, setIsConfirmingSession] = useState(false);

    const { items, subtotal, clearCart } = useCart();
    const { clearWishlist } = useWishlist();
    const { addOrder, createBatchOrders, profile } = useOrders();
    const { user } = useAuth();
    const { addNotification } = useNotifications();
    const { getStore } = useMarketplace(); // Moved up
    const { userCoords, calculateDistance } = useLocation();
    const navigate = useNavigate();
    const { t } = useTranslation();

    // Helper to check if store is open
    const isStoreOpen = (store: any): boolean => {
        if (!store || !store.hours) {
            return true;
        }
        const now = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const currentDay = days[now.getDay()];

        const todayHours = store.hours.find((h: any) => h.day === currentDay);

        if (!todayHours || todayHours.closed) {
            return false;
        }

        const currentTime = now.getHours() * 60 + now.getMinutes();
        const [openHour, openMin] = todayHours.open.split(':').map(Number);
        const [closeHour, closeMin] = todayHours.close.split(':').map(Number);

        const openTime = openHour * 60 + openMin;
        const closeTime = closeHour * 60 + closeMin;

        return currentTime >= openTime && currentTime < closeTime;
    };

    // Security Check: Redirect to login if not authenticated
    useEffect(() => {
        if (!user && items.length > 0 && !sessionId) {
            navigate('/login?returnUrl=/checkout', { replace: true });
        }
    }, [user, navigate, items.length, sessionId]);

    // Payment Confirmation & Checkout Session Verification Hook
    useEffect(() => {
        const confirmSession = async () => {
            if (!sessionId || isConfirmingSession || orderComplete) return;

            setIsConfirmingSession(true);
            try {
                // Retrieve the stored order info from localStorage
                const pendingOrderStr = localStorage.getItem('spendigo_pending_order_v1');
                if (!pendingOrderStr) {
                    throw new Error("No pending order session found in this browser.");
                }

                const pendingOrders = JSON.parse(pendingOrderStr);
                
                // Inject the stripe checkoutSessionId into each order object
                const ordersWithSession = pendingOrders.map((ord: any) => ({
                    ...ord,
                    checkoutSessionId: sessionId
                }));

                console.log("Confirming secure payment session and placing order:", sessionId);
                await createBatchOrders(ordersWithSession);

                // Clear cart and tracking info
                clearCart();
                clearWishlist();
                localStorage.removeItem('smartcart_selections_v1');
                localStorage.removeItem('spendigo_pending_order_v1');

                addNotification({
                    type: 'order',
                    title: 'Order Confirmed! 🎉',
                    message: 'Your secure payment was processed and your order is placed.'
                });

                // Redirect to tracking page
                const targetOrderId = orderIdParam || ordersWithSession[0]?.id;
                if (targetOrderId) {
                    navigate(`/order/${targetOrderId}`);
                } else {
                    navigate('/profile', { state: { activeTab: 'orders' } });
                }
            } catch (err: any) {
                console.error("Session confirmation failed:", err);
                addNotification({
                    type: 'alert',
                    title: 'Payment Confirmation Failed',
                    message: err.message || "Failed to finalize your payment. Please contact support."
                });
                // Remove query parameters to prevent infinite failure loops and preserve cart
                navigate('/checkout', { replace: true });
            } finally {
                setIsConfirmingSession(false);
            }
        };

        confirmSession();
    }, [sessionId, orderIdParam]);

    // Group items by store
    const groupedItems = useMemo(() => items.reduce((acc, item) => {
        const store = getStore(item.storeId);
        
        // --- RADIUS CHECK ---
        const maxRadius = store?.deliveryRadiusKm || 5;
        let distanceViolation = false;
        let distance = 0;
        
        if (store?.coordinates && userCoords) {
             distance = calculateDistance(
                 userCoords.lat, 
                 userCoords.lng, 
                 store.coordinates.lat, 
                 store.coordinates.lng
             );
             if (distance > maxRadius) {
                 distanceViolation = true;
             }
        }

        const isActive = store && store.status === 'active';
        
        if (!acc[item.storeId]) {
            acc[item.storeId] = {
                storeName: item.storeName,
                total: 0,
                items: [],
                tier: store?.subscriptionTier || STORE_DATA[item.storeId]?.subscriptionTier || 'free',
                deliveryEnabled: (store?.deliveryEnabled !== false) && !distanceViolation && isActive,
                pickupEnabled: (store?.pickupEnabled !== false) && isActive,
                isOpen: isStoreOpen(store) && isActive,
                acceptsOnlinePayment: !!store?.stripeAccountId && store?.stripeOnboardingStatus === 'complete' && isActive,
                distanceViolation,
                distance
            };
        }
        acc[item.storeId].total += item.price * item.quantity;
        acc[item.storeId].items.push(item);
        return acc;
    }, {} as Record<string, { storeName: string; total: number; items: any[]; tier: string; deliveryEnabled: boolean; pickupEnabled: boolean; isOpen: boolean; acceptsOnlinePayment: boolean; distanceViolation: boolean; distance: number }>), [items, getStore, userCoords, calculateDistance]);

    // State for fulfillment method PER STORE
    const [fulfillmentMethods, setFulfillmentMethods] = useState<Record<string, 'delivery' | 'pickup'>>({});
    // Payment choice per store: 'card' = pay online via Stripe, 'in_store' = pay at terminal / on delivery
    const [paymentChoices, setPaymentChoices] = useState<Record<string, 'card' | 'in_store'>>({});
    const [checkoutStep, setCheckoutStep] = useState<2 | 3>(2);
    const [isProcessing, setIsProcessing] = useState(false);
    const [orderComplete, setOrderComplete] = useState(false);
    const [ageVerified, setAgeVerified] = useState(false);

    // Check if any item in the cart is age-restricted
    const hasAgeRestricted = items.some((item: any) => item.age_restricted);

    // Initialize fulfillment methods based on tier capabilities
    useEffect(() => {
        const methods: Record<string, 'delivery' | 'pickup'> = {};
        const choices: Record<string, 'card' | 'in_store'> = {};
        Object.entries(groupedItems).forEach(([storeId, data]) => {
            const store = getStore(storeId);
            const tier = store?.subscriptionTier || data.tier || 'free';
            const deliveryEnabled = data.deliveryEnabled; // Use computed value that respects distance
            const pickupEnabled = data.pickupEnabled;

            // Determine default method
            if (tier !== 'free' && deliveryEnabled) {
                methods[storeId] = 'delivery';
            } else if (pickupEnabled) {
                methods[storeId] = 'pickup';
            } else {
                // Edge case: Both disabled (shouldn't happen in normal flow)
                methods[storeId] = 'pickup';
            }

            // Default payment choice: online for Stripe-connected stores, in_store otherwise
            choices[storeId] = data.acceptsOnlinePayment ? 'card' : 'in_store';
        });
        setFulfillmentMethods(methods);
        setPaymentChoices(choices);
    }, [items.length, getStore, userCoords]);

    const toggleFulfillment = (storeId: string, method: 'delivery' | 'pickup') => {
        const storeData = groupedItems[storeId];

        // Validation: Prevent selecting disabled methods
        if (method === 'delivery' && (storeData.tier === 'free' || !storeData.deliveryEnabled)) return;
        if (method === 'pickup' && !storeData.pickupEnabled) return;

        setFulfillmentMethods(prev => ({
            ...prev,
            [storeId]: method
        }));
        // If the store accepts online payments, default to card payment regardless of pickup/delivery
        setPaymentChoices(prev => ({
            ...prev,
            [storeId]: storeData.acceptsOnlinePayment ? 'card' : 'in_store'
        }));
        setCheckoutStep(3);
    };

    const togglePaymentChoice = (storeId: string, choice: 'card' | 'in_store') => {
        setPaymentChoices(prev => ({ ...prev, [storeId]: choice }));
    };

    const taxRate = 0.13; // 13% HST Ontario

    // Calculate totals including Delivery Fees
    const { orderSubtotal, deliveryFees, calculatedTax, grandTotal } = useMemo(() => {
        let sub = 0;
        const taxableSub = 0;
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
            const TAX_RATES: Record<string, number> = { 'ON': 0.13, 'BC': 0.12, 'QC': 0.14975, 'AB': 0.05, 'NS': 0.15, 'NB': 0.15, 'MB': 0.12, 'SK': 0.11, 'PE': 0.15, 'NL': 0.15, 'YT': 0.05, 'NT': 0.05, 'NU': 0.05 };
            const rate = TAX_RATES[province] || 0.13;

            // Tax is applied to taxable items + delivery fee
            // Note: In some jurisdictions delivery might be taxed differently, but for simplicity assuming general sales tax rule
            totalCalculatedTax += parseFloat(((storeTaxable + fee) * rate).toFixed(2));
        });

        // Computed totals
        const roundedSub = parseFloat(sub.toFixed(2));
        const roundedFees = parseFloat(fees.toFixed(2));
        const roundedTax = parseFloat(totalCalculatedTax.toFixed(2));
        return {
            orderSubtotal: roundedSub,
            deliveryFees: roundedFees,
            calculatedTax: roundedTax,
            grandTotal: parseFloat((roundedSub + roundedFees + roundedTax).toFixed(2))
        };


    }, [groupedItems, fulfillmentMethods, getStore]);

    const handlePayment = async () => {
        // Validation check for minimum orders
        for (const [storeId, data] of Object.entries(groupedItems)) {
            const method = fulfillmentMethods[storeId] || 'pickup';
            const store = getStore(storeId);

            if (method === 'delivery') {
                if (data.distanceViolation) {
                    addNotification({
                        type: 'alert',
                        title: 'Delivery Not Available',
                        message: `${data.storeName} does not deliver to your specified location.`
                    });
                    return;
                }

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
                    navigate('/profile/addresses');
                    return;
                }
                
                const defaultAddr = profile.addresses.find(a => a.isDefault) || profile.addresses[0];
                if (!defaultAddr) {
                    addNotification({
                        type: 'alert',
                        title: 'Selection Required',
                        message: `Please select or add a default delivery address in your profile.`
                    });
                    navigate('/profile/addresses');
                    return;
                }
            }
        }

        setIsProcessing(true);

        try {
            // Prepare orders
            const ordersToCreate = Object.entries(groupedItems).map(([storeId, data]) => {
                const method = fulfillmentMethods[storeId] || 'pickup';
                const store = getStore(storeId) || STORE_DATA[storeId];

                // Pre-generate a unique Firestore order ID for this store order
                const orderDocRef = doc(collection(db, 'orders'));
                const orderId = orderDocRef.id;

                // Determine Rate
                const province = store?.province || 'ON';
                const TAX_RATES: Record<string, number> = { 
                    'ON': 0.13, 'BC': 0.12, 'QC': 0.14975, 'AB': 0.05, 
                    'NS': 0.15, 'NB': 0.15, 'MB': 0.12, 'SK': 0.11, 
                    'PE': 0.15, 'NL': 0.15, 'YT': 0.05, 'NT': 0.05, 'NU': 0.05 
                };
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

                // Re-calculate tax based on item taxability
                const taxableAmount = data.items.reduce((sum: number, i: any) => {
                    return (i.taxable !== false) ? sum + (i.price * i.quantity) : sum;
                }, 0);

                const roundedSubtotal = parseFloat(data.total.toFixed(2));
                const roundedTaxable = parseFloat(taxableAmount.toFixed(2));
                const taxAmount = parseFloat(((roundedTaxable + fee) * rate).toFixed(2));
                const grandTotal = parseFloat((roundedSubtotal + taxAmount + fee).toFixed(2));

                const wantsOnlinePayment = data.acceptsOnlinePayment && paymentChoices[storeId] === 'card';

                return {
                    id: orderId,
                    storeId,
                    storeName: data.storeName,
                    storeProvince: province,
                    appliedTaxRate: rate,
                    status: 'placed' as const,
                    paymentStatus: 'pending' as const,
                    items: data.items.map((i: any) => ({
                        productId: i.productId || i.id,
                        productName: i.productName || i.name,
                        price: i.price,
                        quantity: i.quantity,
                        image: i.image,
                        taxable: i.taxable !== false
                    })),
                    subtotal: roundedSubtotal,
                    tax: taxAmount,
                    deliveryFee: fee,
                    total: grandTotal,
                    paymentMethod: wantsOnlinePayment ? ('card' as const) : ('in_store' as const),
                    paymentIntentId: null,
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

            // Find if any order is using online payment
            const onlineOrder = ordersToCreate.find(o => o.paymentMethod === 'card');

            if (onlineOrder) {
                // Call secure Cloud Function to create a Stripe Checkout Session
                const functions = getFunctions();
                const createShopperCheckoutSessionFn = httpsCallable(functions, 'createShopperCheckoutSession');
                
                console.log("Creating Stripe Checkout Session for order:", onlineOrder.id);
                const sessionResult = await createShopperCheckoutSessionFn({
                    amount: Math.round(onlineOrder.total * 100), // in cents
                    storeId: onlineOrder.storeId,
                    metadata: {
                        orderId: onlineOrder.id,
                        storeName: onlineOrder.storeName
                    }
                }) as { data: { url: string; sessionId: string } };

                if (!sessionResult.data || !sessionResult.data.url) {
                    throw new Error("Invalid session response from payment server.");
                }

                // Save pending order details to localStorage
                localStorage.setItem('spendigo_pending_order_v1', JSON.stringify(ordersToCreate));

                // Redirect to Stripe Checkout page
                window.location.href = sessionResult.data.url;
                return;
            }

            // Cash / In-store fallback flow
            console.log(`Submitting batch of ${ordersToCreate.length} cash/in-store orders`);
            await createBatchOrders(ordersToCreate);
            console.log('All orders submitted successfully');

            clearCart();
            clearWishlist();
            localStorage.removeItem('smartcart_selections_v1');
            
            if (ordersToCreate.length > 0) {
                navigate(`/order/${ordersToCreate[0].id}`);
            } else {
                navigate('/profile', { state: { activeTab: 'orders' } });
            }
            
            addNotification({
                type: 'order',
                title: 'Orders Confirmed! 🎉',
                message: 'Your reservations have been successfully placed. You can track them in your profile.'
            });

        } catch (err: any) {
            console.error('Checkout failed:', err);
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

    if (isConfirmingSession) {
        return (
            <div className="fixed inset-0 z-50 bg-[var(--surface-0)]/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                <div className="glass-panel p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-white/40 bg-white/70 flex flex-col items-center">
                    <div className="relative mb-8">
                        {/* Outer rotating gradient ring */}
                        <div className="w-24 h-24 rounded-full border-4 border-transparent border-t-purple-600 border-r-indigo-600 animate-spin" />
                        {/* Inner secure shield icon */}
                        <div className="absolute inset-0 flex items-center justify-center text-4xl">
                            🛡️
                        </div>
                    </div>
                    
                    <h2 className="text-2xl font-black text-[var(--brand-navy)] mb-3 tracking-tight italic">
                        Finalizing Secure Order
                    </h2>
                    
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-6">
                        We are verifying your transaction with Stripe and finalizing your reservations with the merchants. Please do not close this window.
                    </p>
                    
                    <div className="flex items-center gap-2 text-xs font-semibold text-[var(--brand-primary)] bg-blue-50/50 px-4 py-2 rounded-full border border-blue-100">
                        <span className="w-2 h-2 rounded-full bg-[var(--brand-primary)] animate-ping" />
                        Verifying secure checkout session...
                    </div>
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
        <div className="animate-fade-in pb-12">
            <SEO title="Checkout" description="Complete your order and confirm reservations on Spendigo." path="/checkout" noIndex />
            <div className="max-w-3xl mx-auto px-4 py-6">
                <h1 className="text-3xl font-bold text-[var(--text-main)] mb-6">{t('checkoutTitle')}</h1>

                {/* Step progress indicator */}
                <div className="flex items-center mb-12">
                    {[
                        { step: 1, label: t('stepCartLabel'), done: true },
                        { step: 2, label: t('stepFulfillment'), done: checkoutStep === 3, active: checkoutStep === 2 },
                        { step: 3, label: t('stepPayment'), done: false, active: checkoutStep === 3 },
                    ].map((s, i, arr) => (
                        <React.Fragment key={s.step}>
                            <div className="flex items-center gap-3 flex-shrink-0">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${s.done ? 'bg-[var(--status-success)] text-white' : s.active ? 'bg-[var(--brand-primary)] text-white shadow-lg shadow-[var(--brand-primary)]/20 scale-110' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}>
                                    {s.done ? '✓' : s.step}
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${s.active ? 'text-[var(--brand-navy)]' : 'text-[var(--text-muted)]'}`}>{s.label}</span>
                            </div>
                            {i < arr.length - 1 && <div className="flex-1 h-0.5 bg-[var(--glass-border)] mx-4" />}
                        </React.Fragment>
                    ))}
                </div>

                {/* Multi-Store Online Payment Warning */}
                {Object.keys(groupedItems).length > 1 && Object.entries(groupedItems).some(([sid, g]) => g.acceptsOnlinePayment && paymentChoices[sid] === 'card') && (
                    <div className="glass-panel p-6 border-2 border-amber-200 bg-amber-50/50 mb-8 rounded-3xl animate-fade-in">
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">⚠️</span>
                            <div>
                                <h3 className="font-bold text-[var(--brand-navy)] mb-1">Multi-Store Checkout with Online Payment</h3>
                                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                                    To protect shoppers from partial failures and duplicate charges, Spendigo processes secure online credit card payments individually per merchant.
                                </p>
                                <p className="text-xs font-semibold text-amber-800 mt-2">
                                    Remedy: Please switch all store payment methods to <strong>"Pay at Store" / "Pay on Delivery"</strong> to checkout all stores together, or check out each store individually by adjusting your cart items.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-6">
                    {/* Iterate over Stores */}
                    {Object.entries(groupedItems).map(([storeId, { storeName, total, tier, items, isOpen, deliveryEnabled, pickupEnabled }]) => {
                        const bothDisabled = !deliveryEnabled && !pickupEnabled;
                        const isBlocked = !isOpen || bothDisabled;

                        return (
                            <div key={storeId} className={`glass-panel p-6 rounded-3xl ${isBlocked ? 'opacity-70 grayscale-[0.5] border-2 border-red-100' : 'border-gray-100'}`}>
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-white border border-[var(--glass-border)] flex items-center justify-center text-xl shadow-sm overflow-hidden p-1">
                                            {(() => {
                                                const store = getStore(storeId) || STORE_DATA[storeId];
                                                const logo = store?.logoUrl || store?.logo;
                                                if (logo && (logo.startsWith('http') || logo.startsWith('/') || logo.startsWith('data:'))) {
                                                    return <img src={logo} alt={storeName} className="w-full h-full object-cover" />;
                                                }
                                                return <span>{logo || '🏪'}</span>;
                                            })()}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h2 className="font-black text-lg text-[var(--brand-navy)] mb-0">{storeName}</h2>
                                                {groupedItems[storeId].acceptsOnlinePayment && (
                                                    <span className="text-[9px] font-black bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200 uppercase tracking-widest">
                                                        💳 {t('paymentOnline')}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{items.length} items • ${total.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    {(tier === 'free' || !groupedItems[storeId].deliveryEnabled) && !bothDisabled && (
                                        <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-full uppercase tracking-wider">
                                            {t('storePickupOnly')}
                                        </span>
                                    )}
                                    {bothDisabled && (
                                        <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-1 rounded-full uppercase tracking-wider">
                                            ⛔ {t('orderingDisabled')}
                                        </span>
                                    )}
                                    {!isOpen && !bothDisabled && (
                                        <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded-full uppercase tracking-wider">
                                            🕒 {t('closedNow')}
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
                                        🛍️ {t('pickupLabel')}
                                        {(!pickupEnabled) && <span className="text-[8px] border border-gray-300 px-1 rounded">{t('unavailableLabel')}</span>}
                                    </button>
                                    <button
                                        onClick={() => toggleFulfillment(storeId, 'delivery')}
                                        disabled={tier === 'free' || !deliveryEnabled || isBlocked}
                                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${fulfillmentMethods[storeId] === 'delivery'
                                            ? 'bg-white text-[var(--brand-primary)] shadow-sm'
                                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-50 disabled:cursor-not-allowed'
                                            }`}
                                    >
                                        🚚 {t('deliveryLabel')}
                                        {(!deliveryEnabled && groupedItems[storeId].distanceViolation) && <span className="text-[8px] bg-purple-100 text-purple-700 border border-purple-200 px-1 rounded">{t('tooFarLabel')}</span>}
                                        {(tier === 'free' || (!deliveryEnabled && !groupedItems[storeId].distanceViolation)) && <span className="text-[8px] border border-gray-300 px-1 rounded">{t('unavailableLabel')}</span>}
                                    </button>
                                </div>

                                {/* Distance Violation Warning */}
                                {groupedItems[storeId].distanceViolation && (
                                    <div className="mb-4 text-xs text-red-700 bg-red-50 p-4 rounded-2xl border border-red-200 flex items-start gap-3 animate-fade-in font-medium shadow-sm">
                                        <span className="text-lg shrink-0 mt-0.5">📍</span>
                                        <div className="flex-1">
                                            <p className="font-extrabold text-red-800 text-sm">
                                                Delivery Too Far
                                            </p>
                                            <p className="text-[11px] text-red-650 mt-1 leading-relaxed">
                                                Delivery Too Far - make sure your delivery location is correctly configured in your profile addresses.
                                            </p>
                                            <Link 
                                                to="/profile/addresses" 
                                                className="inline-flex items-center gap-1.5 mt-3 text-[10px] font-black uppercase tracking-wider text-red-700 hover:text-white bg-white hover:bg-red-600 border border-red-200 hover:border-red-600 px-3.5 py-1.5 rounded-xl transition-all shadow-sm hover:shadow active:scale-95"
                                            >
                                                <span>⚙️ Manage Addresses</span>
                                            </Link>
                                        </div>
                                    </div>
                                )}

                                {/* Payment Method Toggle */}
                                <div className="mb-4">
                                    <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">How would you like to pay?</p>
                                    <div className="bg-[var(--surface-1)] p-1 rounded-lg flex">
                                        <button
                                            onClick={() => togglePaymentChoice(storeId, 'card')}
                                            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${paymentChoices[storeId] === 'card'
                                                ? 'bg-white text-[var(--brand-primary)] shadow-sm'
                                                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                                                }`}
                                        >
                                            💳 Pay Online
                                        </button>
                                        <button
                                            onClick={() => togglePaymentChoice(storeId, 'in_store')}
                                            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${paymentChoices[storeId] === 'in_store'
                                                ? 'bg-white text-[var(--brand-primary)] shadow-sm'
                                                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                                                }`}
                                        >
                                            🏪 {fulfillmentMethods[storeId] === 'delivery' ? 'Pay on Delivery' : 'Pay at Store'}
                                        </button>
                                    </div>
                                    {paymentChoices[storeId] === 'in_store' && (
                                        <p className="text-[10px] text-[var(--text-muted)] mt-1.5 text-center">
                                            {fulfillmentMethods[storeId] === 'delivery'
                                                ? 'Pay with the delivery driver upon receipt of your order.'
                                                : 'Pay at the store terminal when you pick up your order.'}
                                        </p>
                                    )}
                                    {paymentChoices[storeId] === 'card' && !groupedItems[storeId].acceptsOnlinePayment && (
                                        <div className="mt-2 text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200 animate-fade-in text-center font-medium">
                                            ⚠️ Online payment is currently unavailable for this store. Please select "{fulfillmentMethods[storeId] === 'delivery' ? 'Pay on Delivery' : 'Pay at Store'}".
                                        </div>
                                    )}
                                </div>

                                {/* Item List (Collapsed/Simple) */}
                                < div className="space-y-2 pl-2 border-l-2 border-[var(--glass-border)]" >
                                    {
                                        items.map((item: any, idx) => (
                                            <div key={idx} className="flex justify-between text-sm">
                                                <div className="flex items-center gap-2">
                                                    {item.image && (
                                                        <img
                                                            src={item.image}
                                                            alt={item.productName}
                                                            className="w-8 h-8 rounded-md object-cover border border-[var(--glass-border)] bg-[var(--surface-1)]"
                                                        />
                                                    )}
                                                    <span className="text-[var(--text-muted)] flex items-center gap-1.5">
                                                        <span>{item.quantity}x {item.productName}</span>
                                                        {item.is_canadian_local && (
                                                            <span className="text-xs" title="Canadian Local">🍁</span>
                                                        )}
                                                    </span>
                                                </div>
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
                <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px bg-[var(--glass-border)]" />
                    <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">{t('orderSummaryTitle')}</span>
                    <div className="flex-1 h-px bg-[var(--glass-border)]" />
                </div>
                <div className="mt-8 glass-panel p-8 rounded-[2rem] border-gray-100 shadow-xl">
                    <div className="flex justify-between items-center mb-6">
                        <span className="font-black text-xl text-[var(--brand-navy)] italic tracking-tighter">
                            {(() => {
                                const methods = Object.values(fulfillmentMethods);
                                const hasDelivery = methods.includes('delivery');
                                const hasPickup = methods.includes('pickup');

                                if (hasDelivery && hasPickup) return "Total Due (Store & Delivery)";
                                if (hasDelivery) return "Total Due (Pay on Delivery)";
                                return "Total Due (Pay at Store)";
                            })()}
                        </span>
                        <span className="font-black text-4xl text-[var(--brand-primary)] tracking-tighter italic">${grandTotal.toFixed(2)}</span>
                    </div>
                    <div>
                        <div className="flex justify-between text-sm text-[var(--text-muted)] mb-1">
                            <span>{t('orderSubtotal')}</span>
                            <span>${orderSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-[var(--text-muted)] mb-3">
                            <span>{t('deliveryFees')}</span>
                            <span>${deliveryFees.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-[var(--text-muted)] mb-3 pb-3 border-b border-[var(--glass-border)]">
                            <span>{t('estimatedTax')} <span className="text-[10px] bg-gray-100 px-1 rounded">VARIES BY PROVINCE</span></span>
                            <span>${calculatedTax.toFixed(2)}</span>
                        </div>
                    </div>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed bg-blue-50 p-4 rounded-xl border border-blue-100 text-blue-800">
                        <strong>Note:</strong> Spendigo is a marketplace facilitator. {Object.entries(groupedItems).some(([sid, g]) => g.acceptsOnlinePayment && paymentChoices[sid] === 'card')
                            ? "Your online payment will be securely transferred to the merchant(s) upon order confirmation."
                            : "You are reserving these items. Please complete payment at the store or with the delivery driver upon receipt."}
                    </p>
                </div>
            </div >

            {/* AGE VERIFICATION ATTESTATION */}
            {hasAgeRestricted && (
                <div className="mt-6 glass-panel p-5 border-2 border-orange-200 bg-orange-50/50">
                    <div className="flex items-start gap-3 mb-3">
                        <span className="text-2xl">🔞</span>
                        <div>
                            <h3 className="font-bold text-[var(--text-main)] mb-1">Age Verification Required</h3>
                            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                                Your cart contains age-restricted items. Under provincial law, you must be
                                of legal age to purchase these products.
                            </p>
                        </div>
                    </div>
                    <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl bg-white border border-[var(--glass-border)] hover:border-orange-300 transition-colors">
                        <input
                            type="checkbox"
                            checked={ageVerified}
                            onChange={e => setAgeVerified(e.target.checked)}
                            className="mt-0.5 w-5 h-5 accent-[var(--brand-primary)] rounded"
                        />
                        <span className="text-sm text-[var(--text-main)] leading-relaxed">
                            I confirm I am of <strong>legal age</strong> to purchase restricted items in my jurisdiction
                            and agree to present <strong>valid government-issued ID</strong> upon delivery or pickup.
                        </span>
                    </label>
                </div>
            )}

            {/* CHECKOUT ACTION PANEL */}
            <div className="mt-8 p-6 bg-[var(--surface-0)] border border-[var(--glass-border)] rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                <div className="max-w-3xl mx-auto">
                    {(() => {
                        // Check if ANY store blocks the entire checkout
                        const hasBlockers = Object.values(groupedItems).some(g => !g.isOpen || (!g.deliveryEnabled && !g.pickupEnabled));
                        const ageBlocked = hasAgeRestricted && !ageVerified;
                        const hasOnlinePay = Object.entries(groupedItems).some(([sid, g]) =>
                            g.acceptsOnlinePayment && paymentChoices[sid] === 'card'
                        );
                        const hasUnsupportedOnlinePayment = Object.entries(groupedItems).some(([sid, g]) =>
                            paymentChoices[sid] === 'card' && !g.acceptsOnlinePayment
                        );
                        const isMultiStore = Object.keys(groupedItems).length > 1;
                        const multiStoreOnlinePayBlocker = isMultiStore && hasOnlinePay;

                        if (checkoutStep === 2) {
                            return (
                                <button
                                    onClick={() => setCheckoutStep(3)}
                                    disabled={hasBlockers || multiStoreOnlinePayBlocker || hasUnsupportedOnlinePayment}
                                    className={`w-full py-5 text-white font-black text-sm uppercase tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-3 shadow-2xl ${hasBlockers || multiStoreOnlinePayBlocker || hasUnsupportedOnlinePayment
                                        ? 'bg-gray-400 cursor-not-allowed opacity-80'
                                        : 'bg-[var(--brand-primary)] hover:opacity-90 active:scale-95 shadow-[var(--brand-primary)]/30'
                                        }`}
                                >
                                    {hasBlockers ? '⚠️ Checkout Disabled' : multiStoreOnlinePayBlocker ? '⚠️ Check Out Per Store Required' : hasUnsupportedOnlinePayment ? '⚠️ Online Payment Unavailable' : 'Continue to Payment →'}
                                </button>
                            );
                        }

                        return (
                            <div className="space-y-4">
                                {hasOnlinePay && !multiStoreOnlinePayBlocker && (
                                    <div className="glass-panel p-6 border border-purple-200/50 bg-gradient-to-br from-purple-50/70 to-indigo-50/50 rounded-3xl shadow-md animate-fade-in mb-6 hover:scale-[1.01] transition-transform duration-300">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center text-2xl shadow-inner animate-pulse">
                                                🔒
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-black text-sm text-[var(--brand-navy)] mb-1 flex items-center gap-2">
                                                    Secure Stripe Checkout Redirect
                                                    <span className="text-[9px] font-black bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200 uppercase tracking-widest">
                                                        Official Partner
                                                    </span>
                                                </h3>
                                                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                                                    You will be securely redirected to Stripe to finalize payment. Supports **Credit/Debit, Google Pay, Apple Pay**, and other localized options.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-purple-100 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px]">🛡️</span>
                                                <span>256-bit SSL Encryption</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span>Processed by</span>
                                                <span className="font-extrabold tracking-tight text-[#635BFF] bg-purple-50 px-2.5 py-1 rounded-lg border border-[#635BFF]/10 text-xs">
                                                    stripe
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <button
                                    onClick={handlePayment}
                                    disabled={isProcessing || hasBlockers || ageBlocked || multiStoreOnlinePayBlocker || hasUnsupportedOnlinePayment}
                                    className={`w-full py-5 text-white font-black text-sm uppercase tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-3 shadow-2xl ${isProcessing || hasBlockers || ageBlocked || multiStoreOnlinePayBlocker || hasUnsupportedOnlinePayment
                                        ? 'bg-gray-400 cursor-not-allowed opacity-80'
                                        : 'bg-[var(--brand-navy)] hover:bg-[var(--brand-primary)] active:scale-95 shadow-[var(--brand-navy)]/30'
                                        }`}
                                >
                                    {isProcessing ? 'Processing Secure Payment...' :
                                        hasBlockers ? '⚠️ Checkout Disabled' :
                                            ageBlocked ? '🔞 Verify Age Above' :
                                                multiStoreOnlinePayBlocker ? '⚠️ Check Out Per Store Required' :
                                                    hasUnsupportedOnlinePayment ? '⚠️ Online Payment Unavailable' :
                                                        hasOnlinePay ? `Complete Payment • $${grandTotal.toFixed(2)}` :
                                                            `Confirm Order • $${grandTotal.toFixed(2)}`}
                                </button>
                            </div>
                        );
                    })()}
                </div>
            </div >
        </div >
    );
};

/**
 * Main Export - Wrapped with Stripe Elements
 */
const CheckoutWrapped: React.FC = () => {
    return (
        <Elements stripe={stripePromise}>
            <Checkout />
        </Elements>
    );
};

export default CheckoutWrapped;

