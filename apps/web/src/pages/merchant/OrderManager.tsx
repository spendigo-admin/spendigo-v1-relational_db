import React, { useState } from 'react';
import '../../styles/design-system.css';

interface Order {
    id: string;
    customerName: string;
    items: string[];
    total: number;
    status: 'PENDING' | 'ACCEPTED' | 'READY';
    createdAt: Date;
}

const OrderManager: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([
        {
            id: 'ORD-001',
            customerName: 'Alice Smith',
            items: ['Milk 2L', 'Eggs 12pk'],
            total: 8.50,
            status: 'PENDING',
            createdAt: new Date(Date.now() - 10 * 60000) // 10 mins ago
        },
        {
            id: 'ORD-002',
            customerName: 'Bob Jones',
            items: ['Bread'],
            total: 2.50,
            status: 'ACCEPTED',
            createdAt: new Date(Date.now() - 45 * 60000)
        }
    ]);

    const handleAction = (id: string, newStatus: Order['status']) => {
        setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus } : o));
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-[var(--text-main)]">Incoming Orders</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {orders.map(order => {
                    // SLA Timer Vis
                    const minsElapsed = Math.floor((Date.now() - order.createdAt.getTime()) / 60000);
                    const slaRisk = order.status === 'PENDING' && minsElapsed > 15;

                    return (
                        <div key={order.id} className={`glass-panel p-6 border-l-4 ${slaRisk ? 'border-l-[var(--status-error)]' : 'border-l-[var(--brand-primary)]'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-lg">{order.id}</h3>
                                    <p className="text-sm text-[var(--text-muted)]">{order.customerName}</p>
                                </div>
                                <div className="text-right">
                                    <span className="block font-mono font-bold">${order.total.toFixed(2)}</span>
                                    <span className="text-xs text-[var(--text-muted)]">{minsElapsed}m ago</span>
                                </div>
                            </div>

                            <div className="mb-6 space-y-1">
                                {order.items.map((item, i) => (
                                    <div key={i} className="text-sm flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--brand-secondary)]"></div>
                                        {item}
                                    </div>
                                ))}
                            </div>

                            <div className="pt-4 border-t border-[var(--glass-border)] flex gap-2">
                                {order.status === 'PENDING' && (
                                    <>
                                        <button
                                            onClick={() => handleAction(order.id, 'ACCEPTED')}
                                            className="flex-1 py-2 bg-[var(--status-success)] text-white font-bold rounded-[var(--radius-sm)] hover:brightness-110"
                                        >
                                            Accept
                                        </button>
                                        <button className="px-3 py-2 text-[var(--status-error)] font-medium hover:bg-[var(--status-error)]/10 rounded-[var(--radius-sm)]">
                                            Decline
                                        </button>
                                    </>
                                )}
                                {order.status === 'ACCEPTED' && (
                                    <button
                                        onClick={() => handleAction(order.id, 'READY')}
                                        className="flex-1 py-2 bg-[var(--brand-primary)] text-white font-bold rounded-[var(--radius-sm)]"
                                    >
                                        Mark Ready
                                    </button>
                                )}
                                {order.status === 'READY' && (
                                    <div className="w-full text-center py-2 text-[var(--status-success)] font-bold bg-[var(--status-success)]/10 rounded">
                                        Waiting for Pickup
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default OrderManager;
