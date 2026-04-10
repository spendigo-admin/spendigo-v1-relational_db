import React, { useState, useEffect } from 'react';
import { useCatalog, MasterProduct } from '../../hooks/useCatalog';
import { useNotifications } from '../../context/NotificationContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { PRODUCT_CATEGORIES } from '../../data/categories';

// Component to show real-time merchant count for each product
const MerchantCountCell: React.FC<{ masterProductId: string }> = ({ masterProductId }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!masterProductId) {
            setCount(0);
            return;
        }

        const q = query(
            collection(db, 'merchant_products'),
            where('master_product_id', '==', masterProductId)
        );

        const unsubscribe = onSnapshot(q, snapshot => {
            setCount(snapshot.size);
        });

        return () => unsubscribe();
    }, [masterProductId]);

    return (
        <>
            <div className="text-sm font-mono">{count}</div>
            <div className="text-[10px] text-[var(--text-muted)]">stores</div>
        </>
    );
};

const MasterCatalog: React.FC = () => {
    const {
        useMasterCatalog, searchMasterCatalog,
        useProductRequests, approveProductRequest, rejectProductRequest,
        fetchExternalUPC, addMasterProduct, updateMasterProduct, deleteMasterProduct,
        usePendingMasterProducts, commitPendingProduct, rejectPendingProduct
    } = useCatalog();

    // Hooks
    const { masterProducts, loading } = useMasterCatalog();
    const { requests } = useProductRequests();
    const { pendingProducts } = usePendingMasterProducts();
    const { addNotification } = useNotifications();
    const { confirm } = useConfirmation();

    // UI State
    const [activeTab, setActiveTab] = useState<'catalog' | 'requests' | 'pending'>('catalog');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<MasterProduct | null>(null);
    const [importUpc, setImportUpc] = useState('');
    const [importing, setImporting] = useState(false);
    const [merchantCount, setMerchantCount] = useState(0);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<MasterProduct>>({});

    useEffect(() => {
        if (selectedProduct) {
            setEditForm({ ...selectedProduct });
            setIsEditing(false);
        }
    }, [selectedProduct]);

    const handleUpdate = async () => {
        if (!selectedProduct || !editForm) return;

        // Remove ID itself from payload (don't write ID into doc field if not needed)
        // casting to any to allow destructuring dynamic properties if needed, though interface keys are known.
        const { master_product_id, ...data } = editForm as any;

        // Sanitize: remove undefined values
        const cleanData: any = {};
        Object.keys(data).forEach(key => {
            const val = (data as any)[key];
            if (val !== undefined) cleanData[key] = val;
        });

        console.log('[MasterCatalog] Updating:', selectedProduct.master_product_id, cleanData);

        try {
            await updateMasterProduct(selectedProduct.master_product_id, cleanData);
            addNotification({ type: 'system', title: 'Updated', message: 'Product updated successfully.' });
            setIsEditing(false);
            // Merge changes back into selectedProduct to update the view immediately
            setSelectedProduct({ ...selectedProduct, ...cleanData } as MasterProduct);
        } catch (e: any) {
            console.error('[MasterCatalog] Update Error:', e);
            addNotification({ type: 'alert', title: 'Error', message: e.message || 'Update failed' });
        }
    };

    const handleDelete = async () => {
        if (!selectedProduct) return;
        if (merchantCount > 0) {
            if (!await confirm({ title: 'Warning: Active Usage', message: `This product is listed by ${merchantCount} merchants. Deleting it will break their listings. Are you SURE?`, type: 'danger', confirmText: 'Yes, Delete Anyway' })) return;
        } else {
            if (!await confirm({ title: 'Delete Product?', message: 'This action cannot be undone.', type: 'danger', confirmText: 'Delete' })) return;
        }

        try {
            await deleteMasterProduct(selectedProduct.master_product_id);
            addNotification({ type: 'system', title: 'Deleted', message: 'Product removed from Master Catalog.' });
            setSelectedProduct(null);
        } catch (e: any) {
            addNotification({ type: 'alert', title: 'Error', message: e.message });
        }
    };

    // Count active merchant listings for selected product
    useEffect(() => {
        if (!selectedProduct?.master_product_id) {
            setMerchantCount(0);
            return;
        }

        const q = query(
            collection(db, 'merchant_products'),
            where('master_product_id', '==', selectedProduct.master_product_id)
        );

        const unsubscribe = onSnapshot(q, (snapshot: any) => {
            setMerchantCount(snapshot.size);
        });

        return () => unsubscribe();
    }, [selectedProduct]);

    // --- CATALOG TAB LOGIC ---
    // const categories = Array.from(new Set(masterProducts.map(item => item.category_id).filter(Boolean))).sort();
    const categories = PRODUCT_CATEGORIES;

    const filteredItems = masterProducts.filter(item => {
        const matchesSearch =
            item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.upc_gtin && item.upc_gtin.includes(searchQuery));
        const matchesCategory = filterCategory ? item.category_id === filterCategory : true;
        return matchesSearch && matchesCategory;
    });
    const handleImportUPC = async () => {
        if (!importUpc.trim()) return;
        setImporting(true);
        try {
            const result = await fetchExternalUPC(importUpc);
            setSelectedProduct(result as MasterProduct);
            addNotification({ type: 'system', title: 'UPC Resolved', message: `Found ${result.product_name} in external database.` });
        } catch (err: any) {
            addNotification({ type: 'alert', title: 'Failure', message: err.message });
        } finally {
            setImporting(false);
            setImportUpc('');
        }
    };

    const handleCommit = async () => {
        if (!selectedProduct) return;
        console.log('[Admin handleCommit] Starting commit for:', selectedProduct.product_name);
        setImporting(true);
        try {
            console.log('[Admin handleCommit] Calling addMasterProduct with:', selectedProduct);
            await addMasterProduct({
                ...selectedProduct,
                verification_status: 'verified',
                status: 'active'
            });
            console.log('[Admin handleCommit] ✅ Successfully committed');
            addNotification({ type: 'system', title: 'Committed', message: `${selectedProduct.product_name} added to Master Catalog.` });
            setSelectedProduct(null);
        } catch (err: any) {
            console.error('[Admin handleCommit] ❌ Failed:', err.message, err);
            addNotification({ type: 'alert', title: 'Commit Failed', message: err.message });
        } finally {
            setImporting(false);
        }
    };
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
                    name: request.requested_product_name || 'Unknown Product',
                    brand: request.requested_brand || '',
                    category: request.requested_category || 'general',
                    image: request.requested_image_url || 'https://placehold.co/100',
                    description: request.requested_description || '',
                    barcode: request.requested_barcode || null
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

    const handleCommitPending = async (pending: any) => {
        const confirmed = await confirm({
            title: 'Commit to Master Catalog?',
            message: `Add "${pending.product_name}" to the official Master Catalog?`,
            confirmText: 'Commit',
            type: 'info'
        });
        if (confirmed) {
            try {
                await commitPendingProduct(pending.id, pending);
                addNotification({ type: 'system', title: '✅ Committed', message: 'Product added to Master Catalog.' });
            } catch (err) {
                addNotification({ type: 'alert', title: 'Error', message: 'Failed to commit product.' });
            }
        }
    };

    const handleRejectPending = async (pending: any) => {
        const confirmed = await confirm({
            title: 'Reject Pending Product?',
            message: `Remove "${pending.product_name}" from pending review?`,
            confirmText: 'Reject',
            type: 'danger'
        });
        if (confirmed) {
            try {
                await rejectPendingProduct(pending.id);
                addNotification({ type: 'system', title: 'Rejected', message: 'Pending product removed.' });
            } catch (err) {
                addNotification({ type: 'alert', title: 'Error', message: 'Failed to reject.' });
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
                        Facilitator View: Manage product identity, classification, and hygiene.
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[var(--glass-border)] mb-6">
                <button
                    onClick={() => setActiveTab('catalog')}
                    className={`px-6 py-3 font-bold border-b-2 transition-colors ${activeTab === 'catalog' ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]' : 'border-transparent text-gray-500'}`}
                >
                    Master Products ({masterProducts.length})
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
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`px-6 py-3 font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'pending' ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]' : 'border-transparent text-gray-500'}`}
                >
                    Pending Review
                    {pendingProducts.length > 0 && (
                        <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingProducts.length}</span>
                    )}
                </button>
            </div>

            {/* CATALOG VIEW */}
            {activeTab === 'catalog' && (
                <div className="animate-fade-in">
                    {/* UPC Ingester Tool */}
                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-purple-900">
                            <span className="text-2xl">⚡</span>
                            <div>
                                <span className="font-bold block">Smart Barcode Resolver</span>
                                <span className="text-xs">Import high-fidelity data instantly from Open Food Facts</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Enter GTIN/UPC barcode..."
                                value={importUpc}
                                onChange={e => setImportUpc(e.target.value)}
                                className="px-3 py-2 border rounded-lg text-sm w-64 outline-none focus:border-purple-400"
                            />
                            <button
                                onClick={handleImportUPC}
                                disabled={importing || !importUpc}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 disabled:bg-purple-300"
                            >
                                {importing ? 'Resolving...' : 'Import Barcode'}
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-3 mb-6">
                        <div className="flex-1 relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                            <input
                                type="text"
                                placeholder="Search products, brand, or UPC..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm border border-[var(--glass-border)] rounded-lg outline-none focus:border-[var(--brand-primary)]"
                            />
                        </div>
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="w-full md:w-48 px-3 py-2 text-sm border border-[var(--glass-border)] rounded-lg outline-none bg-white"
                        >
                            <option value="">All Categories</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="bg-white rounded-xl border border-[var(--glass-border)] shadow-sm overflow-hidden">
                        {/* Desktop Table View */}
                        <div className="hidden md:block">
                            <table className="w-full text-left">
                                <thead className="bg-[var(--surface-1)] border-b border-[var(--glass-border)]">
                                    <tr>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Identity</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Category</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Packaging</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Status</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] text-right">Usage</th>
                                        <th className="p-4 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--glass-border)]">
                                    {loading && <tr><td colSpan={6} className="p-8 text-center text-gray-400">Loading catalog...</td></tr>}
                                    {filteredItems.map(item => (
                                        <tr key={item.master_product_id} className="hover:bg-[var(--surface-1)] transition-colors group">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <img src={item.primary_image_url || 'https://placehold.co/50'} className="w-10 h-10 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
                                                    <div className="min-w-0">
                                                        <div className="font-bold text-[var(--text-main)] truncate text-sm">{item.product_name}</div>
                                                        <div className="text-[10px] text-[var(--text-muted)] flex gap-2">
                                                            <span>{item.brand_name}</span>
                                                            {item.upc_gtin && <span className="font-mono bg-gray-100 px-1 rounded">{item.upc_gtin}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-xs capitalize">{item.category_id.replace(/^cat-/, '').replace(/-/g, ' ')}</div>
                                                <div className="text-[10px] text-[var(--text-muted)]">{item.product_type}</div>
                                            </td>
                                            <td className="p-4 text-xs">
                                                {item.net_quantity_value} {item.net_quantity_unit}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${item.status === 'active' ? 'bg-green-100 text-green-700 border border-green-200' :
                                                    item.status === 'deprecated' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-red-100 text-red-700 border border-red-200'
                                                    }`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <MerchantCountCell masterProductId={item.master_product_id} />
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => setSelectedProduct(item)}
                                                    className="px-3 py-1 text-[10px] border rounded-lg hover:bg-gray-50 font-bold"
                                                >
                                                    Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden divide-y divide-[var(--glass-border)] bg-[var(--surface-1)]">
                            {loading && <div className="p-8 text-center text-gray-400">Loading...</div>}
                            {filteredItems.map(item => (
                                <div key={item.master_product_id} className="p-4 space-y-4 hover:bg-[var(--surface-2)] transition-colors" onClick={() => setSelectedProduct(item)}>
                                    <div className="flex gap-3">
                                        <img src={item.primary_image_url || 'https://placehold.co/50'} className="w-16 h-16 rounded-xl object-cover bg-gray-100 border border-gray-200 shadow-sm" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${item.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                    {item.status}
                                                </span>
                                                {item.upc_gtin && <span className="font-mono text-[8px] bg-gray-100 px-1 rounded text-[var(--text-muted)]">{item.upc_gtin}</span>}
                                            </div>
                                            <div className="font-bold text-[var(--text-main)] text-sm leading-tight mb-1">{item.product_name}</div>
                                            <div className="text-xs text-[var(--text-muted)]">{item.brand_name}</div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-white/50 p-2 rounded-lg border border-[var(--glass-border)]">
                                            <p className="text-[8px] uppercase font-bold text-[var(--text-muted)] mb-0.5">Category</p>
                                            <p className="text-[10px] font-bold text-[var(--text-main)] truncate capitalize">{item.category_id.replace(/^cat-/, '').replace(/-/g, ' ')}</p>
                                        </div>
                                        <div className="bg-white/50 p-2 rounded-lg border border-[var(--glass-border)]">
                                            <p className="text-[8px] uppercase font-bold text-[var(--text-muted)] mb-0.5">Size</p>
                                            <p className="text-[10px] font-bold text-[var(--text-main)] truncate">{item.net_quantity_value} {item.net_quantity_unit}</p>
                                        </div>
                                        <div className="bg-white/50 p-2 rounded-lg border border-[var(--glass-border)]">
                                            <p className="text-[8px] uppercase font-bold text-[var(--text-muted)] mb-0.5">Stores</p>
                                            <div className="flex items-center gap-1">
                                                <MerchantCountCell masterProductId={item.master_product_id} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
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
                        <div key={req.id} className="bg-white p-4 md:p-6 rounded-xl border border-[var(--glass-border)] shadow-sm flex flex-col md:flex-row gap-6">
                            {/* Image Preview */}
                            <div className="w-full md:w-48 flex flex-col gap-2">
                                <div className="w-full h-48 md:h-48 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden relative">
                                    {req.requested_image_url ? (
                                        <img src={req.requested_image_url} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                                    )}
                                    <div className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] uppercase font-bold px-2 py-1 rounded">
                                        Product
                                    </div>
                                </div>
                                {req.requested_barcode_image_url && (
                                    <div className="w-full h-24 bg-gray-100 rounded-lg overflow-hidden relative border cursor-pointer hover:opacity-90" onClick={() => window.open(req.requested_barcode_image_url, '_blank')}>
                                        <img src={req.requested_barcode_image_url} className="w-full h-full object-cover" />
                                        <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[8px] uppercase font-bold px-1 rounded">Barcode Proof</div>
                                    </div>
                                )}
                            </div>

                            {/* Details */}
                            <div className="flex-1 space-y-4">
                                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                    <div>
                                        <h3 className="text-lg md:text-xl font-bold">{req.requested_product_name}</h3>
                                        <p className="text-sm text-gray-500">{req.requested_brand} • {req.requested_category}</p>
                                    </div>
                                    <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto p-2 md:p-0 bg-green-50 md:bg-transparent rounded-lg md:rounded-none">
                                        <span className="text-[10px] text-gray-400 uppercase font-bold">Confidence</span>
                                        <div className="flex items-center gap-2">
                                            <div className="h-1.5 w-16 md:w-24 bg-gray-200 rounded-full overflow-hidden">
                                                <div className="h-full bg-green-500 w-[85%]"></div>
                                            </div>
                                            <span className="text-[10px] font-bold text-green-600">85%</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 p-3 md:p-4 bg-gray-50 rounded-lg text-[10px] md:text-sm">
                                    <div>
                                        <span className="text-gray-500 block text-[9px] uppercase font-bold mb-0.5">Barcode</span>
                                        <span className="font-mono font-bold break-all">{req.requested_barcode || "N/A"}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-[9px] uppercase font-bold mb-0.5">Merchant</span>
                                        <span className="font-mono truncate block">{req.submitted_by_merchant_id}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-[9px] uppercase font-bold mb-0.5">Submitted</span>
                                        <span>Just now</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-[9px] uppercase font-bold mb-0.5">Source</span>
                                        <span>App</span>
                                    </div>
                                </div>

                                <div className="text-xs md:text-sm text-gray-700">
                                    <span className="font-bold">Description: </span>
                                    {req.requested_description || "No description provided."}
                                </div>

                                {(() => {
                                    const duplicate = req.requested_barcode && masterProducts.find(p =>
                                        p.barcode === req.requested_barcode ||
                                        (p.upc_gtin && p.upc_gtin.includes(req.requested_barcode))
                                    );

                                    if (duplicate) {
                                        return (
                                            <div className="border text-[10px] rounded p-2 bg-red-50 border-red-100 text-red-800 mt-2 flex justify-between items-center">
                                                <span>
                                                    <strong>⚠️ Duplicate:</strong> "{duplicate.product_name}"
                                                </span>
                                                <button
                                                    onClick={() => { setSelectedProduct(duplicate); setActiveTab('catalog'); }}
                                                    className="underline text-red-900 font-bold"
                                                >
                                                    View
                                                </button>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>

                            {/* Actions */}
                            <div className="flex md:flex-col gap-2 justify-center border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-6 min-w-0 md:min-w-[150px]">
                                <button
                                    onClick={() => handleApprove(req)}
                                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-sm text-sm"
                                >
                                    ✓ Approve
                                </button>
                                <button
                                    onClick={() => handleReject(req)}
                                    className="flex-1 px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-medium rounded-lg text-sm"
                                >
                                    ✕ Reject
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* DETAIL MODAL - Optimized as Side Panel or Fullscreen on mobile */}
            {selectedProduct && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex justify-end">
                    <div className="w-full md:max-w-2xl bg-white h-full shadow-2xl overflow-y-auto animate-slide-in-right">
                        <div className="sticky top-0 bg-white border-b p-4 md:p-6 flex justify-between items-center z-10">
                            <div className="flex-1 mr-4 min-w-0">
                                {isEditing ? (
                                    <input
                                        className="text-lg md:text-xl font-bold border-b border-gray-300 focus:border-blue-500 outline-none w-full"
                                        value={editForm.product_name || ''}
                                        onChange={e => setEditForm({ ...editForm, product_name: e.target.value })}
                                        placeholder="Product Name"
                                    />
                                ) : (
                                    <h2 className="text-lg md:text-xl font-bold truncate">{selectedProduct.product_name}</h2>
                                )}
                                <p className="text-[10px] text-gray-500 font-mono truncate">{selectedProduct.master_product_id}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {isEditing ? (
                                    <>
                                        <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded text-xs font-medium">Cancel</button>
                                        <button onClick={handleUpdate} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold text-xs">Save</button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={handleDelete} className="p-2 text-red-500 hover:bg-red-50 rounded" title="Delete Product">
                                            <span className="text-base">🗑️</span>
                                        </button>
                                        <button onClick={() => setIsEditing(true)} className="p-2 md:px-4 md:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-xs flex items-center gap-2">
                                            <span>✏️</span> <span className="hidden md:inline">Edit</span>
                                        </button>
                                        <button onClick={() => setSelectedProduct(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600">✕</button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="p-4 md:p-6 space-y-6 md:space-y-8">
                            {/* Identity Section */}
                            <section>
                                <h3 className="text-[10px] font-bold uppercase text-gray-400 mb-4 border-b pb-2 tracking-widest">A. Identity & Classification</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                    <div className="bg-gray-50 md:bg-transparent p-3 md:p-0 rounded-xl">
                                        <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Brand Name</label>
                                        {isEditing ? (
                                            <input className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-500 bg-white" value={editForm.brand_name || ''} onChange={e => setEditForm({ ...editForm, brand_name: e.target.value })} />
                                        ) : <span className="font-bold text-sm">{selectedProduct.brand_name}</span>}
                                    </div>
                                    <div className="bg-gray-50 md:bg-transparent p-3 md:p-0 rounded-xl">
                                        <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">UPC / GTIN</label>
                                        {isEditing ? (
                                            <input className="w-full px-3 py-2 text-sm border rounded-lg font-mono outline-none focus:border-blue-500 bg-white" value={editForm.upc_gtin || ''} onChange={e => setEditForm({ ...editForm, upc_gtin: e.target.value, barcode: e.target.value })} />
                                        ) : <span className="font-mono bg-white md:bg-gray-100 px-2 py-1 rounded text-xs border md:border-none">{selectedProduct.upc_gtin || 'N/A'}</span>}
                                    </div>
                                    <div className="bg-gray-50 md:bg-transparent p-3 md:p-0 rounded-xl">
                                        <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Category</label>
                                        {isEditing ? (
                                            <select className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-500 bg-white" value={editForm.category_id} onChange={e => setEditForm({ ...editForm, category_id: e.target.value })}>
                                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        ) : <span className="font-bold text-sm capitalize">{selectedProduct.category_id.replace(/^cat-/, '').replace(/-/g, ' ')}</span>}
                                    </div>
                                    <div className="bg-gray-50 md:bg-transparent p-3 md:p-0 rounded-xl">
                                        <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Status</label>
                                        {isEditing ? (
                                            <select className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500 bg-white text-sm" value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value as any })}>
                                                <option value="active">Active</option>
                                                <option value="deprecated">Deprecated</option>
                                                <option value="blocked">Blocked</option>
                                            </select>
                                        ) : <span className={`px-2 py-1 rounded-full text-[10px] font-bold w-fit border ${selectedProduct.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{selectedProduct.status.toUpperCase()}</span>}
                                    </div>
                                </div>
                            </section>

                            {/* Logistics */}
                            <section>
                                <h3 className="text-[10px] font-bold uppercase text-gray-400 mb-4 border-b pb-2 tracking-widest">B. Logistics & Media</h3>
                                <div className="flex flex-col md:flex-row gap-6">
                                    <div className="w-full md:w-40 h-40 bg-gray-50 border rounded-2xl flex items-center justify-center p-4 relative group">
                                        <img src={editForm.primary_image_url || '/placeholder.png'} className="max-w-full max-h-full object-contain" />
                                        {isEditing && <button className="absolute inset-0 bg-black/40 text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">CHANGE IMAGE</button>}
                                    </div>
                                    <div className="flex-1 space-y-4">
                                        <div className="bg-gray-50 md:bg-transparent p-3 md:p-0 rounded-xl">
                                            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Packaging Size</label>
                                            {isEditing ? (
                                                <div className="flex gap-2">
                                                    <input type="number" className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-500 bg-white" value={editForm.net_quantity_value || ''} onChange={e => setEditForm({ ...editForm, net_quantity_value: Number(e.target.value) })} />
                                                    <input className="w-24 px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-500 bg-white" value={editForm.net_quantity_unit || ''} onChange={e => setEditForm({ ...editForm, net_quantity_unit: e.target.value })} />
                                                </div>
                                            ) : <span className="font-bold text-sm">{selectedProduct.net_quantity_value} {selectedProduct.net_quantity_unit} / {selectedProduct.package_count || 1}pk</span>}
                                        </div>
                                        <div className="bg-gray-50 md:bg-transparent p-3 md:p-0 rounded-xl">
                                            <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Image Reference</label>
                                            {isEditing ? (
                                                <input className="w-full px-3 py-2 text-xs border rounded-lg font-mono outline-none focus:border-blue-500 bg-white" value={editForm.primary_image_url || ''} onChange={e => setEditForm({ ...editForm, primary_image_url: e.target.value })} />
                                            ) : <a href={selectedProduct.primary_image_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline break-all block truncate">{selectedProduct.primary_image_url}</a>}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Usage */}
                            <section className="bg-blue-50 border border-blue-100 p-4 md:p-6 rounded-2xl">
                                <h3 className="text-[10px] font-bold uppercase text-blue-400 mb-4 border-b border-blue-100 pb-2 tracking-widest">Platform Footprint</h3>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <span className="text-3xl font-bold text-blue-700">{merchantCount}</span>
                                        <span className="block text-[10px] text-blue-800 font-bold uppercase tracking-tight">Active Listings</span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-blue-700/60 max-w-[150px]">Propagation speed: Instant (Real-time DB Sync)</p>
                                    </div>
                                </div>
                            </section>

                            <div className="h-10"></div>
                        </div>
                    </div>
                </div>
            )}

            {/* PENDING PRODUCTS VIEW */}
            {activeTab === 'pending' && (
                <div className="animate-fade-in space-y-4">
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 mb-6 flex items-center gap-3">
                        <span className="text-2xl shrink-0">⌛</span>
                        <div>
                            <h3 className="font-bold text-orange-900 text-sm">Merchant Discoveries</h3>
                            <p className="text-[10px] text-orange-700">Review products discovered by merchants before global commitment.</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {pendingProducts.map(pending => (
                            <div key={pending.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-orange-300 transition-colors flex flex-col md:flex-row gap-4 items-start md:items-center">
                                <div className="flex items-center gap-4 w-full">
                                    <img
                                        src={pending.primary_image_url || '/placeholder.png'}
                                        className="w-16 h-16 rounded-lg object-cover border shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <h3 className="font-bold text-sm truncate">{pending.product_name}</h3>
                                            <span className="text-[8px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-bold shrink-0">PENDING</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mb-1">{pending.brand_name}</p>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-gray-400 font-medium">
                                            <span>📦 {pending.original_barcode || pending.barcode}</span>
                                            <span>🏦 Merchant: {pending.discovered_by_merchant?.substring(0, 8)}...</span>
                                            <span>🌐 Source: {pending.data_source || 'external'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-t-0 border-gray-100">
                                    <button
                                        onClick={() => handleCommitPending(pending)}
                                        className="flex-1 md:w-24 py-2 bg-green-600 text-white font-bold rounded-lg text-xs"
                                    >
                                        ✅ Commit
                                    </button>
                                    <button
                                        onClick={() => handleRejectPending(pending)}
                                        className="flex-1 md:w-24 py-2 bg-red-50 text-red-600 font-bold rounded-lg text-xs"
                                    >
                                        ❌ Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
export default MasterCatalog;
