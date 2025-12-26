import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useOrders } from '../../context/OrderContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import '../../styles/design-system.css';

const ORDER_STEPS = ['placed', 'preparing', 'out_for_delivery', 'delivered'] as const;

const OrderTracking: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { orders, cancelOrder } = useOrders();
    const { getStore } = useMarketplace();
    const [showHelpModal, setShowHelpModal] = React.useState(false);

    const order = orders.find(o => o.id === id);
    const store = order ? getStore(order.storeId) : null;

    // Mock store contact info since it's not in the DB yet
    const storeContact = {
        phone: '(555) 123-4567',
        email: store?.merchantEmail || `support@${store?.name.toLowerCase().replace(/\s/g, '') || 'spendigo'}.com`,
        address: '123 Market Street, Toronto, ON'
    };


    if (!order) {
        return (
            <div className="animate-fade-in flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
                <p className="text-5xl mb-4">📦</p>
                <h2 className="text-2xl font-bold text-[var(--text-main)] mb-2">Order Not Found</h2>
                <p className="text-[var(--text-muted)] mb-6">We couldn't find this order.</p>
                <Link to="/profile" className="px-6 py-3 bg-[var(--brand-primary)] text-white font-medium rounded-full">
                    View All Orders
                </Link>
            </div>
        );
    }

    const currentStepIndex = ORDER_STEPS.indexOf(order.status as any);
    const isDelivered = order.status === 'delivered';
    const isCancelled = order.status === 'cancelled';
    const isOnHold = order.status === 'on_hold';

    const getStepLabel = (step: string) => {
        switch (step) {
            case 'placed': return 'Order Placed';
            case 'preparing': return 'Preparing';
            case 'out_for_delivery': return 'Out for Delivery';
            case 'delivered': return 'Delivered';
            default: return step;
        }
    };

    const getStepIcon = (step: string, isCompleted: boolean, isCurrent: boolean) => {
        if (isCompleted) return '✓';
        switch (step) {
            case 'placed': return '📋';
            case 'preparing': return '👨‍🍳';
            case 'out_for_delivery': return '🚚';
            case 'delivered': return '📦';
            default: return '○';
        }
    };

    return (
        <div className="animate-fade-in pb-20">
            {/* Header */}
            <div className={`p-6 ${isDelivered ? 'bg-green-500' : isCancelled ? 'bg-red-500' : isOnHold ? 'bg-yellow-500' : 'bg-[var(--brand-primary)]'} text-white transition-colors duration-500`}>
                <div className="max-w-3xl mx-auto">
                    <p className="text-sm opacity-80 mb-1">{order.id}</p>
                    <h1 className="text-2xl font-bold mb-2">
                        {isDelivered ? 'Order Delivered! 🎉' :
                            isCancelled ? 'Order Cancelled' :
                                isOnHold ? 'Order On Hold ⏳' :
                                    'Track Your Order'}
                    </h1>
                    {!isDelivered && !isCancelled && (order.estimatedTime || order.estimatedDelivery) && (
                        <p className="text-white/90">Estimated {order.deliveryAddress ? 'delivery' : 'ready'}: <strong>{order.estimatedTime || order.estimatedDelivery}</strong></p>
                    )}
                </div>
            </div>

            {/* Hold/Cancel Notifications */}
            <div className="max-w-3xl mx-auto px-4 mt-6">
                {isOnHold && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-3 animate-pulse">
                        <span className="text-2xl">⏳</span>
                        <div>
                            <p className="font-bold text-yellow-800">Your order is currently on hold</p>
                            <p className="text-sm text-yellow-700">The store has briefly paused preparation. They will resume shortly.</p>
                        </div>
                    </div>
                )}
                {isCancelled && order.rejectionReason && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
                        <span className="text-2xl">🚫</span>
                        <div>
                            <p className="font-bold text-red-800">Reason for Cancellation</p>
                            <p className="text-sm text-red-700 italic">"{order.rejectionReason}"</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Progress Timeline */}
            {!isCancelled && (
                <div className="max-w-3xl mx-auto px-4 py-8">
                    <div className="relative">
                        {/* Progress Line */}
                        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-[var(--surface-2)]"></div>
                        <div
                            className="absolute left-6 top-0 w-0.5 bg-[var(--brand-primary)] transition-all duration-500"
                            style={{ height: `${(currentStepIndex / (ORDER_STEPS.length - 1)) * 100}%` }}
                        ></div>

                        {/* Steps */}
                        <div className="space-y-8">
                            {ORDER_STEPS.map((step, index) => {
                                const isCompleted = index < currentStepIndex;
                                const isCurrent = index === currentStepIndex;

                                return (
                                    <div key={step} className="flex items-start gap-4">
                                        <div className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all ${isCompleted ? 'bg-[var(--brand-primary)] text-white' :
                                            isCurrent ? 'bg-[var(--brand-primary)] text-white ring-4 ring-[var(--brand-primary)]/20' :
                                                'bg-[var(--surface-2)] text-[var(--text-muted)]'
                                            }`}>
                                            {getStepIcon(step, isCompleted, isCurrent)}
                                        </div>
                                        <div className="flex-1 pt-3">
                                            <p className={`font-medium ${isCurrent || isCompleted ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>
                                                {getStepLabel(step)}
                                            </p>
                                            {isCurrent && step === 'out_for_delivery' && (
                                                <p className="text-sm text-[var(--brand-primary)] mt-1">Your order is on the way!</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Order Details */}
            <div className="max-w-3xl mx-auto px-4 space-y-4">
                {/* Store Info */}
                <div className="bg-white rounded-xl border border-[var(--glass-border)] p-4">
                    <h3 className="font-bold text-[var(--text-main)] mb-3">Order from {order.storeName}</h3>
                    <div className="space-y-3">
                        {order.items.map(item => (
                            <div key={item.productId} className="flex items-center gap-3">
                                {item.image && <img src={item.image} alt="" className="w-12 h-12 rounded-lg object-cover" />}
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-[var(--text-main)]">{item.productName}</p>
                                    <p className="text-xs text-[var(--text-muted)]">Qty: {item.quantity}</p>
                                </div>
                                <p className="font-medium text-[var(--text-main)]">${(item.price * item.quantity).toFixed(2)}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Delivery Address or Pickup Info */}
                <div className="bg-white rounded-xl border border-[var(--glass-border)] p-4">
                    <h3 className="font-bold text-[var(--text-main)] mb-2">{order.deliveryAddress ? 'Delivery Address' : 'Fulfillment Method'}</h3>
                    {order.deliveryAddress ? (
                        <>
                            <p className="text-sm text-[var(--text-muted)]">{order.deliveryAddress.street}</p>
                            <p className="text-sm text-[var(--text-muted)]">{order.deliveryAddress.city}, {order.deliveryAddress.province} {order.deliveryAddress.postalCode}</p>
                        </>
                    ) : (
                        <div className="flex items-center gap-2 text-[var(--text-main)]">
                            <span className="text-xl">🛍️</span>
                            <div>
                                <p className="font-medium">Store Pickup</p>
                                <p className="text-xs text-[var(--text-muted)]">Please pick up your order at {order.storeName}.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Price Breakdown */}
                <div className="bg-white rounded-xl border border-[var(--glass-border)] p-4">
                    <h3 className="font-bold text-[var(--text-main)] mb-3">Order Summary</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-[var(--text-muted)]">Subtotal</span>
                            <span>${order.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--text-muted)]">Delivery Fee</span>
                            <span>{order.deliveryFee === 0 ? 'Free' : `$${order.deliveryFee.toFixed(2)}`}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--text-muted)]">Tax</span>
                            <span>${order.tax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-[var(--glass-border)] font-bold text-lg">
                            <span>Total</span>
                            <span className="text-[var(--brand-primary)]">${order.total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <Link
                        to={`/store/${order.storeId}`}
                        className="flex-1 py-3 border border-[var(--glass-border)] rounded-xl font-medium text-[var(--text-main)] hover:bg-gray-50 transition-colors flex items-center justify-center"
                    >
                        🏪 Visit Store Page
                    </Link>
                    {order.status === 'placed' && (
                        <button
                            onClick={() => {
                                if (window.confirm('Are you sure you want to cancel this order?')) {
                                    cancelOrder(order.id);
                                }
                            }}
                            className="flex-1 py-3 border border-red-200 text-red-600 bg-red-50 rounded-xl font-bold hover:bg-red-100 transition-colors"
                        >
                            Cancel Order
                        </button>
                    )}
                    <button
                        onClick={() => setShowHelpModal(true)}
                        className="flex-1 py-3 border border-[var(--glass-border)] rounded-xl font-medium text-[var(--text-main)] hover:bg-gray-50 transition-colors flex items-center justify-center"
                    >
                        ❓ Get Help
                    </button>
                </div>
            </div>
            {/* Help Modal */}
            {showHelpModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowHelpModal(false)}>
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Contact Support</h3>
                            <button onClick={() => setShowHelpModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        <div className="space-y-6">
                            {/* Merchant Section */}
                            <div>
                                <h4 className="font-semibold text-[var(--text-main)] mb-2 flex items-center gap-2">
                                    🏪 Contact Store directly
                                </h4>
                                <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
                                    <p className="font-medium text-lg">{order.storeName}</p>
                                    <div className="flex flex-col gap-2">
                                        <a href={`tel:${storeContact.phone}`} className="flex items-center gap-3 text-[var(--text-main)] hover:text-[var(--brand-primary)]">
                                            <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">📞</span>
                                            {storeContact.phone}
                                        </a>
                                        <a href={`mailto:${storeContact.email}`} className="flex items-center gap-3 text-[var(--text-main)] hover:text-[var(--brand-primary)]">
                                            <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">✉️</span>
                                            {storeContact.email}
                                        </a>
                                        <div className="flex items-center gap-3 text-[var(--text-main)]">
                                            <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">📍</span>
                                            {storeContact.address}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                                <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">Or</span></div>
                            </div>

                            {/* Platform Section */}
                            <div>
                                <h4 className="font-semibold text-[var(--text-main)] mb-2">Platform Support</h4>
                                <a
                                    href="mailto:support@spendigo.ca?subject=Help Request Order #${order.id}"
                                    className="block w-full py-3 bg-[var(--surface-2)] text-[var(--text-main)] font-medium rounded-xl hover:bg-gray-200 transition-colors text-center"
                                >
                                    Email Spendigo Support
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrderTracking;
