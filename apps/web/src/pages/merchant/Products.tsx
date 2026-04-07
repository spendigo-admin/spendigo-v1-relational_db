import React, { useState, useEffect } from 'react';
import '../../styles/design-system.css';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { useCatalog, Product, generateBarcodeVariants } from '../../hooks/useCatalog';
import { useStoreProducts } from '../../hooks/useStoreProducts';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { compressImage } from '../../utils/imageOptimizer';
import { PRODUCT_CATEGORIES } from '../../data/categories';

// Scanner Component
const ScannerModal: React.FC<{ onClose: () => void, onScan: (result: string) => void }> = ({ onClose, onScan }) => {
    const [mountError, setMountError] = useState('');

    useEffect(() => {
        const timeout = setTimeout(() => {
            try {
                const scanner = new Html5QrcodeScanner(
                    "reader",
                    { fps: 10, qrbox: { width: 280, height: 150 }, aspectRatio: 1.0 },
                    false
                );
                scanner.render((decodedText) => {
                    onScan(decodedText);
                    scanner.clear().catch(console.error);
                }, (error) => {
                    // console.warn(error); 
                });
                return () => { scanner.clear().catch(() => { }); };
            } catch (err) {
                console.error("Scanner init error", err);
                setMountError('Camera permission denied or not available.');
            }
        }, 100);
        return () => clearTimeout(timeout);
    }, [onScan]);

    return (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl overflow-hidden w-full max-w-sm relative p-6">
                <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-black z-10 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full">✕</button>
                <h3 className="text-center font-bold mb-4">Scan Barcode</h3>
                {mountError ? (
                    <div className="text-red-500 text-center py-4">{mountError}</div>
                ) : (
                    <div id="reader" className="w-full bg-gray-50 rounded-lg overflow-hidden min-h-[300px]"></div>
                )}
                <p className="text-center mt-4 text-xs text-gray-400">Point camera at a barcode to scan</p>
            </div>
        </div>
    );
};

const MerchantProducts: React.FC = () => {
    const { user, can } = useAuth();
    const { addNotification } = useNotifications();
    const { confirm } = useConfirmation();

    // New Hook Usage
    const {
        // useStoreProducts, // Switched to standalone
        searchMasterCatalog,
        addMerchantProduct,
        updateMerchantProduct,
        deleteMerchantProduct,
        requestMasterProduct,
        bulkAddMerchantProducts,
        fetchExternalUPC,
        addMasterProduct,
        addPendingMasterProduct
    } = useCatalog();

    const storeId = user?.storeId || '';
    const hasWriteAccess = can('products:write');

    const { products, loading } = useStoreProducts(storeId);

    // UI State
    const [showAddModal, setShowAddModal] = useState(false);
    const [view, setView] = useState<'list' | 'search_master' | 'add_details' | 'request_new' | 'bulk_upload' | 'bulk_summary'>('list');

    const [searchQuery, setSearchQuery] = useState('');
    const [masterSearchQuery, setMasterSearchQuery] = useState('');
    const [masterSearchResults, setMasterSearchResults] = useState<any[]>([]);
    const [selectedMasterItem, setSelectedMasterItem] = useState<any | null>(null);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [restockProduct, setRestockProduct] = useState<Product | null>(null);
    const [restockQty, setRestockQty] = useState(1);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [bulkText, setBulkText] = useState('');
    const [bulkProcessing, setBulkProcessing] = useState(false);
    const [bulkResults, setBulkResults] = useState<{ success: number, failed: number, errors: string[] } | null>(null);
    const [searching, setSearching] = useState(false);

    const [showScanner, setShowScanner] = useState(false);
    const [scannerContext, setScannerContext] = useState<'search' | 'request_form'>('search');

    // Form State
    const [form, setForm] = useState({
        price: '',
        stock: '100',
        reqBarcode: '',
        reqName: '',
        reqBrand: '',
        reqCategory: 'General',
        reqDescription: '',
        reqImage: '',
        reqBarcodeImage: ''
    });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [barcodeFile, setBarcodeFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [barcodeLocked, setBarcodeLocked] = useState(false);

    // Handlers

    const handleDeleteProduct = async (product: Product) => {
        const confirmed = await confirm({
            title: 'Remove Product?',
            message: `Are you sure you want to remove "${product.name}" from your store? This cannot be undone.`,
            confirmText: 'Remove',
            type: 'danger'
        });

        if (confirmed) {
            setDeletingId(product.id);
            try {
                await deleteMerchantProduct(storeId, product.id);
                addNotification({ type: 'system', title: 'Removed', message: 'Product removed from available inventory.' });
            } catch (err) {
                console.error(err);
                addNotification({ type: 'alert', title: 'Error', message: 'Could not remove product.' });
            } finally {
                setDeletingId(null);
            }
        }
    };

    const handleMasterSearch = async (query: string) => {
        const cleanQuery = query.trim().replace(/[^a-zA-Z0-9]/g, '');
        const strippedQuery = cleanQuery.replace(/^0+/, ''); // Fuzzy match for UPC/EAN
        setMasterSearchQuery(query);

        if (cleanQuery.length > 2) {
            setSearching(true);
            try {
                const results = await searchMasterCatalog(cleanQuery);

                // Smart Discovery: Only auto-trigger if it looks like a barcode
                const isBarcode = /^\d+$/.test(cleanQuery) && cleanQuery.length >= 8;

                // CHECK INVENTORY FIRST
                if (isBarcode) {
                    const variants = generateBarcodeVariants(cleanQuery);
                    console.log(`[MerchantProducts] Checking inventory for barcode variants:`, variants);

                    const existing = products.find(p => {
                        const match = (p.barcode && variants.includes(p.barcode)) ||
                            (p.merchant_sku && variants.includes(p.merchant_sku));
                        if (match) console.log(`[MerchantProducts] Found match: ${p.name} (${p.barcode})`);
                        return match;
                    });

                    if (existing) {
                        setRestockProduct(existing);
                        setRestockQty(1);
                        return; // Stop search, show restock UI
                    }
                }

                // Check if we have an EXACT match already (accounting for leading zero variance)
                const exactLocalMatch = results.find((r: any) =>
                    r.barcode === cleanQuery ||
                    (r.barcode && r.barcode.replace(/^0+/, '') === strippedQuery)
                );

                if (isBarcode && !exactLocalMatch) {
                    const success = await handleGlobalDiscovery(cleanQuery);
                    if (success) return;
                }

                setMasterSearchResults(results);
            } finally {
                setSearching(false);
            }
        } else {
            setMasterSearchResults([]);
        }
    };

    const handleGlobalDiscovery = async (barcode: string) => {
        setSearching(true);
        addNotification({ type: 'system', title: 'Searching Global...', message: 'Checking external databases for barcode info...' });

        try {
            const externalProduct = await fetchExternalUPC(barcode);
            if (externalProduct) {
                const newMasterId = await addPendingMasterProduct(externalProduct as any, storeId, barcode);
                addNotification({
                    type: 'system',
                    title: '✨ Smart Match Found!',
                    message: `Found "${externalProduct.product_name}". Saved for admin review.`
                });
                selectMasterItem({ ...externalProduct, id: newMasterId });
                return true;
            }
        } catch (extErr: any) {
            console.warn("External search failed", extErr);
            addNotification({ type: 'alert', title: 'Not Found', message: 'This item is not in our global database yet.' });
        } finally {
            setSearching(false);
        }
        return false;
    };

    const selectMasterItem = (item: any) => {
        setSelectedMasterItem(item);
        setView('add_details');
        setForm(f => ({ ...f, price: '', stock: '100' }));
    };

    const handleAddProduct = async () => {
        if (!storeId || !selectedMasterItem) return;

        try {
            await addMerchantProduct(storeId, selectedMasterItem.id, parseFloat(form.price) || 0, parseInt(form.stock) || 0);
            addNotification({ type: 'system', title: 'Product Added', message: `${selectedMasterItem.product_name} added to your store.` });
            closeModal();
        } catch (err: any) {
            console.error(err);
            addNotification({ type: 'alert', title: 'Error', message: 'Could not add product.' });
        }
    };

    const handleRequestProduct = async () => {
        if (!form.reqName || !form.reqBrand) {
            addNotification({ type: 'alert', title: 'Missing Info', message: 'Name and Brand are required.' });
            return;
        }

        setUploading(true);
        try {
            let finalImageUrl = form.reqImage;
            let finalBarcodeUrl = form.reqBarcodeImage;

            // Upload Product Image
            if (imageFile && (user?.storeId || user?.id)) {
                const ownerId = user?.storeId || user?.id;
                try {
                    const compressed = await compressImage(imageFile);
                    const path = `product-requests/${ownerId}/${Date.now()}_product_${compressed.name}`;
                    const storageRef = ref(storage, path);
                    await uploadBytes(storageRef, compressed);
                    finalImageUrl = await getDownloadURL(storageRef);
                } catch (imgErr: any) {
                    console.error("Product image upload failed", imgErr);
                    addNotification({ type: 'alert', title: 'Image Error', message: 'Failed to upload product photo, continuing...' });
                }
            }

            // Upload Barcode Image
            if (barcodeFile && (user?.storeId || user?.id)) {
                const ownerId = user?.storeId || user?.id;
                try {
                    const compressed = await compressImage(barcodeFile);
                    const path = `product-requests/${ownerId}/${Date.now()}_barcode_${compressed.name}`;
                    const storageRef = ref(storage, path);
                    await uploadBytes(storageRef, compressed);
                    finalBarcodeUrl = await getDownloadURL(storageRef);
                } catch (bcErr: any) {
                    console.error("Barcode image upload failed", bcErr);
                    addNotification({ type: 'alert', title: 'Image Error', message: 'Failed to upload barcode photo, continuing...' });
                }
            }

            await requestMasterProduct(user?.storeId || 'unknown', {
                name: form.reqName,
                brand: form.reqBrand,
                category: form.reqCategory,
                description: form.reqDescription,
                image: finalImageUrl,
                barcode: form.reqBarcode,
                barcodeImage: finalBarcodeUrl
            });
            addNotification({ type: 'system', title: 'Request Sent', message: 'Admin will review shortly.' });
            setView('search_master');
            setForm({ ...form, reqBarcode: '', reqName: '', reqBrand: '', reqDescription: '', reqImage: '', reqBarcodeImage: '' });
            setImageFile(null);
            setBarcodeFile(null);
        } catch (err: any) {
            console.error(err);
            addNotification({ type: 'alert', title: 'Error', message: err.message });
        } finally {
            setUploading(false);
        }
    };

    const handleBulkUpload = async () => {
        if (!bulkText.trim()) return;
        const lines = bulkText.split('\n');
        const items = [];

        // Robust CSV/Tab parsing with header skipping
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.includes('\t') ? line.split('\t') : line.split(',');
            const [barcode, price, qty] = parts.map(s => s.trim().replace(/"/g, ''));

            // Skip header if it contains words
            if (i === 0 && (barcode.toLowerCase().includes('upc') || barcode.toLowerCase().includes('barcode'))) continue;

            if (barcode && price && qty) {
                items.push({ barcode, price: parseFloat(price), quantity: parseInt(qty) });
            }
        }

        if (items.length === 0) {
            addNotification({ type: 'alert', title: 'Invalid Format', message: 'Please ensure CSV follows: barcode, price, qty' });
            return;
        }

        setBulkProcessing(true);
        try {
            const results = await bulkAddMerchantProducts(storeId, items);
            setBulkResults(results);
            setView('bulk_summary');
            addNotification({
                type: results.success > 0 ? 'system' : 'alert',
                title: 'Bulk Processing Complete',
                message: `✨ Smart mapped ${results.success} items.`
            });
        } catch (err: any) {
            console.error(err);
            addNotification({ type: 'alert', title: 'Upload Failed', message: err.message });
        } finally {
            setBulkProcessing(false);
        }
    };

    const downloadErrorReport = () => {
        if (!bulkResults || bulkResults.errors.length === 0) return;
        const content = bulkResults.errors.join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bulk_upload_errors_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleUpdateProduct = async () => {
        if (!editingProduct) return;
        try {
            await updateMerchantProduct(editingProduct.id, {
                price: parseFloat(form.price),
                available_quantity: parseInt(form.stock)
            });
            addNotification({ type: 'system', title: 'Updated', message: 'Product updated successfully.' });
            closeModal();
        } catch (err) {
            addNotification({ type: 'alert', title: 'Error', message: 'Update failed.' });
        }
    };

    const handleRestockConfirm = async () => {
        if (!restockProduct) return;
        try {
            const newQty = restockProduct.available_quantity + restockQty;
            await updateMerchantProduct(restockProduct.id, {
                available_quantity: newQty
            });
            addNotification({ type: 'system', title: 'Stock Updated', message: `Added ${restockQty} to inventory. Total: ${newQty}` });
            setRestockProduct(null);
            closeModal();
        } catch (err) {
            addNotification({ type: 'alert', title: 'Error', message: 'Restock failed.' });
        }
    };

    const openEdit = (product: Product) => {
        setEditingProduct(product);
        setForm(f => ({
            ...f,
            price: product.price.toString(),
            stock: product.available_quantity.toString()
        }));
        setView('add_details'); // Re-use view
        setShowAddModal(true);
    };

    const closeModal = () => {
        setShowAddModal(false);
        setView('list');
        setMasterSearchQuery('');
        setMasterSearchResults([]);
        setSelectedMasterItem(null);
        setEditingProduct(null);
        setRestockProduct(null);
        setBulkText('');
        setBulkProcessing(false);
        setForm({ price: '', stock: '50', reqName: '', reqBrand: '', reqDescription: '', reqImage: '', reqCategory: 'General', reqBarcode: '', reqBarcodeImage: '' });
    };

    // Filter local list
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.merchant_sku?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-main)]">Inventory</h1>
                    <p className="text-sm text-[var(--text-muted)]">{products.length} products sync with Master Catalog</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {hasWriteAccess && (
                        <>
                            <button
                                onClick={() => { setView('bulk_upload'); setShowAddModal(true); }}
                                className="flex-1 sm:flex-none px-4 py-2 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                            >
                                <span>📄</span> <span className="hidden sm:inline">Bulk</span> <span className="sm:hidden">Bulk Upload</span>
                            </button>
                            <button
                                onClick={() => { setView('search_master'); setShowAddModal(true); }}
                                className="flex-[2] sm:flex-none px-4 py-2 bg-[var(--brand-primary)] text-white font-medium rounded-lg hover:brightness-110 shadow-lg shadow-[var(--brand-primary)]/20 text-center"
                            >
                                + Add Product
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Search Local */}
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search existing inventory..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg focus:border-[var(--brand-primary)] outline-none"
                />
            </div>

            {/* Desktop View (Table) */}
            <div className="hidden md:block bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead className="bg-[var(--surface-1)]">
                        <tr>
                            <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Product</th>
                            <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Category</th>
                            <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Price</th>
                            <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Qty</th>
                            <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--glass-border)]">
                        {loading && <tr><td colSpan={5} className="p-8 text-center text-gray-400">Loading catalog...</td></tr>}
                        {!loading && filteredProducts.map(product => (
                            <tr key={product.id} className="hover:bg-[var(--surface-1)] transition-colors">
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <img src={product.image} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100" />
                                        <div>
                                            <span className="font-medium text-[var(--text-main)] block">{product.name}</span>
                                            <span className="text-xs text-gray-400">{product.brand_name}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 text-[var(--text-muted)] capitalize">{product.category.replace(/^cat-/, '').replace(/-/g, ' ')}</td>
                                <td className="p-4 font-medium text-[var(--text-main)]">${product.price.toFixed(2)}</td>
                                <td className="p-4">
                                    <span className={`${product.available_quantity < 10 ? 'text-orange-600 font-bold' : 'text-green-600'}`}>
                                        {product.available_quantity}
                                    </span>
                                </td>
                                <td className="p-4">
                                    {hasWriteAccess && (
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => openEdit(product)} className="text-[var(--brand-primary)] hover:underline font-bold text-sm">Edit</button>
                                            <button
                                                onClick={() => handleDeleteProduct(product)}
                                                disabled={deletingId === product.id}
                                                className="text-red-500 hover:text-red-700 hover:underline text-sm"
                                            >
                                                {deletingId === product.id ? 'Removing...' : 'Remove'}
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile View (Cards) */}
            <div className="md:hidden space-y-4">
                {loading && <div className="p-8 text-center text-gray-400 bg-white rounded-xl border border-[var(--glass-border)]">Loading catalog...</div>}
                {!loading && filteredProducts.map(product => (
                    <div key={product.id} className="bg-white rounded-xl border border-[var(--glass-border)] p-4 shadow-sm">
                        <div className="flex gap-3 mb-3">
                            <img src={product.image} alt="" className="w-16 h-16 rounded-lg object-cover bg-gray-100" />
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-[var(--text-main)] truncate block">{product.name}</div>
                                <div className="text-sm text-gray-500 mb-1 truncate">{product.brand_name}</div>
                                <div className="text-[10px] text-[var(--text-muted)] capitalize bg-gray-100 inline-block px-2 py-0.5 rounded-full">{product.category.replace(/^cat-/, '').replace(/-/g, ' ')}</div>
                            </div>
                        </div>
                        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg mb-3">
                            <div>
                                <div className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">Price</div>
                                <div className="font-bold text-[var(--text-main)]">${product.price.toFixed(2)}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">Stock</div>
                                <div className={`${product.available_quantity < 10 ? 'text-orange-600 font-bold' : 'text-green-600 font-medium'}`}>
                                    {product.available_quantity} <span className="text-xs">units</span>
                                </div>
                            </div>
                        </div>
                        {hasWriteAccess && (
                            <div className="flex items-center gap-2 pt-2 border-t border-[var(--glass-border)]">
                                <button onClick={() => openEdit(product)} className="flex-1 py-2 text-center text-[var(--brand-primary)] font-bold text-sm bg-blue-50 rounded-lg">Edit</button>
                                <button 
                                    onClick={() => handleDeleteProduct(product)} 
                                    disabled={deletingId === product.id}
                                    className="flex-1 py-2 text-center text-red-600 font-bold text-sm bg-red-50 rounded-lg disabled:opacity-50"
                                >
                                    {deletingId === product.id ? 'Removing...' : 'Remove'}
                                </button>
                            </div>
                        )}
                    </div>
                ))}
                {!loading && filteredProducts.length === 0 && (
                    <div className="p-8 text-center text-gray-400 bg-white rounded-xl border border-[var(--glass-border)]">No products found.</div>
                )}
            </div>

            {/* MODAL */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">

                        {/* PHASE 1: SEARCH MASTER */}
                        {view === 'search_master' && (
                            <>
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-bold">Add from Master Catalog</h2>
                                    <div className="flex items-center gap-4">
                                        <button onClick={() => {
                                            const isBarcode = /^\d+$/.test(masterSearchQuery);
                                            setForm(f => ({ ...f, reqBarcode: isBarcode ? masterSearchQuery : '' }));
                                            setBarcodeLocked(isBarcode);
                                            setView('request_new');
                                        }} className="text-sm font-bold text-[var(--brand-primary)] hover:underline">
                                            Request Missing?
                                        </button>
                                        <button onClick={closeModal} className="text-gray-500 hover:text-black w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full">✕</button>
                                    </div>
                                </div>
                                <div className="mb-4 relative">
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 border rounded-lg"
                                        placeholder="Search by name, brand, barcode..."
                                        value={masterSearchQuery}
                                        onChange={e => handleMasterSearch(e.target.value)}
                                        autoFocus
                                    />
                                    <button onClick={() => { setScannerContext('search'); setShowScanner(true); }} className="absolute right-3 top-3 text-xl">📷</button>
                                </div>

                                <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                                    {searching && <div className="text-center py-4 text-purple-600 font-bold animate-pulse">Checking catalogues...</div>}
                                    {masterSearchResults.map(item => (
                                        <div key={item.id} onClick={() => selectMasterItem(item)} className="flex items-center gap-3 p-3 hover:bg-blue-50 cursor-pointer border rounded-lg">
                                            <img src={item.primary_image_url} className="w-10 h-10 rounded object-cover" />
                                            <div>
                                                <div className="font-bold">{item.product_name}</div>
                                                <div className="text-xs text-gray-500 flex gap-2 items-center">
                                                    <span>{item.brand_name}</span>
                                                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                                    <span>{item.net_quantity_value} {item.net_quantity_unit} {item.package_count > 1 ? `(${item.package_count} pk)` : ''}</span>
                                                </div>
                                                <div className="text-[10px] text-gray-400 font-mono mt-0.5">UPC: {item.barcode || 'N/A'}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {masterSearchQuery.length > 2 && masterSearchResults.length === 0 && !searching && (
                                        <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                            <p className="text-gray-500 mb-4">No local products found.</p>

                                            {/^\d+$/.test(masterSearchQuery.trim()) && (
                                                <button
                                                    onClick={() => handleGlobalDiscovery(masterSearchQuery.trim())}
                                                    className="px-6 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 shadow-lg shadow-purple-500/20 mb-3"
                                                >
                                                    🔍 Search Global Catalog
                                                </button>
                                            )}

                                            <div className="text-xs text-gray-400">
                                                Or <button onClick={() => setView('request_new')} className="text-[var(--brand-primary)] underline font-bold">Request a New Product</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}



                        {/* RESTOCK INTERCEPT MODAL */}
                        {(restockProduct) && (
                            <div className="text-center p-4">
                                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">📦</div>
                                <h2 className="text-2xl font-bold mb-2">Item Already in Stock!</h2>
                                <p className="text-gray-500 mb-6">
                                    You already have <strong className="text-black">{restockProduct.name}</strong> listed.
                                    <br />Current Quantity: <strong className="text-[var(--brand-primary)] text-lg">{restockProduct.available_quantity}</strong>
                                </p>

                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6 max-w-xs mx-auto">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Add to Stock</label>
                                    <div className="flex items-center justify-center gap-4">
                                        <button
                                            onClick={() => setRestockQty(q => Math.max(1, q - 1))}
                                            className="w-10 h-10 rounded-lg bg-white border border-gray-300 font-bold hover:bg-gray-100"
                                        >-</button>
                                        <div className="text-3xl font-bold w-16">{restockQty}</div>
                                        <button
                                            onClick={() => setRestockQty(q => q + 1)}
                                            className="w-10 h-10 rounded-lg bg-white border border-gray-300 font-bold hover:bg-gray-100"
                                        >+</button>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={handleRestockConfirm}
                                        className="w-full py-4 bg-[var(--brand-primary)] text-white font-bold rounded-xl hover:brightness-110 shadow-lg text-lg"
                                    >
                                        Update Stock (+{restockQty})
                                    </button>
                                    <button
                                        onClick={() => { setRestockProduct(null); openEdit(restockProduct); }}
                                        className="w-full py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50"
                                    >
                                        Edit Details Instead
                                    </button>
                                    <button
                                        onClick={() => setRestockProduct(null)}
                                        className="w-full py-3 text-gray-400 font-medium hover:text-black"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* PHASE 2: EDIT/ADD DETAILS */}
                        {view === 'add_details' && !restockProduct && (selectedMasterItem || editingProduct) && (
                            <>
                                <h2 className="text-xl font-bold mb-4">{editingProduct ? 'Edit Inventory' : 'Add to Inventory'}</h2>

                                <div className="flex gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
                                    <img src={editingProduct?.image || selectedMasterItem?.primary_image_url} className="w-16 h-16 rounded object-cover" />
                                    <div>
                                        <div className="font-bold text-lg">{editingProduct?.name || selectedMasterItem?.product_name}</div>
                                        <div className="text-sm text-gray-500">Master Data (Read Only)</div>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-6">
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg">
                                        <span className="text-blue-600 text-lg">✨</span>
                                        <div className="text-xs">
                                            <span className="font-bold text-blue-900 block uppercase tracking-tight">Smart Mapping Active</span>
                                            <span className="text-blue-700">Configurations synced with Spendigo Master Catalog</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                            <span className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Tax Configuration</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">🧾</span>
                                                <div>
                                                    <span className="text-sm font-medium block">{(editingProduct?.tax_category_id || selectedMasterItem?.tax_category_id)?.replace(/_/g, ' ') || 'Zero Rated'}</span>
                                                    <span className="text-[10px] text-green-600 font-bold">Standard Grocery Rule</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                            <span className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Pricing Model</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">⚖️</span>
                                                <div>
                                                    <span className="text-sm font-medium block">{(editingProduct?.is_sold_by_weight || selectedMasterItem?.is_sold_by_weight) ? 'By Weight (lb/kg)' : 'By Each (per unit)'}</span>
                                                    <span className="text-[10px] text-gray-500">Auto-calculated at checkout</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 col-span-2">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <span className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Price Signal</span>
                                                    <div className="flex items-center gap-2 font-medium">
                                                        <span className="text-sm">Market SRP:</span>
                                                        <span className="text-sm text-green-700 font-bold">${(editingProduct?.suggested_retail_price || selectedMasterItem?.suggested_retail_price || 0).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                                {(parseFloat(form.price) > 0) && (
                                                    <div className={`text-right px-2 py-1 rounded text-xs font-bold ${parseFloat(form.price) <= (editingProduct?.suggested_retail_price || selectedMasterItem?.suggested_retail_price || 0)
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-orange-100 text-orange-700'
                                                        }`}>
                                                        {parseFloat(form.price) <= (editingProduct?.suggested_retail_price || selectedMasterItem?.suggested_retail_price || 0)
                                                            ? 'Competitive Price'
                                                            : 'Above Market SRP'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold mb-1">Price ($)</label>
                                        <input type="number" step="0.01" className="w-full p-3 border rounded-lg" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-1">Qty</label>
                                        <input type="number" className="w-full p-3 border rounded-lg" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
                                    </div>

                                    <div className="flex gap-3 pt-4">
                                        <button onClick={editingProduct ? handleUpdateProduct : handleAddProduct} className="flex-1 py-3 bg-[var(--brand-primary)] text-white w-full rounded-lg font-bold">
                                            {editingProduct ? 'Save Changes' : 'Add Product'}
                                        </button>
                                        <button onClick={closeModal} className="flex-1 py-3 border rounded-lg">Cancel</button>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* PHASE 3: REQUEST NEW */}
                        {view === 'request_new' && (
                            <>
                                <h2 className="text-xl font-bold mb-4">Request New Product</h2>
                                <p className="text-sm text-gray-500 mb-4">Help the community by adding new products to the Master Catalog.</p>

                                <div className="space-y-4">
                                    {/* Barcode Section */}
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Product Barcode</label>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <input
                                                    type="text"
                                                    placeholder="Scanned Barcode"
                                                    className={`w-full p-2 border rounded font-mono ${barcodeLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                                                    value={form.reqBarcode}
                                                    onChange={e => setForm({ ...form, reqBarcode: e.target.value })}
                                                    readOnly={barcodeLocked}
                                                />
                                                {barcodeLocked && (
                                                    <button onClick={() => { setBarcodeLocked(false); setForm(f => ({ ...f, reqBarcode: '' })); }} className="absolute right-2 top-2 text-gray-400 hover:text-red-500 text-xs font-bold px-2 py-1">
                                                        🔒 Clear
                                                    </button>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => { setScannerContext('request_form'); setShowScanner(true); }}
                                                className="px-3 bg-white border border-gray-300 rounded hover:bg-gray-50"
                                            >
                                                📷 Scan
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <input type="text" placeholder="Product Name" className="w-full p-3 border rounded-lg" value={form.reqName} onChange={e => setForm({ ...form, reqName: e.target.value })} />
                                        <input type="text" placeholder="Brand" className="w-full p-3 border rounded-lg" value={form.reqBrand} onChange={e => setForm({ ...form, reqBrand: e.target.value })} />
                                    </div>

                                    <select className="w-full p-3 border rounded-lg" value={form.reqCategory} onChange={e => setForm({ ...form, reqCategory: e.target.value })}>

                                        <option value="General">General</option>
                                        {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>

                                    <textarea placeholder="Description (Optional)" className="w-full p-3 border rounded-lg h-20" value={form.reqDescription} onChange={e => setForm({ ...form, reqDescription: e.target.value })}></textarea>

                                    {/* Images Section */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Product Photo</label>
                                            <div onClick={() => document.getElementById('file-product')?.click()} className="cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-4 hover:bg-gray-50 text-center transition-colors relative overflow-hidden h-32 flex items-center justify-center">
                                                {imageFile ? (
                                                    <img src={URL.createObjectURL(imageFile)} className="absolute inset-0 w-full h-full object-cover" />
                                                ) : (
                                                    <div className="text-gray-400 text-xs text-center">Tap to Capture<br />or Upload Photo</div>
                                                )}
                                                <input id="file-product" type="file" accept="image/*" capture="environment" className="hidden" onChange={e => {
                                                    if (e.target.files?.[0]) setImageFile(e.target.files[0]);
                                                }} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Barcode Photo (Usage Proof)</label>
                                            <div onClick={() => document.getElementById('file-barcode')?.click()} className="cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-4 hover:bg-gray-50 text-center transition-colors relative overflow-hidden h-32 flex items-center justify-center">
                                                {barcodeFile ? (
                                                    <img src={URL.createObjectURL(barcodeFile)} className="absolute inset-0 w-full h-full object-cover" />
                                                ) : (
                                                    <div className="text-gray-400 text-xs text-center">Tap to Capture<br />or Upload Proof</div>
                                                )}
                                                <input id="file-barcode" type="file" accept="image/*" capture="environment" className="hidden" onChange={e => {
                                                    if (e.target.files?.[0]) setBarcodeFile(e.target.files[0]);
                                                }} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <button onClick={handleRequestProduct} disabled={uploading} className="py-3 bg-black text-white w-full rounded-lg font-bold shadow-lg hover:bg-gray-800 transition-transform hover:scale-[1.01] disabled:bg-gray-400">
                                            {uploading ? 'Uploading Images...' : 'Submit Request'}
                                        </button>
                                        <button onClick={() => setView('search_master')} className="py-3 w-full text-gray-500 mt-2 hover:text-black">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                        {/* BULK UPLOAD VIEW */}
                        {view === 'bulk_upload' && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-bold">Bulk Smart Upload</h2>
                                    <button onClick={closeModal} className="text-gray-500 hover:text-black w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full">✕</button>
                                </div>

                                <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl border border-purple-100">
                                    <span className="text-2xl">🤖</span>
                                    <div>
                                        <h3 className="font-bold text-purple-900">Smart Importer</h3>
                                        <p className="text-xs text-purple-700">Paste your UPC list. We'll automatically fetch tax, branding, and images.</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">CSV Data (UPC, Price, Qty)</label>
                                    <textarea
                                        value={bulkText}
                                        onChange={e => setBulkText(e.target.value)}
                                        placeholder="6000198046009, 3.99, 100&#10;6000191279309, 15.50, 50"
                                        className="w-full h-48 px-4 py-3 border border-gray-200 rounded-xl font-mono text-sm outline-none focus:border-purple-400"
                                    ></textarea>
                                    <div className="mt-2 text-[11px] text-gray-400">
                                        Tip: You can copy-paste directly from Excel columns: Barcode, Price, Quantity.
                                    </div>
                                </div>

                                <div className="p-4 bg-gray-50 rounded-lg text-xs space-y-2">
                                    <div className="font-bold text-gray-500 uppercase">How it works</div>
                                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                                        <li>We match your UPCs against the Spendigo Master Catalog.</li>
                                        <li>If not found, we automatically search Open Food Facts.</li>
                                        <li>Tax categories & weights are auto-assigned.</li>
                                    </ul>
                                </div>

                                <button
                                    onClick={handleBulkUpload}
                                    disabled={bulkProcessing || !bulkText.trim()}
                                    className="w-full py-4 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:bg-gray-200 shadow-lg"
                                >
                                    {bulkProcessing ? '✨ Processing Smart Map...' : 'Map & Import Inventory'}
                                </button>
                            </div>
                        )}

                        {/* BULK SUMMARY VIEW */}
                        {view === 'bulk_summary' && bulkResults && (
                            <div className="space-y-6">
                                <div className="text-center py-4">
                                    <div className="text-5xl mb-4 text-green-500">✅</div>
                                    <h2 className="text-2xl font-bold">Import Complete</h2>
                                    <p className="text-gray-500">Your inventory has been updated with smart data.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-center">
                                        <div className="text-2xl font-bold text-green-700">{bulkResults.success}</div>
                                        <div className="text-xs text-green-600 font-bold uppercase">Successfully Linked</div>
                                    </div>
                                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-center">
                                        <div className="text-2xl font-bold text-orange-700">{bulkResults.failed}</div>
                                        <div className="text-xs text-orange-600 font-bold uppercase">Failed / Unresolved</div>
                                    </div>
                                </div>

                                {bulkResults.failed > 0 && (
                                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-bold text-red-900">Issues Encountered</span>
                                            <button
                                                onClick={downloadErrorReport}
                                                className="text-[10px] bg-white border border-red-200 px-2 py-1 rounded text-red-600 hover:bg-red-100 font-bold"
                                            >
                                                Download Error Log
                                            </button>
                                        </div>
                                        <div className="max-h-32 overflow-y-auto space-y-1">
                                            {bulkResults.errors.map((err, idx) => (
                                                <div key={idx} className="text-[10px] text-red-700 font-mono">• {err}</div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={() => { closeModal(); setBulkResults(null); }}
                                    className="w-full py-4 bg-black text-white font-bold rounded-xl hover:bg-gray-800"
                                >
                                    Done
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )
            }

            {showScanner && <ScannerModal onClose={() => setShowScanner(false)} onScan={(code) => {
                setShowScanner(false);
                if (scannerContext === 'search') {
                    handleMasterSearch(code);
                } else {
                    setForm(f => ({ ...f, reqBarcode: code }));
                    setBarcodeLocked(true);
                    addNotification({ type: 'system', title: 'Scanned', message: 'Barcode captured.' });
                }
            }} />}
        </div >
    );
};

export default MerchantProducts;
