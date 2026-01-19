import React, { useState, useMemo, useEffect } from 'react';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useCatalog } from '../../context/CatalogContext';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import '../../styles/design-system.css';

const SmartCartWishlist: React.FC = () => {
    const { items: wishlistItems, addItem, removeItem, isInWishlist, clearWishlist } = useWishlist();
    const { addItemsToCart } = useCart();
    const { stores } = useMarketplace();
    const { catalog, loadCatalog } = useCatalog();
    const [showAddItems, setShowAddItems] = useState(false);

    // Ensure Global Catalog is loaded
    useEffect(() => {
        loadCatalog();
    }, [loadCatalog]);
    const [customItemName, setCustomItemName] = useState('');

    // State to track user's selected store for each unique product name
    const [selections, setSelections] = useState<Record<string, string>>({});

    // 1. Build Global Product Database dynamically from Context
    // 1. Build Global Product Database dynamically from Merchant Inventory
    const [merchantInventory, setMerchantInventory] = useState<any[]>([]);
    const [pendingInventory, setPendingInventory] = useState<any[]>([]);

    useEffect(() => {
        // Fetch all merchant products to build the real-time availability map
        // In a real app with thousands of stores, this would be a backend function or filtered query
        const q = query(collection(db, 'merchant_products'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMerchantInventory(products);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        // Fetch pending products to resolve names for items not yet in Master Catalog
        const q = query(collection(db, 'pending_master_products'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const pending = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPendingInventory(pending);
        });
        return () => unsubscribe();
    }, []);

    const availabilityMap = useMemo(() => {
        const productMap: Record<string, {
            stores: {
                storeId: string;
                storeName: string;
                price: number;
                inStock: boolean;
                productId: string;
                brand?: string;
                name?: string;
                unit?: string;
            }[]
        }> = {};

        merchantInventory.forEach((product: any) => {
            const masterId = product.master_product_id;
            // Relaxed check: If store missing, use fallback
            const store = stores[product.merchant_id] || { name: 'Unknown Store', id: product.merchant_id };

            if (!masterId) return;

            if (!productMap[masterId]) {
                productMap[masterId] = { stores: [] };
            }

            const masterProduct = catalog.find(c => c.id === masterId);

            productMap[masterId].stores.push({
                storeId: product.merchant_id,
                storeName: store.name,
                price: product.price,
                inStock: product.available_quantity > 0,
                productId: product.id, // Merchant Product ID
                brand: product.brand || masterProduct?.brand,
                name: product.product_name || masterProduct?.name,
                unit: product.unit_size || product.net_quantity_unit || masterProduct?.unit
            });
        });

        return productMap;
    }, [merchantInventory, stores, catalog]);

    // 2. Derive Available Items from Global Catalog (Filtered by Availability)
    const AVAILABLE_ITEMS = useMemo(() => {
        // A. Start with Master Catalog Items (Existing Logic)
        const masterItems = catalog.filter(item => {
            const availability = availabilityMap[item.id];
            return availability && availability.stores.length > 0;
        });

        // B. Find "Local Only" items from Merchant Inventory
        const localItemsMap = new Map();

        merchantInventory.forEach((p: any) => {
            if (p.available_quantity <= 0) return;

            // Check if this product is already covered by a Master Product
            const hasValidMaster = p.master_product_id && availabilityMap[p.master_product_id];

            if (!hasValidMaster) {
                let name = p.product_name;

                // Try to resolve from Pending if name missing
                if (!name && p.master_product_id) {
                    const pending = pendingInventory.find((pm: any) => pm.id === p.master_product_id);
                    if (pending) name = pending.product_name;
                }

                name = name || 'Unknown Item';
                // Normalize name check to avoid duplicates against Master Items
                const isAlreadyListed = masterItems.some(m => m.name.toLowerCase() === name.toLowerCase());

                if (!isAlreadyListed) {
                    // Group by name to avoid showing duplicate entries (e.g. "Local Bread" from 3 stores -> 1 entry)
                    if (!localItemsMap.has(name)) {
                        localItemsMap.set(name, {
                            id: p.id, // Use merchant product ID as the item ID
                            name: name,
                            image: p.image || p.primary_image_url || `https://ui-avatars.com/api/?name=${name}&background=random&length=1&size=128`,
                            category: p.category || 'Store Item',
                            description: p.description || 'Instore item',
                            unit: p.unit_size || '',
                            taxable: false,
                            brand: p.brand || ''
                        });
                    }
                }
            }
        });

        const localItems = Array.from(localItemsMap.values());

        return [...masterItems, ...localItems].sort((a, b) => a.name.localeCompare(b.name));
    }, [catalog, availabilityMap, merchantInventory, pendingInventory]);

    const GENERIC_STAPLES = [
        { name: 'Milk', emoji: '🥛', category: 'Dairy' },
        { name: 'Eggs', emoji: '🥚', category: 'Dairy' },
        { name: 'Cheese', emoji: '🧀', category: 'Dairy' },
        { name: 'Bread', emoji: '🍞', category: 'Bakery' },
        { name: 'Butter', emoji: '🧈', category: 'Dairy' },
        { name: 'Chicken', emoji: '🍗', category: 'Meat' },
        { name: 'Beef', emoji: '🥩', category: 'Meat' },
        { name: 'Rice', emoji: '🍚', category: 'Pantry' },
        { name: 'Pasta', emoji: '🍝', category: 'Pantry' },
        { name: 'Apples', emoji: '🍎', category: 'Produce' },
        { name: 'Bananas', emoji: '🍌', category: 'Produce' },
        { name: 'Ice Cream', emoji: '🍨', category: 'Frozen' },
        { name: 'Free-Run Eggs', emoji: '🍳', category: 'Dairy' },
    ];

    // 3. Group Wishlist Items and Find Matches using dynamic DB
    // 3. Group Wishlist Items and Find Matches using ID
    const optimizerItems = useMemo(() => {
        // DEBUG LOGS
        console.log("Optimizer Run", { items: wishlistItems.length, inv: merchantInventory.length, catalog: catalog.length });

        return wishlistItems.map(item => {
            // Match by Master ID (Strong Link)
            let globalData = availabilityMap[item.id];

            // Fallback: Match by Name (Weak Link for legacy or generic items)
            if (!globalData) {
                const searchName = item.name.toLowerCase();
                console.log("Searching generic:", searchName);

                // Find all merchant products that match the generic name
                const matches = merchantInventory.filter((p: any) => {
                    let pName = (p.product_name || '').toLowerCase();

                    // If local name is missing, try resolving from Master Catalog
                    if (!pName && p.master_product_id) {
                        const master = catalog.find(c => c.id === p.master_product_id);
                        if (master) {
                            pName = master.name.toLowerCase();
                        }
                    }

                    const isMatch = pName.includes(searchName) && p.available_quantity > 0;
                    if (isMatch) console.log("Match:", pName);
                    return isMatch;
                });

                if (matches.length > 0) {
                    const storesMap = new Map();

                    matches.forEach((m: any) => {
                        // Relaxed check: Use fallback if store missing
                        const store = stores[m.merchant_id] || { name: 'Unknown Store', id: m.merchant_id };

                        let finalName = m.product_name;
                        let finalBrand = m.brand;
                        let finalUnit = m.unit_size || m.net_quantity_unit;

                        if (m.master_product_id) {
                            const master = catalog.find(c => c.id === m.master_product_id);
                            if (master) {
                                // Smart Resolution: If merchant name is generic/missing, use Master Name
                                const isGeneric = !finalName || (finalName.toLowerCase().trim() === searchName.trim());
                                if (isGeneric) {
                                    finalName = master.name;
                                }
                                finalBrand = finalBrand || master.brand;
                                finalUnit = finalUnit || master.unit;
                            }
                        }

                        const option = {
                            storeId: m.merchant_id,
                            storeName: store.name,
                            price: m.price,
                            inStock: true,
                            productId: m.id,
                            brand: finalBrand || '',
                            name: finalName || 'Unknown Item',
                            unit: finalUnit || ''
                        };

                        if (!storesMap.has(m.merchant_id) || storesMap.get(m.merchant_id).price > m.price) {
                            storesMap.set(m.merchant_id, option);
                        }
                    });

                    if (storesMap.size > 0) {
                        globalData = { stores: Array.from(storesMap.values()) };
                    }
                }
            }

            // If valid data found in stores
            let allOptions: any[] = [];
            let cheapestOption = null;
            let maxPrice = 0;

            if (globalData) {
                allOptions = globalData.stores.sort((a, b) => a.price - b.price);
                if (allOptions.length > 0) {
                    cheapestOption = allOptions[0];
                    maxPrice = Math.max(...allOptions.map(o => o.price));
                }
            }

            return {
                id: item.id,
                name: item.name,
                image: item.image,
                category: item.category,
                options: allOptions,
                cheapest: cheapestOption,
                maxPrice
            };
        });
    }, [wishlistItems, availabilityMap, merchantInventory, stores, catalog]);

    // 4. Initialize Selections with Cheapest Option
    useEffect(() => {
        const newSelections = { ...selections };
        let hasChanges = false;

        optimizerItems.forEach(item => {
            if (!item || !item.cheapest) return;

            const cheapestStoreId = item.cheapest.storeId;
            const currentSelection = selections[item.id] || selections[item.name]; // Fallback to name if id key missing

            // Force update to cheapest if no selection or current is more expensive
            if (!currentSelection || (currentSelection !== cheapestStoreId)) {
                const currentOption = item.options.find(o => o.storeId === currentSelection);
                if (!currentOption || currentOption.price > item.cheapest.price) {
                    newSelections[item.id] = cheapestStoreId;
                    hasChanges = true;
                }
            }
        });

        if (hasChanges) {
            setSelections(newSelections);
        }
    }, [optimizerItems]);

    const handleSelectionChange = (id: string, storeId: string) => {
        setSelections(prev => ({ ...prev, [id]: storeId }));
    };

    // 5. Calculate Totals
    // 5. Calculate Totals
    const { totalCost, potentialSavings, validCartItems } = useMemo(() => {
        let total = 0;
        let savings = 0;
        const cartItems: any[] = [];

        optimizerItems.forEach(item => {
            if (!item) return;
            const selectedStoreId = selections[item.id] || (item.cheapest ? item.cheapest.storeId : null);
            const selectedOption = item.options.find(o => o.storeId === selectedStoreId);

            if (selectedOption) {
                total += selectedOption.price;
                savings += (item.maxPrice - selectedOption.price);

                // Smart Name formatting to avoid "Kraft Kraft Dinner"
                const brand = selectedOption.brand || '';
                const name = selectedOption.name;
                const unit = selectedOption.unit ? ` (${selectedOption.unit})` : '';

                const showBrand = brand && !name.toLowerCase().startsWith(brand.toLowerCase());
                const finalName = `${showBrand ? brand + ' ' : ''}${name}${unit}`;

                cartItems.push({
                    productId: selectedOption.productId,
                    productName: finalName,
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
            {/* Header */}
            <div className="bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-secondary)] text-white p-6 shadow-md mb-6">
                <div className="max-w-6xl mx-auto px-4">
                    <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
                        <span>🛒</span> SmartCart Optimizer
                    </h1>
                    <p className="text-white/80 text-sm">Compare prices and choose the best store for each item.</p>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 pb-8">
                {/* Add Items Panel */}
                <div className="mb-8">
                    <button
                        onClick={() => setShowAddItems(!showAddItems)}
                        className="w-full py-3 border border-dashed border-[var(--brand-primary)] rounded-xl text-[var(--brand-primary)] font-medium hover:bg-[var(--brand-primary)]/5 transition-colors text-sm"
                    >
                        {showAddItems ? 'Hide Item Selector' : '+ Add More Items to Wishlist'}
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
                                                });
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
                                                });
                                                setCustomItemName('');
                                            }
                                        }}
                                        className="bg-[var(--brand-primary)] text-white px-4 py-2 rounded-lg text-sm font-bold"
                                    >
                                        Add
                                    </button>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {GENERIC_STAPLES.map(staple => {
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
                                                        });
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

                            <h3 className="font-bold text-[var(--text-main)] mb-3 text-sm">Browse Catalog:</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                                {AVAILABLE_ITEMS.filter(item =>
                                    GENERIC_STAPLES.some(staple =>
                                        item.name.toLowerCase().includes(staple.name.toLowerCase()) ||
                                        (item.category && item.category.toLowerCase().includes(staple.category.toLowerCase()))
                                    )
                                ).map(item => {
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

                {/* Main Content */}
                {wishlistItems.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-[2.5rem] border-2 border-dashed border-gray-100 shadow-inner max-w-2xl mx-auto animate-fade-in">
                        <div className="w-24 h-24 bg-gray-50 rounded-3xl flex items-center justify-center text-5xl mx-auto mb-6 shadow-sm grayscale opacity-60">
                            📋
                        </div>
                        <h2 className="text-2xl font-black text-[var(--text-main)] mb-3 tracking-tight">Wishlist is empty</h2>
                        <p className="text-[var(--text-muted)] max-w-sm mx-auto mb-8 font-medium">Add items from the selector above to start comparing prices across all stores and save big!</p>
                        <button
                            onClick={() => setShowAddItems(true)}
                            className="bg-[var(--brand-primary)] text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-[var(--brand-primary)]/20 hover:scale-105 transition-transform"
                        >
                            Get Started
                        </button>
                    </div>
                ) : (
                    <div className="lg:grid lg:grid-cols-12 lg:gap-8 relative">
                        {/* LEFT COLUMN: Main List */}
                        <div className="lg:col-span-8">
                            <div className="space-y-4">
                                {optimizerItems.map((item) => {
                                    if (!item) return null;
                                    const currentSelection = selections[item.id];
                                    const selectedOption = item.options.find(o => o.storeId === currentSelection);

                                    return (
                                        <div key={item.name} className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden shadow-sm transition-shadow hover:shadow-md">
                                            {/* Item Header */}
                                            <div className="p-4 bg-[var(--surface-1)] border-b border-[var(--glass-border)] flex items-center gap-3">
                                                <img src={item.image} alt="" className="w-12 h-12 rounded-lg object-cover shadow-sm" />
                                                <div className="flex-1">
                                                    {/* Display the SELECTED item name if available, otherwise generic */}
                                                    <h3 className="font-bold text-[var(--text-main)]">
                                                        {selectedOption ? selectedOption.name : item.name}
                                                    </h3>
                                                    {selectedOption && selectedOption.brand && (
                                                        <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded mr-2">
                                                            {selectedOption.brand}
                                                        </span>
                                                    )}
                                                    <p className="text-xs text-[var(--text-muted)] inline-block">
                                                        {item.options.length} options found
                                                    </p>
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
                                            {
                                                item.options.length > 0 ? (
                                                    <div className="divide-y divide-[var(--glass-border)]">
                                                        {item.options.map(option => {
                                                            const isSelected = currentSelection === option.storeId;
                                                            const isCheapest = item.cheapest && option.storeId === item.cheapest.storeId;
                                                            const savingsVsMax = item.maxPrice - option.price;

                                                            return (
                                                                <div
                                                                    key={option.storeId}
                                                                    onClick={() => handleSelectionChange(item.id, option.storeId)}
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
                                                                                {/* Enhanced Product Name: Brand + Name + Unit */}
                                                                                {(() => {
                                                                                    const showBrand = option.brand && !option.name.toLowerCase().startsWith(option.brand.toLowerCase());
                                                                                    return (
                                                                                        <>
                                                                                            {showBrand && <span className="font-bold text-gray-900">{option.brand} </span>}
                                                                                            <span>{option.name}</span>
                                                                                            {option.unit && <span className="text-gray-500 text-xs"> ({option.unit})</span>}
                                                                                        </>
                                                                                    );
                                                                                })()}

                                                                                <span className="block text-[10px] text-gray-400 mt-0.5">{option.storeName}</span>
                                                                            </p>
                                                                            {isCheapest && (
                                                                                <span className="inline-block px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] uppercase font-bold tracking-wider rounded mt-1">
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
                                                ) : (
                                                    <div className="p-8 text-center bg-gray-50">
                                                        <p className="text-2xl mb-2">🤷</p>
                                                        <p className="text-sm font-medium text-[var(--text-main)]">Not found nearby</p>
                                                        <p className="text-xs text-[var(--text-muted)]">We couldn't find this item in any connected stores.</p>
                                                    </div>
                                                )
                                            }
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Sticky Summary */}
                        <div className="lg:col-span-4 mt-8 lg:mt-0">
                            <div className="glass-panel p-6 sticky top-8 border-[var(--glass-border)] shadow-xl bg-white/50 backdrop-blur-xl">

                                {/* AI Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl font-bold text-[var(--text-main)]">Order Summary</h2>
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 rounded-full border border-purple-100">
                                        <span className="text-xs font-bold text-purple-600">AI Powered</span>
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[var(--text-muted)]">Estimated Total</span>
                                    <span className="text-2xl font-bold text-[var(--text-main)]">${totalCost.toFixed(2)}</span>
                                </div>

                                <div className="flex items-center justify-between mb-6 text-green-600 text-sm">
                                    <span>Estimated Savings</span>
                                    <span className="font-bold">-${potentialSavings.toFixed(2)}</span>
                                </div>

                                {/* AI Insights Panel */}
                                <div className="mb-6 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-100 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-purple-200/20 rounded-bl-full -mr-4 -mt-4"></div>

                                    <h3 className="font-bold text-sm text-purple-900 mb-3 flex items-center gap-2">
                                        <span>✨</span> Smart Insights
                                    </h3>

                                    {/* Insight 1: Trip Optimizer / Best Single Store */}
                                    {(() => {
                                        // 1. Calculate totals per store
                                        const storeTotals: Record<string, { id: string, name: string, total: number, missing: number }> = {};

                                        optimizerItems.forEach(item => {
                                            if (!item) return;
                                            // Check availability at all stores
                                            const allStoreIds = new Set(Object.keys(stores));

                                            // For each store, check if they have this item
                                            allStoreIds.forEach(storeId => {
                                                if (!storeTotals[storeId]) {
                                                    storeTotals[storeId] = {
                                                        id: storeId,
                                                        name: stores[storeId]?.name || 'Unknown',
                                                        total: 0,
                                                        missing: 0
                                                    };
                                                }

                                                const option = item.options.find(o => o.storeId === storeId);
                                                if (option) {
                                                    storeTotals[storeId].total += option.price;
                                                } else {
                                                    storeTotals[storeId].missing += 1;
                                                }
                                            });
                                        });

                                        // 2. Find Best Single Store (Most items, then cheapest)
                                        const sortedStores = Object.values(storeTotals).sort((a, b) => {
                                            if (a.missing !== b.missing) return a.missing - b.missing; // Prioritize availability
                                            return a.total - b.total; // Then price
                                        });

                                        const bestSingleStore = sortedStores[0];
                                        const uniqueStoresInSplit = new Set(optimizerItems.map(i => selections[i.id]).filter(Boolean)).size;

                                        // Only show recommendation if valid and actually different from current split
                                        if (bestSingleStore && bestSingleStore.missing === 0 && uniqueStoresInSplit > 1) {
                                            const diff = bestSingleStore.total - totalCost;

                                            return (
                                                <div className="mb-4 bg-white/60 rounded-lg p-3 border border-purple-100 shadow-sm">
                                                    <div className="flex items-start gap-2">
                                                        <div className="bg-purple-100 p-1.5 rounded-md text-purple-600 mt-0.5">
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-xs text-purple-900 uppercase tracking-wide">Trip Saver</h4>
                                                            <p className="text-xs text-[var(--text-main)] mt-1">
                                                                Get everything at <span className="font-bold">{bestSingleStore.name}</span> for <span className="font-bold">${bestSingleStore.total.toFixed(2)}</span>.
                                                            </p>
                                                            <p className="text-[10px] text-[var(--text-muted)] mt-1">
                                                                Pay ${diff.toFixed(2)} more but save {uniqueStoresInSplit - 1} trip{uniqueStoresInSplit - 1 > 1 ? 's' : ''}.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}

                                    {/* Insight 2: Missing Items */}
                                    {(() => {
                                        const categories = wishlistItems.map(i => i.category.toLowerCase());
                                        const hasCoffee = categories.some(c => c.includes('coffee') || c.includes('beverage'));
                                        const hasMilk = categories.some(c => c.includes('dairy') || c.includes('milk'));
                                        const hasPasta = categories.some(c => c.includes('pasta') || c.includes('grain'));
                                        const hasSauce = categories.some(c => c.includes('sauce') || c.includes('canned'));

                                        const suggestions = [];
                                        if (hasCoffee && !hasMilk) suggestions.push("Milk/Creamer");
                                        if (hasPasta && !hasSauce) suggestions.push("Pasta Sauce");

                                        if (suggestions.length > 0) {
                                            return (
                                                <div className="mb-3">
                                                    <p className="text-xs text-purple-800 mb-1">You might be missing:</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {suggestions.map(s => (
                                                            <span key={s} className="px-2 py-1 bg-white rounded-md text-[10px] font-bold text-purple-600 shadow-sm border border-purple-100">
                                                                + {s}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return <div className="mb-3 text-xs text-purple-800">Basket looks well balanced! 🥗</div>;
                                    })()}

                                    {/* Insight 2: Trip Consolidation */}
                                    {(() => {
                                        const storesVisited = new Set(validCartItems.map(i => i.storeId)).size;
                                        if (storesVisited > 1) {
                                            return (
                                                <div className="pt-3 border-t border-purple-100">
                                                    <div className="flex items-start gap-2">
                                                        <span className="text-lg">🚗</span>
                                                        <div>
                                                            <p className="text-xs font-bold text-purple-900">Trip Efficiency: Medium</p>
                                                            <p className="text-[10px] text-purple-700 leading-tight">
                                                                You're visiting {storesVisited} stores to save ${potentialSavings.toFixed(2)}.
                                                                Consider consolidating if time is tight.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        } else if (storesVisited === 1) {
                                            return (
                                                <div className="pt-3 border-t border-purple-100">
                                                    <div className="flex items-start gap-2">
                                                        <span className="text-lg">⚡</span>
                                                        <div>
                                                            <p className="text-xs font-bold text-green-700">Maximum Efficiency</p>
                                                            <p className="text-[10px] text-green-600 leading-tight">
                                                                One-stop shop! You're saving time and money.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
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
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
};

export default SmartCartWishlist;
