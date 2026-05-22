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
        grossSales: number;
        totalRefunds: number;
        netSales: number;
        platformFees: number;
        totalTaxes: number;
        totalDeliveryFees: number;
        netPayout: number;
        loading: boolean;
    }>({
        negativeStock: [],
        paymentGaps: [],
        integrityIssues: [],
        grossSales: 0,
        totalRefunds: 0,
        netSales: 0,
        platformFees: 0,
        totalTaxes: 0,
        totalDeliveryFees: 0,
        netPayout: 0,
        loading: false
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [ledgerSearch, setLedgerSearch] = useState('');
    const [ledgerDateRange, setLedgerDateRange] = useState<'all' | '7d' | '30d' | 'this_month'>('all');
    const [ledgerOrderType, setLedgerOrderType] = useState<'all' | 'card' | 'in_store' | 'delivery' | 'pickup'>('all');
    
    // Collapsible Operational Alerts
    const [isNegativeStockExpanded, setIsNegativeStockExpanded] = useState(false);
    const [isPaymentGapsExpanded, setIsPaymentGapsExpanded] = useState(false);
    const [isPriceIntegrityExpanded, setIsPriceIntegrityExpanded] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [now, setNow] = useState(new Date());

    const [rejectionReason, setRejectionReason] = useState('');
    
    // Refund Wizard Modal States
    const [isRefundWizardOpen, setIsRefundWizardOpen] = useState(false);
    const [refundWizardOrder, setRefundWizardOrder] = useState<Order | null>(null);
    const [refundWizardStep, setRefundWizardStep] = useState<1 | 2 | 3>(1);
    const [refundWizardType, setRefundWizardType] = useState<'full' | 'partial'>('full');
    const [refundWizardAmount, setRefundWizardAmount] = useState('');
    const [refundWizardReason, setRefundWizardReason] = useState('Customer Request');
    const [refundWizardCustomReason, setRefundWizardCustomReason] = useState('');
    const [refundWizardError, setRefundWizardError] = useState<string | null>(null);
    const [refundWizardId, setRefundWizardId] = useState<string | null>(null);
    const [refundMilestone, setRefundMilestone] = useState(0);

    // Delivery Evidence Modal States
    const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
    const [evidenceOrder, setEvidenceOrder] = useState<Order | null>(null);
    const [evidenceType, setEvidenceType] = useState<'signature' | 'photo' | 'none'>('signature');
    const [signatureName, setSignatureName] = useState('');
    const [signatureData, setSignatureData] = useState<string | null>(null);
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [photoPreset, setPhotoPreset] = useState<string | null>('door');
    const [customPhotoData, setCustomPhotoData] = useState<string | null>(null);
    const [evidenceNote, setEvidenceNote] = useState('');
    const [isEvidenceSubmitting, setIsEvidenceSubmitting] = useState(false);

    // Canvas drawing refs
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const isDrawingRef = useRef(false);
    const lastXRef = useRef(0);
    const lastYRef = useRef(0);

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

                // 2. Financial reconciliation calculations
                const grossOrders = contextOrders.filter(o => ['paid', 'refunded', 'partially_refunded', 'refunding'].includes(o.paymentStatus));
                const grossSales = grossOrders.reduce((sum, o) => sum + (o.total || 0), 0);

                const totalRefunds = contextOrders.reduce((sum, o) => {
                    if (o.paymentStatus === 'refunded') {
                        return sum + (o.refundedAmount || o.refundingAmount || o.total || 0);
                    } else if (['partially_refunded', 'refunding'].includes(o.paymentStatus)) {
                        return sum + (o.refundedAmount || o.refundingAmount || 0);
                    }
                    return sum;
                }, 0);

                const netSales = grossSales - totalRefunds;

                const platformFees = contextOrders.reduce((sum, o) => {
                    if (o.paymentMethod === 'card') {
                        if (o.paymentStatus === 'paid') {
                            return sum + (0.05 * o.total + 0.30);
                        } else if (['partially_refunded', 'refunded', 'refunding'].includes(o.paymentStatus)) {
                            const refunded = o.refundedAmount || o.refundingAmount || 0;
                            const netAmount = o.total - refunded;
                            return sum + Math.max(0, 0.05 * netAmount + 0.30);
                        }
                    }
                    return sum;
                }, 0);

                const totalTaxes = grossOrders.reduce((sum, o) => sum + (o.tax || 0), 0);
                const totalDeliveryFees = grossOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
                const netPayout = netSales - platformFees;

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

                setReconData({
                    negativeStock,
                    paymentGaps,
                    integrityIssues,
                    grossSales,
                    totalRefunds,
                    netSales,
                    platformFees,
                    totalTaxes,
                    totalDeliveryFees,
                    netPayout,
                    loading: false
                });
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

    // Memoize the filtered transaction log list (Ledger Transactions)
    const ledgerTransactions = useMemo(() => {
        let list = contextOrders.filter(o => 
            ['paid', 'refunded', 'partially_refunded', 'refunding'].includes(o.paymentStatus)
        );

        // Date Range Filtering
        if (ledgerDateRange !== 'all') {
            const nowTime = new Date().getTime();
            list = list.filter(o => {
                const orderTime = new Date(o.date).getTime();
                const diffDays = (nowTime - orderTime) / (1000 * 60 * 60 * 24);
                if (ledgerDateRange === '7d') return diffDays <= 7;
                if (ledgerDateRange === '30d') return diffDays <= 30;
                if (ledgerDateRange === 'this_month') {
                    const orderDate = new Date(o.date);
                    const currentDate = new Date();
                    return orderDate.getMonth() === currentDate.getMonth() && 
                           orderDate.getFullYear() === currentDate.getFullYear();
                }
                return true;
            });
        }

        // Order Type / Fulfillment Filtering
        if (ledgerOrderType !== 'all') {
            list = list.filter(o => {
                if (ledgerOrderType === 'card') return o.paymentMethod === 'card';
                if (ledgerOrderType === 'in_store') return o.paymentMethod === 'in_store';
                if (ledgerOrderType === 'delivery') return !!o.deliveryAddress;
                if (ledgerOrderType === 'pickup') return !o.deliveryAddress;
                return true;
            });
        }

        // Search Query Filtering
        if (ledgerSearch.trim()) {
            const query = ledgerSearch.toLowerCase().trim();
            list = list.filter(o => 
                o.id.toLowerCase().includes(query) || 
                o.customerName.toLowerCase().includes(query)
            );
        }

        // Sort newest to oldest
        return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [contextOrders, ledgerSearch, ledgerDateRange, ledgerOrderType]);

    // Memoize ledger totals dynamically based on selected filters
    const ledgerTotals = useMemo(() => {
        const grossSales = ledgerTransactions.reduce((sum, o) => sum + (o.total || 0), 0);
        
        const totalRefunds = ledgerTransactions.reduce((sum, o) => {
            if (o.paymentStatus === 'refunded') {
                return sum + (o.refundedAmount || o.refundingAmount || o.total || 0);
            } else if (['partially_refunded', 'refunding'].includes(o.paymentStatus)) {
                return sum + (o.refundedAmount || o.refundingAmount || 0);
            }
            return sum;
        }, 0);

        const totalTaxes = ledgerTransactions.reduce((sum, o) => sum + (o.tax || 0), 0);
        
        const totalDeliveryFees = ledgerTransactions.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);

        const platformFees = ledgerTransactions.reduce((sum, o) => {
            if (o.paymentMethod === 'card') {
                if (o.paymentStatus === 'paid') {
                    return sum + (0.05 * o.total + 0.30);
                } else if (['partially_refunded', 'refunded', 'refunding'].includes(o.paymentStatus)) {
                    const refunded = o.refundedAmount || o.refundingAmount || 0;
                    const netAmount = o.total - refunded;
                    return sum + Math.max(0, 0.05 * netAmount + 0.30);
                }
            }
            return sum;
        }, 0);

        const netSales = grossSales - totalRefunds;
        const netPayout = netSales - platformFees;

        return {
            grossSales,
            totalRefunds,
            totalTaxes,
            totalDeliveryFees,
            platformFees,
            netSales,
            netPayout
        };
    }, [ledgerTransactions]);

    // Local CSV Exporter Method
    const handleExportLedgerCSV = () => {
        if (ledgerTransactions.length === 0) {
            addNotification({
                type: 'alert',
                title: 'No Data',
                message: 'There are no transactions in the current ledger view to export.'
            });
            return;
        }

        // CSV Headers
        const headers = [
            'Order ID',
            'Date',
            'Shopper Name',
            'Fulfillment Type',
            'Payment Method',
            'Payment Status',
            'Subtotal ($)',
            'Sales Tax ($)',
            'Delivery Fee ($)',
            'Refunded Amount ($)',
            'Platform Fees ($)',
            'Order Total ($)',
            'Net Payout ($)'
        ];

        // Format rows
        const rows = ledgerTransactions.map(o => {
            const isCard = o.paymentMethod === 'card';
            const refunded = (o.paymentStatus === 'refunded') 
                ? (o.refundedAmount || o.refundingAmount || o.total || 0) 
                : (['partially_refunded', 'refunding'].includes(o.paymentStatus) ? (o.refundedAmount || o.refundingAmount || 0) : 0);
            
            let platformFee = 0;
            if (isCard) {
                if (o.paymentStatus === 'paid') {
                    platformFee = 0.05 * o.total + 0.30;
                } else if (['partially_refunded', 'refunded', 'refunding'].includes(o.paymentStatus)) {
                    platformFee = Math.max(0, 0.05 * (o.total - refunded) + 0.30);
                }
            }
            const netPayout = (o.total - refunded) - platformFee;

            return [
                o.id,
                new Date(o.date).toLocaleString(),
                `"${o.customerName.replace(/"/g, '""')}"`,
                o.deliveryAddress ? 'Delivery' : 'Pickup',
                o.paymentMethod === 'card' ? 'Online Card' : 'In-Store Cash',
                o.paymentStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                o.subtotal.toFixed(2),
                o.tax.toFixed(2),
                o.deliveryFee.toFixed(2),
                refunded.toFixed(2),
                platformFee.toFixed(2),
                o.total.toFixed(2),
                netPayout.toFixed(2)
            ];
        });

        // Combine into CSV string
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        
        // Create download blob
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const timestamp = new Date().toISOString().slice(0, 10);
        link.setAttribute('href', url);
        link.setAttribute('download', `spendigo_ledger_export_${timestamp}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        addNotification({
            type: 'system',
            title: 'Export Complete 📥',
            message: `Successfully exported ${ledgerTransactions.length} transactions to CSV.`
        });
    };

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
            if (newStatus === 'preparing') {
                const order = contextOrders.find(o => o.id === id);
                const isCurrentlySelected = selectedOrder && selectedOrder.id === id;
                const prepTime = (isCurrentlySelected ? estTimeInput : '') || order?.estimatedTime;
                
                if (!prepTime) {
                    addNotification({
                        type: 'alert',
                        title: 'Prep Time Required ⏱️',
                        message: 'Please select an Est. Prep Time from the dropdown before accepting the order.'
                    });
                    
                    if (!isCurrentlySelected) {
                        const orderToSelect = contextOrders.find(o => o.id === id);
                        if (orderToSelect) {
                            setSelectedOrder(orderToSelect);
                            setEstTimeInput('');
                        }
                    }
                    return;
                }
                
                if (isCurrentlySelected && estTimeInput && estTimeInput !== order?.estimatedTime) {
                    await updateOrderStatus(id, 'preparing', undefined, undefined, estTimeInput);
                    addNotification({ type: 'system', title: 'Accepted 👨‍🍳', message: `Order #${id.substr(0,4)} accepted with ${estTimeInput} prep time.` });
                    setSelectedOrder(null);
                    setEstTimeInput('');
                    return;
                }
            }

            await updateOrderStatus(id, newStatus, reason);
            if (newStatus === 'preparing') {
                addNotification({ type: 'system', title: 'Accepted 👨‍🍳', message: `Order now preparing.` });
            }
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

    const handleProcessRefund = async () => {
        if (!refundWizardOrder) return;
        
        const remainingTotal = refundWizardOrder.total - (refundWizardOrder.refundedAmount || 0);
        const finalAmount = refundWizardType === 'full' 
            ? remainingTotal 
            : parseFloat(refundWizardAmount);

        if (isNaN(finalAmount) || finalAmount <= 0) {
            setRefundWizardError("Refund amount must be a positive number.");
            return;
        }

        if (finalAmount > remainingTotal) {
            setRefundWizardError(`Amount cannot exceed remaining balance ($${remainingTotal.toFixed(2)}).`);
            return;
        }

        const finalReason = refundWizardReason === 'Other' 
            ? refundWizardCustomReason.trim() 
            : refundWizardReason;

        if (!finalReason) {
            setRefundWizardError("Please provide a reason for the refund.");
            return;
        }

        // Advance to Step 2 (Processing)
        setRefundWizardStep(2);
        setRefundMilestone(0);
        setRefundWizardError(null);

        // Simulated milestones
        const timer = setInterval(() => {
            setRefundMilestone(prev => Math.min(prev + 1, 2));
        }, 900);

        try {
            const result = await refundOrder(
                refundWizardOrder.id, 
                finalReason, 
                refundWizardType === 'full' ? undefined : finalAmount
            );
            clearInterval(timer);
            setRefundMilestone(3);
            
            // Wait a brief moment to show completeness
            setTimeout(() => {
                setRefundWizardId(result?.refundId || 'ref_sample_id');
                setRefundWizardStep(3);
            }, 600);
        } catch (e: any) {
            clearInterval(timer);
            console.error("Refund wizard failed", e);
            setRefundWizardError(e.message || "Stripe refund processing failed.");
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

    // Canvas Drawing Helpers
    const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        
        let clientX = 0;
        let clientY = 0;
        
        if ('touches' in e) {
            if (e.touches.length === 0) return { x: 0, y: 0 };
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        
        return {
            x: rect.width > 0 ? ((clientX - rect.left) / rect.width) * canvas.width : 0,
            y: rect.height > 0 ? ((clientY - rect.top) / rect.height) * canvas.height : 0
        };
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const coords = getCoordinates(e);
        isDrawingRef.current = true;
        lastXRef.current = coords.x;
        lastYRef.current = coords.y;

        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.beginPath();
                ctx.arc(coords.x, coords.y, 3, 0, Math.PI * 2);
                ctx.fillStyle = '#0f172a';
                ctx.fill();
            }
        }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current || !canvasRef.current) return;
        e.preventDefault();
        const coords = getCoordinates(e);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.beginPath();
            ctx.moveTo(lastXRef.current, lastYRef.current);
            ctx.lineTo(coords.x, coords.y);
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
            
            lastXRef.current = coords.x;
            lastYRef.current = coords.y;
        }
    };

    const stopDrawing = () => {
        if (isDrawingRef.current) {
            isDrawingRef.current = false;
            saveCanvasData();
        }
    };

    const clearCanvas = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setSignatureData(null);
        }
    };

    const saveCanvasData = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const data = canvas.toDataURL('image/png');
            const buffer = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const isBlank = !buffer.data.some(channel => channel !== 0);
            if (!isBlank) {
                setSignatureData(data);
            } else {
                setSignatureData(null);
            }
        }
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCustomPhotoData(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCompleteOrder = async (order: Order) => {
        setEvidenceOrder(order);
        setSignatureName(order.customerName || '');
        setSignatureData(null);
        setPhotoPreset('door');
        setCustomPhotoData(null);
        setEvidenceNote('');
        setEvidenceType('signature');
        setIsEvidenceModalOpen(true);
    };

    const handleSubmitEvidence = async () => {
        if (!evidenceOrder) return;
        setIsEvidenceSubmitting(true);
        try {
            const deliveryEvidencePayload: any = {
                evidenceType,
                capturedAt: new Date().toISOString(),
            };

            if (evidenceType === 'signature') {
                if (!signatureName.trim()) {
                    addNotification({ type: 'alert', title: 'Name Required', message: "Please specify who received the package" });
                    setIsEvidenceSubmitting(false);
                    return;
                }
                if (!signatureData) {
                    addNotification({ type: 'alert', title: 'Signature Required', message: "Please ask the customer to sign on the drawing board" });
                    setIsEvidenceSubmitting(false);
                    return;
                }
                deliveryEvidencePayload.signatureName = signatureName.trim();
                deliveryEvidencePayload.signatureData = signatureData;
            } else if (evidenceType === 'photo') {
                let url = '';
                if (photoPreset === 'door') {
                    url = 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80';
                } else if (photoPreset === 'mailbox') {
                    url = 'https://images.unsplash.com/photo-1590247813693-5541f1c609fd?auto=format&fit=crop&w=600&q=80';
                } else if (photoPreset === 'hand') {
                    url = 'https://images.unsplash.com/photo-1616077168079-7e09a677fb2c?auto=format&fit=crop&w=600&q=80';
                } else if (photoPreset === 'counter') {
                    url = 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=600&q=80';
                } else if (photoPreset === 'curbside') {
                    url = 'https://images.unsplash.com/photo-1563013544-824ae1d704d3?auto=format&fit=crop&w=600&q=80';
                } else if (photoPreset === 'custom') {
                    if (!customPhotoData) {
                        addNotification({ type: 'alert', title: 'Photo Required', message: "Please upload or snap a photo of the package" });
                        setIsEvidenceSubmitting(false);
                        return;
                    }
                    url = customPhotoData;
                }
                deliveryEvidencePayload.photoUrl = url;
                if (evidenceNote.trim()) {
                    deliveryEvidencePayload.note = evidenceNote.trim();
                }
            } else if (evidenceType === 'none') {
                if (!evidenceNote.trim()) {
                    addNotification({ type: 'alert', title: 'Notes Required', message: "Please provide contactless drop-off details or courier verification remarks" });
                    setIsEvidenceSubmitting(false);
                    return;
                }
                deliveryEvidencePayload.note = evidenceNote.trim();
            }

            await updateOrderStatus(evidenceOrder.id, 'delivered', undefined, deliveryEvidencePayload);
            
            if (evidenceOrder.paymentStatus !== 'paid') {
                const auditEntry = {
                    id: user?.id || 'unknown',
                    name: user?.name || 'Staff',
                    timestamp: new Date().toISOString()
                };
                await updatePaymentStatus(evidenceOrder.id, 'paid', auditEntry);
            }

            addNotification({ type: 'system', title: 'Completed', message: `Order #${evidenceOrder.id.substr(0,4)} completed with proof.` });
            
            setIsEvidenceModalOpen(false);
            setEvidenceOrder(null);
            setSignatureName('');
            setSignatureData(null);
            setPhotoPreset('door');
            setCustomPhotoData(null);
            setEvidenceNote('');
        } catch (e: any) {
            console.error("Failed to complete order with evidence", e);
            addNotification({ type: 'alert', title: 'Completion Failed', message: e.message || "Failed to finalize order with evidence" });
        } finally {
            setIsEvidenceSubmitting(false);
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
                                        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-medium truncate italic">
                                            <span>{order.customerName}</span>
                                            {getPaymentStatusBadge(order)}
                                        </div>
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
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] text-[var(--text-muted)]">{order.deliveryAddress ? '🛵 Delivery' : '🛍️ Pickup'}</span>
                                                    {getPaymentStatusBadge(order)}
                                                </div>
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
                <div className="flex-1 overflow-y-auto p-4 md:p-6 pt-2 space-y-5 animate-fade-in">
                    {reconData.loading ? (
                        <div className="text-center py-20 text-[var(--text-muted)]">
                            <div className="text-3xl mb-3 animate-spin">⚙️</div>
                            <p className="text-sm font-medium">Loading reconciliation data...</p>
                        </div>
                    ) : (
                        <>
                            {/* Expanded Financial Summary Metrics */}
                            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                                <div className="bg-white rounded-2xl border border-[var(--glass-border)] p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-300">
                                    <div>
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Gross Sales</p>
                                        <p className="text-xl font-black text-[var(--text-main)]">${ledgerTotals.grossSales.toFixed(2)}</p>
                                    </div>
                                    <p className="text-[8px] text-[var(--text-muted)] mt-1.5">Total rev. collected</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-[var(--glass-border)] p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-300">
                                    <div>
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Sales Tax</p>
                                        <p className="text-xl font-black text-blue-500">${ledgerTotals.totalTaxes.toFixed(2)}</p>
                                    </div>
                                    <p className="text-[8px] text-[var(--text-muted)] mt-1.5">Collected tax</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-[var(--glass-border)] p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-300">
                                    <div>
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Delivery Fees</p>
                                        <p className="text-xl font-black text-purple-500">${ledgerTotals.totalDeliveryFees.toFixed(2)}</p>
                                    </div>
                                    <p className="text-[8px] text-[var(--text-muted)] mt-1.5">Courier earnings</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-[var(--glass-border)] p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-300">
                                    <div>
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Refunds</p>
                                        <p className="text-xl font-black text-red-500">-${ledgerTotals.totalRefunds.toFixed(2)}</p>
                                    </div>
                                    <p className="text-[8px] text-[var(--text-muted)] mt-1.5">Returns & voids</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-[var(--glass-border)] p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-300">
                                    <div>
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Platform Fees</p>
                                        <p className="text-xl font-black text-orange-500">-${ledgerTotals.platformFees.toFixed(2)}</p>
                                    </div>
                                    <p className="text-[8px] text-[var(--text-muted)] mt-1.5">Stripe processing</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-[var(--glass-border)] p-4 shadow-sm flex flex-col justify-between ring-2 ring-[var(--brand-primary)]/20 bg-gradient-to-br from-[var(--brand-primary)]/5 to-white hover:shadow-md transition-all duration-300">
                                    <div>
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--brand-primary)] mb-1">Net Payout</p>
                                        <p className="text-xl font-black text-[var(--brand-primary)]">${ledgerTotals.netPayout.toFixed(2)}</p>
                                    </div>
                                    <p className="text-[8px] text-[var(--text-muted)] mt-1.5">Settled to bank</p>
                                </div>
                            </div>

                            {/* Accordion Alerts Group */}
                            <div className="space-y-3">
                                {/* Negative Stock Alert Accordion */}
                                <div className="bg-white rounded-2xl border border-[var(--glass-border)] shadow-sm overflow-hidden transition-all duration-300">
                                    <button 
                                        onClick={() => setIsNegativeStockExpanded(!isNegativeStockExpanded)}
                                        className="w-full flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">📦</span>
                                            <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Negative Stock</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${reconData.negativeStock.length > 0 ? 'bg-red-100 text-red-750 animate-pulse' : 'bg-green-100 text-green-700'}`}>
                                                {reconData.negativeStock.length} issues
                                            </span>
                                            <span className="text-xs text-gray-400">{isNegativeStockExpanded ? '▼' : '▶'}</span>
                                        </div>
                                    </button>
                                    
                                    {isNegativeStockExpanded && (
                                        <div className="p-4 border-t border-gray-100 space-y-2 bg-white animate-slide-down">
                                            {reconData.negativeStock.length === 0 ? (
                                                <p className="text-sm text-[var(--text-muted)]">All products have non-negative inventory.</p>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {reconData.negativeStock.map(p => (
                                                        <div key={p.id} className="flex justify-between items-center p-3 bg-red-50/60 rounded-xl border border-red-100">
                                                            <span className="text-xs font-semibold text-[var(--text-main)] truncate pr-4">{p.name}</span>
                                                            <span className="text-xs font-black text-red-650 shrink-0">{p.qty}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Payment Gaps Accordion */}
                                <div className="bg-white rounded-2xl border border-[var(--glass-border)] shadow-sm overflow-hidden transition-all duration-300">
                                    <button 
                                        onClick={() => setIsPaymentGapsExpanded(!isPaymentGapsExpanded)}
                                        className="w-full flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">💸</span>
                                            <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Payment Gaps</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${reconData.paymentGaps.length > 0 ? 'bg-yellow-100 text-yellow-750' : 'bg-green-100 text-green-700'}`}>
                                                {reconData.paymentGaps.length} gaps
                                            </span>
                                            <span className="text-xs text-gray-400">{isPaymentGapsExpanded ? '▼' : '▶'}</span>
                                        </div>
                                    </button>
                                    
                                    {isPaymentGapsExpanded && (
                                        <div className="p-4 border-t border-gray-100 space-y-2 bg-white animate-slide-down">
                                            <p className="text-[10px] text-[var(--text-muted)] mb-2">Card orders with payment still pending (not yet settled).</p>
                                            {reconData.paymentGaps.length === 0 ? (
                                                <p className="text-sm text-[var(--text-muted)]">All paid orders are reconciled.</p>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {reconData.paymentGaps.map(o => (
                                                        <div key={o.id} className="flex justify-between items-center p-3 bg-yellow-50/60 rounded-xl border border-yellow-100">
                                                            <div className="min-w-0 pr-4">
                                                                <p className="text-xs font-bold text-[var(--text-main)]">#{o.id.substr(0, 8)}</p>
                                                                <p className="text-[10px] text-[var(--text-muted)] truncate">{o.customerName}</p>
                                                            </div>
                                                            <span className="text-xs font-black text-yellow-750 shrink-0">${o.total.toFixed(2)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Price Integrity Accordion */}
                                <div className="bg-white rounded-2xl border border-[var(--glass-border)] shadow-sm overflow-hidden transition-all duration-300">
                                    <button 
                                        onClick={() => setIsPriceIntegrityExpanded(!isPriceIntegrityExpanded)}
                                        className="w-full flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">🛡️</span>
                                            <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Price Integrity (Last 10 Orders)</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${reconData.integrityIssues.length > 0 ? 'bg-red-100 text-red-750' : 'bg-green-100 text-green-700'}`}>
                                                {reconData.integrityIssues.length} alerts
                                            </span>
                                            <span className="text-xs text-gray-400">{isPriceIntegrityExpanded ? '▼' : '▶'}</span>
                                        </div>
                                    </button>
                                    
                                    {isPriceIntegrityExpanded && (
                                        <div className="p-4 border-t border-gray-100 space-y-2 bg-white animate-slide-down">
                                            {reconData.integrityIssues.length === 0 ? (
                                                <p className="text-sm text-[var(--text-muted)]">No price discrepancies detected in recent orders.</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {reconData.integrityIssues.map(({ orderId, issues }) => (
                                                        <div key={orderId} className="p-3 bg-red-50/60 rounded-xl border border-red-100">
                                                            <p className="text-xs font-bold text-red-750 mb-1">Order #{orderId.substr(0, 8)}</p>
                                                            <ul className="space-y-1">
                                                                {issues.map((issue, i) => (
                                                                    <li key={i} className="text-[10px] text-red-600 font-medium">• {issue}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Account Ledger Section */}
                            <div className="bg-white rounded-2xl border border-[var(--glass-border)] shadow-sm overflow-hidden flex flex-col">
                                {/* Ledger Control Header */}
                                <div className="p-4 md:p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col gap-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div>
                                            <h3 className="text-sm font-black text-[var(--text-main)] uppercase tracking-wide">Account Ledger & Bookkeeping Log</h3>
                                            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Track, audit, and reconcile live payment payouts and fee deductions.</p>
                                        </div>
                                        <button
                                            onClick={handleExportLedgerCSV}
                                            className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 hover:text-[var(--text-main)] border border-[var(--glass-border)] rounded-xl text-xs font-black shadow-sm transition-all duration-200 flex items-center justify-center gap-1.5 self-start sm:self-auto shrink-0 active:scale-95"
                                        >
                                            <span>📥</span> Export Ledger (CSV)
                                        </button>
                                    </div>

                                    {/* Interactive Filters Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {/* Search */}
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none text-xs">🔍</span>
                                            <input
                                                type="text"
                                                value={ledgerSearch}
                                                onChange={(e) => setLedgerSearch(e.target.value)}
                                                placeholder="Search Order ID or customer..."
                                                className="w-full h-10 bg-white border border-[var(--glass-border)] rounded-xl pl-9 pr-3 text-xs focus:ring-1 focus:ring-[var(--brand-primary)] outline-none text-[var(--text-main)]"
                                            />
                                        </div>

                                        {/* Date Selector */}
                                        <div className="flex bg-white border border-[var(--glass-border)] p-0.5 rounded-xl">
                                            {[
                                                { id: 'all', label: 'All' },
                                                { id: '7d', label: '7D' },
                                                { id: '30d', label: '30D' },
                                                { id: 'this_month', label: 'Month' }
                                            ].map(opt => (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => setLedgerDateRange(opt.id as any)}
                                                    className={`flex-1 py-1 text-[10px] font-black rounded-lg transition-all ${ledgerDateRange === opt.id ? 'bg-[var(--brand-primary)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Order Type Dropdown */}
                                        <select
                                            value={ledgerOrderType}
                                            onChange={(e) => setLedgerOrderType(e.target.value as any)}
                                            className="h-10 bg-white border border-[var(--glass-border)] rounded-xl px-3 text-xs focus:ring-1 focus:ring-[var(--brand-primary)] outline-none text-[var(--text-main)] cursor-pointer"
                                        >
                                            <option value="all">All Fulfillment / Payment Methods</option>
                                            <option value="card">💳 Online Card Only</option>
                                            <option value="in_store">💵 In-Store Cash Only</option>
                                            <option value="delivery">🛵 Delivery Orders</option>
                                            <option value="pickup">🛍️ Pickup Orders</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Ledger High-Density Table */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                                                <th className="py-3 px-4">Date & Reference</th>
                                                <th className="py-3 px-4">Shopper</th>
                                                <th className="py-3 px-4">Type</th>
                                                <th className="py-3 px-4 text-right">Breakdown</th>
                                                <th className="py-3 px-4 text-right">Refunds</th>
                                                <th className="py-3 px-4 text-right">Platform Fee</th>
                                                <th className="py-3 px-4 text-right">Net Payout</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 text-xs">
                                            {ledgerTransactions.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="py-12 text-center text-[var(--text-muted)] opacity-60">
                                                        <div className="text-3xl mb-2 opacity-30">📂</div>
                                                        No transactions found for current filter settings
                                                    </td>
                                                </tr>
                                            ) : (
                                                ledgerTransactions.map(o => {
                                                    const isCard = o.paymentMethod === 'card';
                                                    const refunded = (o.paymentStatus === 'refunded')
                                                        ? (o.refundedAmount || o.refundingAmount || o.total || 0)
                                                        : (['partially_refunded', 'refunding'].includes(o.paymentStatus) ? (o.refundedAmount || o.refundingAmount || 0) : 0);
                                                    
                                                    let platformFee = 0;
                                                    if (isCard) {
                                                        if (o.paymentStatus === 'paid') {
                                                            platformFee = 0.05 * o.total + 0.30;
                                                        } else if (['partially_refunded', 'refunded', 'refunding'].includes(o.paymentStatus)) {
                                                            platformFee = Math.max(0, 0.05 * (o.total - refunded) + 0.30);
                                                        }
                                                    }
                                                    
                                                    const netPayout = (o.total - refunded) - platformFee;

                                                    return (
                                                        <tr 
                                                            key={o.id} 
                                                            onClick={() => setSelectedOrder(o)}
                                                            className="hover:bg-gray-50/80 transition-colors cursor-pointer group"
                                                        >
                                                            {/* Date & ID */}
                                                            <td className="py-3.5 px-4">
                                                                <div className="font-bold text-[var(--text-main)] group-hover:text-[var(--brand-primary)] transition-colors">
                                                                    #{o.id.substr(0, 8)}
                                                                </div>
                                                                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                                                                    {new Date(o.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                                </div>
                                                            </td>

                                                            {/* Shopper */}
                                                            <td className="py-3.5 px-4 font-medium text-[var(--text-main)]">
                                                                <div>{o.customerName}</div>
                                                                <div className="text-[9px] text-[var(--text-muted)] mt-0.5">{o.customerPhone || 'No contact'}</div>
                                                            </td>

                                                            {/* Type Indicators */}
                                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                                <div className="flex items-center gap-1.5">
                                                                    {o.deliveryAddress ? (
                                                                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-md text-[10px] font-bold">🛵 Del.</span>
                                                                    ) : (
                                                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-[10px] font-bold">🛍️ Pick.</span>
                                                                    )}
                                                                    {isCard ? (
                                                                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[9px] font-medium" title="Online Stripe Payment">💳 Card</span>
                                                                    ) : (
                                                                        <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-md text-[9px] font-medium" title="Paid Cash In-Store">💵 Cash</span>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            {/* Breakdown */}
                                                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                                <div className="font-bold text-[var(--text-main)]">${o.total.toFixed(2)}</div>
                                                                <div className="text-[9px] text-[var(--text-muted)] mt-0.5">
                                                                    Sub: ${o.subtotal.toFixed(2)} | Tax: ${o.tax.toFixed(2)}
                                                                </div>
                                                            </td>

                                                            {/* Refunds */}
                                                            <td className="py-3.5 px-4 text-right font-semibold">
                                                                {refunded > 0 ? (
                                                                    <div className="text-red-500 font-extrabold animate-fade-in">
                                                                        -${refunded.toFixed(2)}
                                                                        <span className="block text-[8px] text-red-400 font-normal uppercase tracking-wider mt-0.5">
                                                                            {o.paymentStatus === 'refunded' ? 'Full' : 'Partial'}
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-gray-300">-</span>
                                                                )}
                                                            </td>

                                                            {/* Platform Fees */}
                                                            <td className="py-3.5 px-4 text-right">
                                                                {platformFee > 0 ? (
                                                                    <span className="text-orange-500 font-medium">${platformFee.toFixed(2)}</span>
                                                                ) : (
                                                                    <span className="text-gray-400 italic text-[10px]">Cash ($0)</span>
                                                                )}
                                                            </td>

                                                            {/* Net Payout */}
                                                            <td className="py-3.5 px-4 text-right font-black text-[var(--brand-primary)]">
                                                                ${netPayout.toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
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
                                    
                                    {/* Detailed Payment Info */}
                                    <div className="bg-gray-50 rounded-2xl p-4 mt-4 space-y-2 border border-gray-100 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500 font-bold">Payment Method:</span>
                                            <span className="font-medium text-[var(--text-main)] capitalize">
                                                {selectedOrder.paymentMethod === 'card' ? '💳 Online Card' : '🏪 In-Store'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 font-bold">Payment Status:</span>
                                            {getPaymentStatusBadge(selectedOrder)}
                                        </div>
                                        {(selectedOrder.refundedAmount || selectedOrder.refundingAmount) && (
                                            <div className="flex justify-between border-t border-gray-200/60 pt-2 mt-2">
                                                <span className="text-red-600 font-bold">
                                                    {selectedOrder.paymentStatus === 'refunding' ? 'Refunding Amount:' : 'Refunded Amount:'}
                                                </span>
                                                <span className="font-black text-red-600">
                                                    -${(selectedOrder.refundedAmount || selectedOrder.refundingAmount || 0).toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                        {selectedOrder.refundReason && (
                                            <div className="text-gray-500 italic mt-1 leading-snug">
                                                Reason: {selectedOrder.refundReason}
                                            </div>
                                        )}
                                    </div>

                                    {/* Delivery Evidence Display Card in Merchant Sidebar */}
                                    {selectedOrder.deliveryEvidence && (
                                        <div className="bg-green-50 border border-green-200/60 rounded-2xl p-4 space-y-4 text-xs shadow-sm overflow-hidden relative font-sans text-gray-800">
                                            <div className="absolute top-0 inset-x-0 h-1 bg-green-500"></div>
                                            <div className="flex items-center gap-1.5 font-black text-green-700 uppercase tracking-widest text-[9px]">
                                                <span>✅ FULFILLMENT VERIFIED</span>
                                            </div>
                                            
                                            {selectedOrder.deliveryEvidence.evidenceType === 'signature' && (
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-gray-500 font-bold">Signed For By:</span>
                                                        <span className="font-extrabold text-[var(--text-main)] bg-white px-2 py-0.5 rounded border">{selectedOrder.deliveryEvidence.signatureName}</span>
                                                    </div>
                                                    {selectedOrder.deliveryEvidence.signatureData && (
                                                        <div className="bg-white rounded-xl p-2.5 border border-green-100 flex flex-col items-center shadow-inner">
                                                            <img 
                                                                src={selectedOrder.deliveryEvidence.signatureData} 
                                                                alt="Signature" 
                                                                className="h-16 object-contain" 
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {selectedOrder.deliveryEvidence.evidenceType === 'photo' && (
                                                <div className="space-y-3">
                                                    <div className="text-gray-500 font-bold mb-1">Proof Photo:</div>
                                                    {selectedOrder.deliveryEvidence.photoUrl && (
                                                        <div className="bg-white rounded-xl overflow-hidden border border-green-150 shadow-inner">
                                                            <img 
                                                                src={selectedOrder.deliveryEvidence.photoUrl} 
                                                                alt="Drop-off Proof" 
                                                                className="w-full h-32 object-cover" 
                                                            />
                                                            {selectedOrder.deliveryEvidence.note && (
                                                                <p className="text-[10px] text-gray-600 italic p-2 bg-gray-50 border-t border-gray-100 leading-relaxed">
                                                                    💬 "{selectedOrder.deliveryEvidence.note}"
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {selectedOrder.deliveryEvidence.evidenceType === 'none' && selectedOrder.deliveryEvidence.note && (
                                                <div className="space-y-1.5">
                                                    <span className="text-gray-500 font-bold">Verification Note:</span>
                                                    <p className="bg-white p-2.5 rounded-xl border border-green-100 italic text-gray-700 leading-relaxed">
                                                        💬 "{selectedOrder.deliveryEvidence.note}"
                                                    </p>
                                                </div>
                                            )}
                                            
                                            <div className="text-[8px] text-gray-400 font-bold uppercase tracking-wider text-right border-t border-dashed border-green-200/50 pt-2">
                                                Captured {new Date(selectedOrder.deliveryEvidence.capturedAt).toLocaleDateString()} {new Date(selectedOrder.deliveryEvidence.capturedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions Panel - Mobile Optimized */}
                                {hasWriteAccess && (
                                    <div className="bg-[var(--surface-1)] rounded-3xl p-5 md:p-6 border border-[var(--glass-border)] space-y-6 text-[var(--text-main)] shadow-sm">
                                        <div className="space-y-5">
                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">Merchant Controls</h3>
                                            
                                            <div className="grid grid-cols-2 gap-3">
                                                <button 
                                                    onClick={() => handleUpdateStatus(selectedOrder.id, selectedOrder.status === 'on_hold' ? 'preparing' : 'on_hold')} 
                                                    disabled={['out_for_delivery', 'delivered', 'completed', 'cancelled'].includes(selectedOrder.status)}
                                                    className={`p-3 rounded-2xl text-[11px] font-black transition-all border flex items-center justify-center gap-2 ${selectedOrder.status === 'on_hold' ? 'bg-orange-500 text-white border-orange-400' : 'bg-white text-[var(--text-main)] border-[var(--glass-border)] hover:bg-gray-50 shadow-sm active:scale-95'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                                >
                                                    {selectedOrder.status === 'on_hold' ? '▶️ Resume' : '⏳ Hold'}
                                                </button>
                                                <button 
                                                    onClick={() => handleDownloadReceipt(selectedOrder.id)} 
                                                    disabled={downloadingReceiptId === selectedOrder.id}
                                                    className="bg-white text-[var(--text-main)] p-3 rounded-2xl text-[11px] font-black hover:bg-gray-50 transition-all border border-[var(--glass-border)] flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm active:scale-95"
                                                >
                                                    {downloadingReceiptId === selectedOrder.id ? '⌛...' : '📄 Receipt'}
                                                </button>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">Est. Prep Time</label>
                                                <div className="flex gap-2 h-11">
                                                    <select
                                                        value={estTimeInput}
                                                        onChange={(e) => setEstTimeInput(e.target.value)}
                                                        disabled={['out_for_delivery', 'delivered', 'completed', 'cancelled'].includes(selectedOrder.status)}
                                                        className="flex-1 bg-white border border-[var(--glass-border)] rounded-xl px-3 text-sm focus:ring-1 focus:ring-[var(--brand-primary)] outline-none text-[var(--text-main)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <option value="" disabled>Select prep time...</option>
                                                        <option value="15 min">15 min</option>
                                                        <option value="30 min">30 min</option>
                                                        <option value="45 min">45 min</option>
                                                        <option value="1 H">1 H</option>
                                                        <option value="2H">2H</option>
                                                        <option value="4H">4H</option>
                                                    </select>
                                                    <button 
                                                        onClick={() => handleSaveET(selectedOrder.id)} 
                                                        disabled={!estTimeInput || ['out_for_delivery', 'delivered', 'completed', 'cancelled'].includes(selectedOrder.status)}
                                                        className="px-5 bg-[var(--brand-primary)] text-white hover:bg-[var(--brand-primary-dark)] text-[11px] font-black rounded-xl active:scale-95 transition-all shrink-0 shadow-md shadow-[var(--brand-primary)]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        Save
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-[var(--glass-border)]">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">Cancel / Reject</label>
                                                <div className="flex gap-2 mt-2 h-11">
                                                    <select
                                                        value={rejectionReason}
                                                        onChange={(e) => setRejectionReason(e.target.value)}
                                                        disabled={['out_for_delivery', 'delivered', 'completed', 'cancelled'].includes(selectedOrder.status)}
                                                        className="flex-1 bg-white border border-[var(--glass-border)] rounded-xl px-3 text-sm focus:ring-1 focus:ring-red-500 outline-none text-[var(--text-main)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <option value="" disabled>Select cancellation reason...</option>
                                                        <option value="Customer requested cancellation">🙋‍♂️ Customer Request</option>
                                                        <option value="Out of stock / Sold out">📦 Out of Stock</option>
                                                        <option value="Store closing early">🚫 Store Closing Early</option>
                                                        <option value="Incorrect pricing on item">🏷️ Incorrect Pricing</option>
                                                        <option value="Store too busy / Capacity reached">⏳ Store Too Busy</option>
                                                        <option value="Courier / Delivery issue">🚚 Delivery/Courier Issue</option>
                                                    </select>
                                                    <button 
                                                        onClick={() => handleCancelOrder(selectedOrder.id)} 
                                                        disabled={!rejectionReason || ['out_for_delivery', 'delivered', 'completed', 'cancelled'].includes(selectedOrder.status)}
                                                        className="px-5 bg-red-50 text-red-650 hover:bg-red-100/50 border border-red-200 text-[11px] font-black rounded-xl active:scale-95 transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        Cancel Order
                                                    </button>
                                                </div>
                                            </div>

                                            {['paid', 'partially_refunded'].includes(selectedOrder.paymentStatus) && (
                                                <div className="pt-4 border-t border-[var(--glass-border)]">
                                                    <button 
                                                        onClick={() => {
                                                            setRefundWizardOrder(selectedOrder);
                                                            setRefundWizardType('full');
                                                            const remaining = selectedOrder.total - (selectedOrder.refundedAmount || 0);
                                                            setRefundWizardAmount(remaining.toFixed(2));
                                                            setRefundWizardReason('Customer Request');
                                                            setRefundWizardCustomReason('');
                                                            setRefundWizardStep(1);
                                                            setRefundWizardError(null);
                                                            setRefundWizardId(null);
                                                            setIsRefundWizardOpen(true);
                                                        }}
                                                        className="w-full py-3.5 bg-orange-50 text-orange-600 border border-orange-200 text-xs font-black rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-orange-100/60 shadow-sm"
                                                    >
                                                        <span>💳</span> Issue Refund (Wizard)
                                                    </button>
                                                </div>
                                            )}
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
                    {/* Refund Wizard Modal Overlay */}
            {isRefundWizardOpen && refundWizardOrder && (
                <div 
                    className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in font-sans"
                    onClick={() => {
                        if (refundWizardStep !== 2) {
                            setIsRefundWizardOpen(false);
                            setRefundWizardOrder(null);
                        }
                    }}
                >
                    <div 
                        className="bg-white border border-[var(--glass-border)] rounded-3xl w-full max-w-md p-6 shadow-2xl relative overflow-hidden text-[var(--text-main)] flex flex-col max-h-[90vh] animate-scale-in"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Brand top glowing accent border */}
                        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[var(--brand-primary)] via-indigo-500 to-blue-500"></div>

                        {/* Step 1: Configuration Form */}
                        {refundWizardStep === 1 && (
                            <div className="animate-fade-in">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-widest bg-blue-50 text-[var(--brand-primary)] px-2.5 py-1 rounded-full border border-blue-200/50">
                                            Order Financials
                                        </span>
                                        <h3 className="text-xl font-extrabold text-gray-900 mt-3">Issue Refund</h3>
                                        <p className="text-xs text-gray-500 mt-1 font-medium">For {refundWizardOrder.customerName}</p>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            setIsRefundWizardOpen(false);
                                            setRefundWizardOrder(null);
                                        }}
                                        className="text-gray-400 hover:text-gray-600 text-lg w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center transition-colors"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div className="space-y-5">
                                    {/* Segment Toggle */}
                                    <div className="bg-gray-100 p-1 rounded-xl flex gap-1 border border-gray-200">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setRefundWizardType('full');
                                                const remaining = refundWizardOrder.total - (refundWizardOrder.refundedAmount || 0);
                                                setRefundWizardAmount(remaining.toFixed(2));
                                            }}
                                            className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${refundWizardType === 'full' ? 'bg-[var(--brand-primary)] text-white shadow-md shadow-[var(--brand-primary)]/15' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
                                        >
                                            Full Refund
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setRefundWizardType('partial');
                                                setRefundWizardAmount('');
                                            }}
                                            className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${refundWizardType === 'partial' ? 'bg-[var(--brand-primary)] text-white shadow-md shadow-[var(--brand-primary)]/15' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
                                        >
                                            Partial Refund
                                        </button>
                                    </div>

                                    {/* Amount Input */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                                            Refund Amount
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-extrabold text-lg">$</span>
                                            <input
                                                type="number"
                                                value={refundWizardAmount}
                                                onChange={(e) => setRefundWizardAmount(e.target.value)}
                                                disabled={refundWizardType === 'full'}
                                                placeholder="0.00"
                                                step="0.01"
                                                min="0.01"
                                                max={(refundWizardOrder.total - (refundWizardOrder.refundedAmount || 0)).toFixed(2)}
                                                className={`w-full bg-gray-50 border border-gray-200 rounded-2xl pl-8 pr-4 py-3.5 text-lg font-black outline-none text-gray-800 focus:bg-white focus:border-[var(--brand-primary)] transition-all ${refundWizardType === 'full' ? 'opacity-65 cursor-not-allowed bg-gray-100' : ''}`}
                                            />
                                        </div>
                                        <p className="text-[10px] text-gray-500 ml-1">
                                            Remaining refundable balance: <span className="font-bold text-gray-700">${(refundWizardOrder.total - (refundWizardOrder.refundedAmount || 0)).toFixed(2)}</span>
                                        </p>
                                    </div>

                                    {/* Reason Selector Grid */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                                            Select Reason
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { label: 'Customer Request', emoji: '🙋‍♂️' },
                                                { label: 'Out of Stock', emoji: '📦' },
                                                { label: 'Store Rejected', emoji: '🚫' },
                                                { label: 'Other', emoji: '📝' }
                                            ].map((item) => (
                                                <button
                                                    key={item.label}
                                                    type="button"
                                                    onClick={() => setRefundWizardReason(item.label)}
                                                    className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center gap-2.5 ${refundWizardReason === item.label ? 'bg-blue-50/50 border-[var(--brand-primary)] text-[var(--brand-primary)] shadow-sm font-black' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-100/50'}`}
                                                >
                                                    <span className="text-base">{item.emoji}</span>
                                                    <span>{item.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Custom Reason Field */}
                                    {refundWizardReason === 'Other' && (
                                        <div className="space-y-2 animate-fade-in">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                                                Custom Reason Description
                                            </label>
                                            <input
                                                type="text"
                                                value={refundWizardCustomReason}
                                                onChange={(e) => setRefundWizardCustomReason(e.target.value)}
                                                placeholder="Describe the reason..."
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs outline-none text-gray-800 focus:bg-white focus:border-[var(--brand-primary)] transition-colors"
                                            />
                                        </div>
                                    )}

                                    {/* Stripe Connect Warning */}
                                    <div className="bg-amber-50 border border-amber-200/70 rounded-2xl p-3.5 flex gap-3 text-[11px] text-amber-800 leading-relaxed">
                                        <span className="text-lg shrink-0">🛡️</span>
                                        <div>
                                            <span className="font-bold text-amber-900 block mb-0.5">Stripe Connect Security Enabled</span>
                                            This action will reverse the corresponding platform application fee and connected merchant transfer automatically.
                                        </div>
                                    </div>

                                    {/* Error Message if local validation fails */}
                                    {refundWizardError && (
                                        <div className="bg-red-50 border border-red-200 text-red-650 rounded-xl p-3 text-xs text-center font-semibold">
                                            {refundWizardError}
                                        </div>
                                    )}

                                    {/* Buttons */}
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsRefundWizardOpen(false);
                                                setRefundWizardOrder(null);
                                            }}
                                            className="flex-1 py-3.5 border border-gray-200 rounded-2xl text-xs font-black text-gray-500 hover:bg-gray-105 transition-colors active:scale-95"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleProcessRefund}
                                            className="flex-1 py-3.5 bg-[var(--brand-primary)] text-white rounded-2xl text-xs font-black hover:brightness-110 transition-all shadow-lg shadow-[var(--brand-primary)]/20 active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            Confirm & Process
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Processing Reversal */}
                        {refundWizardStep === 2 && (
                            <div className="animate-fade-in">
                                {refundWizardError ? (
                                    /* Error Screen inside Step 2 */
                                    <div className="text-center py-6">
                                        <div className="w-16 h-16 bg-red-50 border border-red-200 text-red-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 animate-bounce">
                                            ⚠️
                                        </div>
                                        <h3 className="text-lg font-black text-gray-900">Refund Processing Failed</h3>
                                        <p className="text-xs text-red-600 px-4 mt-2 max-w-sm mx-auto leading-relaxed font-medium">
                                            {refundWizardError}
                                        </p>
                                        
                                        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mt-6 text-left text-[11px] text-gray-500 space-y-1.5 max-w-sm mx-auto">
                                            <p className="font-bold text-gray-800">Suggested Troubleshooting:</p>
                                            <p>• Verify merchant account has sufficient Stripe balance.</p>
                                            <p>• Ensure Internet connection is stable.</p>
                                            <p>• Contact platform support if error persists.</p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setRefundWizardError(null);
                                                setRefundWizardStep(1);
                                            }}
                                            className="mt-8 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 rounded-2xl text-xs font-black transition-all active:scale-95 inline-flex items-center gap-2"
                                        >
                                            ← Go Back & Edit
                                        </button>
                                    </div>
                                ) : (
                                    /* Live Processing Milestones */
                                    <div className="text-center py-8">
                                        <div className="relative w-20 h-20 mx-auto mb-8 flex items-center justify-center">
                                            <div className="absolute inset-0 rounded-full border-4 border-gray-100"></div>
                                            <div className="absolute inset-0 rounded-full border-4 border-t-[var(--brand-primary)] animate-spin"></div>
                                            <div className="absolute inset-0 rounded-full bg-[var(--brand-primary)]/5 blur-md"></div>
                                            <span className="text-xl">💳</span>
                                        </div>

                                        <h3 className="text-lg font-black text-gray-900">Processing Transaction</h3>
                                        <p className="text-xs text-gray-500 mt-1.5 max-w-xs mx-auto leading-relaxed font-medium">
                                            Communicating securely with payment gateway. Do not reload or close this page.
                                        </p>

                                        <div className="mt-8 space-y-3.5 max-w-xs mx-auto text-left">
                                            {[
                                                "Initiating secure transaction...",
                                                "Reversing Stripe Connected transfer...",
                                                "Finalizing platform fee ledger..."
                                            ].map((text, idx) => {
                                                const isChecked = refundMilestone > idx;
                                                const isCurrent = refundMilestone === idx;
                                                return (
                                                    <div key={idx} className="flex items-center gap-3 transition-all duration-300">
                                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border transition-all duration-300 ${isChecked ? 'bg-blue-50 border-[var(--brand-primary)] text-[var(--brand-primary)]' : isCurrent ? 'border-[var(--brand-primary)] text-[var(--brand-primary)] animate-pulse' : 'border-gray-200 text-gray-400'}`}>
                                                            {isChecked ? '✓' : isCurrent ? '⏳' : ''}
                                                        </div>
                                                        <span className={`text-xs transition-colors duration-350 ${isChecked ? 'text-gray-500 font-medium' : isCurrent ? 'text-gray-900 font-bold' : 'text-gray-400'}`}>
                                                                {text}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step 3: Success Screen */}
                        {refundWizardStep === 3 && (
                            <div className="animate-fade-in text-center py-4">
                                <div className="relative w-16 h-16 bg-emerald-50 border border-emerald-250 rounded-full flex items-center justify-center text-3xl mx-auto mb-5 shadow-sm shadow-emerald-500/5 animate-scale-in">
                                    🎉
                                </div>

                                <h3 className="text-xl font-extrabold text-gray-900">Refund Finalized</h3>
                                <p className="text-xs text-emerald-600 font-bold mt-1">Transaction Completed Successfully</p>

                                {/* Ticket Summary Receipt */}
                                <div className="relative bg-gray-50 border border-gray-200 rounded-2xl p-5 mt-6 mb-6 text-left overflow-hidden shadow-sm">
                                    {/* Ticket holes punched with modal backdrop surface-0 */}
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2.5 w-5 h-5 rounded-full bg-white border-r border-gray-200"></div>
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2.5 w-5 h-5 rounded-full bg-white border-l border-gray-200"></div>

                                    <div className="text-center pb-4 border-b border-gray-200 border-dashed mb-4">
                                        <span className="text-[9px] uppercase tracking-widest text-gray-400 font-black">Refunded Amount</span>
                                        <div className="text-3xl font-black text-emerald-650 mt-1">
                                            -${parseFloat(refundWizardAmount).toFixed(2)}
                                        </div>
                                    </div>

                                    <div className="space-y-3 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-gray-400 font-bold">Shopper:</span>
                                            <span className="text-gray-700 font-medium">{refundWizardOrder.customerName}</span>
                                        </div>
                                        {refundWizardOrder.customerEmail && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-400 font-bold">Email:</span>
                                                <span className="text-gray-700 font-medium truncate max-w-[180px]">{refundWizardOrder.customerEmail}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between border-t border-gray-200 pt-3">
                                            <span className="text-gray-400 font-bold">Refund ID:</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-gray-600 font-medium font-mono text-[10px]">
                                                    {refundWizardId ? `${refundWizardId.substr(0, 16)}...` : 'N/A'}
                                                </span>
                                                {refundWizardId && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(refundWizardId);
                                                            addNotification({ type: 'system', title: 'Copied', message: 'Refund ID copied to clipboard' });
                                                        }}
                                                        className="text-[9px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-300 transition-colors"
                                                    >
                                                        Copy
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-50 border border-blue-150 rounded-2xl p-4 mb-6 flex gap-3 text-left text-[11px] text-blue-800 leading-relaxed">
                                    <span className="text-lg">⏱️</span>
                                    <div>
                                        <span className="font-bold text-blue-900 block">Shopper Payout Timeline</span>
                                        Stripe Connect processes refunds immediately. The returned funds will clear on the shopper's card statement in 5-10 business days.
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsRefundWizardOpen(false);
                                        setRefundWizardOrder(null);
                                        setSelectedOrder(null);
                                    }}
                                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
                                >
                                    Dismiss & Complete
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Delivery Proof Wizard Modal Overlay */}
            {isEvidenceModalOpen && evidenceOrder && (() => {
                const isDelivery = !!evidenceOrder.deliveryAddress;
                
                const deliveryPresets = [
                    { id: 'door', label: '📦 Front Door', url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80' },
                    { id: 'mailbox', label: '📬 Mailbox', url: 'https://images.unsplash.com/photo-1590247813693-5541f1c609fd?auto=format&fit=crop&w=600&q=80' },
                    { id: 'hand', label: '🤝 Handed Over', url: 'https://images.unsplash.com/photo-1616077168079-7e09a677fb2c?auto=format&fit=crop&w=600&q=80' }
                ];

                const pickupPresets = [
                    { id: 'hand', label: '🤝 Handed to Customer', url: 'https://images.unsplash.com/photo-1616077168079-7e09a677fb2c?auto=format&fit=crop&w=600&q=80' },
                    { id: 'counter', label: '🏪 Counter Pickup', url: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=600&q=80' },
                    { id: 'curbside', label: '🚗 Curbside Handoff', url: 'https://images.unsplash.com/photo-1563013544-824ae1d704d3?auto=format&fit=crop&w=600&q=80' }
                ];

                const activePresets = isDelivery ? deliveryPresets : pickupPresets;

                return (
                    <div 
                        className="fixed inset-0 bg-black/35 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in font-sans"
                        onClick={() => {
                            if (!isEvidenceSubmitting) {
                                setIsEvidenceModalOpen(false);
                                setEvidenceOrder(null);
                            }
                        }}
                    >
                        <div 
                            className="bg-white border border-[var(--glass-border)] rounded-3xl w-full max-w-lg p-6 shadow-2xl relative overflow-hidden text-[var(--text-main)] flex flex-col max-h-[95vh] animate-scale-in"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Accent Glow Strip */}
                            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-400 via-green-500 to-teal-500"></div>

                            {/* Header */}
                            <div className="flex justify-between items-start mb-5">
                                <div>
                                    <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200/50">
                                        Fulfillment Verification
                                    </span>
                                    <h3 className="text-xl font-extrabold text-gray-900 mt-2.5">Provide Delivery Evidence</h3>
                                    <p className="text-xs text-gray-500 mt-1 font-medium">Order #{evidenceOrder.id.substr(0, 8)} • {evidenceOrder.customerName}</p>
                                </div>
                                <button 
                                    onClick={() => {
                                        setIsEvidenceModalOpen(false);
                                        setEvidenceOrder(null);
                                    }}
                                    disabled={isEvidenceSubmitting}
                                    className="text-gray-400 hover:text-gray-600 text-lg w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center transition-colors disabled:opacity-50"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Tabs selector */}
                            <div className="bg-gray-100 p-1 rounded-2xl flex gap-1 border border-gray-200/80 mb-5 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setEvidenceType('signature')}
                                    disabled={isEvidenceSubmitting}
                                    className={`flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${evidenceType === 'signature' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/15' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-255/55 disabled:opacity-50'}`}
                                >
                                    ✍️ Signature
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEvidenceType('photo')}
                                    disabled={isEvidenceSubmitting}
                                    className={`flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${evidenceType === 'photo' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/15' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-255/55 disabled:opacity-50'}`}
                                >
                                    📸 {isDelivery ? 'Drop-off Photo' : 'Pickup Photo'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEvidenceType('none')}
                                    disabled={isEvidenceSubmitting}
                                    className={`flex-1 py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${evidenceType === 'none' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/15' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-255/55 disabled:opacity-50'}`}
                                >
                                    ✅ Notes Only
                                </button>
                            </div>

                            {/* Tab Contents */}
                            <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
                                {evidenceType === 'signature' && (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                                                Received By (Name)
                                            </label>
                                            <input 
                                                type="text"
                                                value={signatureName}
                                                onChange={e => setSignatureName(e.target.value)}
                                                placeholder="Enter recipient's name"
                                                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-extrabold outline-none text-gray-800 focus:bg-white focus:border-emerald-500 transition-all"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center ml-1">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                                                    Signature Drawing Board
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={clearCanvas}
                                                    className="text-[10px] text-emerald-600 font-extrabold hover:underline"
                                                >
                                                    🧹 Clear Board
                                                </button>
                                            </div>
                                            <div className="relative border border-gray-200 rounded-3xl overflow-hidden bg-gray-50">
                                                <canvas
                                                    ref={canvasRef}
                                                    width={800}
                                                    height={384}
                                                    onMouseDown={startDrawing}
                                                    onMouseMove={draw}
                                                    onMouseUp={stopDrawing}
                                                    onMouseLeave={stopDrawing}
                                                    onTouchStart={startDrawing}
                                                    onTouchMove={draw}
                                                    onTouchEnd={stopDrawing}
                                                    className="w-full h-48 bg-white cursor-crosshair touch-none"
                                                />
                                                {!signatureData && (
                                                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-center p-6 text-gray-400 text-xs font-semibold leading-relaxed">
                                                        Draw customer signature here<br/>(supports touch & pointer)
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {evidenceType === 'photo' && (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                                                Choose {isDelivery ? 'Drop-off' : 'Pickup'} Photo Template
                                            </label>
                                            <div className="grid grid-cols-3 gap-3">
                                                {activePresets.map(preset => (
                                                    <div
                                                        key={preset.id}
                                                        onClick={() => {
                                                            setPhotoPreset(preset.id);
                                                            setPhotoUrl(preset.url);
                                                        }}
                                                        className={`bg-white border rounded-2xl overflow-hidden cursor-pointer hover:shadow-md transition-all flex flex-col group relative ${photoPreset === preset.id ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-gray-200'}`}
                                                    >
                                                        <img 
                                                            src={preset.url} 
                                                            alt={preset.label} 
                                                            className="h-16 w-full object-cover" 
                                                        />
                                                        <div className="p-2 text-[10px] font-black text-center text-gray-700 bg-gray-50 group-hover:bg-white truncate">
                                                            {preset.label}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-150"></div></div>
                                            <div className="relative flex justify-center text-[10px] font-black uppercase tracking-wider"><span className="px-3 bg-white text-gray-400">Or Upload Real Photo</span></div>
                                        </div>

                                        {/* File Uploader */}
                                        <div className="space-y-1.5">
                                            <div className="border-2 border-dashed border-gray-200 rounded-3xl p-5 flex flex-col items-center justify-center bg-gray-50/50 hover:bg-gray-50 transition-all cursor-pointer relative overflow-hidden group">
                                                {customPhotoData && photoPreset === 'custom' ? (
                                                    <div className="w-full relative h-28 rounded-2xl overflow-hidden">
                                                        <img src={customPhotoData} alt="Uploaded Proof" className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <span className="text-white text-xs font-black">Replace Photo</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <span className="text-3xl mb-1.5">📸</span>
                                                        <span className="text-xs font-extrabold text-gray-700">Upload Live Proof Photo</span>
                                                        <span className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-wider">Drag & drop or click to choose file</span>
                                                    </>
                                                )}
                                                <input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    onChange={(e) => {
                                                        handlePhotoUpload(e);
                                                        setPhotoPreset('custom');
                                                    }} 
                                                    className="absolute inset-0 opacity-0 cursor-pointer" 
                                                />
                                            </div>
                                        </div>

                                        {/* Optional details note */}
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                                                Remarks / Location Details (Optional)
                                            </label>
                                            <input 
                                                type="text"
                                                value={evidenceNote}
                                                onChange={e => setEvidenceNote(e.target.value)}
                                                placeholder={isDelivery ? "e.g. Behind the flower planter, at door buzzer #12" : "e.g. Verified photo ID matching customer record"}
                                                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs font-extrabold outline-none text-gray-800 focus:bg-white focus:border-emerald-500 transition-all"
                                            />
                                        </div>
                                    </div>
                                )}

                                {evidenceType === 'none' && (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                                                Verification Notes
                                            </label>
                                            <textarea 
                                                value={evidenceNote}
                                                onChange={e => setEvidenceNote(e.target.value)}
                                                placeholder={isDelivery ? "Provide drop-off location or courier comments (e.g. Left safe in front porch, mailbox full...)" : "Provide staff pickup comments (e.g. Handed to customer after ID check...)"}
                                                rows={4}
                                                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 text-sm font-extrabold outline-none text-gray-800 focus:bg-white focus:border-emerald-500 transition-all resize-none leading-relaxed"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer Controls */}
                            <div className="border-t border-gray-150 pt-5 mt-5 flex gap-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEvidenceModalOpen(false);
                                        setEvidenceOrder(null);
                                    }}
                                    disabled={isEvidenceSubmitting}
                                    className="flex-1 py-4 border border-gray-250 text-gray-500 hover:bg-gray-50 text-sm font-black rounded-2xl transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmitEvidence}
                                    disabled={isEvidenceSubmitting}
                                    className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black rounded-2xl transition-all shadow-lg shadow-emerald-600/15 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isEvidenceSubmitting ? 'Finalizing...' : 'Save & Complete'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

// --- Helper functions ---

export const getPaymentStatusBadge = (order: Order) => {
    const status = order.paymentStatus;
    const amount = order.refundedAmount || order.refundingAmount;
    
    switch (status) {
        case 'refunded':
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tight bg-red-100 text-red-700 border border-red-200">
                    🔄 Refunded
                </span>
            );
        case 'partially_refunded':
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tight bg-orange-100 text-orange-700 border border-orange-200">
                    🔄 Partial {amount ? `(-$${amount.toFixed(2)})` : ''}
                </span>
            );
        case 'refunding':
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tight bg-yellow-100 text-yellow-700 border border-yellow-200 animate-pulse">
                    ⏳ Refunding
                </span>
            );
        case 'paid':
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tight bg-green-100 text-green-700 border border-green-200">
                    💳 Paid
                </span>
            );
        case 'pending':
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tight bg-blue-50 text-blue-600 border border-blue-100">
                    ⏳ Pending
                </span>
            );
        default:
            return null;
    }
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
            <div className="pt-1 text-[10px] text-gray-400 font-bold border-t border-dashed border-gray-100 mt-2 flex justify-between items-center">
                <span>{order.items.length} items • ${order.total.toFixed(2)}</span>
                {getPaymentStatusBadge(order)}
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
