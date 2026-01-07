import React, { useState, useEffect } from 'react';
import { useCatalog, MasterProduct } from '../../hooks/useCatalog';
import { useNotifications } from '../../context/NotificationContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';

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
        fetchExternalUPC, addMasterProduct,
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
    const categories = Array.from(new Set(masterProducts.map(item => item.category_id).filter(Boolean))).sort();

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
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                        <div className="flex-1">
                            <input
                                type="text"
                                placeholder="Search by name, brand, or UPC/GTIN..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg outline-none focus:border-[var(--brand-primary)]"
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
                                                    <div className="font-bold text-[var(--text-main)] truncate">{item.product_name}</div>
                                                    <div className="text-xs text-[var(--text-muted)] flex gap-2">
                                                        <span>{item.brand_name}</span>
                                                        {item.upc_gtin && <span className="font-mono bg-gray-100 px-1 rounded">{item.upc_gtin}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-sm">{item.category_id}</div>
                                            <div className="text-xs text-[var(--text-muted)]">{item.product_type}</div>
                                        </td>
                                        <td className="p-4 text-sm">
                                            {item.net_quantity_value} {item.net_quantity_unit}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.status === 'active' ? 'bg-green-100 text-green-700' :
                                                item.status === 'deprecated' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
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
                                                className="px-3 py-1 text-xs border rounded hover:bg-gray-50"
                                            >
                                                View Details
                                            </button>
                                        </td>
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
                            <div className="w-full md:w-48 h-48 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden relative">
                                {req.requested_image_url ? (
                                    <img src={req.requested_image_url} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                                )}
                                <div className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] uppercase font-bold px-2 py-1 rounded">
                                    New Request
                                </div>
                            </div>

                            {/* Details */}
                            <div className="flex-1 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-xl font-bold">{req.requested_product_name}</h3>
                                        <p className="text-gray-500">{req.requested_brand} • {req.requested_category}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs text-gray-400 block mb-1">Confidence Score</span>
                                        <div className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                                            <div className="h-full bg-green-500 w-[85%]"></div>
                                        </div>
                                        <span className="text-xs font-bold text-green-600">85% Match (AI)</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg text-sm">
                                    <div>
                                        <span className="text-gray-500 block text-xs">Barcode / GTIN</span>
                                        <span className="font-mono font-bold">{req.requested_barcode || "N/A"}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-xs">Merchant</span>
                                        <span className="font-mono">{req.submitted_by_merchant_id}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-xs">Submitted</span>
                                        <span>Just now</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 block text-xs">Source</span>
                                        <span>Merchant App</span>
                                    </div>
                                </div>

                                <div className="text-sm text-gray-700">
                                    <span className="font-bold">Description: </span>
                                    {req.requested_description || "No description provided."}
                                </div>

                                {/* AI Suggestions Placeholder */}
                                <div className="border text-xs rounded p-2 bg-yellow-50 border-yellow-100 text-yellow-800">
                                    <strong>⚠️ Possible Duplicate Detected:</strong> We found "Coca-Cola 500ml" (MP-123) with similar attributes.
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-2 justify-center border-l pl-6 min-w-[150px]">
                                <button
                                    onClick={() => handleApprove(req)}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-sm w-full text-center"
                                >
                                    ✓ Approve
                                </button>
                                <button
                                    onClick={() => handleReject(req)}
                                    className="px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-medium rounded-lg w-full text-center"
                                >
                                    ✕ Reject
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* DETAIL MODAL */}
            {selectedProduct && (
                <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
                    <div className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto animate-slide-in-right">
                        <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center z-10">
                            <div>
                                <h2 className="text-xl font-bold">{selectedProduct.product_name}</h2>
                                <p className="text-sm text-gray-500">{selectedProduct.master_product_id} • {selectedProduct.status}</p>
                            </div>
                            <button onClick={() => setSelectedProduct(null)} className="p-2 hover:bg-gray-100 rounded-full">✕</button>
                        </div>

                        <div className="p-6 space-y-8">
                            {/* A. Identity */}
                            <section>
                                <h3 className="text-sm font-bold uppercase text-gray-400 mb-4 border-b pb-2">A. Identity & Classification</h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <span className="block text-sm text-gray-500">Brand Name</span>
                                        <span className="font-medium">{selectedProduct.brand_name}</span>
                                    </div>
                                    <div>
                                        <span className="block text-sm text-gray-500">UPC / GTIN</span>
                                        <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">{selectedProduct.upc_gtin || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="block text-sm text-gray-500">Category</span>
                                        <span className="font-medium">{selectedProduct.category_id}</span>
                                    </div>
                                    <div>
                                        <span className="block text-sm text-gray-500">Is Generic?</span>
                                        <span className="font-medium">{selectedProduct.is_generic ? 'Yes' : 'No'}</span>
                                    </div>
                                </div>
                            </section>

                            {/* B. Size & Packaging */}
                            <section>
                                <h3 className="text-sm font-bold uppercase text-gray-400 mb-4 border-b pb-2">B. Size & Packaging</h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <span className="block text-sm text-gray-500">Net Quantity</span>
                                        <span className="font-medium">{selectedProduct.net_quantity_value} {selectedProduct.net_quantity_unit}</span>
                                    </div>
                                    <div>
                                        <span className="block text-sm text-gray-500">Package Count</span>
                                        <span className="font-medium">{selectedProduct.package_count} pk</span>
                                    </div>
                                    <div>
                                        <span className="block text-sm text-gray-500">Storage Type</span>
                                        <span className="font-medium capitalize">{selectedProduct.storage_type}</span>
                                    </div>
                                    <div>
                                        <span className="block text-sm text-gray-500">Unit of Sale</span>
                                        <span className="font-medium">{selectedProduct.is_sold_by_weight ? 'Sold by Weight' : 'Sold by Each'}</span>
                                    </div>
                                </div>
                            </section>

                            {/* C. Commerce & Tax */}
                            <section>
                                <h3 className="text-sm font-bold uppercase text-gray-400 mb-4 border-b pb-2">C. Commerce & Tax</h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <span className="block text-sm text-gray-500">Tax Category</span>
                                        <span className="font-medium select-all bg-yellow-50 px-2 rounded">{selectedProduct.tax_category_id || 'zero_rated_grocery'}</span>
                                    </div>
                                    <div>
                                        <span className="block text-sm text-gray-500">Suggested Retail (SRP)</span>
                                        <span className="font-bold text-green-700">${selectedProduct.suggested_retail_price?.toFixed(2) || '0.00'}</span>
                                    </div>
                                </div>
                            </section>

                            {/* D. Media & Regional */}
                            <section>
                                <h3 className="text-sm font-bold uppercase text-gray-400 mb-4 border-b pb-2">D. Media & Regional Support</h3>
                                <div className="space-y-4">
                                    <div className="flex gap-4">
                                        <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center border flex-shrink-0">
                                            <img src={selectedProduct.primary_image_url} className="max-w-full max-h-full object-contain" />
                                        </div>
                                        <div className="flex-1 space-y-3">
                                            <div>
                                                <span className="block text-xs font-bold text-gray-400 uppercase">EN Description</span>
                                                <p className="text-sm text-gray-700">{selectedProduct.short_description || "No description."}</p>
                                            </div>
                                            {selectedProduct.short_description_fr && (
                                                <div>
                                                    <span className="block text-xs font-bold text-gray-400 uppercase">FR Description (Bilingual)</span>
                                                    <p className="text-sm text-gray-700 italic border-l-2 pl-2 border-blue-200">{selectedProduct.short_description_fr}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {selectedProduct.product_name_fr && (
                                        <div className="bg-blue-50/50 p-2 rounded text-sm italic">
                                            <span className="font-bold mr-2 text-blue-900">FR Name:</span> {selectedProduct.product_name_fr}
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* E. Logistics */}
                            <section>
                                <h3 className="text-sm font-bold uppercase text-gray-400 mb-4 border-b pb-2">E. Logistics</h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <span className="block text-sm text-gray-500">Dimensions (LxWxH)</span>
                                        <span className="font-medium">
                                            {selectedProduct.dimensions ? `${selectedProduct.dimensions.length}x${selectedProduct.dimensions.width}x${selectedProduct.dimensions.height} ${selectedProduct.dimensions.unit}` : 'N/A'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="block text-sm text-gray-500">Gross Weight</span>
                                        <span className="font-medium">{selectedProduct.weight_gross ? `${selectedProduct.weight_gross}g` : 'N/A'}</span>
                                    </div>
                                </div>
                            </section>

                            {/* F. Governance */}
                            <section>
                                <h3 className="text-sm font-bold uppercase text-gray-400 mb-4 border-b pb-2">F. Governance & Quality</h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <span className="block text-sm text-gray-500">Verification</span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${selectedProduct.verification_status === 'verified' ? 'bg-green-100 text-green-700' :
                                            selectedProduct.verification_status === 'manufacturer_verified' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                                            }`}>
                                            {selectedProduct.verification_status || 'Unverified'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="block text-sm text-gray-500">Data Source</span>
                                        <span className="font-medium capitalize">{selectedProduct.data_source || 'Admin'}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="block text-sm text-gray-500 mb-1">Search Keywords (Synonyms)</span>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedProduct.search_keywords?.map(kw => (
                                                <span key={kw} className="bg-gray-100 px-2 py-1 rounded text-xs text-gray-600">#{kw}</span>
                                            )) || <span className="text-xs text-gray-400">No keywords defined.</span>}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* E. Usage (Read Only) */}
                            <section>
                                <h3 className="text-sm font-bold uppercase text-gray-400 mb-4 border-b pb-2">E. Usage Signals</h3>
                                <div className="bg-blue-50 p-4 rounded-xl flex justify-between items-center">
                                    <div>
                                        <span className="text-2xl font-bold text-blue-700">{merchantCount}</span>
                                        <span className="block text-sm text-blue-600">Active Merchant Listings</span>
                                    </div>
                                    <div className="text-right">
                                        <button className="text-sm text-blue-700 font-bold hover:underline">View All Merchants →</button>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    Note: You cannot edit prices or inventory. Contact merchants directly for commerce issues.
                                </p>
                            </section>

                            {selectedProduct.data_source === 'open_food_facts' && selectedProduct.status !== 'active' && (
                                <div className="p-6 bg-purple-50 border-t border-purple-100 flex items-center justify-between sticky bottom-0">
                                    <div className="text-sm font-medium text-purple-900">
                                        Found in External DB. Save to Master?
                                    </div>
                                    <button
                                        onClick={handleCommit}
                                        disabled={importing}
                                        className="px-6 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 shadow-lg shadow-purple-500/20"
                                    >
                                        {importing ? 'Saving...' : 'Commit to Master Catalog'}
                                    </button>
                                </div>
                            )}

                            <div className="h-10"></div>
                        </div>
                    </div>
                </div>
            )}

            {/* PENDING PRODUCTS VIEW */}
            {activeTab === 'pending' && (
                <div className="animate-fade-in">
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 mb-6">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">⌛</span>
                            <div>
                                <h3 className="font-bold text-orange-900">Pending Merchant Discoveries</h3>
                                <p className="text-xs text-orange-700">Products scanned by merchants from external databases. Review and commit to make globally available.</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {pendingProducts.map(pending => (
                            <div key={pending.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-orange-300 transition-colors">
                                <div className="flex items-center gap-4">
                                    <img
                                        src={pending.primary_image_url || '/placeholder.png'}
                                        className="w-20 h-20 rounded-lg object-cover border"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-lg">{pending.product_name}</h3>
                                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-bold">PENDING</span>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">{pending.brand_name}</p>
                                        <div className="flex items-center gap-4 text-xs text-gray-500">
                                            <span>📦 {pending.original_barcode || pending.barcode}</span>
                                            <span>🏦 Discovered by: {pending.discovered_by_merchant}</span>
                                            <span>🌐 Source: {pending.data_source || 'external'}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleCommitPending(pending)}
                                            className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-sm"
                                        >
                                            ✅ Commit
                                        </button>
                                        <button
                                            onClick={() => handleRejectPending(pending)}
                                            className="px-4 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 shadow-sm"
                                        >
                                            ❌ Reject
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {pendingProducts.length === 0 && (
                            <div className="text-center py-12 text-gray-400">
                                <p className="text-4xl mb-4">✨</p>
                                <p className="font-bold">No pending products</p>
                                <p className="text-sm">Merchant-discovered products will appear here for review.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
export default MasterCatalog;
