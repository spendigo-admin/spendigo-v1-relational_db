import React, { useState, useMemo, useEffect } from 'react';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import '../../styles/design-system.css';
import { STORE_DATA } from '../../data/productData';

// Helper to group products by normalized name
function buildGlobalProductDatabaseByName() {
    const productMap: Record<string, {
        name: string;
        category: string;
        image: string;
        stores: { storeId: string; storeName: string; price: number; inStock: boolean; productId: string }[]
    }> = {};

    Object.values(STORE_DATA).forEach((store: any) => {
        store.products?.forEach((product: any) => {
            const normalizedName = product.name; // In a real app, use fuzzy matching or UPC
            if (!productMap[normalizedName]) {
                productMap[normalizedName] = {
                    name: product.name,
                    category: product.category,
                    image: product.image,
                    stores: []
                };
            }
            productMap[normalizedName].stores.push({
                storeId: store.id,
                storeName: store.name,
                price: product.price,
                inStock: true,
                productId: product.id
            });
        });
    });

    return productMap;
}

const GLOBAL_PRODUCTS = buildGlobalProductDatabaseByName();



// Available items for the localized "Add Items" panel
const AVAILABLE_ITEMS = Object.values(GLOBAL_PRODUCTS).map(data => {
    // Find the cheapest option and use its product ID
    const cheapestStore = [...data.stores].sort((a, b) => a.price - b.price)[0];
    return {
        id: cheapestStore.productId,
        name: data.name,
        category: data.category,
        image: data.image,
    };
});

const SmartCartWishlist: React.FC = () => {
    const { items: wishlistItems, addItem, removeItem, isInWishlist, clearWishlist } = useWishlist();
    const { addItemsToCart } = useCart();
    const [showAddItems, setShowAddItems] = useState(false);

    // State to track user's selected store for each unique product name
    // Key: ProductName, Value: StoreId
    const [selections, setSelections] = useState<Record<string, string>>({});

    // 1. Group Wishlist Items and Find Matches
    const optimizerItems = useMemo(() => {
        return wishlistItems.map(item => {
            // Find global data by name
            const globalData = GLOBAL_PRODUCTS[item.name];
            if (!globalData) return null;

            const allOptions = globalData.stores.sort((a, b) => a.price - b.price);
            const cheapestOption = allOptions[0];
            const maxPrice = Math.max(...allOptions.map(o => o.price));

            return {
                name: item.name,
                image: item.image,
                category: item.category,
                options: allOptions,
                cheapest: cheapestOption,
                maxPrice
            };
        }).filter(Boolean);
    }, [wishlistItems]);

    // 2. Initialize Selections with Cheapest Option
    useEffect(() => {
        const newSelections = { ...selections };
        let hasChanges = false;

        optimizerItems.forEach(item => {
            if (!item) return;
            const cheapestStoreId = item.cheapest.storeId;
            const currentSelection = selections[item.name];



            // Force update to cheapest if:
            // 1. No selection exists
            // 2. OR current selection is MORE EXPENSIVE (Auto-Optimize behavior)
            // Note: This effectively makes 'Optimize' the default behavior. User can manually change it, 
            // but if they reload or data changes, it might revert to cheapest. This is likely desired for an "Optimizer".
            if (!currentSelection || (currentSelection !== cheapestStoreId)) {
                // Check if we should override. For now, let's say YES because the user complained about it not optimizing.
                // We only override if the current selection is actually *more expensive* than the cheapest.
                const currentOption = item.options.find(o => o.storeId === currentSelection);
                if (!currentOption || currentOption.price > item.cheapest.price) {

                    newSelections[item.name] = cheapestStoreId;
                    hasChanges = true;
                }
            }
        });

        if (hasChanges) {
            setSelections(newSelections);
        }
    }, [optimizerItems]); // Removing selections from dependency to avoid loop, only run when data changes

    const handleSelectionChange = (productName: string, storeId: string) => {
        setSelections(prev => ({ ...prev, [productName]: storeId }));
    };

    // 3. Calculate Totals based on Selections
    const { totalCost, potentialSavings, validCartItems } = useMemo(() => {
        let total = 0;
        let savings = 0;
        const cartItems: any[] = [];

        optimizerItems.forEach(item => {
            if (!item) return;
            const selectedStoreId = selections[item.name] || item.cheapest.storeId;
            const selectedOption = item.options.find(o => o.storeId === selectedStoreId);

            if (selectedOption) {
                total += selectedOption.price;
                // Calculate savings as difference between most expensive and selected option
                savings += (item.maxPrice - selectedOption.price);

                cartItems.push({
                    productId: selectedOption.productId,
                    productName: item.name,
                    price: selectedOption.price,
                    quantity: 1,
                    storeId: selectedOption.storeId,
                    storeName: selectedOption.storeName,
                    image: item.image
                });
            }
        });

        return { totalCost: total, potentialSavings: savings, validCartItems: cartItems };
    }, [optimizerItems, selections]);

    const handleAddAllToCart = () => {
        if (validCartItems.length > 0) {
            addItemsToCart(validCartItems);
        }
    };

    return (
        <div className="animate-fade-in pb-12">

            {/* Header (Non-sticky to align with Cart) */}
            <div className="bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-secondary)] text-white p-6 shadow-md mb-6">
                <div className="max-w-6xl mx-auto px-4">
                    <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
                        <span>🛒</span> SmartCart Optimizer
                    </h1>
                    <p className="text-white/80 text-sm">Compare prices and choose the best store for each item.</p>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 pb-8">

                {/* 1. Add Items Panel (Full Width) */}
                <div className="mb-8">
                    <button
                        onClick={() => setShowAddItems(!showAddItems)}
                        className="w-full py-3 border border-dashed border-[var(--brand-primary)] rounded-xl text-[var(--brand-primary)] font-medium hover:bg-[var(--brand-primary)]/5 transition-colors text-sm"
                    >
                        {showAddItems ? 'Hide Item Selector' : '+ Add More Items to Wishlist'}
                    </button>

                    {showAddItems && (
                        <div className="bg-white rounded-xl border border-[var(--glass-border)] p-4 shadow-sm animate-slide-up mt-4">
                            <h3 className="font-bold text-[var(--text-main)] mb-3 text-sm">Tap to add/remove:</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                                {AVAILABLE_ITEMS.map(item => {
                                    const isAdded = wishlistItems.some(w => w.name === item.name);
                                    return (
                                        <button
                                            key={item.name}
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
                        </div>
                    )}
                </div>

                {/* 2. Main Content Grid */}
                <div className="lg:grid lg:grid-cols-12 lg:gap-8 bg relative">

                    {/* LEFT COLUMN: Main List (Span 8) */}
                    <div className="lg:col-span-8">
                        {wishlistItems.length === 0 ? (
                            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                                <p className="text-5xl mb-4 grayscale opacity-50">📋</p>
                                <h2 className="text-xl font-bold text-[var(--text-main)] mb-2">Wishlist is empty</h2>
                                <p className="text-[var(--text-muted)]">Add items to start comparing prices!</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {optimizerItems.map((item) => {
                                    if (!item) return null;
                                    const currentSelection = selections[item.name];

                                    return (
                                        <div key={item.name} className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden shadow-sm transition-shadow hover:shadow-md">
                                            {/* Item Header */}
                                            <div className="p-4 bg-[var(--surface-1)] border-b border-[var(--glass-border)] flex items-center gap-3">
                                                <img src={item.image} alt="" className="w-12 h-12 rounded-lg object-cover shadow-sm" />
                                                <div className="flex-1">
                                                    <h3 className="font-bold text-[var(--text-main)]">{item.name}</h3>
                                                    <p className="text-xs text-[var(--text-muted)]">{item.category} • {item.options.length} options found</p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const wItem = wishlistItems.find(w => w.name === item.name);
                                                        if (wItem) removeItem(wItem.id);
                                                    }}
                                                    className="text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>

                                            {/* Store Options */}
                                            <div className="divide-y divide-[var(--glass-border)]">
                                                {item.options.map(option => {
                                                    const isSelected = currentSelection === option.storeId;
                                                    const isCheapest = option.storeId === item.cheapest.storeId;
                                                    const savingsVsMax = item.maxPrice - option.price;

                                                    return (
                                                        <div
                                                            key={option.storeId}
                                                            onClick={() => handleSelectionChange(item.name, option.storeId)}
                                                            className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${isSelected ? 'bg-[var(--brand-primary)]/5' : 'hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${isSelected ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]' : 'border-gray-300'
                                                                    }`}>
                                                                    {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                                                                </div>
                                                                <div>
                                                                    <p className={`font-medium text-sm ${isSelected ? 'text-[var(--brand-primary)]' : 'text-gray-700'}`}>
                                                                        {option.storeName}
                                                                    </p>
                                                                    {isCheapest && (
                                                                        <span className="inline-block px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] uppercase font-bold tracking-wider rounded">
                                                                            Best Price
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="text-right">
                                                                <p className={`font-bold ${isSelected ? 'text-[var(--brand-primary)]' : 'text-gray-900'}`}>
                                                                    ${option.price.toFixed(2)}
                                                                </p>
                                                                {savingsVsMax > 0 && (
                                                                    <p className="text-[10px] text-green-600 font-medium">
                                                                        Save ${(savingsVsMax).toFixed(2)}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Sticky Summary (Span 4) */}
                    <div className="lg:col-span-4 mt-8 lg:mt-0">
                        {wishlistItems.length > 0 && (
                            <div className="glass-panel p-6 sticky top-8 border-[var(--glass-border)] shadow-xl bg-white/50 backdrop-blur-xl">
                                <h2 className="text-xl font-bold text-[var(--text-main)] mb-4">Order Summary</h2>

                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[var(--text-muted)]">Estimated Total</span>
                                    <span className="text-2xl font-bold text-[var(--text-main)]">${totalCost.toFixed(2)}</span>
                                </div>

                                <div className="flex items-center justify-between mb-6 text-green-600 text-sm">
                                    <span>Estimated Savings</span>
                                    <span className="font-bold">-${potentialSavings.toFixed(2)}</span>
                                </div>

                                <div className="border-t border-[var(--glass-border)] my-4"></div>

                                <button
                                    onClick={handleAddAllToCart}
                                    className="w-full bg-[var(--brand-primary)] text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-[var(--brand-primary)]/20 active:scale-95 hover:brightness-110 transition-all flex items-center justify-center gap-2"
                                >
                                    <span>Add Selected to Cart</span>
                                    <span className="bg-white/20 px-2 py-0.5 rounded text-sm">{validCartItems.length}</span>
                                </button>

                                <p className="text-xs text-[var(--text-muted)] text-center mt-3">
                                    Proceed to cart to verify availability
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SmartCartWishlist;
