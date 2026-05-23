import React, { useState, useMemo, useEffect } from 'react';
import '../../styles/design-system.css';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useAuth } from '../../context/AuthContext';
import { useStoreProducts } from '../../hooks/useStoreProducts';

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

const COVER_PRESETS = [
    { id: 'fresh', name: 'Fresh Harvest', url: '/assets/flyers/fresh_produce.png' },
    { id: 'bbq', name: 'Butcher\'s Best', url: '/assets/flyers/meat_bbq.png' },
    { id: 'bakery', name: 'Morning Bakery', url: '/assets/flyers/bakery_breakfast.png' },
    { id: 'deals', name: 'Weekly Super Sale', url: '/assets/flyers/weekly_deals.png' },
    { id: 'ethnic', name: 'Flavor Festival', url: '/assets/flyers/ethnic_spices.png' },
];

const getValidFlyerImage = (imageUrl?: string): string | undefined => {
    if (!imageUrl) return undefined;
    if (imageUrl.includes('.gemini/antigravity/brain')) {
        if (imageUrl.includes('produce')) return '/assets/flyers/fresh_produce.png';
        if (imageUrl.includes('meat')) return '/assets/flyers/meat_bbq.png';
        if (imageUrl.includes('bakery')) return '/assets/flyers/bakery_breakfast.png';
        if (imageUrl.includes('deals')) return '/assets/flyers/weekly_deals.png';
        if (imageUrl.includes('spices')) return '/assets/flyers/ethnic_spices.png';
        return '/assets/flyers/fresh_produce.png';
    }
    return imageUrl;
};

const MerchantFlyers: React.FC = () => {
    const { user } = useAuth();
    const { stores, getStore, updateStoreFlyer, subscribeToFlyers, saveFlyer, deleteFlyer } = useMarketplace();
    const storeId = user?.storeId || '1';
    const isLocked = stores[storeId]?.status === 'pending_deletion';
    const { products: availableProducts } = useStoreProducts(storeId);
    const hasWriteAccess = !isLocked;
    const isRestrictedPlan = (user?.subscriptionTier || 'free') !== 'growth';

    const [flyers, setFlyers] = useState<Flyer[]>([]);
    const [view, setView] = useState<'list' | 'editor'>('list');
    const [activeFlyerId, setActiveFlyerId] = useState<string | null>(null);

    const getEffectiveStatus = (flyer: Partial<Flyer>): Flyer['status'] => {
        if (flyer.status === 'draft') return 'draft';

        const now = new Date();
        const validFrom = flyer.validFrom || '';
        const validUntil = flyer.validUntil || '';

        if (!validFrom || !validUntil) return 'draft';

        const [y1, m1, d1] = validFrom.split('-').map(Number);
        const start = new Date(y1, m1 - 1, d1);

        const [y2, m2, d2] = validUntil.split('-').map(Number);
        const end = new Date(y2, m2 - 1, d2);
        end.setHours(23, 59, 59, 999);

        if (end < now) return 'expired';
        if (start > now) return 'scheduled';
        return 'active';
    };

    // Subscribe to real-time flyer data
    useEffect(() => {
        if (!storeId) return;
        const unsubscribe = subscribeToFlyers(storeId, (data) => {
            const normalized = (data as Flyer[]).map(f => ({
                ...f,
                status: getEffectiveStatus(f)
            }));
            setFlyers(normalized);
        });
        return () => unsubscribe();
    }, [storeId, subscribeToFlyers]);

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
        const localToday = d.toISOString().split('T')[0];

        // Default end date to 7 days from now
        const nextWeek = new Date(d);
        nextWeek.setDate(d.getDate() + 7);
        const localNextWeek = nextWeek.toISOString().split('T')[0];

        setFormData({
            title: '',
            validFrom: localToday,
            validUntil: localNextWeek,
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

    const handleDuplicate = async (flyer: Flyer) => {
        const newId = `f${Date.now()}`;
        const newFlyer: Flyer = {
            ...flyer,
            id: newId,
            title: `Copy of ${flyer.title}`,
            status: 'draft',
            items: flyer.items.map(i => ({ ...i }))
        };
        await saveFlyer(storeId, newFlyer);
    };

    const handleDelete = async (id: string) => {
        const flyerToDelete = flyers.find(f => f.id === id);
        if (confirm('Are you sure you want to delete this flyer?')) {
            await deleteFlyer(storeId, id);

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
    const handleSave = async (publish: boolean) => {
        if (!formData.title || !formData.validFrom || !formData.validUntil) {
            alert('Please ensure Title, Start Date, and End Date are filled out.');
            return;
        }

        const status: Flyer['status'] = publish ? getEffectiveStatus(formData) : 'draft';

        const newFlyer: Flyer = {
            id: activeFlyerId || `f${Date.now()}`,
            title: formData.title || 'Untitled',
            validFrom: formData.validFrom || '',
            validUntil: formData.validUntil || '',
            status: status,
            items: formData.items || [],
            coverImage: formData.coverImage || COVER_PRESETS[0].url
        };

        try {
            await saveFlyer(storeId, newFlyer);

            // Sync with Global Marketplace Context if Active
            if (status === 'active') {
                updateStoreFlyer(storeId, {
                    title: newFlyer.title,
                    validUntil: new Date(newFlyer.validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    image: newFlyer.coverImage,
                    items: newFlyer.items
                });
            }

            setView('list');
        } catch (error) {
            console.error("Failed to save flyer:", error);
            alert(`Failed to save flyer. Please try again. Error: ${(error as Error).message}`);
        }
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
            <div className="p-4 sm:p-6 animate-fade-in pb-20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                        <button onClick={() => setView('list')} className="text-[var(--text-muted)] hover:text-[var(--text-main)] mb-2 flex items-center gap-1">
                            ← Back to Flyers
                        </button>
                        <h1 className="page-headline">
                            {activeFlyerId ? 'Edit Flyer' : 'Create New Flyer'}
                        </h1>
                    </div>
                    {hasWriteAccess ? (
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                            <button onClick={() => handleSave(false)} className="w-full sm:w-auto px-4 py-2 border border-[var(--glass-border)] rounded-lg hover:bg-[var(--surface-1)] text-center">
                                Save Draft
                            </button>
                            <button onClick={() => handleSave(true)} className="w-full sm:w-auto px-6 py-2 bg-[var(--brand-primary)] text-white font-bold rounded-lg hover:brightness-110 shadow-lg shadow-[var(--brand-primary)]/20 text-center">
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
                                <div className="grid grid-cols-1 gap-3">
                                    {COVER_PRESETS.map(preset => (
                                        <div
                                            key={preset.id}
                                            onClick={() => setFormData({ ...formData, coverImage: preset.url })}
                                            className={`relative h-24 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${formData.coverImage === preset.url ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]/20' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                        >
                                            <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                                            <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold rounded uppercase tracking-wider">
                                                {preset.name}
                                            </div>
                                            {formData.coverImage === preset.url && (
                                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-[var(--brand-primary)] shadow-lg">✓</div>
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
                        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                            {/* Desktop View (Table) */}
                            <div className="hidden md:block overflow-x-auto">
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

                            {/* Mobile View (Cards) */}
                            <div className="md:hidden space-y-4 p-4">
                                {(!formData.items || formData.items.length === 0) ? (
                                    <div className="text-center py-8 text-[var(--text-muted)] bg-gray-50 rounded-lg">
                                        No products added. Click "Add Products" to start.
                                    </div>
                                ) : (
                                    formData.items.map((item, idx) => (
                                        <div key={idx} className="bg-white rounded-xl border border-[var(--glass-border)] p-4 shadow-sm">
                                            <div className="flex gap-3 mb-3">
                                                <img src={item.image} alt="" className="w-16 h-16 rounded-lg object-cover bg-gray-100" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-[var(--text-main)] truncate block">{item.name}</div>
                                                    <div className="text-xs text-[var(--text-muted)] capitalize mb-1">{item.category}</div>
                                                    {(() => {
                                                        const discount = calculateDiscount(item.originalPrice, item.salePrice);
                                                        return (
                                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${discount > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                                {discount > 0 ? `${discount}% OFF` : 'No Discount'}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                                <button onClick={() => removeItem(idx)} className="self-start text-red-500 hover:text-red-700 p-2 rounded hover:bg-red-50">
                                                    🗑️
                                                </button>
                                            </div>
                                            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                                                <div>
                                                    <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold mb-0.5">Original</div>
                                                    <div className="text-sm line-through text-[var(--text-muted)]">${item.originalPrice.toFixed(2)}</div>
                                                </div>
                                                <div className="text-right flex items-center gap-2">
                                                    <div className="text-[10px] text-[var(--brand-primary)] uppercase tracking-wider font-bold mb-0.5 mt-1">Sale</div>
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
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
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
        <div className="p-4 sm:p-6 animate-fade-in pb-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="page-headline">📰 Flyers</h1>
                    <p className="text-sm text-[var(--text-muted)]">Manage your store's digital flyers and weekly deals</p>
                </div>
                {hasWriteAccess && !isRestrictedPlan && (
                    <button
                        onClick={handleCreateNew}
                        className="px-4 py-2 bg-[var(--brand-primary)] text-white font-medium rounded-lg hover:brightness-110 shadow-lg shadow-[var(--brand-primary)]/20 w-full sm:w-auto"
                    >
                        + Create Flyer
                    </button>
                )}
            </div>

            {isRestrictedPlan ? (
                <div className="text-center py-16 bg-slate-50/50 backdrop-blur-md rounded-3xl border border-[var(--glass-border)] shadow-xl p-8 max-w-xl mx-auto space-y-6 animate-fade-in my-10 relative overflow-hidden group">
                    <div className="absolute -top-12 -right-12 w-40 h-40 bg-[var(--brand-primary)]/10 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500"></div>
                    <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-blue-600/10 rounded-full blur-2xl"></div>

                    <div className="relative w-16 h-16 bg-blue-50 text-[var(--brand-primary)] rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-md shadow-blue-100/50">
                        📰
                    </div>

                    <div className="space-y-2 relative z-10">
                        <h2 className="text-2xl font-black text-[var(--text-main)]">Starter Plan: Restricted Access</h2>
                        <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
                            Digital Flyers and Catalog Ingestions are restricted on your current plan. Upgrade to the <strong>Growth Plan</strong> or above to publish weekly flyers and reach shoppers.
                        </p>
                    </div>

                    <div className="pt-4 relative z-10 flex flex-col gap-3">
                        <a 
                            href="/merchant/subscription" 
                            className="inline-block w-full py-3 bg-[var(--brand-primary)] text-white font-bold rounded-xl hover:brightness-110 shadow-lg shadow-[var(--brand-primary)]/20 transition-all text-center text-sm"
                        >
                            Upgrade to Growth Plan
                        </a>
                        <a 
                            href="/merchant/products" 
                            className="inline-block w-full py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors text-center text-xs"
                        >
                            Return to Inventory
                        </a>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {flyers.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-xl border border-[var(--glass-border)]">
                            <div className="text-6xl mb-4">📰</div>
                            <h3 className="text-xl font-bold text-[var(--text-main)] mb-2">No Flyers Created</h3>
                            <p className="text-[var(--text-muted)] mb-6">Create your first weekly flyer to attract more customers.</p>
                            {hasWriteAccess && (
                                <button
                                    onClick={handleCreateNew}
                                    className="px-6 py-2 bg-[var(--brand-primary)] text-white font-bold rounded-lg hover:brightness-110 shadow-lg shadow-[var(--brand-primary)]/20"
                                >
                                    Start Creating
                                </button>
                            )}
                        </div>
                    ) : (
                        flyers.map(flyer => (
                            <div key={flyer.id} className="bg-white rounded-xl border border-[var(--glass-border)] p-4 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex flex-col gap-4">
                                    <div className="flex gap-4 items-center w-full min-w-0">
                                        <img src={getValidFlyerImage(flyer.coverImage)} className="w-16 h-16 rounded-lg object-cover bg-gray-200 shrink-0" alt="" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <h3 className="font-bold text-[var(--text-main)] text-lg truncate">{flyer.title}</h3>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${getStatusColor(flyer.status)} font-medium border border-[var(--glass-border)] opacity-80 shrink-0`}>
                                                    {flyer.status}
                                                </span>
                                            </div>
                                            <p className="text-sm text-[var(--text-muted)] line-clamp-1 break-all">
                                                {new Date(flyer.validFrom).toLocaleDateString()} - {new Date(flyer.validUntil).toLocaleDateString()}
                                            </p>
                                            <p className="text-sm text-[var(--text-muted)] mt-1 flex items-center gap-1 shrink-0">
                                                <span>🏷️</span> {flyer.items?.length || 0} items
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 w-full justify-between sm:justify-end border-t border-[var(--glass-border)] pt-3">
                                        {hasWriteAccess ? (
                                            <>
                                                <button onClick={() => handleDuplicate(flyer)} className="flex-1 sm:flex-none justify-center px-4 py-2 border border-[var(--glass-border)] text-[var(--brand-primary)] rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors" title="Duplicate Flyer">
                                                    📋 Clone
                                                </button>
                                                <button onClick={() => handleEdit(flyer)} className="flex-1 sm:flex-none justify-center px-4 py-2 border border-[var(--glass-border)] rounded-lg text-sm font-medium text-[var(--text-main)] hover:bg-gray-50 transition-colors">
                                                    ✏️ Edit
                                                </button>
                                                <button onClick={() => handleDelete(flyer.id)} className="px-4 py-2 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex justify-center">
                                                    🗑️
                                                </button>
                                            </>
                                        ) : (
                                            <button onClick={() => handleEdit(flyer)} className="w-full sm:w-auto px-4 py-2 border border-[var(--glass-border)] rounded-lg text-sm font-medium text-[var(--text-main)] hover:bg-gray-50 transition-colors">
                                                👁️ View Details
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}

                </div>
            )}
        </div>
    );
};

export default MerchantFlyers;
