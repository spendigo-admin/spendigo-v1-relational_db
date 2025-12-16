import React from 'react';
import '../../styles/design-system.css';

// Mock Stores
const STORES = [
    { id: '1', name: 'FreshMart Toronto', distance: '0.4km', image: 'https://via.placeholder.com/300x150/111/fff?text=FreshMart' },
    { id: '2', name: 'QuickPick Convenience', distance: '1.2km', image: 'https://via.placeholder.com/300x150/333/fff?text=QuickPick' },
    { id: '3', name: 'Metro Mart', distance: '2.5km', image: 'https://via.placeholder.com/300x150/555/fff?text=Metro' },
];

const StoreList: React.FC = () => {
    return (
        <div className="min-h-screen bg-[var(--surface-0)] pb-20">
            {/* Header */}
            <div className="p-4 flex items-center justify-between sticky top-0 bg-[var(--surface-0)]/90 backdrop-blur z-10">
                <div>
                    <h1 className="text-xl font-bold text-[var(--brand-primary)]">Spendigo</h1>
                    <p className="text-xs text-[var(--text-muted)]">📍 123 Queen St W</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-[var(--surface-2)] flex items-center justify-center">
                    🛒
                </div>
            </div>

            {/* Hero */}
            <div className="px-4 mb-8">
                <div className="glass-panel p-6 bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-secondary)] text-white border-none">
                    <h2 className="text-2xl font-bold mb-2">SmartCart Optimizer</h2>
                    <p className="mb-4 text-white/90">Save an average of 15% by splitting your order automatically.</p>
                    <button className="bg-white text-[var(--brand-primary)] px-4 py-2 rounded-full font-bold text-sm">
                        Try it now
                    </button>
                </div>
            </div>

            {/* Store Grid */}
            <div className="px-4">
                <h3 className="font-bold text-lg mb-4 text-[var(--text-main)]">Nearby Stores</h3>
                <div className="grid grid-cols-1 gap-4">
                    {STORES.map(store => (
                        <div key={store.id} className="glass-panel overflow-hidden group cursor-pointer hover:border-[var(--brand-primary)] transition-colors">
                            <div className="h-32 bg-gray-800 relative">
                                <img src={store.image} alt={store.name} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute top-2 right-2 bg-black/50 backdrop-blur px-2 py-1 rounded text-xs text-white font-mono">
                                    {store.distance}
                                </div>
                            </div>
                            <div className="p-4">
                                <h4 className="font-bold text-lg text-[var(--text-main)]">{store.name}</h4>
                                <div className="flex gap-2 mt-2">
                                    <span className="text-xs bg-[var(--surface-2)] px-2 py-1 rounded text-[var(--text-muted)]">Groceries</span>
                                    <span className="text-xs bg-[var(--surface-2)] px-2 py-1 rounded text-[var(--text-muted)]">Snacks</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StoreList;
