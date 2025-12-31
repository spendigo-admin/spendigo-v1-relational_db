import React, { useState } from 'react';
import '../../styles/design-system.css';
import { useAuth } from '../../context/AuthContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useNotifications } from '../../context/NotificationContext';
import { useConfirmation } from '../../context/ConfirmationContext';

const StoreManagement: React.FC = () => {
    const { user } = useAuth();
    const { stores, updateStoreStatus, addStore, requestDeleteStore, approveDeleteStore } = useMarketplace();
    const { addNotification } = useNotifications();
    const { confirm } = useConfirmation();
    const storeList = Object.values(stores);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newStore, setNewStore] = useState({
        name: '',
        merchantEmail: '',
        type: 'grocery'
    });

    const handleAddStore = (e: React.FormEvent) => {
        e.preventDefault();
        addStore({
            ...newStore,
            status: 'pending', // Default to pending for approval
            rating: 0,
            products: [],
            logo: `https://ui-avatars.com/api/?name=${newStore.name}&background=random`
        });
        setIsModalOpen(false);
        setNewStore({ name: '', merchantEmail: '', type: 'grocery' });
    };

    return (
        <div className="space-y-6 animate-fade-in relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-main)]">Store Management</h1>
                    <p className="text-[var(--text-muted)] text-sm">Review merchant applications and manage existing stores</p>
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-lg text-sm font-medium hover:bg-[var(--surface-2)]">
                        Export List
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-medium hover:brightness-110"
                    >
                        + Add Store
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-[var(--glass-border)] shadow-sm">
                    <p className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider">Total Stores</p>
                    <p className="text-2xl font-bold text-[var(--text-main)] mt-1">{storeList.length}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-[var(--glass-border)] shadow-sm">
                    <p className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider">Pending</p>
                    <p className="text-2xl font-bold text-orange-500 mt-1">{storeList.filter((s: any) => s.status === 'pending').length}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-[var(--glass-border)] shadow-sm">
                    <p className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider">Suspended</p>
                    <p className="text-2xl font-bold text-red-500 mt-1">{storeList.filter((s: any) => s.status === 'suspended').length}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-[var(--glass-border)] shadow-sm">
                    <p className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider">Deletion Req</p>
                    <p className="text-2xl font-bold text-red-500 mt-1">{storeList.filter((s: any) => s.status === 'pending_deletion').length}</p>
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
                            {storeList.map((store: any) => (
                                <tr key={store.id} className="hover:bg-[var(--surface-2)] transition-colors group">
                                    <td className="p-4">
                                        <div className="font-bold text-[var(--text-main)]">{store.name}</div>
                                        <div className="text-xs text-[var(--text-muted)] md:hidden">ID: {store.id}</div>
                                    </td>
                                    <td className="p-4 text-sm text-[var(--text-main)]">{store.merchantEmail || 'N/A'}</td>
                                    <td className="p-4 text-sm text-[var(--text-main)]">{store.products?.length || 0}</td>
                                    <td className="p-4 text-sm text-[var(--text-muted)]">{store.joinedAt}</td>
                                    <td className="p-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                            ${store.status === 'active' ? 'bg-green-100 text-green-800' :
                                                store.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                                                    'bg-red-100 text-red-800'}`}>
                                            {store.status === 'active' && <span className="mr-1">●</span>}
                                            {store.status === 'pending' && <span className="mr-1">○</span>}
                                            {store.status === 'suspended' && <span className="mr-1">✕</span>}
                                            {store.status === 'pending_deletion' && <span className="mr-1">⚠️</span>}
                                            {(store.status || 'active').replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right space-x-2">
                                        {store.status === 'pending' && (
                                            <>
                                                <button
                                                    onClick={() => updateStoreStatus(store.id, 'active')}
                                                    className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => updateStoreStatus(store.id, 'suspended')}
                                                    className="text-xs bg-[var(--surface-2)] hover:bg-red-50 text-red-600 px-3 py-1.5 rounded-lg transition-colors border border-[var(--glass-border)]"
                                                >
                                                    Reject
                                                </button>
                                            </>
                                        )}
                                        {(store.status === 'active' || !store.status) && (
                                            <button
                                                onClick={() => updateStoreStatus(store.id, 'suspended')}
                                                className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1"
                                            >
                                                Suspend
                                            </button>
                                        )}
                                        {store.status === 'suspended' && (
                                            <button
                                                onClick={() => updateStoreStatus(store.id, 'active')}
                                                className="text-xs text-green-500 hover:text-green-700 font-medium px-2 py-1"
                                            >
                                                Reactivate
                                            </button>
                                        )}
                                        {store.status === 'pending_deletion' && (
                                            <>
                                                {store.deletionRequest?.requestedBy !== user?.id ? (
                                                    <button
                                                        onClick={async () => {
                                                            const confirmed = await confirm({
                                                                title: 'Approve Deletion',
                                                                message: `Approve deletion for ${store.name}? This is final.`,
                                                                confirmText: 'Approve & Delete',
                                                                type: 'danger'
                                                            });
                                                            if (confirmed) approveDeleteStore(store.id);
                                                        }}
                                                        className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-bold"
                                                    >
                                                        Approve Deletion
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-orange-600 font-medium bg-orange-50 border border-orange-100 px-2 py-1 rounded inline-block">
                                                        ⏳ Waiting for other admin
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => updateStoreStatus(store.id, 'active')}
                                                    className="text-xs text-gray-500 hover:text-gray-700 border border-gray-300 px-2 py-1 rounded ml-1"
                                                >
                                                    Reject
                                                </button>
                                            </>
                                        )}

                                        {store.status !== 'pending_deletion' && (
                                            <button
                                                onClick={async () => {
                                                    const confirmed = await confirm({
                                                        title: 'Request Deletion',
                                                        message: `Request deletion for ${store.name}? Another admin will need to approve this.`,
                                                        confirmText: 'Submit Request',
                                                        type: 'warning'
                                                    });

                                                    if (confirmed) {
                                                        try {
                                                            await requestDeleteStore(store.id, user?.id || 'admin', 'admin');
                                                            addNotification({
                                                                type: 'system',
                                                                title: 'Request Submitted',
                                                                message: `Deletion request for ${store.name} submitted.`
                                                            });
                                                        } catch (e) {
                                                            addNotification({
                                                                type: 'alert',
                                                                title: 'Error',
                                                                message: 'Failed to submit request.'
                                                            });
                                                        }
                                                    }
                                                }}
                                                className="text-xs text-red-600 hover:text-red-800 font-medium px-3 py-1.5 ml-2 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                                                title="Initiate Maker-Checker Deletion Workflow"
                                            >
                                                Request Delete
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Store Modal */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                <h2 className="text-xl font-bold">Add New Store</h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                            </div>
                            <form onSubmit={handleAddStore} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent outline-none"
                                        value={newStore.name}
                                        onChange={e => setNewStore({ ...newStore, name: e.target.value })}
                                        placeholder="e.g. Green Valley Grocers"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Merchant Email</label>
                                    <input
                                        type="email"
                                        required
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent outline-none"
                                        value={newStore.merchantEmail}
                                        onChange={e => setNewStore({ ...newStore, merchantEmail: e.target.value })}
                                        placeholder="merchant@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Store Type</label>
                                    <select
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] outline-none"
                                        value={newStore.type}
                                        onChange={e => setNewStore({ ...newStore, type: e.target.value })}
                                    >
                                        <option value="grocery">Grocery Store</option>
                                        <option value="convenience">Convenience Store</option>
                                        <option value="bakery">Bakery</option>
                                        <option value="butcher">Butcher</option>
                                    </select>
                                </div>
                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-2.5 bg-[var(--brand-primary)] text-white rounded-lg font-bold hover:brightness-110 shadow-lg shadow-[var(--brand-primary)]/20"
                                    >
                                        Create Store
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default StoreManagement;
