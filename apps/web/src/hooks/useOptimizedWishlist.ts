import { useState, useMemo, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { performCachedSearch } from '../utils/fuzzy-search';
import { MerchantProduct, OptimizedWishlistItem, StoreOption } from '../types/smartCart';
import { useWishlist } from '../context/WishlistContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { useCatalog } from '../context/CatalogContext';

export const useOptimizedWishlist = () => {
    const { items: wishlistItems } = useWishlist();
    const { stores } = useMarketplace();
    const { catalog, loadCatalog } = useCatalog();

    // Ensure Global Catalog is loaded
    useEffect(() => {
        loadCatalog();
    }, [loadCatalog]);

    // State to track user's selected store for each unique product name
    const [selections, setSelections] = useState<Record<string, string>>({});
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string) => setExpandedItems(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    // 1. Build Global Product Database dynamically from Merchant Inventory
    const [merchantInventory, setMerchantInventory] = useState<any[]>([]);
    const [inventoryLoading, setInventoryLoading] = useState(true);

    useEffect(() => {
        // Fetch all in-stock merchant products to build the real-time availability map
        const q = query(collection(db, 'merchant_products'), where('available_quantity', '>', 0));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMerchantInventory(products);
            setInventoryLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Index catalog by ID for O(1) lookups instead of O(N) catalog.find() in nested loops
    const catalogMap = useMemo(() => new Map(catalog.map(c => [c.id, c])), [catalog]);

    const availabilityMap = useMemo(() => {
        const productMap: Record<string, { stores: StoreOption[] }> = {};

        merchantInventory.forEach((product: any) => {
            const masterId = product.master_product_id;
            // Relaxed check: If store missing, use fallback
            const store = stores[product.merchant_id] || { name: 'Unknown Store', id: product.merchant_id };

            if (!masterId) return;

            if (!productMap[masterId]) {
                productMap[masterId] = { stores: [] };
            }

            const masterProduct = catalogMap.get(masterId);

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
    }, [merchantInventory, stores, catalogMap]);

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

                // Try to resolve from catalog if name missing
                if (!name && p.master_product_id) {
                    const master = catalogMap.get(p.master_product_id);
                    if (master) name = master.name;
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
    }, [catalog, availabilityMap, merchantInventory, catalogMap]);

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

    const availableStaples = useMemo(() => {
        const candidates = merchantInventory
            .map((p: any) => {
                let name = p.product_name || '';
                if (!name && p.master_product_id) {
                    const master = catalogMap.get(p.master_product_id);
                    if (master) name = master.name;
                }
                return { id: p.id, name, brand: p.brand };
            })
            .filter(c => c.name.length > 0);

        return GENERIC_STAPLES.filter(staple => {
            const results = performCachedSearch(staple.name, candidates);
            return results.some(r => r.confidenceScore >= 65);
        });
    }, [merchantInventory, catalogMap]);

    // 3. Group Wishlist Items and Find Matches using ID
    const optimizerItems = useMemo(() => {
        const mapped = wishlistItems
            .map(item => {
                // Match by Master ID (Strong Link)
                let globalData = availabilityMap[item.id];

                // Fallback: Match by Name (Weak Link for legacy or generic items)
                if (!globalData) {
                    const searchName = item.name.toLowerCase();

                    // Find all merchant products that match using fuzzy search
                    const fuzzyResults = performCachedSearch(item.name, merchantInventory
                        .map((p: any) => {
                            let name = p.product_name || '';
                            if (!name && p.master_product_id) {
                                const master = catalogMap.get(p.master_product_id);
                                if (master) name = master.name;
                                }
                            return { id: p.id, name, brand: p.brand, category: p.category };
                        })
                        .filter(c => c.name.length > 0)
                    );
                    const matchedIds = new Set(
                        fuzzyResults.filter(r => r.confidenceScore >= 65).map(r => r.productId)
                    );
                    const matches = merchantInventory.filter((p: any) => matchedIds.has(p.id));

                    if (matches.length > 0) {
                        const storesMap = new Map();

                        matches.forEach((m: any) => {
                            // Relaxed check: Use fallback if store missing
                            const store = stores[m.merchant_id] || { name: 'Unknown Store', id: m.merchant_id };

                            let finalName = m.product_name;
                            let finalBrand = m.brand;
                            let finalUnit = m.unit_size || m.net_quantity_unit;

                            if (m.master_product_id) {
                                const master = catalogMap.get(m.master_product_id);
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
                let allOptions: StoreOption[] = [];
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
                } as OptimizedWishlistItem;
            });

        // Deduplicate: two wishlist entries can resolve to the same merchant products
        const seen = new Map<string, typeof mapped[0]>();
        for (const item of mapped) {
            const fingerprint = item.options.map((o: any) => o.productId).sort().join('|');
            if (!fingerprint) {
                seen.set(item.id, item);
                continue;
            }
            const existing = seen.get(fingerprint);
            if (!existing) {
                seen.set(fingerprint, item);
            } else if (existing.id.startsWith('generic-') && !item.id.startsWith('generic-')) {
                seen.set(fingerprint, item);
            }
        }
        return Array.from(seen.values());
    }, [wishlistItems, availabilityMap, merchantInventory, stores, catalogMap]);

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
                // Savings vs. average market price across all stores (honest metric)
                if (item.options.length > 1) {
                    const avgPrice = item.options.reduce((sum: number, o: any) => sum + o.price, 0) / item.options.length;
                    savings += Math.max(0, avgPrice - selectedOption.price);
                }

                // Smart Name formatting to avoid "Kraft Kraft Dinner"
                const brand = selectedOption.brand || '';
                const name = selectedOption.name || '';
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

    return {
        selections,
        expandedItems,
        toggleExpand,
        inventoryLoading,
        AVAILABLE_ITEMS,
        availableStaples,
        optimizerItems,
        handleSelectionChange,
        totalCost,
        potentialSavings,
        validCartItems
    };
};
