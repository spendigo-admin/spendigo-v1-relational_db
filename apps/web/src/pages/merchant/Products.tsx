import React, { useState, useEffect } from 'react';
import '../../styles/design-system.css';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { useCatalog, Product } from '../../hooks/useCatalog';
import { Html5QrcodeScanner } from 'html5-qrcode';

// Scanner Component
const ScannerModal: React.FC<{ onClose: () => void, onScan: (result: string) => void }> = ({ onClose, onScan }) => {
    const [mountError, setMountError] = useState('');

    useEffect(() => {
        const timeout = setTimeout(() => {
            try {
                const scanner = new Html5QrcodeScanner(
                    "reader",
                    { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
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
    const { useStoreProducts, searchMasterCatalog, addMerchantProduct, updateMerchantProduct, deleteMerchantProduct, requestMasterProduct } = useCatalog();

    const storeId = user?.storeId || '';
    const hasWriteAccess = can('products:write');

    const { products, loading } = useStoreProducts(storeId);

    // UI State
    const [showAddModal, setShowAddModal] = useState(false);
    const [view, setView] = useState<'list' | 'search_master' | 'add_details' | 'request_new'>('list');

    const [searchQuery, setSearchQuery] = useState('');
    const [masterSearchQuery, setMasterSearchQuery] = useState('');
    const [masterSearchResults, setMasterSearchResults] = useState<any[]>([]);
    const [selectedMasterItem, setSelectedMasterItem] = useState<any | null>(null);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null); // State for delete loading

    const [showScanner, setShowScanner] = useState(false);

    // Form State
    const [form, setForm] = useState({
        price: '',
        stock: '50',

        // Request Form Fields
        reqName: '',
        reqBrand: '',
        reqDescription: '',
        reqImage: '',
        reqCategory: 'General'
    });

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
                await deleteMerchantProduct(product.id);
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
        setMasterSearchQuery(query);
        if (query.length > 2) {
            const results = await searchMasterCatalog(query);
            setMasterSearchResults(results);
        } else {
            setMasterSearchResults([]);
        }
    };

    const selectMasterItem = (item: any) => {
        setSelectedMasterItem(item);
        setView('add_details');
        setForm(f => ({ ...f, price: '', stock: '50' }));
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
        if (!storeId) return;
        try {
            await requestMasterProduct(storeId, {
                name: form.reqName,
                brand: form.reqBrand,
                category: form.reqCategory,
                description: form.reqDescription,
                image: form.reqImage,
                barcode: masterSearchQuery // Assume search query was barcode if applicable
            });
            addNotification({ type: 'system', title: 'Request Sent', message: 'Spendigo team will review your product request.' });
            closeModal();
        } catch (err: any) {
            console.error(err);
            addNotification({ type: 'alert', title: 'Error', message: 'Could not submit request.' });
        }
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
        setForm({ price: '', stock: '50', reqName: '', reqBrand: '', reqDescription: '', reqImage: '', reqCategory: 'General' });
    };

    // Filter local list
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.merchant_sku?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-main)]">Inventory</h1>
                    <p className="text-sm text-[var(--text-muted)]">{products.length} products sync with Master Catalog</p>
                </div>
                {hasWriteAccess && (
                    <button
                        onClick={() => { setView('search_master'); setShowAddModal(true); }}
                        className="px-4 py-2 bg-[var(--brand-primary)] text-white font-medium rounded-lg hover:brightness-110 shadow-lg shadow-[var(--brand-primary)]/20"
                    >
                        + Add Product
                    </button>
                )}
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

            {/* Table */}
            <div className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden shadow-sm">
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
                                <td className="p-4 text-[var(--text-muted)] capitalize">{product.category}</td>
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
                                        <button onClick={() => setView('request_new')} className="text-sm font-bold text-[var(--brand-primary)] hover:underline">
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
                                    <button onClick={() => setShowScanner(true)} className="absolute right-3 top-3 text-xl">📷</button>
                                </div>

                                <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                                    {masterSearchResults.map(item => (
                                        <div key={item.id} onClick={() => selectMasterItem(item)} className="flex items-center gap-3 p-3 hover:bg-blue-50 cursor-pointer border rounded-lg">
                                            <img src={item.primary_image_url} className="w-10 h-10 rounded object-cover" />
                                            <div>
                                                <div className="font-bold">{item.product_name}</div>
                                                <div className="text-xs text-gray-500">{item.brand_name} • {item.category_id}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {masterSearchQuery.length > 2 && masterSearchResults.length === 0 && (
                                        <div className="text-center py-4 text-gray-500">
                                            No products found.
                                            <br />
                                            <button onClick={() => setView('request_new')} className="mt-2 text-[var(--brand-primary)] underline font-bold">
                                                Request New Product
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* PHASE 2: EDIT/ADD DETAILS */}
                        {view === 'add_details' && (selectedMasterItem || editingProduct) && (
                            <>
                                <h2 className="text-xl font-bold mb-4">{editingProduct ? 'Edit Inventory' : 'Add to Inventory'}</h2>

                                <div className="flex gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
                                    <img src={editingProduct?.image || selectedMasterItem?.primary_image_url} className="w-16 h-16 rounded object-cover" />
                                    <div>
                                        <div className="font-bold text-lg">{editingProduct?.name || selectedMasterItem?.product_name}</div>
                                        <div className="text-sm text-gray-500">Master Data (Read Only)</div>
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
                                <p className="text-sm text-gray-500 mb-4">This product will be added to the Master Catalog after approval.</p>

                                <div className="space-y-3">
                                    <input type="text" placeholder="Product Name" className="w-full p-3 border rounded-lg" value={form.reqName} onChange={e => setForm({ ...form, reqName: e.target.value })} />
                                    <input type="text" placeholder="Brand" className="w-full p-3 border rounded-lg" value={form.reqBrand} onChange={e => setForm({ ...form, reqBrand: e.target.value })} />
                                    <select className="w-full p-3 border rounded-lg" value={form.reqCategory} onChange={e => setForm({ ...form, reqCategory: e.target.value })}>
                                        <option>General</option>
                                        <option>Fresh Produce</option>
                                        <option>Dairy</option>
                                        <option>Bakery</option>
                                    </select>
                                    <textarea placeholder="Description" className="w-full p-3 border rounded-lg h-24" value={form.reqDescription} onChange={e => setForm({ ...form, reqDescription: e.target.value })}></textarea>
                                    <input type="text" placeholder="Image URL (Optional)" className="w-full p-3 border rounded-lg" value={form.reqImage} onChange={e => setForm({ ...form, reqImage: e.target.value })} />

                                    <button onClick={handleRequestProduct} className="py-3 bg-black text-white w-full rounded-lg font-bold mt-2">Submit Request</button>
                                    <button onClick={() => setView('search_master')} className="py-3 w-full text-gray-500">Back</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {showScanner && <ScannerModal onClose={() => setShowScanner(false)} onScan={(code) => { setShowScanner(false); handleMasterSearch(code); }} />}
        </div>
    );
};

export default MerchantProducts;
