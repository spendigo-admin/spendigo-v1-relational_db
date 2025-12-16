import React, { useState } from 'react';
import '../../styles/design-system.css';

// Mock flyer data
const INITIAL_FLYERS = [
    { id: 'f1', title: 'Weekly Fresh Deals', validFrom: '2024-12-16', validUntil: '2024-12-22', status: 'active', items: 12 },
    { id: 'f2', title: 'Holiday Savings', validFrom: '2024-12-20', validUntil: '2024-12-26', status: 'scheduled', items: 8 },
];

const MerchantFlyers: React.FC = () => {
    const [flyers, setFlyers] = useState(INITIAL_FLYERS);
    const [showAddModal, setShowAddModal] = useState(false);
    const [form, setForm] = useState({ title: '', validFrom: '', validUntil: '' });

    const handleAddFlyer = () => {
        if (form.title && form.validFrom && form.validUntil) {
            const newFlyer = {
                id: `f${Date.now()}`,
                title: form.title,
                validFrom: form.validFrom,
                validUntil: form.validUntil,
                status: new Date(form.validFrom) <= new Date() ? 'active' : 'scheduled',
                items: 0,
            };
            setFlyers(prev => [...prev, newFlyer]);
            setShowAddModal(false);
            setForm({ title: '', validFrom: '', validUntil: '' });
        }
    };

    const deleteFlyer = (id: string) => {
        if (confirm('Delete this flyer?')) {
            setFlyers(prev => prev.filter(f => f.id !== id));
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
                    <h1 className="text-2xl font-bold text-[var(--text-main)]">📰 Flyers</h1>
                    <p className="text-sm text-[var(--text-muted)]">Create and manage your digital flyers</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2 bg-[var(--brand-primary)] text-white font-medium rounded-lg hover:brightness-110"
                >
                    + Create Flyer
                </button>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <p className="text-sm text-blue-700">
                    📋 <strong>Tip:</strong> Flyers appear on your store page and help customers discover your weekly deals. Add products to flyers after creating them.
                </p>
            </div>

            {/* Flyers List */}
            <div className="space-y-4">
                {flyers.map(flyer => (
                    <div key={flyer.id} className="bg-white rounded-xl border border-[var(--glass-border)] p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-bold text-[var(--text-main)]">{flyer.title}</h3>
                                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${getStatusColor(flyer.status)}`}>
                                        {flyer.status}
                                    </span>
                                </div>
                                <p className="text-sm text-[var(--text-muted)]">
                                    {new Date(flyer.validFrom).toLocaleDateString()} - {new Date(flyer.validUntil).toLocaleDateString()}
                                </p>
                                <p className="text-sm text-[var(--text-muted)]">{flyer.items} products</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="px-3 py-1.5 bg-[var(--surface-2)] rounded-lg text-sm text-[var(--text-main)]">
                                    Edit Products
                                </button>
                                <button onClick={() => deleteFlyer(flyer.id)} className="px-3 py-1.5 text-red-500 text-sm">
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {flyers.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-xl border border-[var(--glass-border)]">
                        <p className="text-4xl mb-2">📰</p>
                        <p className="text-[var(--text-muted)]">No flyers yet. Create your first flyer!</p>
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-[var(--text-main)] mb-4">Create New Flyer</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Flyer Title</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Weekly Fresh Deals"
                                    value={form.title}
                                    onChange={e => setForm({ ...form, title: e.target.value })}
                                    className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Valid From</label>
                                    <input
                                        type="date"
                                        value={form.validFrom}
                                        onChange={e => setForm({ ...form, validFrom: e.target.value })}
                                        className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Valid Until</label>
                                    <input
                                        type="date"
                                        value={form.validUntil}
                                        onChange={e => setForm({ ...form, validUntil: e.target.value })}
                                        className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={handleAddFlyer} className="flex-1 py-3 bg-[var(--brand-primary)] text-white font-medium rounded-lg">
                                Create Flyer
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

export default MerchantFlyers;
