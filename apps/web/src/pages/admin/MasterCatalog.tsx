import React, { useState } from 'react';
import { useCatalog } from '../../hooks/useCatalog';
import { useNotifications } from '../../context/NotificationContext';
import { useConfirmation } from '../../context/ConfirmationContext';

const MasterCatalog: React.FC = () => {
    const {
        useGlobalCatalog, searchMasterCatalog,
        useProductRequests, approveProductRequest, rejectProductRequest
    } = useCatalog();

    // Hooks
    const { products: catalog, loading } = useGlobalCatalog();
    const { requests } = useProductRequests();
    const { addNotification } = useNotifications();
    const { confirm } = useConfirmation();

    // UI State
    const [activeTab, setActiveTab] = useState<'catalog' | 'requests'>('catalog');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('');

    // --- CATALOG TAB LOGIC ---
    const categories = Array.from(new Set(catalog.map(item => item.category))).sort();
    const filteredItems = catalog.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = filterCategory ? item.category === filterCategory : true;
        return matchesSearch && matchesCategory;
    });

    // --- REQUESTS TAB LOGIC ---
    const handleApprove = async (request: any) => {
        const confirmed = await confirm({
            title: 'Approve Product',
            message: `Create Master Product for "${request.requested_product_name}"?`,
            confirmText: 'Approve & Create',
            type: 'success'
        });

        if (confirmed) {
            try {
                // Map request data to master data structure
                const masterData = {
                    name: request.requested_product_name,
                    brand: request.requested_brand,
                    category: request.requested_category,
                    image: request.requested_image_url || 'https://placehold.co/100',
                    description: request.requested_description
                };

                await approveProductRequest(request.id, request, masterData);
                addNotification({ type: 'system', title: 'Approved', message: 'Master Product created.' });
            } catch (err) {
                console.error(err);
                addNotification({ type: 'alert', title: 'Error', message: 'Approval failed.' });
            }
        }
    };

    const handleReject = async (request: any) => {
        const reason = prompt("Enter rejection reason:");
        if (reason) {
            try {
                await rejectProductRequest(request.id, request, reason);
                addNotification({ type: 'system', title: 'Rejected', message: 'Request rejected.' });
            } catch (err) {
                addNotification({ type: 'alert', title: 'Error', message: 'Action failed.' });
            }
        }
    };

    return (
        <div className="p-6 h-[calc(100vh-64px)] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-main)]">Master Catalog Manager</h1>
                    <p className="text-sm text-[var(--text-muted)]">
                        Manage global products and review merchant requests.
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[var(--glass-border)] mb-6">
                <button
                    onClick={() => setActiveTab('catalog')}
                    className={`px-6 py-3 font-bold border-b-2 transition-colors ${activeTab === 'catalog' ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]' : 'border-transparent text-gray-500'}`}
                >
                    Global Catalog ({catalog.length})
                </button>
                <button
                    onClick={() => setActiveTab('requests')}
                    className={`px-6 py-3 font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'requests' ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]' : 'border-transparent text-gray-500'}`}
                >
                    Creation Requests
                    {requests.length > 0 && (
                        <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{requests.length}</span>
                    )}
                </button>
            </div>

            {/* CATALOG VIEW */}
            {activeTab === 'catalog' && (
                <div className="animate-fade-in">
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                        <div className="flex-1">
                            <input
                                type="text"
                                placeholder="Search items..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg outline-none"
                            />
                        </div>
                        <div>
                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="w-full sm:w-64 px-4 py-3 border border-[var(--glass-border)] rounded-lg outline-none"
                            >
                                <option value="">All Categories</option>
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-[var(--glass-border)] shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-[var(--surface-1)] border-b border-[var(--glass-border)]">
                                <tr>
                                    <th className="p-4 text-sm text-[var(--text-muted)] w-1/3">Product</th>
                                    <th className="p-4 text-sm text-[var(--text-muted)]">Category</th>
                                    <th className="p-4 text-sm text-[var(--text-muted)]">Brand</th>
                                    <th className="p-4 text-sm text-[var(--text-muted)]">Barcode</th>
                                    <th className="p-4 text-sm text-[var(--text-muted)]">Size</th>
                                    <th className="p-4 text-sm text-[var(--text-muted)] text-right">ID</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--glass-border)]">
                                {loading && <tr><td colSpan={6} className="p-8 text-center text-gray-400">Loading...</td></tr>}
                                {filteredItems.map(item => (
                                    <tr key={item.id} className="hover:bg-[var(--surface-1)] transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <img src={item.image} className="w-10 h-10 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
                                                <div className="min-w-0">
                                                    <div className="font-bold text-[var(--text-main)] truncate">{item.name}</div>
                                                    <div className="text-xs text-[var(--text-muted)] line-clamp-1">{item.description || 'No description'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm">{item.category}</td>
                                        <td className="p-4 text-sm">{item.brand_name}</td>
                                        <td className="p-4 text-sm font-mono text-[var(--text-muted)]">{item.barcode || '-'}</td>
                                        <td className="p-4 text-sm">{item.unit_size || '-'}</td>
                                        <td className="p-4 text-xs font-mono text-right text-gray-400">{item.master_product_id}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* REQUESTS VIEW */}
            {activeTab === 'requests' && (
                <div className="animate-fade-in space-y-4">
                    {requests.length === 0 && (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                            <p className="text-lg text-gray-500">No pending requests.</p>
                        </div>
                    )}

                    {requests.map(req => (
                        <div key={req.id} className="bg-white p-6 rounded-xl border border-[var(--glass-border)] shadow-sm flex flex-col md:flex-row gap-6">
                            {/* Image Preview */}
                            <div className="w-full md:w-48 h-48 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                                {req.requested_image_url ? (
                                    <img src={req.requested_image_url} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                                )}
                            </div>

                            {/* Details */}
                            <div className="flex-1 space-y-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-xl font-bold">{req.requested_product_name}</h3>
                                        <p className="text-gray-500">{req.requested_brand} • {req.requested_category}</p>
                                    </div>
                                    <span className="bg-orange-100 text-orange-700 font-bold text-xs px-2 py-1 rounded">Pending</span>
                                </div>

                                <div className="p-3 bg-gray-50 rounded text-sm text-gray-700">
                                    {req.requested_description || "No description provided."}
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-500 block">Barcode</span>
                                        <span className="font-mono">{req.requested_barcode || "N/A"}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block">Merchant ID</span>
                                        <span className="font-mono text-xs">{req.submitted_by_merchant_id}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-2 justify-center border-l pl-6 min-w-[150px]">
                                <button
                                    onClick={() => handleApprove(req)}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-sm"
                                >
                                    ✓ Approve
                                </button>
                                <button
                                    onClick={() => handleReject(req)}
                                    className="px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-medium rounded-lg"
                                >
                                    ✕ Reject
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
export default MasterCatalog;
