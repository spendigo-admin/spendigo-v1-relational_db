import React, { useState } from 'react';
import '../../styles/design-system.css';

interface Store {
    id: string;
    name: string;
    merchantEmail: string;
    status: 'active' | 'pending' | 'suspended';
    joinedAt: string;
    productsCount: number;
}

const StoreManagement: React.FC = () => {
    // Mock Data
    const [stores, setStores] = useState<Store[]>([
        { id: 's1', name: 'FreshMart', merchantEmail: 'contact@freshmart.com', status: 'active', joinedAt: '2023-11-12', productsCount: 145 },
        { id: 's2', name: 'QuickPick', merchantEmail: 'owner@quickpick.net', status: 'active', joinedAt: '2023-12-05', productsCount: 89 },
        { id: 's3', name: 'Metro Express', merchantEmail: 'metro@express.com', status: 'pending', joinedAt: '2024-01-10', productsCount: 0 },
        { id: 's4', name: 'Corner Bodega', merchantEmail: 'bodega@nyc.com', status: 'suspended', joinedAt: '2023-10-20', productsCount: 12 },
    ]);

    const updateStatus = (id: string, newStatus: Store['status']) => {
        setStores(stores.map(s => s.id === id ? { ...s, status: newStatus } : s));
        // Status updated toast or API call would go here
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-main)]">Store Management</h1>
                    <p className="text-[var(--text-muted)] text-sm">Review merchant applications and manage existing stores</p>
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-lg text-sm font-medium hover:bg-[var(--surface-2)]">
                        Export List
                    </button>
                    <button className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-medium hover:brightness-110">
                        + Add Store
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-[var(--glass-border)] shadow-sm">
                    <p className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider">Total Stores</p>
                    <p className="text-2xl font-bold text-[var(--text-main)] mt-1">{stores.length}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-[var(--glass-border)] shadow-sm">
                    <p className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider">Pending Review</p>
                    <p className="text-2xl font-bold text-orange-500 mt-1">{stores.filter(s => s.status === 'pending').length}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-[var(--glass-border)] shadow-sm">
                    <p className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider">Suspended</p>
                    <p className="text-2xl font-bold text-red-500 mt-1">{stores.filter(s => s.status === 'suspended').length}</p>
                </div>
            </div>

            {/* Main Table */}
            <div className="glass-panel overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left bg-[var(--surface-1)]">
                        <thead className="bg-[var(--surface-2)] text-[var(--text-muted)] text-xs uppercase">
                            <tr>
                                <th className="p-4">Store Name</th>
                                <th className="p-4">Merchant Email</th>
                                <th className="p-4">Products</th>
                                <th className="p-4">Joined</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--glass-border)]">
                            {stores.map(store => (
                                <tr key={store.id} className="hover:bg-[var(--surface-2)] transition-colors group">
                                    <td className="p-4">
                                        <div className="font-bold text-[var(--text-main)]">{store.name}</div>
                                        <div className="text-xs text-[var(--text-muted)] md:hidden">ID: {store.id}</div>
                                    </td>
                                    <td className="p-4 text-sm text-[var(--text-main)]">{store.merchantEmail}</td>
                                    <td className="p-4 text-sm text-[var(--text-main)]">{store.productsCount}</td>
                                    <td className="p-4 text-sm text-[var(--text-muted)]">{store.joinedAt}</td>
                                    <td className="p-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                            ${store.status === 'active' ? 'bg-green-100 text-green-800' :
                                                store.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                                                    'bg-red-100 text-red-800'}`}>
                                            {store.status === 'active' && <span className="mr-1">●</span>}
                                            {store.status === 'pending' && <span className="mr-1">○</span>}
                                            {store.status === 'suspended' && <span className="mr-1">✕</span>}
                                            {store.status.charAt(0).toUpperCase() + store.status.slice(1)}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right space-x-2">
                                        {store.status === 'pending' && (
                                            <>
                                                <button
                                                    onClick={() => updateStatus(store.id, 'active')}
                                                    className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => updateStatus(store.id, 'suspended')}
                                                    className="text-xs bg-[var(--surface-2)] hover:bg-red-50 text-red-600 px-3 py-1.5 rounded-lg transition-colors border border-[var(--glass-border)]"
                                                >
                                                    Reject
                                                </button>
                                            </>
                                        )}
                                        {store.status === 'active' && (
                                            <button
                                                onClick={() => updateStatus(store.id, 'suspended')}
                                                className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1"
                                            >
                                                Suspend
                                            </button>
                                        )}
                                        {store.status === 'suspended' && (
                                            <button
                                                onClick={() => updateStatus(store.id, 'active')}
                                                className="text-xs text-green-500 hover:text-green-700 font-medium px-2 py-1"
                                            >
                                                Reactivate
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StoreManagement;
