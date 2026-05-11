import React, { useState, useEffect, useRef, useMemo } from 'react';
import '../../styles/design-system.css';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useOrders, Order } from '../../context/OrderContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { validateOrderIntegrity } from '../../utils/IntegrityUtils';
import NotificationPopover from '../../components/NotificationPopover';
import ReviewForm from '../../components/ReviewForm';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase'; // db kept for future payment ledger queries

const MerchantOrders: React.FC = () => {
    const { can, user } = useAuth();
    const { addNotification } = useNotifications();
    const {
        orders: contextOrders,
        updateOrderStatus,
        updatePaymentStatus,
        updateEstimatedTime,
        cancelOrder,
        refundOrder,
        downloadOrderReceipt,
        loading
    } = useOrders();
    const { stores, getStore } = useMarketplace();
    const { confirm } = useConfirmation();
    const storeId = user?.storeId;
    const store = storeId ? getStore(storeId) : null;
    const isLocked = storeId ? stores[storeId]?.status === 'pending_deletion' : false;
    const storeProducts = store?.products || [];

    const hasReadAccess = can('orders:read');
    const hasWriteAccess = can('orders:write') && !isLocked;

    // const storeId = user?.storeId || '1'; // Handled by OrderContext filtering


    const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'reconciliation'>('kanban');

    const [reconData, setReconData] = useState<{
        negativeStock: { id: string; name: string; qty: number }[];
        paymentGaps: Order[];
        integrityIssues: { orderId: string; issues: string[] }[];
        totalRevenue: number;
        loading: boolean;
    }>({ negativeStock: [], paymentGaps: [], integrityIssues: [], totalRevenue: 0, loading: false });

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [now, setNow] = useState(new Date());

    const [rejectionReason, setRejectionReason] = useState('');
    const [estTimeInput, setEstTimeInput] = useState('');
    const [mobileStatusFilter, setMobileStatusFilter] = useState<string>('placed'); // Default to 'New Orders' on mobile
    const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);

    // Timer Tick
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 30000); // Update every 30s
        return () => clearInterval(interval);
    }, []);

    // Reconciliation data — fetched once when the tab is opened
    useEffect(() => {
        if (viewMode !== 'reconciliation' || !storeId) return;
        setReconData(prev => ({ ...prev, loading: true }));

        (async () => {
            try {
                // 1. Negative stock — products where available_quantity < 0
                const productsSnap = await getDocs(
                    query(collection(db, 'merchant_products'),
                        where('merchant_id', '==', storeId),
                        where('available_quantity', '<', 0))
                );
                const negativeStock = productsSnap.docs.map(d => ({
                    id: d.id,
                    name: d.data().product_name || d.data().name || d.id,
                    qty: d.data().available_quantity as number,
                }));

                // 2. Revenue from paid orders in context
                const paidOrders = contextOrders.filter(o => o.paymentStatus === 'paid');
                const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);

                // 3. Payment gap detection — card orders still in 'pending' payment status
                const paymentGaps = contextOrders.filter(
                    o => o.paymentMethod === 'card' && o.paymentStatus === 'pending' && o.status !== 'cancelled'
                );

                // 4. Price integrity check on last 10 orders
                const recentOrders = [...contextOrders]
                    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
                    .slice(0, 10);
                const integrityIssues: { orderId: string; issues: string[] }[] = [];
                for (const order of recentOrders) {
                    const result = validateOrderIntegrity(order, storeProducts);
                    if (result.flaggedItems.length > 0) {
                        integrityIssues.push({
                            orderId: order.id,
                            issues: result.flaggedItems.map(f =>
                                `${f.name}: charged $${f.orderPrice.toFixed(2)}, catalog $${f.catalogPrice.toFixed(2)}`
                            ),
                        });
                    }
                }

                setReconData({ negativeStock, paymentGaps, integrityIssues, totalRevenue, loading: false });
            } catch (err) {
                console.error('[Reconciliation] Failed:', err);
                setReconData(prev => ({ ...prev, loading: false }));
            }
        })();
    }, [viewMode, storeId]);

    // Scroll Sync for Mobile Kanban
    const kanbanRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (viewMode !== 'kanban' || !kanbanRef.current) return;

        const observerOptions = {
            root: kanbanRef.current,
            threshold: 0.6, // 60% visibility to trigger
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const statusId = entry.target.id.replace('col-', '');
                    setMobileStatusFilter(statusId);
                }
            });
        }, observerOptions);

        const columns = kanbanRef.current.querySelectorAll('[id^="col-"]');
        columns.forEach((col) => observer.observe(col));

        return () => observer.disconnect();
    }, [viewMode, contextOrders.length]); // Re-run if view changes or orders refresh

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
    const getTimeElapsedLabel = (dateStr: string) => {
        const date = new Date(dateStr);
        const diffMs = now.getTime() - date.getTime();
        const mins = Math.max(0, Math.floor(diffMs / 60000));

        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m`;
        
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h`;
        
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d`;
        
        const weeks = Math.floor(days / 7);
        if (weeks < 4) return `${weeks}w`;
        
        const months = Math.floor(days / 30);
        if (months < 12) return `${months}mo`;
        
        const years = Math.floor(days / 365);
        return `${years}y`;
    };

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

    const getStatusLabel = (order: Order) => {
        if (order.status === 'out_for_delivery') {
            return order.deliveryAddress ? 'Out for Delivery' : 'Ready for Pickup';
        }
        return order.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const handleUpdateStatus = async (id: string, newStatus: Order['status'], reason?: string) => {
        try {
            await updateOrderStatus(id, newStatus, reason);
        } catch (e) {
            console.error("Failed to update status", e);
            addNotification({ type: 'alert', title: 'Error', message: "Failed to update order status" });
        }
    };

    const handleSaveET = async (id: string) => {
        try {
            await updateEstimatedTime(id, estTimeInput);
            addNotification({ type: 'system', title: 'Updated', message: "Estimated time updated" });
        } catch (e) {
            addNotification({ type: 'alert', title: 'Error', message: "Failed to update time" });
        }
    };

    const handleCancelOrder = async (id: string) => {
        if (!rejectionReason.trim()) {
            addNotification({ type: 'alert', title: 'Required', message: "Please provide a reason for cancellation" });
            return;
        }
        try {
            await cancelOrder(id, rejectionReason);
            setSelectedOrder(null);
            setRejectionReason('');
            addNotification({ type: 'system', title: 'Cancelled', message: "Order cancelled successfully" });
        } catch (e) {
            addNotification({ type: 'alert', title: 'Error', message: "Failed to cancel order" });
        }
    };

    const handleRefundOrder = async (order: Order) => {
        if (!rejectionReason.trim()) {
            addNotification({ type: 'alert', title: 'Required', message: "Please provide a reason for refund" });
            return;
        }

        const confirmed = await confirm({
            title: 'Confirm Refund',
            message: `Are you sure you want to refund $${order.total.toFixed(2)} to ${order.customerName}? This will process immediately through Stripe.`,
            confirmText: 'Issue Refund',
            type: 'danger'
        });

        if (!confirmed) return;

        try {
            await refundOrder(order.id, rejectionReason);
            setRejectionReason('');
            addNotification({ type: 'system', title: 'Refund Initiated', message: "Funds are being transferred back to the customer." });
        } catch (e: any) {
            console.error("Refund failed", e);
            addNotification({ type: 'alert', title: 'Refund Failed', message: e.message || "Failed to process refund" });
        }
    };

    const handleDownloadReceipt = async (orderId: string) => {
        setDownloadingReceiptId(orderId);
        try {
            await downloadOrderReceipt(orderId);
        } catch (error: any) {
            addNotification({
                type: 'alert',
                title: 'Receipt Failed',
                message: error.message || 'Failed to generate PDF receipt'
            });
        } finally {
            setDownloadingReceiptId(null);
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
            addNotification({ type: 'alert', title: 'Error', message: "Failed to mark paid" });
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
            addNotification({ type: 'alert', title: 'Error', message: "Failed to complete order" });
        }
    };




    // Render Logic moved to outside component

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-[var(--surface-1)]">
            {/* Header with Stats */}
            <div className="p-4 md:p-6 pb-2 shrink-0">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                    <div>
                        <h1 className="page-headline">Live Orders Dashboard</h1>
                        <div className="flex gap-4 mt-1 text-[10px] md:text-sm text-[var(--text-muted)]">
                            <span className="flex items-center gap-1">⏱️ Avg Prep: <strong>12m</strong></span>
                            <span className="flex items-center gap-1">⭐ On-Time: <strong>98%</strong></span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="flex bg-[var(--surface-2)] p-1 rounded-xl shadow-inner">
                            <button
                                onClick={() => setViewMode('kanban')}
                                className={`px-2 md:px-3 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all ${viewMode === 'kanban' ? 'bg-white shadow-sm text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}
                            >
                                Kanban
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`px-2 md:px-3 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}
                            >
                                List
                            </button>
                            <button
                                onClick={() => setViewMode('reconciliation')}
                                className={`px-2 md:px-3 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all ${viewMode === 'reconciliation' ? 'bg-white shadow-sm text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}
                            >
                                Reconcile
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Filter Segments (Only visible for Kanban) */}
            {viewMode === 'kanban' && (
                <div className="px-4 pb-4 md:hidden">
                    <div className="bg-[var(--surface-2)] p-1 rounded-2xl shadow-inner flex overflow-x-auto no-scrollbar scroll-smooth">
                        {[
                            { id: 'placed', label: 'New', icon: '🔔' },
                            { id: 'preparing', label: 'Prep', icon: '👨‍🍳' },
                            { id: 'on_hold', label: 'Hold', icon: '⏳' },
                            { id: 'out_for_delivery', label: 'Ready', icon: '🛍️' },
                            { id: 'delivered', label: 'Done', icon: '✅' }
                        ].map(status => (
                            <button
                                key={status.id}
                                onClick={() => {
                                    setMobileStatusFilter(status.id);
                                    document.getElementById(`col-${status.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                                }}
                                className={`flex-1 min-w-[72px] px-1 py-2.5 rounded-xl text-[10px] font-black whitespace-nowrap transition-all flex flex-col items-center gap-1 relative ${mobileStatusFilter === status.id
                                    ? 'bg-white shadow-md text-[var(--brand-primary)]'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                                    }`}
                            >
                                <span className="text-sm">{status.icon}</span>
                                <span>{status.label}</span>
                                
                                {/* Status Count Badge */}
                                <span className={`absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold ${mobileStatusFilter === status.id ? 'bg-[var(--brand-primary)] text-white' : 'bg-gray-100 text-gray-400'}`}>
                                    {filteredOrders.filter(o => o.status === status.id).length}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}


            {/* Kanban Board (Scrollable on Mobile) */}
            {
                viewMode === 'kanban' && (
                    <div 
                        ref={kanbanRef}
                        className="flex-1 min-h-0 p-4 md:p-6 pt-0 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory"
                    >
                        <div className="flex flex-nowrap md:grid md:grid-cols-5 gap-4 h-full min-w-max md:min-w-0">
                            {/* Columns */}
                            {[
                                { id: 'placed', label: '🔔 New Orders', color: 'border-blue-500' },
                                { id: 'preparing', label: '👨‍🍳 Preparing', color: 'border-orange-500' },
                                { id: 'on_hold', label: '⏳ On Hold', color: 'border-yellow-500' },
                                { id: 'out_for_delivery', label: '🛍️ Ready / On Route', color: 'border-purple-500' },
                                { id: 'delivered', label: '✅ Delivered / Done', color: 'border-green-500' }
                            ].map(col => (
                                <div
                                    key={col.id}
                                    id={`col-${col.id}`}
                                    className={`flex flex-col h-full bg-[var(--surface-1)]/50 rounded-2xl border border-[var(--glass-border)] overflow-hidden transition-all duration-300 w-[85vw] md:w-auto shrink-0 snap-center
                                `}
                                >
                                    <div className={`p-3 font-black text-[10px] md:text-xs border-b-2 bg-white flex justify-between shrink-0 ${col.color}`}>
                                        <span className="uppercase tracking-widest">{col.label}</span>
                                        <span className="text-[var(--text-muted)] bg-gray-50 px-2 py-0.5 rounded-full">{filteredOrders.filter(o => o.status === col.id).length}</span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 md:p-3 space-y-3 pb-safe scrollbar-hide">
                                        {filteredOrders.filter(o => o.status === col.id).map(order => (
                                            <OrderCard
                                                key={order.id}
                                                order={order}
                                                onClick={() => setSelectedOrder(order)}
                                                onUpdateStatus={handleUpdateStatus}
                                                onComplete={handleCompleteOrder}
                                                onMarkPaid={handleUpdatePayment}
                                                timeElapsed={getTimeElapsedLabel(order.date)}
                                                isLate={getMinutesElapsed(order.date) > 20 && order.status !== 'delivered'}
                                                hasWriteAccess={hasWriteAccess}
                                                statusLabel={getStatusLabel(order)}
                                            />
                                        ))}
                                        {filteredOrders.filter(o => o.status === col.id).length === 0 && (
                                            <div className="text-center py-12 text-[var(--text-muted)] text-sm opacity-60">
                                                <div className="text-3xl mb-2 opacity-30">✨</div>
                                                No orders here
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }

            {/* List View */}
            {
                viewMode === 'list' && (
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 pt-0">
                        {/* Mobile List View (Cards) */}
                        <div className="md:hidden space-y-3 pb-safe">
                            {filteredOrders.length > 0 ? filteredOrders.map(order => (
                                <div 
                                    key={order.id} 
                                    onClick={() => setSelectedOrder(order)}
                                    className="bg-white p-4 rounded-2xl border border-[var(--glass-border)] shadow-sm active:scale-[0.98] transition-all flex justify-between items-center"
                                >
                                    <div className="min-w-0 pr-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-black text-sm text-[var(--text-main)]">#{order.id.substr(0, 8)}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${getStatusColor(order.status)} uppercase`}>
                                                {order.status}
                                            </span>
                                        </div>
                                        <div className="text-xs text-[var(--text-muted)] font-medium truncate italic">{order.customerName}</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-sm font-black text-[var(--brand-primary)]">${order.total.toFixed(2)}</div>
                                        <div className="text-[10px] text-[var(--text-muted)] font-bold">{getTimeElapsedLabel(order.date)} ago</div>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-20 text-[var(--text-muted)] opacity-50">
                                    <div className="text-4xl mb-2">📭</div>
                                    No orders found
                                </div>
                            )}
                        </div>

                        {/* Desktop List View (Table) */}
                        <div className="hidden md:block bg-white rounded-2xl border border-[var(--glass-border)] overflow-hidden shadow-sm">
                            <table className="w-full">
                                <thead className="bg-[var(--surface-1)] text-left text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                                    <tr>
                                        <th className="p-4">ID</th>
                                        <th className="p-4">Customer</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-center">Items</th>
                                        <th className="p-4 text-right">Total</th>
                                        <th className="p-4 text-center">Elapsed</th>
                                        <th className="p-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--glass-border)]">
                                    {filteredOrders.map(order => (
                                        <tr key={order.id} onClick={() => setSelectedOrder(order)} className="hover:bg-[var(--surface-1)] cursor-pointer transition-colors group">
                                            <td className="p-4 font-bold text-sm text-[var(--text-main)]">#{order.id.substr(0, 12)}...</td>
                                            <td className="p-4">
                                                <div className="font-medium text-sm">{order.customerName}</div>
                                                <div className="text-[10px] text-[var(--text-muted)]">{order.deliveryAddress ? '🛵 Delivery' : '🛍️ Pickup'}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-black border ${getStatusColor(order.status)} uppercase tracking-tighter`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center text-sm font-bold text-[var(--text-muted)]">{order.items.length}</td>
                                            <td className="p-4 text-right font-black text-[var(--brand-primary)]">${order.total.toFixed(2)}</td>
                                            <td className="p-4 text-center text-xs font-medium text-[var(--text-muted)]">{getTimeElapsedLabel(order.date)} ago</td>
                                            <td className="p-4 text-right">
                                                <button className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] text-[var(--brand-primary)] font-bold text-xs hover:bg-[var(--brand-primary)] hover:text-white transition-all shadow-sm">
                                                    Open
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredOrders.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="p-20 text-center text-[var(--text-muted)]">
                                                <div className="text-4xl mb-4">📭</div>
                                                <p className="text-lg font-bold">No orders match your filters</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            }

            {/* Reconciliation View */}
            {viewMode === 'reconciliation' && (
                <div className="flex-1 overflow-y-auto p-4 md:p-6 pt-2 space-y-4 animate-fade-in">
                    {reconData.loading ? (
                        <div className="text-center py-20 text-[var(--text-muted)]">
                            <div className="text-3xl mb-3 animate-spin">⚙️</div>
                            <p className="text-sm font-medium">Loading reconciliation data...</p>
                        </div>
                    ) : (
                        <>
                            {/* Revenue Summary */}
                            <div className="bg-white rounded-2xl border border-[var(--glass-border)] p-5 shadow-sm">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Paid Revenue (All Time)</p>
                                <p className="text-3xl font-black text-[var(--brand-primary)]">${reconData.totalRevenue.toFixed(2)}</p>
                                <p className="text-xs text-[var(--text-muted)] mt-1">{contextOrders.filter(o => o.paymentStatus === 'paid').length} paid orders</p>
                            </div>

                            {/* Negative Stock Alerts */}
                            <div className="bg-white rounded-2xl border border-[var(--glass-border)] p-5 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Negative Stock</p>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${reconData.negativeStock.length > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                        {reconData.negativeStock.length} issues
                                    </span>
                                </div>
                                {reconData.negativeStock.length === 0 ? (
                                    <p className="text-sm text-[var(--text-muted)]">All products have non-negative inventory.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {reconData.negativeStock.map(p => (
                                            <div key={p.id} className="flex justify-between items-center p-3 bg-red-50 rounded-xl border border-red-100">
                                                <span className="text-sm font-medium text-[var(--text-main)] truncate pr-4">{p.name}</span>
                                                <span className="text-sm font-black text-red-600 shrink-0">{p.qty}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Payment Gaps */}
                            <div className="bg-white rounded-2xl border border-[var(--glass-border)] p-5 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Payment Gaps</p>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${reconData.paymentGaps.length > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                        {reconData.paymentGaps.length} gaps
                                    </span>
                                </div>
                                <p className="text-[10px] text-[var(--text-muted)] mb-3">Card orders with payment still pending (not yet settled).</p>
                                {reconData.paymentGaps.length === 0 ? (
                                    <p className="text-sm text-[var(--text-muted)]">All paid orders are reconciled.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {reconData.paymentGaps.map(o => (
                                            <div key={o.id} className="flex justify-between items-center p-3 bg-yellow-50 rounded-xl border border-yellow-100">
                                                <div className="min-w-0 pr-4">
                                                    <p className="text-xs font-bold text-[var(--text-main)]">#{o.id.substr(0, 8)}</p>
                                                    <p className="text-[10px] text-[var(--text-muted)] truncate">{o.customerName}</p>
                                                </div>
                                                <span className="text-sm font-black text-yellow-700 shrink-0">${o.total.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Price Integrity Issues */}
                            <div className="bg-white rounded-2xl border border-[var(--glass-border)] p-5 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Price Integrity (Last 10 Orders)</p>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${reconData.integrityIssues.length > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                        {reconData.integrityIssues.length} alerts
                                    </span>
                                </div>
                                {reconData.integrityIssues.length === 0 ? (
                                    <p className="text-sm text-[var(--text-muted)]">No price discrepancies detected in recent orders.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {reconData.integrityIssues.map(({ orderId, issues }) => (
                                            <div key={orderId} className="p-3 bg-red-50 rounded-xl border border-red-100">
                                                <p className="text-xs font-bold text-red-700 mb-1">Order #{orderId.substr(0, 8)}</p>
                                                <ul className="space-y-0.5">
                                                    {issues.map((issue, i) => (
                                                        <li key={i} className="text-[10px] text-red-600">• {issue}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Order Detail Modal / Mobile Side Panel */}
            {
                selectedOrder && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-end z-[60] animate-fade-in" onClick={() => setSelectedOrder(null)}>
                        <div 
                            className="bg-white rounded-t-3xl md:rounded-l-3xl w-full md:max-w-md h-[92vh] md:h-screen shadow-2xl overflow-hidden flex flex-col md:animate-slide-left animate-slide-up" 
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-6 border-b border-[var(--glass-border)] flex justify-between items-start bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm">
                                <div>
                                    <h2 className="text-2xl font-bold text-[var(--text-main)] flex items-center gap-2">
                                        #{selectedOrder.id.substr(0, 8)}
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(selectedOrder.id);
                                                addNotification({ type: 'system', title: 'Copied', message: 'Full ID copied to clipboard' });
                                            }}
                                            className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-300 transition-colors"
                                        >
                                            COPY
                                        </button>
                                    </h2>
                                    <p className="text-sm text-[var(--text-muted)] mt-1">{selectedOrder.deliveryAddress ? '🛵 Delivery' : '🛍️ Store Pickup'}</p>
                                </div>
                                <button onClick={() => setSelectedOrder(null)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-[var(--glass-border)] shadow-sm text-gray-400 hover:text-gray-600">
                                    ✕
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide pb-32">
                                {/* Status Progress Bar (Mobile-friendly visual) */}
                                <div className="flex justify-between items-center mb-2 px-1">
                                    {['placed', 'preparing', 'out_for_delivery', 'delivered'].map((s, i) => {
                                        const steps = ['placed', 'preparing', 'out_for_delivery', 'delivered'];
                                        const currentIdx = steps.indexOf(selectedOrder.status);
                                        const isActive = steps.indexOf(s) <= currentIdx;
                                        return (
                                            <React.Fragment key={s}>
                                                <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-[var(--brand-primary)]' : 'bg-gray-200'}`}></div>
                                                {i < steps.length - 1 && <div className={`flex-1 h-1 mx-1 rounded-full ${steps.indexOf(steps[i+1]) <= currentIdx ? 'bg-[var(--brand-primary)]' : 'bg-gray-100'}`}></div>}
                                            </React.Fragment>
                                        );
                                    })}
                                </div>

                                {/* Integrity Check */}
                                {(() => {
                                    const integrity = validateOrderIntegrity(selectedOrder, storeProducts);
                                    if (!integrity.isValid) {
                                        return (
                                            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 animate-pulse">
                                                <div className="flex items-center gap-2 text-red-700 font-bold mb-2">
                                                    <span>🚨 SECURITY ALERT</span>
                                                </div>
                                                <p className="text-xs text-red-600 font-medium">Potential price tampering detected. Items in this order differ from your master catalog prices.</p>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}

                                {/* Customer Quick Contact */}
                                <div className="bg-[var(--surface-1)] p-5 rounded-2xl border border-[var(--glass-border)]">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Customer</label>
                                            <div className="font-bold text-lg text-[var(--text-main)] italic">{selectedOrder.customerName}</div>
                                        </div>
                                        {selectedOrder.customerPhone && (
                                            <a 
                                                href={`tel:${selectedOrder.customerPhone}`}
                                                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-[var(--brand-primary)] text-white shadow-lg shadow-[var(--brand-primary)]/40 active:scale-95 transition-transform"
                                            >
                                                📞
                                            </a>
                                        )}
                                    </div>
                                    {selectedOrder.deliveryAddress && (
                                        <div className="pt-4 border-t border-[var(--glass-border)]">
                                            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Delivery Address</label>
                                            <div className="text-sm font-medium mt-1 leading-snug">{selectedOrder.deliveryAddress.street}, {selectedOrder.deliveryAddress.city}</div>
                                            <button className="text-[var(--brand-primary)] text-xs font-bold mt-2 hover:underline">🗺️ Open in Maps</button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex justify-between items-center">
                                        <span>Order Summary</span>
                                        <span>{selectedOrder.items.length} items</span>
                                    </label>
                                    <div className="space-y-3">
                                        {selectedOrder.items.map((item, i) => (
                                            <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-8 h-8 rounded-lg bg-[var(--surface-2)] flex items-center justify-center font-bold text-[var(--brand-primary)] text-xs border border-[var(--glass-border)] shrink-0">
                                                        {item.quantity}x
                                                    </div>
                                                    <div className="font-medium text-sm truncate pr-2">{item.productName}</div>
                                                </div>
                                                <div className="text-sm font-bold shrink-0">${item.price.toFixed(2)}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between items-center px-2 pt-2">
                                        <span className="text-sm font-bold text-gray-500">Total Charged</span>
                                        <span className="text-2xl font-black text-[var(--brand-primary)]">${selectedOrder.total.toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* Actions Panel - Mobile Optimized */}
                                {hasWriteAccess && (
                                    <div className="bg-gray-900 rounded-3xl p-5 md:p-6 text-white space-y-6">
                                        <div className="space-y-5">
                                            <h3 className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Merchant Controls</h3>
                                            
                                            <div className="grid grid-cols-2 gap-3">
                                                <button 
                                                    onClick={() => handleUpdateStatus(selectedOrder.id, selectedOrder.status === 'on_hold' ? 'preparing' : 'on_hold')} 
                                                    className={`p-3 rounded-2xl text-[11px] font-black transition-all border flex items-center justify-center gap-2 ${selectedOrder.status === 'on_hold' ? 'bg-orange-500 text-white border-orange-400' : 'bg-white/10 text-white border-white/5 hover:bg-white/20'}`}
                                                >
                                                    {selectedOrder.status === 'on_hold' ? '▶️ Resume' : '⏳ Hold'}
                                                </button>
                                                <button 
                                                    onClick={() => handleDownloadReceipt(selectedOrder.id)} 
                                                    disabled={downloadingReceiptId === selectedOrder.id}
                                                    className="bg-white/10 p-3 rounded-2xl text-[11px] font-black hover:bg-white/20 transition-all border border-white/5 flex items-center justify-center gap-2 disabled:opacity-50"
                                                >
                                                    {downloadingReceiptId === selectedOrder.id ? '⌛...' : '📄 Receipt'}
                                                </button>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase tracking-widest opacity-50 ml-1">Est. Prep Time</label>
                                                <div className="flex gap-2 h-11">
                                                    <input
                                                        type="text"
                                                        value={estTimeInput}
                                                        onChange={(e) => setEstTimeInput(e.target.value)}
                                                        placeholder="e.g. 15 min"
                                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 text-sm focus:ring-1 focus:ring-[var(--brand-primary)] outline-none"
                                                    />
                                                    <button 
                                                        onClick={() => handleSaveET(selectedOrder.id)} 
                                                        className="px-5 bg-white text-black text-[11px] font-black rounded-xl active:scale-95 transition-all shrink-0"
                                                    >
                                                        Save
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-white/10">
                                                <label className="text-[9px] font-black uppercase tracking-widest opacity-50 ml-1">Cancel / Reject</label>
                                                <div className="flex gap-2 mt-2 h-11">
                                                    <input
                                                        type="text"
                                                        value={rejectionReason}
                                                        onChange={(e) => setRejectionReason(e.target.value)}
                                                        placeholder="Reason..."
                                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 text-sm outline-none"
                                                    />
                                                    <button 
                                                        onClick={() => handleCancelOrder(selectedOrder.id)} 
                                                        className="px-5 bg-red-500/20 text-red-400 border border-red-500/30 text-[11px] font-black rounded-xl active:scale-95 transition-all shrink-0"
                                                    >
                                                        REJ.
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Floating Action Bar at Bottom - Mobile Optimized */}
                            <div className="p-4 md:p-6 border-t border-[var(--glass-border)] bg-white/95 backdrop-blur-md flex flex-col sm:flex-row gap-3 sticky bottom-0 z-20 pb-safe">
                                {hasWriteAccess && (
                                    <div className="flex-1 flex gap-3">
                                        {selectedOrder.status === 'on_hold' && (
                                            <button 
                                                onClick={() => { handleUpdateStatus(selectedOrder.id, 'preparing'); setSelectedOrder(null); }} 
                                                className="flex-1 py-4 bg-[var(--brand-primary)] text-white text-sm font-black rounded-2xl hover:brightness-110 shadow-lg active:scale-[0.98] transition-all"
                                            >
                                                Accept Order
                                            </button>
                                        )}
                                        {selectedOrder.status === 'placed' && (
                                            <button 
                                                onClick={() => { handleUpdateStatus(selectedOrder.id, 'preparing'); setSelectedOrder(null); }} 
                                                className="flex-1 py-4 bg-blue-600 text-white text-sm font-black rounded-2xl hover:brightness-110 shadow-lg active:scale-[0.98] transition-all"
                                            >
                                                Accept Order
                                            </button>
                                        )}
                                        {selectedOrder.status === 'preparing' && (
                                            <button 
                                                onClick={() => { handleUpdateStatus(selectedOrder.id, 'out_for_delivery'); setSelectedOrder(null); }} 
                                                className="flex-1 py-4 bg-orange-500 text-white text-sm font-black rounded-2xl hover:brightness-110 shadow-lg active:scale-[0.98] transition-all"
                                            >
                                                {selectedOrder.deliveryAddress ? 'Out for Delivery' : 'Ready for Pickup'}
                                            </button>
                                        )}
                                        {selectedOrder.status === 'out_for_delivery' && (
                                            <button 
                                                onClick={() => { handleCompleteOrder(selectedOrder); setSelectedOrder(null); }} 
                                                className="flex-1 py-4 bg-green-600 text-white text-sm font-black rounded-2xl hover:brightness-110 shadow-lg active:scale-[0.98] transition-all"
                                            >
                                                Complete Order
                                            </button>
                                        )}
                                    </div>
                                )}
                                <button 
                                    onClick={() => setSelectedOrder(null)} 
                                    className="px-6 py-4 border border-[var(--glass-border)] text-sm font-black rounded-2xl text-gray-500 hover:bg-gray-50 transition-colors w-full sm:w-auto"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
};

// --- Internal Components ---

interface OrderCardProps {
    order: Order;
    onClick: () => void;
    onUpdateStatus: (id: string, status: Order['status']) => void;
    onComplete: (order: Order) => void;
    onMarkPaid: (order: Order) => void;
    timeElapsed: string;
    isLate: boolean;
    hasWriteAccess: boolean;
    statusLabel: string;
}

const OrderCard = ({ order, onClick, onUpdateStatus, onComplete, onMarkPaid, timeElapsed, isLate, hasWriteAccess, statusLabel }: OrderCardProps) => {
    const isDelivery = !!order.deliveryAddress;

    return (
        <div
            onClick={onClick}
            className={`bg-white rounded-2xl p-4 shadow-sm border cursor-pointer hover:shadow-lg transition-all relative overflow-hidden group ${isLate ? 'border-red-200 bg-red-50/10' : 'border-[var(--glass-border)]'}`}
        >
            {/* Urgent Strip */}
            {isLate && <div className="absolute top-0 left-0 w-1.5 h-full bg-red-400"></div>}

            <div className="flex justify-between items-start mb-3 pl-1">
                <div className="min-w-0 pr-4">
                    <div className="font-black text-[var(--text-main)] flex items-center gap-1.5 mb-0.5">
                        <span className="text-sm">#{order.id.substr(0, 4)}</span>
                        {isDelivery ? <span className="text-xs">🛵</span> : <span className="text-xs">🛍️</span>}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wider truncate">{order.customerName}</div>
                </div>
                <div className={`text-[10px] font-black px-2 py-1 rounded-full shrink-0 ${isLate ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500'}`}>
                    {timeElapsed}
                </div>
            </div>

            {/* Order Items Preview */}
            <div className="mb-4 pl-1 space-y-1">
                {order.items.slice(0, 3).map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] text-[var(--text-main)] font-medium">
                        <span className="w-4 h-4 bg-gray-100 rounded flex items-center justify-center font-bold text-[8px] text-gray-500 shrink-0">{item.quantity}x</span>
                        <span className="truncate">{item.productName}</span>
                    </div>
                ))}
                {order.items.length > 3 && (
                    <div className="text-[9px] text-gray-400 font-bold pl-6 italic">
                        + {order.items.length - 3} more items...
                    </div>
                )}
                <div className="pt-1 text-[10px] text-gray-400 font-bold border-t border-dashed border-gray-100 mt-2">
                    {order.items.length} items • ${order.total.toFixed(2)}
                </div>
            </div>

            <div className="pt-3 border-t border-[var(--glass-border)] flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                    {order.estimatedTime && (
                        <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-bold">
                            ⏱️ {order.estimatedTime}
                        </span>
                    )}
                </div>
                
                <div className="flex gap-2">
                    {hasWriteAccess ? (
                        <>
                            {order.status === 'on_hold' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onUpdateStatus(order.id, 'preparing'); }}
                                    className="px-3 py-1.5 bg-[var(--brand-primary)] text-white text-[10px] font-black rounded-lg active:scale-90 transition-transform shadow-md shadow-[var(--brand-primary)]/20"
                                >
                                    RESUME
                                </button>
                            )}
                            {order.status === 'placed' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onUpdateStatus(order.id, 'preparing'); }}
                                    className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-black rounded-lg active:scale-90 transition-transform shadow-md shadow-blue-600/20"
                                >
                                    ACCEPT
                                </button>
                            )}
                            {order.status === 'preparing' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onUpdateStatus(order.id, 'out_for_delivery'); }}
                                    className="px-3 py-1.5 bg-orange-500 text-white text-[10px] font-black rounded-lg active:scale-90 transition-transform shadow-md shadow-orange-500/20"
                                >
                                    READY
                                </button>
                            )}
                            {order.status === 'out_for_delivery' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onComplete(order); }}
                                    className="px-3 py-1.5 bg-green-600 text-white text-[10px] font-black rounded-lg active:scale-90 transition-transform shadow-md shadow-green-600/20"
                                >
                                    DONE
                                </button>
                            )}
                        </>
                    ) : (
                        <span className="text-[9px] text-[var(--text-muted)] font-black uppercase py-1 px-2 bg-gray-50 border rounded-full">
                            {statusLabel}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MerchantOrders;
