import React, { useState, useEffect } from 'react';
import '../../styles/design-system.css';
import { useAuth } from '../../context/AuthContext';
import { useOrders, Order } from '../../context/OrderContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { validateOrderIntegrity } from '../../utils/IntegrityUtils';
import NotificationPopover from '../../components/NotificationPopover';
import ReviewForm from '../../components/ReviewForm';

const MerchantOrders: React.FC = () => {
    const { can, user } = useAuth();
    const {
        orders: contextOrders,
        updateOrderStatus,
        updatePaymentStatus,
        updateEstimatedTime,
        cancelOrder,
        loading
    } = useOrders();
    const { getStore } = useMarketplace();
    const store = getStore(user?.storeId || '1');
    const storeProducts = store?.products || [];

    const hasReadAccess = can('orders:read');
    const hasWriteAccess = can('orders:write');
    // const storeId = user?.storeId || '1'; // Handled by OrderContext filtering

    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [now, setNow] = useState(new Date());

    const [rejectionReason, setRejectionReason] = useState('');
    const [estTimeInput, setEstTimeInput] = useState('');

    // Timer Tick
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 30000); // Update every 30s
        return () => clearInterval(interval);
    }, []);

    // Sync selected order with live data (if it changes while modal is open)
    useEffect(() => {
        if (selectedOrder) {
            const updated = contextOrders.find(o => o.id === selectedOrder.id);
            if (updated) {
                setSelectedOrder(updated);
                if (!estTimeInput) setEstTimeInput(updated.estimatedTime || '');
            }
        }
    }, [contextOrders, selectedOrder?.id]); // Watch for updates

    if (!hasReadAccess) {
        return (
            <div className="p-12 text-center h-[80vh] flex flex-col items-center justify-center">
                <div className="text-6xl mb-4">🚫</div>
                <h2 className="text-2xl font-bold text-[var(--text-main)]">Access Denied</h2>
                <p className="text-[var(--text-muted)] mt-2">You do not have permission to view Order Management.</p>
                <p className="text-sm text-[var(--brand-primary)] mt-4 font-medium">Contact your store owner to request access.</p>
            </div>
        );
    }

    if (loading) {
        return <div className="p-12 text-center">Loading orders...</div>;
    }

    // Filter
    const filteredOrders = contextOrders.filter(o =>
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customerName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Helpers
    const getMinutesElapsed = (dateStr: string) => {
        const date = new Date(dateStr);
        return Math.floor((now.getTime() - date.getTime()) / 60000);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'placed': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'preparing': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'on_hold': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'out_for_delivery': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'delivered': return 'bg-green-100 text-green-700 border-green-200';
            case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const handleUpdateStatus = async (id: string, newStatus: Order['status'], reason?: string) => {
        try {
            await updateOrderStatus(id, newStatus, reason);
        } catch (e) {
            console.error("Failed to update status", e);
            alert("Failed to update order status");
        }
    };

    const handleSaveET = async (id: string) => {
        try {
            await updateEstimatedTime(id, estTimeInput);
            alert("Updated estimated time");
        } catch (e) {
            alert("Failed to update time");
        }
    };

    const handleCancelOrder = async (id: string) => {
        if (!rejectionReason.trim()) {
            alert("Please provide a reason for cancellation");
            return;
        }
        try {
            await cancelOrder(id, rejectionReason);
            setSelectedOrder(null);
            setRejectionReason('');
        } catch (e) {
            alert("Failed to cancel order");
        }
    };

    const handleUpdatePayment = async (order: Order) => {
        const auditEntry = {
            id: user?.id || 'unknown',
            name: user?.name || 'Staff',
            timestamp: new Date().toISOString()
        };
        try {
            await updatePaymentStatus(order.id, 'paid', auditEntry);
        } catch (e) {
            console.error("Failed to update payment", e);
            alert("Failed to mark paid");
        }
    };

    const handleCompleteOrder = async (order: Order) => {
        try {
            // 1. Mark Delivered
            await updateOrderStatus(order.id, 'delivered');

            // 2. Mark Paid (if pending)
            if (order.paymentStatus !== 'paid') {
                const auditEntry = {
                    id: user?.id || 'unknown',
                    name: user?.name || 'Staff',
                    timestamp: new Date().toISOString()
                };
                await updatePaymentStatus(order.id, 'paid', auditEntry);
            }
        } catch (e) {
            console.error("Failed to complete order", e);
            alert("Failed to complete order");
        }
    };


    const addMockOrder = () => {
        alert('Please use the Consumer App to place a real order.');
    };

    // Components
    const OrderCard = ({ order }: { order: Order }) => {
        const elapsed = getMinutesElapsed(order.date);
        const isLate = elapsed > 20 && order.status !== 'delivered';
        const isDelivery = !!order.deliveryAddress;

        return (
            <div
                onClick={() => setSelectedOrder(order)}
                className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer hover:shadow-md transition-all relative overflow-hidden group ${isLate ? 'border-red-200' : 'border-[var(--glass-border)]'}`}
            >
                {/* Urgent Strip */}
                {isLate && <div className="absolute top-0 left-0 w-1 h-full bg-red-400"></div>}

                <div className="flex justify-between items-start mb-2 pl-2">
                    <div>
                        <div className="font-bold text-[var(--text-main)] flex items-center gap-2">
                            {order.id.substr(0, 8)}...
                            {isDelivery ? <span>🛵</span> : <span>🛍️</span>}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">{order.customerName}</div>
                    </div>
                    <div className={`text-xs font-bold px-2 py-1 rounded-lg ${isLate ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                        {elapsed}m ago
                    </div>
                </div>

                <div className="space-y-1 mb-3 pl-2 border-l-2 border-transparent group-hover:border-[var(--brand-primary)]/20 transition-all max-h-24 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent pr-1">
                    {order.items.map((item, i) => (
                        <div key={i} className="text-sm flex justify-between">
                            <span className="truncate"><span className="font-bold">{item.quantity}x</span> {item.productName}</span>
                        </div>
                    ))}
                </div>

                <div className="mt-3 pt-3 border-t border-[var(--glass-border)] pl-2">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-[var(--text-main)]">${order.total.toFixed(2)}</span>
                        {order.estimatedTime && (
                            <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold">
                                ⏱️ {order.estimatedTime}
                            </span>
                        )}
                        <span className={`text-xs px-2 py-1 rounded-full ${order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {order.paymentStatus === 'paid' ? (order.paymentMethod === 'card' ? 'Paid Online' : 'Paid in Store') : 'Pay Pending'}
                        </span>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex justify-end gap-2">
                        {hasWriteAccess ? (
                            <>
                                {order.status === 'placed' && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleUpdateStatus(order.id, 'preparing'); }}
                                        className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-md hover:brightness-110"
                                    >
                                        Accept
                                    </button>
                                )}
                                {order.status === 'preparing' && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleUpdateStatus(order.id, 'out_for_delivery'); }}
                                        className="px-3 py-1 bg-purple-500 text-white text-xs font-bold rounded-md hover:brightness-110"
                                    >
                                        Ready
                                    </button>
                                )}
                                {order.status === 'out_for_delivery' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleCompleteOrder(order);
                                            }}
                                            className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-md hover:brightness-110"
                                        >
                                            Complete
                                        </button>
                                        {order.paymentStatus === 'pending' && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleUpdatePayment(order);
                                                }}
                                                className="px-3 py-1 bg-orange-500 text-white text-xs font-bold rounded-md hover:brightness-110"
                                            >
                                                Mark Paid
                                            </button>
                                        )}
                                    </div>
                                )}
                            </>
                        ) : (
                            <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase py-1 px-2 bg-gray-50 border rounded">{order.status}</span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-[var(--surface-1)]">
            {/* Header with Stats */}
            <div className="p-6 pb-2 shrink-0">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--text-main)]">Live Orders Dashboard</h1>
                        <div className="flex gap-4 mt-2 text-sm text-[var(--text-muted)]">
                            <span className="flex items-center gap-1">⏱️ Avg Prep: <strong>12m</strong></span>
                            <span className="flex items-center gap-1">⭐ On-Time: <strong>98%</strong></span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={addMockOrder} className="px-3 py-2 bg-[var(--surface-2)] text-xs font-bold rounded-lg hover:bg-gray-200">
                            + Test Order
                        </button>
                        <div className="h-8 w-px bg-[var(--glass-border)] mx-1"></div>
                        <div className="flex bg-[var(--surface-2)] p-1 rounded-lg">
                            <button
                                onClick={() => setViewMode('kanban')}
                                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${viewMode === 'kanban' ? 'bg-white shadow text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}
                            >
                                Kanban
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-white shadow text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}
                            >
                                List
                            </button>
                        </div>
                        <NotificationPopover />
                    </div>
                </div>
            </div>

            {/* Kanban Board */}
            {viewMode === 'kanban' && (
                <div className="flex-1 min-h-0 p-6 pt-0 overflow-hidden">
                    <div className="grid grid-cols-5 gap-4 h-full">
                        {/* Columns */}
                        {[
                            { id: 'placed', label: '🔔 New Orders', color: 'border-blue-500' },
                            { id: 'preparing', label: '👨‍🍳 Preparing', color: 'border-orange-500' },
                            { id: 'on_hold', label: '⏳ On Hold', color: 'border-yellow-500' },
                            { id: 'out_for_delivery', label: '🛵 On Route / Ready', color: 'border-purple-500' },
                            { id: 'delivered', label: '✅ Delivered / Done', color: 'border-green-500' }
                        ].map(col => (
                            <div key={col.id} className="flex flex-col h-full bg-[var(--surface-1)]/50 rounded-xl border border-[var(--glass-border)] overflow-hidden">
                                <div className={`p-3 font-bold text-sm border-b-2 bg-white rounded-t-xl ${col.color} flex justify-between shrink-0`}>
                                    <span>{col.label}</span>
                                    <span className="text-[var(--text-muted)]">{filteredOrders.filter(o => o.status === col.id).length}</span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                                    {filteredOrders.filter(o => o.status === col.id).map(order => (
                                        <OrderCard key={order.id} order={order} />
                                    ))}
                                    {filteredOrders.filter(o => o.status === col.id).length === 0 && (
                                        <div className="text-center py-10 text-[var(--text-muted)] text-sm opacity-60">
                                            No orders
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* List View Fallback (Simpler) */}
            {viewMode === 'list' && (
                <div className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-[var(--surface-1)] text-left text-xs font-bold text-[var(--text-muted)] uppercase">
                            <tr>
                                <th className="p-4">ID</th>
                                <th className="p-4">Customer</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Items</th>
                                <th className="p-4">Total</th>
                                <th className="p-4">Elapsed</th>
                                <th className="p-4">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--glass-border)]">
                            {filteredOrders.map(order => (
                                <tr key={order.id} onClick={() => setSelectedOrder(order)} className="hover:bg-[var(--surface-1)] cursor-pointer">
                                    <td className="p-4 font-bold">{order.id}</td>
                                    <td className="p-4">{order.customerName}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getStatusColor(order.status)}`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-[var(--text-muted)]">{order.items.length} items</td>
                                    <td className="p-4 font-bold">${order.total.toFixed(2)}</td>
                                    <td className="p-4 text-sm text-[var(--text-muted)]">{getMinutesElapsed(order.date)}m</td>
                                    <td className="p-4">
                                        <button className="text-[var(--brand-primary)] font-bold text-sm hover:underline">View</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Order Detail Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setSelectedOrder(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-[var(--glass-border)] flex justify-between items-start bg-[var(--surface-1)]">
                            <div>
                                <h2 className="text-2xl font-bold text-[var(--text-main)]">{selectedOrder.id}</h2>
                                <p className="text-sm text-[var(--text-muted)]">{selectedOrder.deliveryAddress ? '🛵 Delivery' : '🛍️ Pickup'} • {getMinutesElapsed(selectedOrder.date)}m ago</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-sm font-bold border ${getStatusColor(selectedOrder.status)} capitalize`}>
                                {selectedOrder.status}
                            </span>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Integrity Check */}
                            {(() => {
                                const integrity = validateOrderIntegrity(selectedOrder, storeProducts);
                                if (!integrity.isValid) {
                                    return (
                                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 animate-pulse">
                                            <div className="flex items-center gap-2 text-red-700 font-bold mb-2">
                                                <span>⚠️ Security Alert: Price Tampering Detected</span>
                                            </div>
                                            <p className="text-sm text-red-600 mb-2">
                                                The prices in this order do not match your current catalog. Do not fulfill.
                                            </p>
                                            <div className="text-xs bg-white p-2 rounded border border-red-100">
                                                {integrity.flaggedItems.map(item => (
                                                    <div key={item.id} className="flex justify-between">
                                                        <span>{item.name}:</span>
                                                        <span>
                                                            Order <strong>${item.orderPrice}</strong> vs
                                                            Catalog <span className="text-green-600 font-bold">${item.catalogPrice}</span>
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Customer</label>
                                    <div className="font-medium text-lg">{selectedOrder.customerName}</div>
                                    <div className="text-sm text-[var(--text-muted)]">555-0199</div>
                                </div>
                                {selectedOrder.deliveryAddress && (
                                    <div>
                                        <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Delivery To</label>
                                        <div className="font-medium">{selectedOrder.deliveryAddress.street}</div>
                                        <div className="text-sm text-[var(--text-muted)]">{selectedOrder.deliveryAddress.city}</div>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-4 text-xs text-[var(--text-muted)] mt-2">
                                <div className="flex items-center gap-1">
                                    <span>🗓️</span>
                                    <span>{new Date(selectedOrder.date).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span>📦</span>
                                    <span>{selectedOrder.items.length} Items</span>
                                </div>
                                <div className={`flex items-center gap-1 font-medium ${selectedOrder.paymentStatus === 'paid' ? 'text-green-600' : 'text-orange-600'}`}>
                                    <span>{selectedOrder.paymentMethod === 'card' ? '💳' : '💵'}</span>
                                    <span>
                                        {selectedOrder.paymentMethod === 'card'
                                            ? 'Paid Online'
                                            : selectedOrder.paymentStatus === 'paid'
                                                ? 'Paid in Store'
                                                : 'Pay at Store'
                                        }
                                    </span>
                                </div>
                            </div>

                            <div className="md:hidden mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                                <span className="font-bold text-[var(--text-main)]">${selectedOrder.total.toFixed(2)}</span>
                                <div className="flex gap-2">
                                    {/* Mobile Actions if needed */}
                                </div>
                            </div>


                            <div className="hidden md:block col-span-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs">👤</div>
                                    <span className="font-medium text-[var(--text-main)]">{selectedOrder.customerName}</span>
                                </div>
                                <div className="text-xs text-[var(--text-muted)] pl-8">
                                    #{selectedOrder.id}
                                </div>
                            </div>

                            <div className="hidden md:flex col-span-2 justify-end items-center gap-2">
                                <span className="font-bold text-[var(--text-main)]">${selectedOrder.total.toFixed(2)}</span>
                                {selectedOrder.paymentStatus === 'pending' && (
                                    <span className="text-[10px] uppercase tracking-wider font-bold text-orange-600 border border-orange-200 bg-orange-50 px-2 py-0.5 rounded-full">
                                        Collect Payment
                                    </span>
                                )}
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-2 block">Order Items</label>
                                <div className="bg-[var(--surface-1)] rounded-xl p-4 space-y-3">
                                    {selectedOrder.items.map((item, i) => (
                                        <div key={i} className="flex justify-between items-center pb-3 border-b border-[var(--glass-border)] last:border-0 last:pb-0">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-white flex items-center justify-center font-bold text-[var(--brand-primary)] border border-[var(--glass-border)]">
                                                    {item.quantity}x
                                                </div>
                                                <div className="font-medium">{item.productName}</div>
                                            </div>
                                            <div className="text-sm font-bold">${item.price}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Merchant Power Actions */}
                            {hasWriteAccess && (
                                <div className="p-4 bg-gray-50 rounded-xl border border-[var(--glass-border)] space-y-4">
                                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase block">Merchant Action Center</label>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-[var(--text-muted)] font-bold">SET PICKUP/READY TIME</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={estTimeInput}
                                                    onChange={(e) => setEstTimeInput(e.target.value)}
                                                    placeholder="e.g. 15 min"
                                                    className="flex-1 p-2 text-sm border rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] min-w-0"
                                                />
                                                <button
                                                    onClick={() => handleSaveET(selectedOrder.id)}
                                                    className="px-4 py-2 bg-gray-800 text-white text-xs font-bold rounded-lg hover:bg-black whitespace-nowrap"
                                                >
                                                    Save
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex flex-col justify-end">
                                            <label className="text-[10px] text-[var(--text-muted)] font-bold md:hidden mb-1">QUICK ACTION</label>
                                            {selectedOrder.status !== 'on_hold' ? (
                                                <button
                                                    onClick={() => handleUpdateStatus(selectedOrder.id, 'on_hold')}
                                                    className="w-full p-2 bg-yellow-100 text-yellow-700 border border-yellow-200 text-xs font-bold rounded-lg hover:bg-yellow-200 h-[38px] flex items-center justify-center gap-1"
                                                >
                                                    ⚠️ Put on Hold
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleUpdateStatus(selectedOrder.id, 'preparing')}
                                                    className="w-full p-2 bg-orange-100 text-orange-700 border border-orange-200 text-xs font-bold rounded-lg hover:bg-orange-200 h-[38px] flex items-center justify-center gap-1"
                                                >
                                                    👨‍🍳 Resume Prep
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-gray-200">
                                        <label className="text-[10px] text-[var(--text-muted)] font-bold block mb-1">CANCEL ORDER (PROVIDE REASON)</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={rejectionReason}
                                                onChange={(e) => setRejectionReason(e.target.value)}
                                                placeholder="e.g. Out of stock: Milk"
                                                className="flex-1 p-2 text-sm border rounded-lg min-w-0"
                                            />
                                            <button
                                                onClick={() => handleCancelOrder(selectedOrder.id)}
                                                className="px-4 py-2 bg-red-100 text-red-700 text-xs font-bold rounded-lg hover:bg-red-200 whitespace-nowrap"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                    {/* Customer Review Section (Only independent logic) */}
                                    {selectedOrder.status === 'delivered' && hasWriteAccess && (
                                        <div className="pt-3 border-t border-gray-200">
                                            <h4 className="text-[10px] text-[var(--text-muted)] font-bold mb-2 uppercase">Review Customer</h4>
                                            <ReviewForm targetId={selectedOrder.customerId || 'unknown'} targetType="shopper" />
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-between items-center pt-2">
                                <span className="font-bold text-lg">Total</span>
                                <span className="font-bold text-2xl text-[var(--brand-primary)]">${selectedOrder.total.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="p-6 border-t border-[var(--glass-border)] bg-gray-50 flex gap-3">
                            {hasWriteAccess && (
                                <>
                                    {selectedOrder.status === 'placed' && (
                                        <button onClick={() => { handleUpdateStatus(selectedOrder.id, 'preparing'); setSelectedOrder(null); }} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:brightness-110 shadow-lg shadow-blue-600/20">
                                            Accept Order
                                        </button>
                                    )}
                                    {selectedOrder.status === 'preparing' && (
                                        <button onClick={() => { handleUpdateStatus(selectedOrder.id, 'out_for_delivery'); setSelectedOrder(null); }} className="flex-1 py-3 bg-orange-500 text-white font-bold rounded-xl hover:brightness-110 shadow-lg shadow-orange-500/20">
                                            Mark Ready
                                        </button>
                                    )}
                                    {selectedOrder.status === 'out_for_delivery' && (
                                        <button onClick={() => {
                                            handleCompleteOrder(selectedOrder);
                                            setSelectedOrder(null);
                                        }} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:brightness-110 shadow-lg shadow-green-600/20">
                                            Complete Order
                                        </button>
                                    )}

                                    {/* Payment Action */}
                                    {selectedOrder.paymentStatus === 'pending' && (
                                        <button
                                            onClick={() => {
                                                handleUpdatePayment(selectedOrder);
                                                // Optimistic update of local state handled by listener
                                            }}
                                            className="px-6 py-3 bg-orange-100 text-orange-700 border border-orange-200 font-bold rounded-xl hover:bg-orange-200 transition-colors"
                                        >
                                            Mark Paid
                                        </button>
                                    )}

                                    {/* Audit Log Display */}
                                    {selectedOrder.paymentStatus === 'paid' && selectedOrder.paymentCollectedBy && (
                                        <div className="text-xs text-[var(--text-muted)] bg-gray-50 px-3 py-1 rounded-lg border border-gray-100 flex items-center gap-1">
                                            <span>✓ Payment collected by <strong>{selectedOrder.paymentCollectedBy.name}</strong></span>
                                            <span className="opacity-70">at {new Date(selectedOrder.paymentCollectedBy.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                    )}
                                </>
                            )}

                            <button onClick={() => setSelectedOrder(null)} className="px-6 py-3 border border-[var(--glass-border)] font-bold rounded-xl hover:bg-white transition-colors">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MerchantOrders;
