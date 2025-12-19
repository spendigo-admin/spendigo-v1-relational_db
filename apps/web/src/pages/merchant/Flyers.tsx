import React, { useState, useMemo } from 'react';
import '../../styles/design-system.css';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useAuth } from '../../context/AuthContext';

// Types
interface FlyerItem {
    productId: string;
    name: string;
    image: string;
    category: string;
    originalPrice: number;
    salePrice: number;
}

interface Flyer {
    id: string;
    title: string;
    validFrom: string;
    validUntil: string;
    status: 'active' | 'scheduled' | 'expired' | 'draft';
    items: FlyerItem[];
    coverImage: string; // New: Visual customization
}

// Simulate logged-in merchant (FreshMart)

const COVER_PRESETS = [
    { id: 'fresh', name: 'FreshGrocer', url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=400&fit=crop' },
    { id: 'holiday', name: 'Seasonal', url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&h=400&fit=crop' },
    { id: 'pantry', name: 'Essentials', url: 'https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?w=800&h=400&fit=crop' },
    { id: 'deals', name: 'Mega Sale', url: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=800&h=400&fit=crop' },
];

const INITIAL_FLYERS: Flyer[] = [
    {
        id: 'f1',
        title: 'Weekly Fresh Deals',
        validFrom: '2025-12-16',
        validUntil: '2025-12-22',
        status: 'active',
        coverImage: COVER_PRESETS[0].url,
        items: []
    }
];
const MerchantFlyers: React.FC = () => {
    const { getStore, updateStoreFlyer } = useMarketplace();
    const { can, user } = useAuth();
    const storeId = user?.storeId || '1';
    const store = getStore(storeId);
    const availableProducts = useMemo(() => store?.products || [], [store?.products]);
    const hasWriteAccess = can('flyers:write');

    const [flyers, setFlyers] = useState<Flyer[]>(INITIAL_FLYERS);
    const [view, setView] = useState<'list' | 'editor'>('list');
    const [activeFlyerId, setActiveFlyerId] = useState<string | null>(null);

    // Editor State
    const [formData, setFormData] = useState<Partial<Flyer>>({});
    const [showProductPicker, setShowProductPicker] = useState(false);
    const [pickerSearch, setPickerSearch] = useState('');
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
    const [bulkDiscountInput, setBulkDiscountInput] = useState<string>('10');

    // Filter products for picker
    const filteredPickerProducts = useMemo(() => {
        if (!pickerSearch) return availableProducts;
        return availableProducts.filter((p: any) =>
            p.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
            p.category.toLowerCase().includes(pickerSearch.toLowerCase())
        );
    }, [pickerSearch, availableProducts]);

    // Helpers
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-700';
            case 'scheduled': return 'bg-blue-100 text-blue-700';
            case 'draft': return 'bg-gray-200 text-gray-700';
            case 'expired': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const calculateDiscount = (original: number, sale: number) => {
        if (!original || !sale) return 0;
        return Math.round(((original - sale) / original) * 100);
    };

    // Handlers
    const handleCreateNew = () => {
        const d = new Date();
        // Use local YYYY-MM-DD format
        const localToday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        setFormData({
            title: '',
            validFrom: localToday,
            validUntil: '',
            items: [],
            coverImage: COVER_PRESETS[0].url
        });
        setActiveFlyerId(null);
        setView('editor');
    };

    const handleEdit = (flyer: Flyer) => {
        setFormData({ ...flyer });
        setActiveFlyerId(flyer.id);
        setView('editor');
    };

    const handleDuplicate = (flyer: Flyer) => {
        const newFlyer: Flyer = {
            ...flyer,
            id: `f${Date.now()}`,
            title: `Copy of ${flyer.title}`,
            status: 'draft',
            items: flyer.items.map(i => ({ ...i }))
        };
        setFlyers(prev => [newFlyer, ...prev]);
    };

    const handleDelete = (id: string) => {
        const flyerToDelete = flyers.find(f => f.id === id);
        if (confirm('Are you sure you want to delete this flyer?')) {
            setFlyers(prev => prev.filter(f => f.id !== id));

            // Sync Removal with Global Store if it was the active flyer
            if (flyerToDelete && flyerToDelete.status === 'active') {
                updateStoreFlyer(storeId, {
                    title: '',
                    validUntil: '', // Clears the active status in consumer view
                    image: ''
                });
            }
        }
    };

    // Editor Handlers
    const handleSave = (publish: boolean) => {
        if (!formData.title || !formData.validFrom || !formData.validUntil) return;

        let status: Flyer['status'] = 'draft';
        if (publish) {
            const now = new Date();

            // Parse YYYY-MM-DD explicitly to Local Time (avoiding UTC conversion issues)
            const [y1, m1, d1] = formData.validFrom.split('-').map(Number);
            const start = new Date(y1, m1 - 1, d1); // Start of day 00:00

            const [y2, m2, d2] = formData.validUntil.split('-').map(Number);
            const end = new Date(y2, m2 - 1, d2);
            end.setHours(23, 59, 59, 999); // End of day 23:59

            if (end < now) status = 'expired';
            else if (start > now) status = 'scheduled';
            else status = 'active';
        }

        const newFlyer: Flyer = {
            id: activeFlyerId || `f${Date.now()}`,
            title: formData.title || 'Untitled',
            validFrom: formData.validFrom || '',
            validUntil: formData.validUntil || '',
            status: status,
            items: formData.items || [],
            coverImage: formData.coverImage || COVER_PRESETS[0].url
        };

        setFlyers(prev => {
            if (activeFlyerId) {
                return prev.map(f => f.id === activeFlyerId ? newFlyer : f);
            }
            return [...prev, newFlyer];
        });

        // Sync with Global Marketplace Context if Active
        if (status === 'active') {
            updateStoreFlyer(storeId, {
                title: newFlyer.title,
                validUntil: new Date(newFlyer.validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                image: newFlyer.coverImage
            });
        }

        setView('list');
    };

    // Smart Tools
    const applyBulkDiscount = () => {
        const percent = parseFloat(bulkDiscountInput);
        if (isNaN(percent) || percent <= 0) return;

        if (!formData.items) return;

        const newItems = formData.items.map(item => ({
            ...item,
            salePrice: Number((item.originalPrice * (1 - percent / 100)).toFixed(2))
        }));

        setFormData({ ...formData, items: newItems });
    };

    const toggleProductSelection = (id: string) => {
        const newSet = new Set(selectedProductIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedProductIds(newSet);
    };

    const openPicker = () => {
        const currentIds = new Set(formData.items?.map(i => i.productId) || []);
        setSelectedProductIds(currentIds);
        setPickerSearch('');
        setShowProductPicker(true);
    };

    const savePickerSelection = () => {
        const currentItems = formData.items || [];
        const newItems: FlyerItem[] = [];

        selectedProductIds.forEach(id => {
            const existing = currentItems.find(i => i.productId === id);
            if (existing) {
                newItems.push(existing);
            } else {
                const product = availableProducts.find((p: any) => p.id === id);
                if (product) {
                    newItems.push({
                        productId: product.id,
                        name: product.name,
                        image: product.image,
                        category: product.category,
                        originalPrice: product.originalPrice || product.price,
                        salePrice: product.price
                    });
                }
            }
        });

        setFormData({ ...formData, items: newItems });
        setShowProductPicker(false);
    };

    const updateItemPrice = (index: number, price: number) => {
        if (!formData.items) return;
        const newItems = [...formData.items];
        newItems[index].salePrice = price;
        setFormData({ ...formData, items: newItems });
    };

    const removeItem = (index: number) => {
        if (!formData.items) return;
        const newItems = [...formData.items];
        newItems.splice(index, 1);
        setFormData({ ...formData, items: newItems });
    };

    if (view === 'editor') {
        const totalSavings = formData.items?.reduce((acc, item) => acc + (item.originalPrice - item.salePrice), 0) || 0;

        return (
            <div className="p-6 animate-fade-in pb-20">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <button onClick={() => setView('list')} className="text-[var(--text-muted)] hover:text-[var(--text-main)] mb-2 flex items-center gap-1">
                            ← Back to Flyers
                        </button>
                        <h1 className="text-2xl font-bold text-[var(--text-main)]">
                            {activeFlyerId ? 'Edit Flyer' : 'Create New Flyer'}
                        </h1>
                    </div>
                    {hasWriteAccess ? (
                        <div className="flex gap-3">
                            <button onClick={() => handleSave(false)} className="px-4 py-2 border border-[var(--glass-border)] rounded-lg hover:bg-[var(--surface-1)]">
                                Save Draft
                            </button>
                            <button onClick={() => handleSave(true)} className="px-6 py-2 bg-[var(--brand-primary)] text-white font-bold rounded-lg hover:brightness-110 shadow-lg shadow-[var(--brand-primary)]/20">
                                Publish Flyer
                            </button>
                        </div>
                    ) : (
                        <div className="text-sm font-medium text-orange-600 bg-orange-50 px-4 py-2 rounded-lg border border-orange-100 flex items-center gap-2">
                            <span>🛡️</span> View Only Mode
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Col: Details & Visuals */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Basic Info */}
                        <div className="bg-white p-6 rounded-xl border border-[var(--glass-border)] shadow-sm">
                            <h3 className="font-bold text-lg mb-4">Flyer Details</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-[var(--text-muted)]">Title</label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-3 py-2 border border-[var(--glass-border)] rounded-lg outline-none focus:border-[var(--brand-primary)]"
                                        placeholder="e.g. Weekly Savings"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-[var(--text-muted)]">Start Date</label>
                                        <input
                                            type="date"
                                            value={formData.validFrom}
                                            onChange={e => setFormData({ ...formData, validFrom: e.target.value })}
                                            className="w-full px-3 py-2 border border-[var(--glass-border)] rounded-lg outline-none focus:border-[var(--brand-primary)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-[var(--text-muted)]">End Date</label>
                                        <input
                                            type="date"
                                            value={formData.validUntil}
                                            onChange={e => setFormData({ ...formData, validUntil: e.target.value })}
                                            className="w-full px-3 py-2 border border-[var(--glass-border)] rounded-lg outline-none focus:border-[var(--brand-primary)]"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Visual Customization */}
                        <div className="bg-white p-6 rounded-xl border border-[var(--glass-border)] shadow-sm">
                            <h3 className="font-bold text-lg mb-4">Appearance</h3>
                            <div className="mb-4">
                                <label className="block text-sm font-medium mb-2 text-[var(--text-muted)]">Cover Image</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {COVER_PRESETS.map(preset => (
                                        <div
                                            key={preset.id}
                                            onClick={() => setFormData({ ...formData, coverImage: preset.url })}
                                            className={`relative h-20 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${formData.coverImage === preset.url ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]/20' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                        >
                                            <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                                            {formData.coverImage === preset.url && (
                                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                                    <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-[var(--brand-primary)]">✓</div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Col: Items */}
                    <div className="lg:col-span-2">
                        {/* Stats Banner */}
                        <div className="mb-4 grid grid-cols-2 gap-4">
                            <div className="glass-panel p-4 flex items-center gap-3">
                                <div className="p-3 rounded-full bg-blue-100 text-blue-700 text-xl">🏷️</div>
                                <div>
                                    <div className="text-sm text-[var(--text-muted)]">Total Products</div>
                                    <div className="text-xl font-bold">{formData.items?.length || 0}</div>
                                </div>
                            </div>
                            <div className="glass-panel p-4 flex items-center gap-3">
                                <div className="p-3 rounded-full bg-green-100 text-green-700 text-xl">💰</div>
                                <div>
                                    <div className="text-sm text-[var(--text-muted)]">Total Savings Value</div>
                                    <div className="text-xl font-bold">${totalSavings.toFixed(2)}</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-[var(--glass-border)] shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--surface-1)]">
                                <h3 className="font-bold text-lg">Flyer Products</h3>
                                {hasWriteAccess && (
                                    <button
                                        onClick={openPicker}
                                        className="px-4 py-2 bg-[var(--brand-primary)] text-white text-sm font-medium rounded-lg hover:brightness-110 flex items-center gap-2"
                                    >
                                        <span>➕</span> Add Products
                                    </button>
                                )}
                            </div>

                            {/* Smart Tools Toolbar */}
                            <div className="p-3 bg-gray-50 border-b border-[var(--glass-border)] flex items-center gap-4">
                                <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">⚡ Smart Tools:</span>

                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-[var(--text-muted)]">Apply</span>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={bulkDiscountInput}
                                            onChange={e => setBulkDiscountInput(e.target.value)}
                                            className="w-16 px-2 py-1 text-sm border border-[var(--glass-border)] rounded focus:border-[var(--brand-primary)] outline-none"
                                        />
                                        <span className="absolute right-2 top-1 text-xs text-[var(--text-muted)]">%</span>
                                    </div>
                                    <button
                                        onClick={applyBulkDiscount}
                                        className="text-xs px-3 py-1.5 bg-white border border-[var(--glass-border)] hover:border-[var(--brand-primary)] rounded-md font-medium text-[var(--brand-primary)] transition-colors"
                                    >
                                        Auto-Discount All
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-[var(--surface-1)] text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-3">Product</th>
                                            <th className="px-6 py-3">Original</th>
                                            <th className="px-6 py-3">Sale Price</th>
                                            <th className="px-6 py-3">Discount</th>
                                            <th className="px-6 py-3">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--glass-border)]">
                                        {(!formData.items || formData.items.length === 0) ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-[var(--text-muted)]">
                                                    No products added. Click "Add Products" to start.
                                                </td>
                                            </tr>
                                        ) : (
                                            formData.items.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-[var(--surface-1)] transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <img src={item.image} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100" />
                                                            <div>
                                                                <div className="font-medium text-[var(--text-main)] w-32 md:w-auto truncate">{item.name}</div>
                                                                <div className="text-xs text-[var(--text-muted)]">{item.category}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-[var(--text-muted)] line-through">
                                                        ${item.originalPrice.toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[var(--text-main)] font-medium">$</span>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={item.salePrice}
                                                                onChange={(e) => updateItemPrice(idx, parseFloat(e.target.value))}
                                                                className="w-20 px-2 py-1 border border-[var(--glass-border)] rounded text-sm font-bold text-[var(--brand-primary)] outline-none focus:border-[var(--brand-primary)]"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {(() => {
                                                            const discount = calculateDiscount(item.originalPrice, item.salePrice);
                                                            return (
                                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${discount > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                                    {discount > 0 ? `${discount}% OFF` : 'No Discount'}
                                                                </span>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50">
                                                            🗑️
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Product Picker Modal */}
                {showProductPicker && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
                        <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
                            <div className="p-6 border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--surface-1)]">
                                <h3 className="text-xl font-bold">Select Products</h3>
                                <button onClick={() => setShowProductPicker(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">❌</button>
                            </div>

                            <div className="p-4 border-b border-[var(--glass-border)]">
                                <input
                                    type="text"
                                    placeholder="Search products by name or category..."
                                    value={pickerSearch}
                                    onChange={e => setPickerSearch(e.target.value)}
                                    className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg outline-none focus:border-[var(--brand-primary)]"
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto p-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2">
                                    {filteredPickerProducts.length === 0 ? (
                                        <div className="col-span-2 text-center py-10 text-[var(--text-muted)]">No products found.</div>
                                    ) : (
                                        filteredPickerProducts.map((product: any) => {
                                            const isSelected = selectedProductIds.has(product.id);
                                            return (
                                                <div
                                                    key={product.id}
                                                    onClick={() => toggleProductSelection(product.id)}
                                                    className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${isSelected ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5' : 'border-[var(--glass-border)] hover:border-[var(--brand-primary)]/50'}`}
                                                >
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white' : 'border-gray-300 bg-white'}`}>
                                                        {isSelected && '✓'}
                                                    </div>
                                                    <img src={product.image} className="w-12 h-12 rounded-lg object-cover bg-gray-100" />
                                                    <div className="flex-1">
                                                        <div className="font-medium text-[var(--text-main)] w-32 truncate">{product.name}</div>
                                                        <div className="text-sm text-[var(--text-muted)]">${(product.price || 0).toFixed(2)}</div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            <div className="p-6 border-t border-[var(--glass-border)] bg-[var(--surface-1)] flex justify-between items-center rounded-b-2xl">
                                <div className="text-sm text-[var(--text-muted)]">
                                    {selectedProductIds.size} products selected
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setShowProductPicker(false)} className="px-4 py-2 border border-[var(--glass-border)] rounded-lg hover:bg-white text-[var(--text-main)]">
                                        Cancel
                                    </button>
                                    <button onClick={savePickerSelection} className="px-6 py-2 bg-[var(--brand-primary)] text-white font-bold rounded-lg hover:brightness-110">
                                        Add Selected Items
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Default List View
    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-main)]">📰 Flyers</h1>
                    <p className="text-sm text-[var(--text-muted)]">Manage your store's digital flyers and weekly deals</p>
                </div>
                {hasWriteAccess && (
                    <button
                        onClick={handleCreateNew}
                        className="px-4 py-2 bg-[var(--brand-primary)] text-white font-medium rounded-lg hover:brightness-110 shadow-lg shadow-[var(--brand-primary)]/20"
                    >
                        + Create Flyer
                    </button>
                )}
            </div>

            <div className="space-y-4">
                {flyers.map(flyer => (
                    <div key={flyer.id} className="bg-white rounded-xl border border-[var(--glass-border)] p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div className="flex gap-4 items-center">
                                <img src={flyer.coverImage} className="w-16 h-16 rounded-lg object-cover bg-gray-200" alt="" />
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-[var(--text-main)] text-lg">{flyer.title}</h3>
                                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${getStatusColor(flyer.status)} font-medium border border-current opacity-80`}>
                                            {flyer.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-[var(--text-muted)]">
                                        {new Date(flyer.validFrom).toLocaleDateString()} - {new Date(flyer.validUntil).toLocaleDateString()}
                                    </p>
                                    <p className="text-sm text-[var(--text-muted)] mt-1 flex items-center gap-1">
                                        <span>🏷️</span> {flyer.items?.length || 0} products included
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {hasWriteAccess ? (
                                    <>
                                        <button onClick={() => handleDuplicate(flyer)} className="px-3 py-1.5 border border-[var(--glass-border)] text-[var(--brand-primary)] rounded-lg text-sm hover:bg-[var(--surface-1)]" title="Duplicate Flyer">
                                            📋 Clone
                                        </button>
                                        <button onClick={() => handleEdit(flyer)} className="px-3 py-1.5 border border-[var(--glass-border)] rounded-lg text-sm text-[var(--text-main)] hover:bg-[var(--surface-1)]">
                                            ✏️ Edit
                                        </button>
                                        <button onClick={() => handleDelete(flyer.id)} className="px-3 py-1.5 text-red-500 text-sm hover:bg-red-50 rounded-lg">
                                            🗑️
                                        </button>
                                    </>
                                ) : (
                                    <button onClick={() => handleEdit(flyer)} className="px-3 py-1.5 border border-[var(--glass-border)] rounded-lg text-sm text-[var(--text-main)] hover:bg-[var(--surface-1)]">
                                        👁️ View Details
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MerchantFlyers;
