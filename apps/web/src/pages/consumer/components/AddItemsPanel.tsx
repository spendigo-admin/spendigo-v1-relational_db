import React, { useState } from 'react';
import { useWishlist } from '../../../context/WishlistContext';
import { OptimizedWishlistItem } from '../../../types/smartCart';

interface AddItemsPanelProps {
    showAddItems: boolean;
    setShowAddItems: (show: boolean) => void;
    availableStaples: any[];
    AVAILABLE_ITEMS: any[];
}

export const AddItemsPanel: React.FC<AddItemsPanelProps> = ({ showAddItems, setShowAddItems, availableStaples, AVAILABLE_ITEMS }) => {
    const { items: wishlistItems, addItem, removeItem } = useWishlist();
    const [customItemName, setCustomItemName] = useState('');

    return (
        <div className="mb-8">
            <button
                onClick={() => setShowAddItems(!showAddItems)}
                className="w-full py-3 border border-dashed border-[var(--brand-primary)] rounded-xl text-[var(--brand-primary)] font-medium hover:bg-[var(--brand-primary)]/5 transition-colors text-sm"
            >
                {showAddItems ? '▲ Hide Item Selector' : `+ Add Items${wishlistItems.length > 0 ? ` (${wishlistItems.length} in list)` : ''}`}
            </button>

            {showAddItems && (
                <div className="bg-white rounded-xl border border-[var(--glass-border)] p-4 shadow-sm animate-slide-up mt-4">

                    {/* Generic Staples Section */}
                    <div className="mb-6">
                        <h3 className="font-bold text-[var(--text-main)] mb-3 text-sm">Quick Add Essentials:</h3>

                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                placeholder="Add any item (e.g. 'Kale')"
                                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--brand-primary)] outline-none"
                                value={customItemName}
                                onChange={(e) => setCustomItemName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && customItemName.trim()) {
                                        addItem({
                                            id: `generic-${customItemName.trim()}`,
                                            name: customItemName.trim(),
                                            image: `https://ui-avatars.com/api/?name=${customItemName.trim().charAt(0)}&background=random&length=1&size=128`,
                                            category: 'General'
                                        } as any);
                                        setCustomItemName('');
                                    }
                                }}
                            />
                            <button
                                onClick={() => {
                                    if (customItemName.trim()) {
                                        addItem({
                                            id: `generic-${customItemName.trim()}`,
                                            name: customItemName.trim(),
                                            image: `https://ui-avatars.com/api/?name=${customItemName.trim().charAt(0)}&background=random&length=1&size=128`,
                                            category: 'General'
                                        } as any);
                                        setCustomItemName('');
                                    }
                                }}
                                className="bg-[var(--brand-primary)] text-white px-4 py-2 rounded-lg text-sm font-bold"
                            >
                                Add
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {availableStaples.map(staple => {
                                const isAdded = wishlistItems.some(w => w.name === staple.name);
                                return (
                                    <button
                                        key={staple.name}
                                        onClick={() => {
                                            if (isAdded) {
                                                const toRemove = wishlistItems.find(w => w.name === staple.name);
                                                if (toRemove) removeItem(toRemove.id);
                                            } else {
                                                addItem({
                                                    id: `generic-${staple.name}`,
                                                    name: staple.name,
                                                    image: `https://ui-avatars.com/api/?name=${staple.emoji}&background=random&length=1&size=128`,
                                                    category: staple.category
                                                } as any);
                                            }
                                        }}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 ${isAdded
                                            ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-md'
                                            : 'bg-white text-gray-600 border-gray-200 hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]'
                                            }`}
                                    >
                                        <span className="text-sm">{staple.emoji}</span>
                                        {staple.name}
                                        {isAdded && <span className="ml-1 text-[10px] opacity-80">✓</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {(() => {
                        // Selected chips (staples that are in the wishlist)
                        const selectedChips = availableStaples.filter(s =>
                            wishlistItems.some(w => w.name === s.name)
                        );
                        // Filter catalog items to those matching a selected chip's name
                        const filteredItems = selectedChips.length > 0
                            ? AVAILABLE_ITEMS.filter(item =>
                                selectedChips.some(chip =>
                                    item.name.toLowerCase().includes(chip.name.toLowerCase())
                                )
                            )
                            : [];

                        if (selectedChips.length === 0) {
                            return (
                                <p className="text-xs text-gray-400 text-center py-4">
                                    Select a category above to browse matching products
                                </p>
                            );
                        }

                        return filteredItems.length > 0 ? (
                            <>
                                <h3 className="font-bold text-[var(--text-main)] mb-3 text-sm">
                                    Matching: {selectedChips.map(c => c.name).join(', ')}
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                                    {filteredItems.map(item => {
                                        const isAdded = wishlistItems.some(w => w.name === item.name);
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => {
                                                    if (isAdded) {
                                                        const toRemove = wishlistItems.find(w => w.name === item.name);
                                                        if (toRemove) removeItem(toRemove.id);
                                                    } else {
                                                        addItem(item);
                                                    }
                                                }}
                                                className={`flex items-center gap-2 p-2 rounded-lg text-left transition-all text-xs ${isAdded
                                                    ? 'bg-[var(--brand-primary)] text-white shadow-md transform scale-[1.02]'
                                                    : 'bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border border-transparent'
                                                    }`}
                                            >
                                                <img src={item.image} alt="" className="w-8 h-8 rounded-md object-cover bg-white" />
                                                <span className="font-medium truncate flex-1">{item.name}</span>
                                                {isAdded && <span>✓</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <p className="text-xs text-gray-400 text-center py-4">
                                No catalog items found for {selectedChips.map(c => c.name).join(', ')}
                            </p>
                        );
                    })()}
                </div>
            )}
        </div>
    );
};
