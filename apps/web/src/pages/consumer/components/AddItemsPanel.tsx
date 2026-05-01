import React, { useState } from 'react';
import { useWishlist } from '../../../context/WishlistContext';

interface AddItemsPanelProps {
    showAddItems: boolean;
    setShowAddItems: (show: boolean) => void;
    availableStaples: any[];
    AVAILABLE_ITEMS: any[];
}

export const AddItemsPanel: React.FC<AddItemsPanelProps> = ({ showAddItems, setShowAddItems, availableStaples, AVAILABLE_ITEMS }) => {
    const { items: wishlistItems, addItem, removeItem } = useWishlist();
    const [customItemName, setCustomItemName] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const handleCustomAdd = () => {
        if (customItemName.trim()) {
            addItem({
                id: `generic-${Date.now()}`,
                name: customItemName.trim(),
                image: `https://ui-avatars.com/api/?name=${customItemName.trim().charAt(0)}&background=random&length=1&size=128`,
                category: 'General'
            } as any);
            setCustomItemName('');
        }
    };

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
                                className="flex-1 border border-[var(--glass-border)] rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent focus:outline-none transition-colors"
                                value={customItemName}
                                onChange={(e) => setCustomItemName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCustomAdd();
                                }}
                            />
                            <button
                                onClick={handleCustomAdd}
                                className="bg-[var(--brand-primary)] text-white px-5 py-2 rounded-full text-sm font-bold hover:brightness-110 transition-all"
                            >
                                Add
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {availableStaples.map(staple => {
                                const isSelected = selectedCategory === staple.name;
                                return (
                                    <button
                                        key={staple.name}
                                        onClick={() => {
                                            setSelectedCategory(isSelected ? null : staple.name);
                                        }}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 ${isSelected
                                            ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-md'
                                            : 'bg-white text-[var(--text-muted)] border-[var(--glass-border)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]'
                                            }`}
                                    >
                                        <span className="text-sm">{staple.emoji}</span>
                                        {staple.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {(() => {
                        const searchQuery = customItemName.trim().toLowerCase();
                        
                        // Decide what to show: Priority to search query if it's long enough, otherwise category
                        const isActiveSearch = searchQuery.length >= 2;
                        
                        if (!selectedCategory && !isActiveSearch) {
                            return (
                                <p className="text-xs text-[var(--text-muted)] text-center py-4">
                                    Type an item name above or select a category to browse products
                                </p>
                            );
                        }

                        // Filter catalog items
                        const filteredItems = AVAILABLE_ITEMS.filter(item => {
                            const name = item.name.toLowerCase();
                            if (isActiveSearch) return name.includes(searchQuery);
                            if (selectedCategory) return name.includes(selectedCategory.toLowerCase());
                            return false;
                        });

                        const matchingLabel = isActiveSearch ? `Results for "${customItemName}"` : `Matching: ${selectedCategory}`;

                        return filteredItems.length > 0 ? (
                            <>
                                <h3 className="font-bold text-[var(--text-main)] mb-3 text-sm flex justify-between items-center">
                                    <span>{matchingLabel}</span>
                                    <button 
                                        onClick={() => {
                                            setSelectedCategory(null);
                                            setCustomItemName('');
                                        }}
                                        className="text-xs text-gray-500 font-normal hover:text-[var(--brand-primary)]"
                                    >
                                        Clear
                                    </button>
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
                            <p className="text-xs text-[var(--text-muted)] text-center py-4">
                                No catalog items found for {isActiveSearch ? `"${customItemName}"` : selectedCategory}
                            </p>
                        );
                    })()}
                </div>
            )}
        </div>
    );
};

