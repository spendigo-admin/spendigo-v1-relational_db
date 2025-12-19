import React, { useState, useEffect } from 'react';
import '../../styles/design-system.css';
import { useAuth } from '../../context/AuthContext';

// Types
interface OrderItem {
    name: string;
    qty: number;
    notes?: string;
}

interface Order {
    id: string;
    customer: string;
    items: OrderItem[];
    total: number;
    status: 'new' | 'preparing' | 'ready' | 'completed' | 'cancelled';
    timePlaced: Date; // Object for timer calc
    type: 'delivery' | 'pickup';
    driver?: {
        name: string;
        phone: string;
        plate: string;
    };
    address?: string;
}

// Mock Data
const INITIAL_ORDERS: Order[] = [
    {
        id: 'ORD-1201',
        customer: 'Sarah Chen',
        items: [{ name: 'Organic Avocados', qty: 2 }, { name: 'Almond Milk (1L)', qty: 1 }],
        total: 20.87,
        status: 'new',
        timePlaced: new Date(Date.now() - 1000 * 60 * 2), // 2 mins ago
        type: 'delivery',
        address: '123 Queen St W, Toronto'
    },
    {
        id: 'ORD-1198',
        customer: 'Mike Ross',
        items: [{ name: 'Sourdough Loaf', qty: 1 }, { name: 'Espresso Beans', qty: 1 }],
        total: 24.50,
        status: 'preparing',
        timePlaced: new Date(Date.now() - 1000 * 60 * 12), // 12 mins ago
        type: 'pickup'
    },
    {
        id: 'ORD-1195',
        customer: 'Jessica Pearson',
        items: [{ name: 'Greek Yogurt (500g)', qty: 3 }, { name: 'Bananas', qty: 1 }],
        total: 18.46,
        status: 'ready',
        timePlaced: new Date(Date.now() - 1000 * 60 * 25), // 25 mins ago
        type: 'delivery',
        driver: { name: 'James D.', phone: '555-0102', plate: 'AB-1234' },
        address: '456 King St E, Toronto'
    },
];

const MerchantOrders: React.FC = () => {
    const { can } = useAuth();
    const hasReadAccess = can('orders:read');
    const hasWriteAccess = can('orders:write');

    const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

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
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [now, setNow] = useState(new Date());

    // Timer Tick
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 30000); // Update every 30s
        return () => clearInterval(interval);
    }, []);

    // Filter
    const filteredOrders = orders.filter(o =>
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customer.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Helpers
    const getMinutesElapsed = (date: Date) => Math.floor((now.getTime() - date.getTime()) / 60000);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'new': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'preparing': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'ready': return 'bg-green-100 text-green-700 border-green-200';
            case 'completed': return 'bg-gray-100 text-gray-600 border-gray-200';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const updateStatus = (id: string, newStatus: Order['status']) => {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
        if (selectedOrder?.id === id) {
            setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
        }
    };

    const addMockOrder = () => {
        const newOrder: Order = {
            id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
            customer: 'New Customer',
            items: [{ name: 'Random Item', qty: 1 }],
            total: 9.99,
            status: 'new',
            timePlaced: new Date(),
            type: Math.random() > 0.5 ? 'delivery' : 'pickup',
            address: '789 Bloor St'
        };
        setOrders(prev => [newOrder, ...prev]);
    };

    // Components
    const OrderCard = ({ order }: { order: Order }) => {
        const elapsed = getMinutesElapsed(order.timePlaced);
        const isLate = elapsed > 20 && order.status !== 'completed';

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
                            {order.id}
                            {order.type === 'delivery' ? <span>🛵</span> : <span>🛍️</span>}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">{order.customer}</div>
                    </div>
                    <div className={`text-xs font-bold px-2 py-1 rounded-lg ${isLate ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                        {elapsed}m ago
                    </div>
                </div>

                <div className="space-y-1 mb-3 pl-2 border-l-2 border-transparent group-hover:border-[var(--brand-primary)]/20 transition-all">
                    {order.items.slice(0, 3).map((item, i) => (
                        <div key={i} className="text-sm flex justify-between">
                            <span><span className="font-bold">{item.qty}x</span> {item.name}</span>
                        </div>
                    ))}
                    {order.items.length > 3 && <div className="text-xs text-[var(--text-muted)]">+{order.items.length - 3} more...</div>}
                </div>

                <div className="flex justify-between items-center pl-2 pt-2 border-t border-[var(--glass-border)]">
                    <div className="font-bold text-[var(--text-main)]">${order.total.toFixed(2)}</div>

                    {/* Quick Actions */}
                    <div className="flex gap-2">
                        {hasWriteAccess ? (
                            <>
                                {order.status === 'new' && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'preparing'); }}
                                        className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-md hover:brightness-110"
                                    >
                                        Accept
                                    </button>
                                )}
                                {order.status === 'preparing' && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'ready'); }}
                                        className="px-3 py-1 bg-orange-500 text-white text-xs font-bold rounded-md hover:brightness-110"
                                    >
                                        Ready
                                    </button>
                                )}
                                {order.status === 'ready' && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); updateStatus(order.id, 'completed'); }}
                                        className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-md hover:brightness-110"
                                    >
                                        {order.type === 'delivery' ? 'Ship Order' : 'Picked Up'}
                                    </button>
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
        <div className="p-6 h-[calc(100vh-64px)] overflow-hidden flex flex-col">
            {/* Header with Stats */}
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
                        + Simulate Order
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
                    <button className="p-2 bg-[var(--brand-primary)] text-white rounded-lg shadow-lg shadow-[var(--brand-primary)]/20 hover:brightness-110">
                        🔔
                    </button>
                </div>
            </div>

            {/* Kanban Board */}
            {viewMode === 'kanban' && (
                <div className="flex-1 grid grid-cols-4 gap-4 overflow-hidden min-h-0">
                    {/* Columns */}
                    {[
                        { id: 'new', label: '🔔 New Orders', color: 'border-blue-500' },
                        { id: 'preparing', label: '👨‍🍳 Preparing', color: 'border-orange-500' },
                        { id: 'ready', label: '🎒 Ready', color: 'border-green-500' },
                        { id: 'completed', label: '✅ Done (Shipped/Picked Up)', color: 'border-gray-300' }
                    ].map(col => (
                        <div key={col.id} className="flex flex-col h-full bg-[var(--surface-1)]/50 rounded-xl border border-[var(--glass-border)]">
                            <div className={`p-3 font-bold text-sm border-b-2 bg-white rounded-t-xl ${col.color} flex justify-between`}>
                                <span>{col.label}</span>
                                <span className="text-[var(--text-muted)]">{filteredOrders.filter(o => o.status === col.id).length}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide">
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
                                    <td className="p-4">{order.customer}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getStatusColor(order.status)}`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-[var(--text-muted)]">{order.items.length} items</td>
                                    <td className="p-4 font-bold">${order.total.toFixed(2)}</td>
                                    <td className="p-4 text-sm text-[var(--text-muted)]">{getMinutesElapsed(order.timePlaced)}m</td>
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
                                <p className="text-sm text-[var(--text-muted)]">{selectedOrder.type === 'delivery' ? '🛵 Delivery' : '🛍️ Pickup'} • {getMinutesElapsed(selectedOrder.timePlaced)}m ago</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-sm font-bold border ${getStatusColor(selectedOrder.status)} capitalize`}>
                                {selectedOrder.status}
                            </span>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Customer</label>
                                    <div className="font-medium text-lg">{selectedOrder.customer}</div>
                                    <div className="text-sm text-[var(--text-muted)]">555-0199</div>
                                </div>
                                {selectedOrder.type === 'delivery' && (
                                    <div>
                                        <label className="text-xs font-bold text-[var(--text-muted)] uppercase">Delivery To</label>
                                        <div className="font-medium">{selectedOrder.address}</div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase mb-2 block">Order Items</label>
                                <div className="bg-[var(--surface-1)] rounded-xl p-4 space-y-3">
                                    {selectedOrder.items.map((item, i) => (
                                        <div key={i} className="flex justify-between items-center pb-3 border-b border-[var(--glass-border)] last:border-0 last:pb-0">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-white flex items-center justify-center font-bold text-[var(--brand-primary)] border border-[var(--glass-border)]">
                                                    {item.qty}x
                                                </div>
                                                <div className="font-medium">{item.name}</div>
                                            </div>
                                            <div className="text-sm font-bold">$Mock</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-2">
                                <span className="font-bold text-lg">Total</span>
                                <span className="font-bold text-2xl text-[var(--brand-primary)]">${selectedOrder.total.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="p-6 border-t border-[var(--glass-border)] bg-gray-50 flex gap-3">
                            {hasWriteAccess && (
                                <>
                                    {selectedOrder.status === 'new' && (
                                        <button onClick={() => { updateStatus(selectedOrder.id, 'preparing'); setSelectedOrder(null); }} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:brightness-110 shadow-lg shadow-blue-600/20">
                                            Accept Order
                                        </button>
                                    )}
                                    {selectedOrder.status === 'preparing' && (
                                        <button onClick={() => { updateStatus(selectedOrder.id, 'ready'); setSelectedOrder(null); }} className="flex-1 py-3 bg-orange-500 text-white font-bold rounded-xl hover:brightness-110 shadow-lg shadow-orange-500/20">
                                            Mark Ready
                                        </button>
                                    )}
                                    {selectedOrder.status === 'ready' && (
                                        <button onClick={() => { updateStatus(selectedOrder.id, 'completed'); setSelectedOrder(null); }} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:brightness-110 shadow-lg shadow-green-600/20">
                                            {selectedOrder.type === 'delivery' ? 'Mark as Shipped' : 'Mark as Picked Up'}
                                        </button>
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
