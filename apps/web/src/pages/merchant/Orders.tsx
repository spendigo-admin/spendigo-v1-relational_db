import React, { useState } from 'react';
import '../../styles/design-system.css';

// Mock orders for this merchant
const INITIAL_ORDERS = [
    {
        id: 'ORD-001',
        customer: 'John Doe',
        items: [{ name: 'Organic Avocados', qty: 2 }, { name: 'Almond Milk', qty: 1 }],
        total: 20.87,
        status: 'preparing',
        time: '10:30 AM',
        address: '123 Queen St W, Toronto'
    },
    {
        id: 'ORD-002',
        customer: 'Jane Smith',
        items: [{ name: 'Sourdough Loaf', qty: 1 }],
        total: 6.77,
        status: 'ready',
        time: '10:45 AM',
        address: '456 King St E, Toronto'
    },
    {
        id: 'ORD-003',
        customer: 'Mike Johnson',
        items: [{ name: 'Greek Yogurt', qty: 3 }, { name: 'Bananas', qty: 2 }],
        total: 22.46,
        status: 'new',
        time: '11:00 AM',
        address: '789 Bloor St W, Toronto'
    },
];

const MerchantOrders: React.FC = () => {
    const [orders, setOrders] = useState(INITIAL_ORDERS);
    const [filter, setFilter] = useState<'all' | 'new' | 'preparing' | 'ready'>('all');
    const [selectedOrder, setSelectedOrder] = useState<typeof INITIAL_ORDERS[0] | null>(null);

    const filteredOrders = filter === 'all' ? orders : orders.filter(o => o.status === filter);

    const updateStatus = (orderId: string, newStatus: string) => {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        if (selectedOrder?.id === orderId) {
            setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'new': return 'bg-blue-100 text-blue-700';
            case 'preparing': return 'bg-yellow-100 text-yellow-700';
            case 'ready': return 'bg-green-100 text-green-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getNextStatus = (status: string) => {
        switch (status) {
            case 'new': return 'preparing';
            case 'preparing': return 'ready';
            case 'ready': return 'completed';
            default: return null;
        }
    };

    const getActionLabel = (status: string) => {
        switch (status) {
            case 'new': return 'Start Preparing';
            case 'preparing': return 'Mark Ready';
            case 'ready': return 'Complete Order';
            default: return null;
        }
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-main)]">Orders</h1>
                    <p className="text-sm text-[var(--text-muted)]">{orders.filter(o => o.status === 'new').length} new orders</p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-4">
                {(['all', 'new', 'preparing', 'ready'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${filter === f ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
                    >
                        {f} {f !== 'all' && `(${orders.filter(o => o.status === f).length})`}
                    </button>
                ))}
            </div>

            {/* Orders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOrders.map(order => (
                    <div
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${order.status === 'new' ? 'border-blue-300 ring-2 ring-blue-100' : 'border-[var(--glass-border)]'
                            }`}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <span className="font-bold text-[var(--text-main)]">{order.id}</span>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${getStatusColor(order.status)}`}>
                                {order.status}
                            </span>
                        </div>
                        <p className="text-sm text-[var(--text-muted)] mb-2">🕐 {order.time}</p>
                        <p className="font-medium text-[var(--text-main)] mb-1">{order.customer}</p>
                        <p className="text-sm text-[var(--text-muted)]">
                            {order.items.map(i => `${i.qty}x ${i.name}`).join(', ')}
                        </p>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--glass-border)]">
                            <span className="font-bold text-[var(--brand-primary)]">${order.total.toFixed(2)}</span>
                            {getNextStatus(order.status) && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); updateStatus(order.id, getNextStatus(order.status)!); }}
                                    className="text-sm text-[var(--brand-primary)] font-medium hover:underline"
                                >
                                    {getActionLabel(order.status)}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Order Detail Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedOrder(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-[var(--text-main)]">{selectedOrder.id}</h2>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${getStatusColor(selectedOrder.status)}`}>
                                {selectedOrder.status}
                            </span>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <p className="text-sm text-[var(--text-muted)]">Customer</p>
                                <p className="font-medium text-[var(--text-main)]">{selectedOrder.customer}</p>
                            </div>
                            <div>
                                <p className="text-sm text-[var(--text-muted)]">Delivery Address</p>
                                <p className="font-medium text-[var(--text-main)]">{selectedOrder.address}</p>
                            </div>
                            <div>
                                <p className="text-sm text-[var(--text-muted)]">Items</p>
                                <div className="mt-2 space-y-2">
                                    {selectedOrder.items.map((item, i) => (
                                        <div key={i} className="flex justify-between">
                                            <span>{item.qty}x {item.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-between pt-4 border-t border-[var(--glass-border)]">
                                <span className="font-bold">Total</span>
                                <span className="font-bold text-[var(--brand-primary)]">${selectedOrder.total.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            {getNextStatus(selectedOrder.status) && (
                                <button
                                    onClick={() => updateStatus(selectedOrder.id, getNextStatus(selectedOrder.status)!)}
                                    className="flex-1 py-3 bg-[var(--brand-primary)] text-white font-medium rounded-lg"
                                >
                                    {getActionLabel(selectedOrder.status)}
                                </button>
                            )}
                            <button onClick={() => setSelectedOrder(null)} className="flex-1 py-3 border border-[var(--glass-border)] rounded-lg">
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
