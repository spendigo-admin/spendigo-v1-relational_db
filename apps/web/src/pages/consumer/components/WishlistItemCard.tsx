import React from 'react';
import { OptimizedWishlistItem } from '../../../types/smartCart';
import { useWishlist } from '../../../context/WishlistContext';

interface WishlistItemCardProps {
    item: OptimizedWishlistItem;
    isExpanded: boolean;
    toggleExpand: (id: string) => void;
    currentSelection?: string;
    handleSelectionChange: (id: string, storeId: string) => void;
    onSwapItem?: (currentId: string, substituteId: string) => void;
}

export const WishlistItemCard: React.FC<WishlistItemCardProps> = ({
    item,
    isExpanded,
    toggleExpand,
    currentSelection,
    handleSelectionChange,
    onSwapItem
}) => {
    const { items: wishlistItems, removeItem } = useWishlist();
    const selectedOption = item.options.find(o => o.storeId === currentSelection);

    // Per-item reasoning
    const reasonText = (() => {
        if (!selectedOption) return null;
        if (item.options.length === 1) return 'Only store with this item';
        if (item.cheapest && selectedOption.storeId === item.cheapest.storeId) {
            if (selectedOption.normalizedUnitPrice && selectedOption.comparisonUnit) {
                return `Cheapest at $${selectedOption.normalizedUnitPrice.toFixed(2)}/${selectedOption.comparisonUnit}`;
            }
            return 'Lowest price available';
        }
        return null;
    })();

    return (
        <div className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden shadow-sm transition-shadow hover:shadow-md">
            {/* Item Header — always visible, tap to expand */}
            <div
                className="p-4 flex items-center gap-3 cursor-pointer select-none"
                onClick={() => toggleExpand(item.id)}
            >
                <img src={item.image} alt="" className="w-11 h-11 rounded-lg object-cover shadow-sm flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[var(--text-main)] text-sm truncate flex items-center gap-1.5">
                        <span>{selectedOption ? selectedOption.name : item.name}</span>
                        {(selectedOption?.is_canadian_local || item.is_canadian_local) && (
                            <span className="text-xs" title="Canadian Local">🍁</span>
                        )}
                    </h3>
                    {/* Collapsed summary: store name + price + reason */}
                    {!isExpanded && selectedOption && (
                        <div className="mt-0.5">
                            <p className="text-xs text-[var(--text-muted)] truncate">
                                {selectedOption.storeName}
                                {item.options.length > 1 && (
                                    <span className="ml-1.5 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                                        +{item.options.length - 1} more
                                    </span>
                                )}
                            </p>
                            {reasonText && (
                                <p className="text-[10px] text-green-600 font-medium mt-0.5">{reasonText}</p>
                            )}
                        </div>
                    )}
                    {isExpanded && selectedOption?.brand && (
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                            {selectedOption.brand}
                        </span>
                    )}
                </div>

                {/* Right side: price + chevron + delete */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {selectedOption && (
                        <div className="text-right">
                             {selectedOption.originalPrice && (
                                <p className="text-[10px] text-gray-400 line-through leading-none mb-0.5">
                                    ${selectedOption.originalPrice.toFixed(2)}
                                </p>
                            )}
                            <div className="flex items-center gap-1.5">
                                {selectedOption.discount && (
                                    <span className="text-[10px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-bold">
                                        {selectedOption.discount}
                                    </span>
                                )}
                                <span className="font-bold text-[var(--brand-primary)] text-sm">
                                    ${selectedOption.price.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    )}
                    <svg
                        className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const wItem = wishlistItems.find(w => w.name === item.name);
                            if (wItem) removeItem(wItem.id);
                        }}
                        className="text-gray-300 hover:text-red-400 p-1 rounded-full transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>

            {/* Store Options — only visible when expanded */}
            {isExpanded && (
                <div className="border-t border-[var(--glass-border)] divide-y divide-[var(--glass-border)]">
                    {item.options.map(option => {
                        const isSelected = currentSelection === option.storeId;
                        const isCheapest = item.cheapest && option.storeId === item.cheapest.storeId;
                        const priceDelta = item.cheapest ? option.price - item.cheapest.price : 0;

                        return (
                            <div
                                key={option.storeId}
                                onClick={() => handleSelectionChange(item.id, option.storeId)}
                                className={`p-3 flex items-center justify-between cursor-pointer transition-colors border-l-4 ${
                                    isSelected
                                        ? 'bg-[var(--brand-primary)]/5 border-[var(--brand-primary)]'
                                        : 'border-transparent hover:bg-gray-50'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${isSelected ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]' : 'border-gray-300'}`}>
                                        {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className={`font-medium text-sm leading-tight ${isSelected ? 'text-[var(--brand-primary)]' : 'text-gray-700'}`}>
                                                {(() => {
                                                    const showBrand = option.brand && !option.name?.toLowerCase().startsWith(option.brand.toLowerCase());
                                                    return (
                                                        <>
                                                            {showBrand && <span className="font-bold text-gray-900">{option.brand} </span>}
                                                            <span>{option.name}</span>
                                                            {option.unit && <span className="text-gray-400 text-xs"> ({option.unit})</span>}
                                                            {option.is_canadian_local && (
                                                                <span className="ml-1.5 text-xs" title="Canadian Local">🍁</span>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </p>
                                            {option.discount && (
                                                <span className="text-[9px] bg-red-50 text-red-500 px-1 py-0.5 rounded font-bold uppercase tracking-tight">
                                                    {option.discount}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-gray-400 mt-0.5">{option.storeName}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {isCheapest && (
                                                <span className="inline-block px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] uppercase font-bold tracking-wider rounded">
                                                    Best Price
                                                </span>
                                            )}
                                            {option.normalizedUnitPrice != null && option.comparisonUnit && (
                                                <span className="text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
                                                    ${option.normalizedUnitPrice.toFixed(2)}/{option.comparisonUnit}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right flex-shrink-0 ml-2">
                                    {option.originalPrice && (
                                        <p className="text-[10px] text-gray-400 line-through leading-none mb-0.5">
                                            ${option.originalPrice.toFixed(2)}
                                        </p>
                                    )}
                                    <div className="flex items-center justify-end gap-1">
                                        {option.priceTrend && option.priceTrend !== 'stable' && (
                                            <span className={`text-[10px] ${option.priceTrend === 'down' ? 'text-green-500' : 'text-red-400'}`}>
                                                {option.priceTrend === 'down' ? '↓' : '↑'}
                                            </span>
                                        )}
                                        <p className={`font-bold text-sm ${isSelected ? 'text-[var(--brand-primary)]' : 'text-gray-900'}`}>
                                            ${option.price.toFixed(2)}
                                        </p>
                                    </div>
                                    {priceDelta > 0 && (
                                        <p className="text-[10px] text-amber-600 font-medium">
                                            +${priceDelta.toFixed(2)} more
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {/* Substitution Suggestions */}
            {isExpanded && item.substitutions && item.substitutions.length > 0 && (
                <div className="border-t border-[var(--glass-border)] bg-amber-50/50 p-3">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700 mb-2">Cheaper Alternative{item.substitutions.length > 1 ? 's' : ''}</p>
                    {item.substitutions.map(sub => (
                        <div key={sub.id} className="flex items-center justify-between gap-2 py-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                                <img src={sub.image} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-xs font-medium text-gray-700 truncate">
                                        {sub.brand && <span className="text-gray-500">{sub.brand} </span>}
                                        {sub.name}
                                    </p>
                                    <p className="text-[10px] text-gray-400">{sub.cheapestStore}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="text-right">
                                    <p className="text-xs font-bold text-amber-700">${sub.cheapestPrice.toFixed(2)}</p>
                                    <p className="text-[10px] text-green-600 font-medium">Save ${sub.priceDifference.toFixed(2)}</p>
                                </div>
                                {onSwapItem && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onSwapItem(item.id, sub.id); }}
                                        className="text-[10px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded transition-colors"
                                    >
                                        Swap
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
