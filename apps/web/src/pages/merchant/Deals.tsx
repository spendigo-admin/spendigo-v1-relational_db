import React, { useState } from 'react';
import '../../styles/design-system.css';

// Mock deals data
const INITIAL_DEALS = [
    { id: 'd1', type: 'one_day', name: 'Buy 2 Get 1 Free - Avocados', discount: '33%', originalPrice: 8.99, salePrice: 5.99, endsAt: '2024-12-16T18:00:00', status: 'active' },
    { id: 'd2', type: 'sale', name: 'Greek Yogurt Special', discount: '25%', originalPrice: 5.49, salePrice: 4.12, endsAt: '2024-12-22T23:59:59', status: 'active' },
    { id: 'd3', type: 'one_day', name: 'Flash Sale - Bread', discount: '50%', originalPrice: 5.99, salePrice: 2.99, endsAt: '2024-12-17T12:00:00', status: 'scheduled' },
];

type DealType = 'one_day' | 'sale' | 'clearance';

const MerchantDeals: React.FC = () => {
    const [deals, setDeals] = useState(INITIAL_DEALS);
    const [showAddModal, setShowAddModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'one_day' | 'sale'>('all');
    const [form, setForm] = useState({ name: '', type: 'sale' as DealType, originalPrice: '', discountPercent: '', endsAt: '' });

    const filteredDeals = activeTab === 'all' ? deals : deals.filter(d => d.type === activeTab);

    const handleAddDeal = () => {
        if (form.name && form.originalPrice && form.discountPercent) {
            const original = parseFloat(form.originalPrice);
            const discount = parseFloat(form.discountPercent);
            const sale = original * (1 - discount / 100);

            const newDeal = {
                id: `d${Date.now()}`,
                type: form.type,
                name: form.name,
                discount: `${discount}%`,
                originalPrice: original,
                salePrice: parseFloat(sale.toFixed(2)),
                endsAt: form.endsAt,
                status: 'active',
            };
            setDeals(prev => [...prev, newDeal]);
            setShowAddModal(false);
            setForm({ name: '', type: 'sale', originalPrice: '', discountPercent: '', endsAt: '' });
        }
    };

    const deleteDeal = (id: string) => {
        if (confirm('Delete this deal?')) {
            setDeals(prev => prev.filter(d => d.id !== id));
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'one_day': return '⏰ One-Day Offer';
            case 'sale': return '🏷️ Sale';
            case 'clearance': return '🔥 Clearance';
            default: return type;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-700';
            case 'scheduled': return 'bg-blue-100 text-blue-700';
            case 'expired': return 'bg-gray-100 text-gray-600';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-main)]">🏷️ Deals & Offers</h1>
                    <p className="text-sm text-[var(--text-muted)]">Create special offers to attract customers</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2 bg-[var(--brand-primary)] text-white font-medium rounded-lg hover:brightness-110"
                >
                    + Create Deal
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                {(['all', 'one_day', 'sale'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${activeTab === tab ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
                    >
                        {tab === 'one_day' ? 'One-Day Offers' : tab === 'all' ? 'All Deals' : 'Sale Items'}
                    </button>
                ))}
            </div>

            {/* Info Banner */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                <p className="text-sm text-yellow-700">
                    💡 <strong>Types:</strong>
                    <span className="ml-2"><strong>One-Day Offers</strong> - Limited time, high urgency</span>
                    <span className="ml-4"><strong>Sale Items</strong> - Longer term discounts</span>
                </p>
            </div>

            {/* Deals List */}
            <div className="space-y-4">
                {filteredDeals.map(deal => (
                    <div key={deal.id} className="bg-white rounded-xl border border-[var(--glass-border)] p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-[var(--brand-primary)]/10 flex items-center justify-center text-2xl">
                                    {deal.type === 'one_day' ? '⏰' : '🏷️'}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-[var(--text-main)]">{deal.name}</h3>
                                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${getStatusColor(deal.status)}`}>
                                            {deal.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-[var(--text-muted)]">{getTypeLabel(deal.type)}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-lg font-bold text-green-600">${deal.salePrice.toFixed(2)}</span>
                                        <span className="text-sm text-[var(--text-muted)] line-through">${deal.originalPrice.toFixed(2)}</span>
                                        <span className="text-sm font-bold text-red-500">{deal.discount} OFF</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="text-right text-sm text-[var(--text-muted)]">
                                    Ends: {new Date(deal.endsAt).toLocaleDateString()}
                                </div>
                                <button onClick={() => deleteDeal(deal.id)} className="px-3 py-1.5 text-red-500 text-sm">
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {filteredDeals.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-xl border border-[var(--glass-border)]">
                        <p className="text-4xl mb-2">🏷️</p>
                        <p className="text-[var(--text-muted)]">No deals yet. Create your first offer!</p>
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-[var(--text-main)] mb-4">Create New Deal</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Deal Name / Product</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Organic Avocados (5pk)"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Deal Type</label>
                                <select
                                    value={form.type}
                                    onChange={e => setForm({ ...form, type: e.target.value as DealType })}
                                    className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg"
                                >
                                    <option value="sale">🏷️ Sale Item</option>
                                    <option value="one_day">⏰ One-Day Offer</option>
                                    <option value="clearance">🔥 Clearance</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Original Price ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={form.originalPrice}
                                        onChange={e => setForm({ ...form, originalPrice: e.target.value })}
                                        className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Discount (%)</label>
                                    <input
                                        type="number"
                                        placeholder="e.g., 25"
                                        value={form.discountPercent}
                                        onChange={e => setForm({ ...form, discountPercent: e.target.value })}
                                        className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Ends At</label>
                                <input
                                    type="datetime-local"
                                    value={form.endsAt}
                                    onChange={e => setForm({ ...form, endsAt: e.target.value })}
                                    className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg"
                                />
                            </div>
                            {form.originalPrice && form.discountPercent && (
                                <div className="bg-green-50 p-3 rounded-lg">
                                    <p className="text-sm text-green-700">
                                        Sale Price: <strong>${(parseFloat(form.originalPrice) * (1 - parseFloat(form.discountPercent) / 100)).toFixed(2)}</strong>
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={handleAddDeal} className="flex-1 py-3 bg-[var(--brand-primary)] text-white font-medium rounded-lg">
                                Create Deal
                            </button>
                            <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 border border-[var(--glass-border)] rounded-lg">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MerchantDeals;
