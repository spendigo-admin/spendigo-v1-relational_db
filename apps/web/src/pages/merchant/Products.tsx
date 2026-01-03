import React, { useState, useMemo, useEffect } from 'react';
import '../../styles/design-system.css';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { useCatalog } from '../../context/CatalogContext';
import { useInventorySync } from '../../hooks/useInventorySync';
import { Html5QrcodeScanner } from 'html5-qrcode';

// Scanner Component
const ScannerModal: React.FC<{ onClose: () => void, onScan: (result: string) => void }> = ({ onClose, onScan }) => {
    const [mountError, setMountError] = useState('');

    useEffect(() => {
        // Delay init slightly to ensure DOM is ready
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

                // Cleanup
                return () => {
                    scanner.clear().catch(() => { });
                };
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
    const { getStore, updateStoreProducts } = useMarketplace();
    const { can, user } = useAuth();
    const { addNotification } = useNotifications();
    const { confirm } = useConfirmation();
    const { catalog, searchCatalog } = useCatalog();

    const storeId = user?.storeId;
    const store = storeId ? getStore(storeId) : null;
    const hasWriteAccess = can('products:write');

    const products = useMemo(() => store?.products || [], [store?.products]);
    const { stats, getSyncedProducts } = useInventorySync(products, catalog);

    const [showAddModal, setShowAddModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Catalog Search State
    const [catalogSearch, setCatalogSearch] = useState('');
    const [showCatalogDropdown, setShowCatalogDropdown] = useState(false);

    // Scanner State
    const [showScanner, setShowScanner] = useState(false);

    // Form state
    const [form, setForm] = useState({
        name: '',
        sku: '',
        description: '',
        price: '',
        stock: '',
        lowStockThreshold: '10',
        category: 'Fresh Produce',
        image: '',
        relatedCatalogItemId: '',
        taxable: true
    });

    const handleScanSuccess = (decodedText: string) => {
        setForm(prev => ({ ...prev, sku: decodedText }));
        setShowScanner(false);
        addNotification({ type: 'system', title: 'Scanned!', message: `SKU set to ${decodedText}` });
    };

    const filteredProducts = products.filter((p: any) =>
        (p.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (p.sku?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );

    const updateProducts = async (newProducts: any[]) => {
        if (!storeId) {
            addNotification({ type: 'alert', title: 'Error', message: 'No Store ID associated with this account.' });
            return;
        }
        try {
            await updateStoreProducts(storeId, newProducts);
        } catch (error) {
            console.error("Failed to update products:", error);
            addNotification({ type: 'alert', title: 'Error', message: 'Failed to save changes. You may not have permission.' });
        }
    };

    const handleSyncInventory = async () => {
        const confirmed = await confirm({
            title: 'Sync Inventory',
            message: `Update ${stats.outOfSyncCount} items from Master Catalog? Prices and stock will remain unchanged.`,
            confirmText: 'Sync Now',
            type: 'info'
        });

        if (confirmed) {
            const syncedList = getSyncedProducts();
            updateProducts(syncedList);
            addNotification({ type: 'system', title: 'Sync Complete', message: 'Product details updated from Master Catalog.' });
        }
    };


    const handleSaveProduct = () => {
        const price = parseFloat(form.price) || 0;
        const stock = parseInt(form.stock) || 0;
        const lowStock = parseInt(form.lowStockThreshold) || 10;

        if (editingProduct) {
            const updatedList = products.map((p: any) => p.id === editingProduct.id ? {
                ...p,
                name: form.name,
                sku: form.sku,
                description: form.description,
                price,
                stock,
                lowStockThreshold: lowStock,
                category: form.category,
                image: form.image || p.image,
                taxable: form.taxable
            } : p);
            updateProducts(updatedList);
        } else {
            const newProduct = {
                id: `mp${Date.now()}`,
                name: form.name,
                catalogItemId: form.relatedCatalogItemId,
                sku: form.sku,
                description: form.description,
                price,
                stock,
                lowStockThreshold: lowStock,
                category: form.category,
                image: form.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100',
                active: true,
                taxable: form.taxable
            };
            updateProducts([...products, newProduct]);
        }
        closeModal();
    };

    const openEditModal = (product: any) => {
        setEditingProduct(product);
        setForm({
            name: product.name || '',
            sku: product.sku || '',
            description: product.description || '',
            price: String(product.price || 0),
            stock: String(product.stock !== undefined ? product.stock : 50),
            lowStockThreshold: String(product.lowStockThreshold || 10),
            category: product.category || 'Fresh Produce',
            image: product.image || '',
            relatedCatalogItemId: product.catalogItemId || '',
            taxable: product.taxable !== false
        });
        setShowAddModal(true);
    };

    const closeModal = () => {
        setShowAddModal(false);
        setEditingProduct(null);
        setCatalogSearch('');
        setForm({ name: '', sku: '', description: '', price: '', stock: '', lowStockThreshold: '10', category: 'Fresh Produce', image: '', relatedCatalogItemId: '', taxable: true });
    };

    const toggleProductActive = (id: string) => {
        const updatedList = products.map((p: any) => p.id === id ? { ...p, active: !p.active } : p);
        updateProducts(updatedList);
    };

    const deleteProduct = async (id: string) => {
        const confirmed = await confirm({
            title: 'Delete Product',
            message: 'Are you sure you want to delete this product? This cannot be undone.',
            confirmText: 'Delete',
            type: 'danger'
        });

        if (confirmed) {
            const updatedList = products.filter((p: any) => p.id !== id);
            updateProducts(updatedList);
            addNotification({ type: 'system', title: 'Product Deleted', message: 'Product removed from catalog.' });
        }
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-main)]">Products</h1>
                    <p className="text-sm text-[var(--text-muted)]">{products.length} total products</p>
                </div>
                <div className="flex gap-3">
                    {hasWriteAccess && stats.outOfSyncCount > 0 && (
                        <button
                            onClick={handleSyncInventory}
                            className="px-4 py-2 bg-orange-100 text-orange-700 font-bold rounded-lg hover:bg-orange-200 border border-orange-200 flex items-center gap-2 animate-pulse"
                        >
                            <span>↻</span>
                            <span>Sync Catalog ({stats.outOfSyncCount})</span>
                        </button>
                    )}
                    {hasWriteAccess && (
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="px-4 py-2 bg-[var(--brand-primary)] text-white font-medium rounded-lg hover:brightness-110 shadow-lg shadow-[var(--brand-primary)]/20"
                        >
                            + Add Product
                        </button>
                    )}
                </div>
            </div>

            {/* Search */}
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Search by name or SKU..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg focus:border-[var(--brand-primary)] outline-none"
                />
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead className="bg-[var(--surface-1)]">
                        <tr>
                            <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Product</th>
                            <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Category</th>
                            <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Price</th>
                            <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Stock</th>
                            <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Status</th>
                            <th className="text-left p-4 text-sm font-medium text-[var(--text-muted)]">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--glass-border)]">
                        {filteredProducts.map((product: any) => {
                            const stock = product.stock !== undefined ? product.stock : 50;
                            const lowThreshold = product.lowStockThreshold || 10;
                            const isActive = product.active !== false;

                            return (
                                <tr key={product.id} className="hover:bg-[var(--surface-1)] transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <img src={product.image} alt="" className="w-10 h-10 rounded-lg object-cover" />
                                            <div>
                                                <span className="font-medium text-[var(--text-main)] block">{product.name}</span>
                                                {stock <= lowThreshold && stock > 0 && (
                                                    <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">Low Stock</span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-[var(--text-muted)]">{product.category}</td>
                                    <td className="p-4 font-medium text-[var(--text-main)]">${product.price.toFixed(2)}</td>
                                    <td className="p-4">
                                        <span className={`${stock === 0 ? 'text-red-500 font-bold' : stock <= lowThreshold ? 'text-orange-600 font-medium' : 'text-green-600'}`}>
                                            {stock}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className={`text-xs px-2 py-1 rounded-full ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            {hasWriteAccess ? (
                                                <>
                                                    <button onClick={() => openEditModal(product)} className="text-[var(--brand-primary)] text-sm hover:underline">Edit</button>
                                                    <button onClick={() => toggleProductActive(product.id)} className="text-yellow-600 text-sm hover:underline">
                                                        {isActive ? 'Disable' : 'Enable'}
                                                    </button>
                                                    <button onClick={() => deleteProduct(product.id)} className="text-red-500 text-sm hover:underline">Delete</button>
                                                </>
                                            ) : (
                                                <span className="text-xs text-[var(--text-muted)] italic">View Only</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Scanner Overlay */}
            {showScanner && (
                <ScannerModal
                    onClose={() => setShowScanner(false)}
                    onScan={handleScanSuccess}
                />
            )}

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-[var(--text-main)] mb-4">
                            {editingProduct ? 'Edit Product' : 'Add New Product'}
                        </h2>

                        {!editingProduct && (
                            <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100">
                                <label className="block text-sm font-bold text-blue-900 mb-2">🛍️ Select from Master Catalog</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search catalog (e.g. 'Apple', 'Milk')..."
                                        value={catalogSearch}
                                        onChange={e => {
                                            setCatalogSearch(e.target.value);
                                            setShowCatalogDropdown(true);
                                            if (!form.relatedCatalogItemId) {
                                                setForm(prev => ({ ...prev, name: e.target.value }));
                                            }
                                        }}
                                        onFocus={() => setShowCatalogDropdown(true)}
                                        className="w-full px-4 py-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                    {showCatalogDropdown && catalogSearch && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto">
                                            {searchCatalog(catalogSearch).length > 0 ? (
                                                searchCatalog(catalogSearch).map(item => (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => {
                                                            setForm(prev => ({
                                                                ...prev,
                                                                name: item.name,
                                                                description: item.description,
                                                                category: item.category,
                                                                image: item.image,
                                                                relatedCatalogItemId: item.id,
                                                                taxable: item.taxable !== false
                                                            }));
                                                            setCatalogSearch(item.name);
                                                            setShowCatalogDropdown(false);
                                                        }}
                                                        className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 flex items-center gap-3"
                                                    >
                                                        <img src={item.image} className="w-8 h-8 rounded object-cover" alt="" />
                                                        <div>
                                                            <div className="font-bold text-sm">{item.name}</div>
                                                            <div className="text-xs text-gray-500">{item.category}</div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-3 text-sm text-gray-500 italic">No matching items found in catalog.</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-blue-600 mt-2">
                                    Selecting from catalog ensures better visibility in search results.
                                </p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Product Name</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={form.name}
                                            onChange={e => setForm({ ...form, name: e.target.value })}
                                            className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg bg-gray-50"
                                            readOnly={!!form.relatedCatalogItemId && !editingProduct}
                                        />
                                        {form.relatedCatalogItemId && (
                                            <button
                                                onClick={() => {
                                                    setForm(prev => ({ ...prev, relatedCatalogItemId: '' }));
                                                    setCatalogSearch('');
                                                }}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-500 hover:underline"
                                            >
                                                Clear Selection
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">SKU / Barcode</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={form.sku}
                                            onChange={e => setForm({ ...form, sku: e.target.value })}
                                            className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg font-mono text-sm"
                                            placeholder="e.g. 12345..."
                                        />
                                        <button
                                            onClick={() => setShowScanner(true)}
                                            className="px-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-lg"
                                            title="Scan Barcode"
                                            type="button"
                                        >
                                            📷
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Category</label>
                                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg">
                                        <option value="">Select Category</option>
                                        {['Dairy & Refrigerated', 'Bakery & Grains', 'Pantry Staples', 'Breakfast & Beverages', 'Produce & Frozen', 'Snacks & Household'].map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Description</label>
                                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg h-24 resize-none" placeholder="Product details..." />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Price ($)</label>
                                    <input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Stock</label>
                                    <input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Low Alert At</label>
                                    <input type="number" value={form.lowStockThreshold} onChange={e => setForm({ ...form, lowStockThreshold: e.target.value })} className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg bg-yellow-50" />
                                </div>
                                <div className="flex items-center pt-6">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={form.taxable}
                                            onChange={e => setForm({ ...form, taxable: e.target.checked })}
                                            className="w-5 h-5 accent-[var(--brand-primary)]"
                                        />
                                        <div>
                                            <div className="font-bold text-[var(--text-main)]">Taxable Item</div>
                                            <div className="text-xs text-[var(--text-muted)]">Apply HST/GST (13%)</div>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={handleSaveProduct} className="flex-1 py-3 bg-[var(--brand-primary)] text-white font-medium rounded-lg hover:brightness-110 shadow-lg shadow-[var(--brand-primary)]/20 transition-all">
                                {editingProduct ? 'Save Changes' : 'Add Product'}
                            </button>
                            <button onClick={closeModal} className="flex-1 py-3 border border-[var(--glass-border)] rounded-lg hover:bg-[var(--surface-1)]">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default MerchantProducts;
