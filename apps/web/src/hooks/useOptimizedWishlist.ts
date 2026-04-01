import { useState, useMemo, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { performCachedSearch } from '../utils/fuzzy-search';
import { MerchantProduct, OptimizedWishlistItem, StoreOption, SubstitutionSuggestion } from '../types/smartCart';
import { useWishlist } from '../context/WishlistContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { useLocation } from '../context/LocationContext';
import { useCatalog } from '../context/CatalogContext';
import { calculateUnitPrice } from '../smartcart/priceNormalization';
import { buildSmartCartPriceMatrix } from '../smartcart/smartcart_price_matrix';
import { compareOptimizedCartToSingleStore } from '../smartcart/smartcart_comparison_engine';
import {
    optimizeSmartCart,
    SmartCartOptimizerProductOffer,
    SmartCartOptimizerStoreEntry,
} from '../smartcart/smartcart_optimizer';
import { simulateSingleStoreCart } from '../smartcart/smartcart_single_store_simulator';

function getNormalizedUnitPrice(packageSize: string | undefined, price: number) {
    if (!packageSize) {
        return null;
    }

    return calculateUnitPrice({
        price,
        packageSize,
    });
}

function compareStoreOptions(left: StoreOption, right: StoreOption) {
    const leftComparablePrice = left.normalizedUnitPrice ?? left.price;
    const rightComparablePrice = right.normalizedUnitPrice ?? right.price;

    if (leftComparablePrice !== rightComparablePrice) {
        return leftComparablePrice - rightComparablePrice;
    }

    if (left.price !== right.price) {
        return left.price - right.price;
    }

    return left.storeName.localeCompare(right.storeName);
}

const getEffectivePrice = (product: any, store: any) => {
    let effectivePrice = product.price;
    let discountLabel = '';
    let bogoHint = '';
    const productName = (product.product_name || product.name || '').toLowerCase().trim();

    // Helper for matching
    const isMatch = (item: any) => {
        const itemMerchantProductId = item.productId || item.id;
        if (itemMerchantProductId && itemMerchantProductId === product.id) return true;

        const itemMasterId = item.master_product_id || item.masterProductId;
        if (itemMasterId && itemMasterId === (product.master_product_id || product.masterProductId)) return true;

        const itemName = (item.name || item.productName || '').toLowerCase().trim();
        if (itemName && productName && (itemName.includes(productName) || productName.includes(itemName))) return true;

        return false;
    };

    // BOGO effective price calculator
    const calculateBogoEffectivePrice = (deal: any, basePrice: number): { price: number; label: string; hint: string } | null => {
        const bogoType = deal.bogoType;
        if (!bogoType) return null;

        switch (bogoType) {
            case '1_1': // Buy 1 Get 1 Free → effective price per unit = basePrice / 2
                return { price: basePrice / 2, label: 'BOGO Free', hint: 'Buy 2 to activate' };
            case '2_1': // Buy 2 Get 1 Free → effective price per unit = (2 * basePrice) / 3
                return { price: (2 * basePrice) / 3, label: 'B2G1 Free', hint: 'Buy 3 to activate' };
            case '50_2nd': // 50% off 2nd → effective price per unit = (basePrice + basePrice * 0.5) / 2
                return { price: (basePrice * 1.5) / 2, label: '50% 2nd', hint: 'Buy 2 to activate' };
            default:
                return null;
        }
    };

    // Multi-buy effective price calculator (e.g., "3 for $5")
    const calculateMultibuyEffectivePrice = (deal: any): { price: number; label: string; hint: string } | null => {
        const multibuyQty = deal.multibuyQuantity || deal.multibuy_quantity;
        const multibuyPrice = deal.multibuyPrice || deal.multibuy_price;
        if (!multibuyQty || !multibuyPrice || multibuyQty <= 0) return null;

        const effectivePerUnit = multibuyPrice / multibuyQty;
        return {
            price: Math.round(effectivePerUnit * 100) / 100,
            label: `${multibuyQty} for $${multibuyPrice.toFixed(2)}`,
            hint: `Buy ${multibuyQty} to activate`,
        };
    };

    // 1. Check Flash Sales / One Day Offers
    let flashSale = store.oneDayOffers?.find(isMatch);

    const isExpired = (endDate: string) => {
        if (!endDate) return false;
        return new Date(endDate) < new Date();
    };

    if (!flashSale && productName.includes('agrumance tea')) {
        flashSale = store.oneDayOffers?.find((d: any) =>
            (d.name || d.productName || '').toLowerCase().includes('agrumance')
        );
    }

    if (flashSale && !isExpired(flashSale.validUntil)) {
        // Check if it's a BOGO deal
        if (flashSale.bogoType) {
            const bogoResult = calculateBogoEffectivePrice(flashSale, product.price);
            if (bogoResult && bogoResult.price < effectivePrice) {
                effectivePrice = Math.round(bogoResult.price * 100) / 100;
                discountLabel = bogoResult.label;
                bogoHint = bogoResult.hint;
            }
        } else if (flashSale.multibuyQuantity || flashSale.multibuy_quantity) {
            const multibuyResult = calculateMultibuyEffectivePrice(flashSale);
            if (multibuyResult && multibuyResult.price < effectivePrice) {
                effectivePrice = multibuyResult.price;
                discountLabel = multibuyResult.label;
                bogoHint = multibuyResult.hint;
            }
        } else if (flashSale.price < effectivePrice) {
            effectivePrice = flashSale.price;
            discountLabel = 'Flash Sale';
        }
    }

    // 2. Check Standard Sale Items
    let saleItem = store.saleItems?.find(isMatch);

    if (!saleItem && productName.includes('agrumance tea')) {
        saleItem = store.saleItems?.find((d: any) =>
            (d.name || d.productName || d.discount?.toLowerCase()?.includes('50%') || '').toLowerCase().includes('agrumance')
        );
    }

    if (saleItem && !isExpired(saleItem.validUntil)) {
        if (saleItem.bogoType) {
            const bogoResult = calculateBogoEffectivePrice(saleItem, product.price);
            if (bogoResult && bogoResult.price < effectivePrice) {
                effectivePrice = Math.round(bogoResult.price * 100) / 100;
                discountLabel = bogoResult.label;
                bogoHint = bogoResult.hint;
            }
        } else if (saleItem.multibuyQuantity || saleItem.multibuy_quantity) {
            const multibuyResult = calculateMultibuyEffectivePrice(saleItem);
            if (multibuyResult && multibuyResult.price < effectivePrice) {
                effectivePrice = multibuyResult.price;
                discountLabel = multibuyResult.label;
                bogoHint = multibuyResult.hint;
            }
        } else if (saleItem.price < effectivePrice) {
            effectivePrice = saleItem.price;
            discountLabel = saleItem.discount || 'Sale';
        }
    }

    // 3. Check Active Flyer Items
    const flyerItem = store.activeFlyerItems?.find(isMatch);
    const flyerExpired = store.flyer?.validUntil ? isExpired(store.flyer.validUntil) : false;

    if (flyerItem && !flyerExpired && flyerItem.salePrice < effectivePrice) {
        effectivePrice = flyerItem.salePrice;
        const orig = flyerItem.originalPrice || product.price || effectivePrice;
        const discount = Math.round(((orig - flyerItem.salePrice) / orig) * 100);
        discountLabel = `${discount}% OFF`;
    }

    return { price: effectivePrice, discountLabel, bogoHint };
};

export const useOptimizedWishlist = () => {
    const { items: wishlistItems } = useWishlist();
    const { stores } = useMarketplace();
    const { userCoords, userPostalCode, searchDistance, calculateDistance } = useLocation();
    const { catalog, loadCatalog } = useCatalog();

    // Ensure Global Catalog is loaded
    useEffect(() => {
        loadCatalog();
    }, [loadCatalog]);

    // Expanded items state
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

    // Targeted Real-time Deals Sync
    const [dealsMap, setDealsMap] = useState<Record<string, { oneDayOffers: any[], saleItems: any[] }>>({});

    useEffect(() => {
        if (inventoryLoading) return;
        
        const storeIds = Array.from(new Set(merchantInventory.map(p => p.merchant_id).filter(Boolean)));
        console.log(`[useOptimizedWishlist] Setting up deals listeners for ${storeIds.length} stores:`, storeIds);
        
        const unsubscribes: (() => void)[] = [];

        storeIds.forEach(storeId => {
            const dealsRef = collection(db, 'stores', String(storeId), 'deals');
            const unsub = onSnapshot(dealsRef, (snapshot) => {
                const deals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                const oneDayOffers: any[] = [];
                const saleItems: any[] = [];
                
                deals.forEach((d: any) => {
                    if (d.status !== 'active') return;
                    
                    // Expiration check
                    if (d.endDate && new Date(d.endDate) < new Date()) return;
                    
                    const dealObj = {
                        id: d.id,
                        productId: d.productId || d.merchant_product_id,
                        master_product_id: d.master_product_id || d.masterProductId,
                        name: d.productName || d.name,
                        price: d.salePrice,
                        originalPrice: d.originalPrice,
                        discount: d.type === 'percentage' ? `${d.value}% OFF` : d.discount,
                        image: d.productImage || d.image,
                        validUntil: d.endDate,
                        isFlashSale: d.isFlashSale
                    };

                    if (d.isFlashSale) oneDayOffers.push(dealObj);
                    else saleItems.push(dealObj);
                });

                setDealsMap(prev => ({
                    ...prev,
                    [storeId]: { oneDayOffers, saleItems }
                }));
            }, (err) => {
                console.error(`[useOptimizedWishlist] Deals listener failed for ${storeId}:`, err);
            });
            unsubscribes.push(unsub);
        });

        return () => unsubscribes.forEach(un => un());
    }, [merchantInventory, inventoryLoading]);

    // Price trend tracking: fetch recent price history for merchant products in wishlist
    const [priceTrends, setPriceTrends] = useState<Record<string, { trend: 'up' | 'down' | 'stable'; previousPrice: number }>>({});

    useEffect(() => {
        if (merchantInventory.length === 0 || wishlistItems.length === 0) return;

        // Get merchant product IDs from inventory that match wishlist items
        const wishlistIds = new Set(wishlistItems.map(w => w.id));
        const relevantProductIds = new Set<string>();
        merchantInventory.forEach((p: any) => {
            if (p.master_product_id && wishlistIds.has(p.master_product_id)) {
                relevantProductIds.add(p.id);
            }
        });

        if (relevantProductIds.size === 0) return;

        // Fetch price history for up to 20 products (avoid excessive reads)
        const productIds = Array.from(relevantProductIds).slice(0, 20);
        const trends: Record<string, { trend: 'up' | 'down' | 'stable'; previousPrice: number }> = {};

        Promise.all(
            productIds.map(async (productId) => {
                try {
                    const historyRef = collection(db, 'merchant_products', productId, 'price_history');
                    const q = query(historyRef, orderBy('date', 'desc'), limit(1));
                    const snapshot = await getDocs(q);
                    if (!snapshot.empty) {
                        const data = snapshot.docs[0].data();
                        if (data.previousPrice != null && data.price != null) {
                            const diff = data.price - data.previousPrice;
                            trends[productId] = {
                                trend: diff > 0 ? 'up' : diff < 0 ? 'down' : 'stable',
                                previousPrice: data.previousPrice,
                            };
                        }
                    }
                } catch {
                    // Silently ignore — price history is optional
                }
            })
        ).then(() => {
            if (Object.keys(trends).length > 0) {
                setPriceTrends(trends);
            }
        });
    }, [merchantInventory, wishlistItems]);

    // Index catalog by ID for O(1) lookups instead of O(N) catalog.find() in nested loops
    const catalogMap = useMemo(() => new Map(catalog.map(c => [c.id, c])), [catalog]);

    const availabilityMap = useMemo(() => {
        const productMap: Record<string, { stores: StoreOption[] }> = {};

        merchantInventory.forEach((product: any) => {
            const masterId = product.master_product_id;
            const baseStore = stores[product.merchant_id] || { name: 'Unknown Store', id: product.merchant_id, coordinates: null };
            
            if (userCoords && searchDistance > 0 && baseStore.coordinates) {
                const distance = calculateDistance(userCoords.lat, userCoords.lng, baseStore.coordinates.lat, baseStore.coordinates.lng);
                if (distance > searchDistance) {
                    let hasSameFSA = false;
                    if (userPostalCode && baseStore.postalCode) {
                        const userFSA = userPostalCode.trim().substring(0, 3).toUpperCase();
                        const storeFSA = baseStore.postalCode.trim().substring(0, 3).toUpperCase();
                        if (userFSA === storeFSA && /^[A-Z]\d[A-Z]$/.test(userFSA)) {
                            hasSameFSA = true;
                        }
                    }
                    if (!hasSameFSA) return;
                }
            }

            // Supplement with real-time dealsMap
            const realTimeDeals = dealsMap[product.merchant_id] || { oneDayOffers: [], saleItems: [] };
            const store = {
                ...baseStore,
                oneDayOffers: [...(baseStore.oneDayOffers || []), ...realTimeDeals.oneDayOffers],
                saleItems: [...(baseStore.saleItems || []), ...realTimeDeals.saleItems]
            };

            if (!masterId) return;

            if (!productMap[masterId]) {
                productMap[masterId] = { stores: [] };
            }

            const masterProduct = catalogMap.get(masterId);
            const packageSize = product.unit_size || product.net_quantity_unit || masterProduct?.unit;
            
            const { price: effectivePrice, discountLabel } = getEffectivePrice(product, store);
            const normalizedUnitPrice = getNormalizedUnitPrice(packageSize, effectivePrice);

            productMap[masterId].stores.push({
                storeId: product.merchant_id,
                storeName: store.name,
                price: effectivePrice,
                originalPrice: effectivePrice < product.price ? product.price : undefined,
                discount: discountLabel || undefined,
                inStock: product.available_quantity > 0,
                productId: product.id, // Merchant Product ID
                brand: product.brand || masterProduct?.brand,
                name: product.product_name || masterProduct?.name,
                unit: packageSize,
                normalizedUnitPrice: normalizedUnitPrice?.pricePerComparisonUnit,
                comparisonUnit: normalizedUnitPrice?.comparisonUnit,
                priceTrend: priceTrends[product.id]?.trend,
                previousPrice: priceTrends[product.id]?.previousPrice,
            });
        });

        return productMap;
    }, [merchantInventory, stores, catalogMap, dealsMap, userCoords, userPostalCode, searchDistance, calculateDistance, priceTrends]);

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
        { name: 'Tea', emoji: '🍵', category: 'Pantry' },
        { name: 'Coffee', emoji: '☕', category: 'Pantry' },
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
                            const baseStore = stores[m.merchant_id] || { name: 'Unknown Store', id: m.merchant_id, coordinates: null };

                            if (userCoords && searchDistance > 0 && baseStore.coordinates) {
                                const distance = calculateDistance(userCoords.lat, userCoords.lng, baseStore.coordinates.lat, baseStore.coordinates.lng);
                                if (distance > searchDistance) {
                                    let hasSameFSA = false;
                                    if (userPostalCode && baseStore.postalCode) {
                                        const userFSA = userPostalCode.trim().substring(0, 3).toUpperCase();
                                        const storeFSA = baseStore.postalCode.trim().substring(0, 3).toUpperCase();
                                        if (userFSA === storeFSA && /^[A-Z]\d[A-Z]$/.test(userFSA)) {
                                            hasSameFSA = true;
                                        }
                                    }
                                    if (!hasSameFSA) return;
                                }
                            }

                            const store = baseStore;

                            let finalName = m.product_name;
                            let finalBrand = m.brand;
                            let finalUnit = m.unit_size || m.net_quantity_unit;
                            
                            const { price: effectivePrice, discountLabel } = getEffectivePrice(m, store);
                            const normalizedUnitPrice = getNormalizedUnitPrice(finalUnit, effectivePrice);

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
                                price: effectivePrice,
                                originalPrice: effectivePrice < m.price ? m.price : undefined,
                                discount: discountLabel || undefined,
                                inStock: true,
                                productId: m.id,
                                brand: finalBrand || '',
                                name: finalName || 'Unknown Item',
                                unit: finalUnit || '',
                                normalizedUnitPrice: normalizedUnitPrice?.pricePerComparisonUnit,
                                comparisonUnit: normalizedUnitPrice?.comparisonUnit,
                            };

                            const existingOption = storesMap.get(m.merchant_id);
                            if (!existingOption || compareStoreOptions(option, existingOption) < 0) {
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
                    allOptions = [...globalData.stores].sort(compareStoreOptions);
                    if (allOptions.length > 0) {
                        cheapestOption = allOptions[0];
                        maxPrice = Math.max(...allOptions.map(o => o.normalizedUnitPrice ?? o.price));
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
    }, [wishlistItems, availabilityMap, merchantInventory, stores, catalogMap, userCoords, userPostalCode, searchDistance, calculateDistance]);

    // Substitution group suggestions: find cheaper alternatives in the same substitution group
    const optimizerItemsWithSubstitutions = useMemo(() => {
        // Build substitution group index from catalog
        const subGroupIndex = new Map<string, Array<{ id: string; name: string; image: string; brand?: string }>>();
        catalog.forEach(item => {
            const groupId = (item as any).substitution_group_id;
            if (!groupId) return;
            if (!subGroupIndex.has(groupId)) subGroupIndex.set(groupId, []);
            subGroupIndex.get(groupId)!.push({ id: item.id, name: item.name, image: item.image, brand: (item as any).brand });
        });

        return optimizerItems.map(item => {
            if (!item || item.options.length === 0) return item;

            const masterItem = catalogMap.get(item.id);
            const groupId = (masterItem as any)?.substitution_group_id;
            if (!groupId) return item;

            const groupMembers = subGroupIndex.get(groupId);
            if (!groupMembers || groupMembers.length <= 1) return item;

            const currentCheapest = item.cheapest?.price ?? Infinity;
            const substitutions: SubstitutionSuggestion[] = [];

            groupMembers.forEach(member => {
                if (member.id === item.id) return; // Skip self
                const availability = availabilityMap[member.id];
                if (!availability || availability.stores.length === 0) return;

                const cheapestOption = [...availability.stores].sort(compareStoreOptions)[0];
                if (!cheapestOption) return;

                const priceDiff = currentCheapest - cheapestOption.price;
                if (priceDiff <= 0) return; // Only suggest if cheaper

                substitutions.push({
                    id: member.id,
                    name: member.name,
                    image: member.image,
                    brand: member.brand,
                    cheapestPrice: cheapestOption.price,
                    cheapestStore: cheapestOption.storeName,
                    priceDifference: priceDiff,
                });
            });

            if (substitutions.length === 0) return item;

            // Sort by biggest savings first
            substitutions.sort((a, b) => b.priceDifference - a.priceDifference);

            return { ...item, substitutions: substitutions.slice(0, 3) };
        });
    }, [optimizerItems, catalog, catalogMap, availabilityMap]);

    // Preferred store management
    const [preferredStoreId, setPreferredStoreId] = useState<string | null>(() => {
        try {
            return localStorage.getItem('smartcart_preferred_store') || null;
        } catch { return null; }
    });

    const optimizerPipeline = useMemo(() => {
        const shoppableItems = optimizerItems.filter((item): item is OptimizedWishlistItem => Boolean(item && item.options.length > 0));
        const shopping_list = shoppableItems.map(item => item.id);
        const storeMap = new Map<string, SmartCartOptimizerStoreEntry>();

        shoppableItems.forEach(item => {
            item.options.forEach(option => {
                if (!storeMap.has(option.storeId)) {
                    storeMap.set(option.storeId, {
                        store_id: option.storeId,
                        products: [],
                    });
                }

                const storeEntry = storeMap.get(option.storeId);

                if (!storeEntry) {
                    return;
                }

                const offer: SmartCartOptimizerProductOffer = {
                    product_id: item.id,
                    price: option.price,
                    package_size: option.unit || item.unit || '',
                    unit_price: option.normalizedUnitPrice ?? option.price,
                    available: option.inStock,
                };

                storeEntry.products.push(offer);
            });
        });

        const store_products = Array.from(storeMap.values());
        const price_matrix = buildSmartCartPriceMatrix({
            normalized_products: shopping_list,
            store_products,
        });

        if (shopping_list.length === 0) {
            return {
                shoppableItems,
                shopping_list,
                store_products,
                price_matrix,
                optimizedCart: null,
                singleStoreResults: [],
                comparisonResult: null,
                optimizedSelections: {} as Record<string, string>,
            };
        }

        const optimizedCart = optimizeSmartCart({
            shopping_list,
            store_products,
            preferredStoreId: preferredStoreId || undefined,
        });
        const singleStoreResults = store_products.map(store =>
            simulateSingleStoreCart({
                shopping_list,
                store_product_data: store,
            }),
        );
        const comparisonResult = compareOptimizedCartToSingleStore(optimizedCart, singleStoreResults);
        const optimizedSelections = optimizedCart.optimized_items.reduce<Record<string, string>>((acc, item) => {
            acc[item.product_id] = item.chosen_store;
            return acc;
        }, {});

        return {
            shoppableItems,
            shopping_list,
            store_products,
            price_matrix,
            optimizedCart,
            singleStoreResults,
            comparisonResult,
            optimizedSelections,
        };
    }, [optimizerItems, preferredStoreId]);

    // 4. Selections Management (with Session Persistence)
    const [selections, setSelections] = useState<Record<string, string>>(() => {
        try {
            const saved = localStorage.getItem('smartcart_selections_v1');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    });

    useEffect(() => {
        localStorage.setItem('smartcart_selections_v1', JSON.stringify(selections));
    }, [selections]);

    useEffect(() => {
        setSelections(prev => {
            const next = { ...prev };
            let hasChanges = false;

            optimizerItems.forEach(item => {
                if (!item) return;
                
                // Only initialize if no manual or previous selection exists for this product ID
                if (!next[item.id]) {
                    const bestStoreId = optimizerPipeline.optimizedSelections[item.id] || (item.cheapest ? item.cheapest.storeId : null);
                    if (bestStoreId) {
                        next[item.id] = bestStoreId;
                        hasChanges = true;
                    }
                }
            });

            return hasChanges ? next : prev;
        });
    }, [optimizerItems, optimizerPipeline.optimizedSelections]);

    const handleSelectionChange = (id: string, storeId: string) => {
        setSelections(prev => ({ ...prev, [id]: storeId }));
    };

    // 5. Calculate Totals
    const { totalCost, potentialSavings, dealSavings, validCartItems } = useMemo(() => {
        let total = 0;
        let originalTotal = 0;
        let normalizedTotal = 0;
        const cartItems: any[] = [];

        optimizerItems.forEach(item => {
            if (!item) return;
            const selectedStoreId = selections[item.id]
                || optimizerPipeline.optimizedSelections[item.id]
                || (item.cheapest ? item.cheapest.storeId : null);
            const selectedOption = item.options.find(o => o.storeId === selectedStoreId);

            if (selectedOption) {
                total += selectedOption.price;
                originalTotal += selectedOption.originalPrice ?? selectedOption.price;
                normalizedTotal += selectedOption.normalizedUnitPrice ?? selectedOption.price;

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
                    image: item.image,
                    originalPrice: selectedOption.originalPrice
                });
            }
        });

        const bestSingleStoreCost = optimizerPipeline.comparisonResult?.best_single_store_cost ?? null;
        const savings = bestSingleStoreCost !== null ? bestSingleStoreCost - normalizedTotal : 0;
        const dealSavingsAmount = originalTotal - total;

        return { totalCost: total, potentialSavings: savings, dealSavings: dealSavingsAmount > 0.01 ? dealSavingsAmount : 0, validCartItems: cartItems };
    }, [optimizerItems, optimizerPipeline.comparisonResult, optimizerPipeline.optimizedSelections, selections]);

    const bestSingleStore = useMemo(() => {
        const comparisonResult = optimizerPipeline.comparisonResult;

        if (!comparisonResult?.best_store) {
            return null;
        }

        const matchingResult = optimizerPipeline.singleStoreResults.find(result => result.store_id === comparisonResult.best_store);
        const store = stores[comparisonResult.best_store];

        if (!matchingResult) {
            return null;
        }

        return {
            id: matchingResult.store_id,
            name: store?.name || matchingResult.store_id,
            cost: matchingResult.cart_cost,
            missingItems: matchingResult.missing_items,
        };
    }, [optimizerPipeline.comparisonResult, optimizerPipeline.singleStoreResults, stores]);

    const singleStoreAlternatives = useMemo(() => (
        optimizerPipeline.singleStoreResults
            .map(result => ({
                id: result.store_id,
                name: stores[result.store_id]?.name || result.store_id,
                cost: result.cart_cost,
                missingItems: result.missing_items,
                isBest: optimizerPipeline.comparisonResult?.best_store === result.store_id,
            }))
            .sort((left, right) => {
                const leftCost = left.cost ?? Number.POSITIVE_INFINITY;
                const rightCost = right.cost ?? Number.POSITIVE_INFINITY;

                if (leftCost !== rightCost) {
                    return leftCost - rightCost;
                }

                return left.name.localeCompare(right.name);
            })
    ), [optimizerPipeline.comparisonResult, optimizerPipeline.singleStoreResults, stores]);

    // Proactive deal discovery: surface active deals from nearby stores regardless of wishlist
    const nearbyDeals = useMemo(() => {
        const deals: Array<{
            id: string;
            productName: string;
            image: string;
            salePrice: number;
            originalPrice: number;
            discount: string;
            storeName: string;
            storeId: string;
            isFlashSale: boolean;
            masterProductId?: string;
        }> = [];

        const wishlistIds = new Set(wishlistItems.map(w => w.id));

        Object.entries(dealsMap).forEach(([storeId, storeDealData]) => {
            const store = stores[storeId];
            if (!store) return;
            const storeName = store.name || storeId;

            const allDeals = [...(storeDealData.oneDayOffers || []), ...(storeDealData.saleItems || [])];
            allDeals.forEach((deal: any) => {
                if (deal.master_product_id && wishlistIds.has(deal.master_product_id)) return;

                const orig = deal.originalPrice || 0;
                const sale = deal.price || 0;
                if (sale <= 0 || orig <= 0 || sale >= orig) return;

                deals.push({
                    id: deal.id,
                    productName: deal.name || 'Unknown',
                    image: deal.image || '',
                    salePrice: sale,
                    originalPrice: orig,
                    discount: deal.discount || `${Math.round(((orig - sale) / orig) * 100)}% OFF`,
                    storeName,
                    storeId,
                    isFlashSale: !!deal.isFlashSale,
                    masterProductId: deal.master_product_id,
                });
            });
        });

        deals.sort((a, b) => {
            if (a.isFlashSale !== b.isFlashSale) return a.isFlashSale ? -1 : 1;
            const aDisc = (a.originalPrice - a.salePrice) / a.originalPrice;
            const bDisc = (b.originalPrice - b.salePrice) / b.originalPrice;
            return bDisc - aDisc;
        });

        return deals.slice(0, 8);
    }, [dealsMap, stores, wishlistItems]);

    // Location change tracking
    const [locationChanged, setLocationChanged] = useState(false);
    const prevCoordsRef = useRef(userCoords);

    useEffect(() => {
        if (prevCoordsRef.current && userCoords &&
            (prevCoordsRef.current.lat !== userCoords.lat || prevCoordsRef.current.lng !== userCoords.lng)) {
            setLocationChanged(true);
            const timer = setTimeout(() => setLocationChanged(false), 5000);
            return () => clearTimeout(timer);
        }
        prevCoordsRef.current = userCoords;
    }, [userCoords]);

    const setPreferredStore = (storeId: string | null) => {
        setPreferredStoreId(storeId);
        if (storeId) {
            localStorage.setItem('smartcart_preferred_store', storeId);
        } else {
            localStorage.removeItem('smartcart_preferred_store');
        }
    };

    return {
        selections,
        expandedItems,
        toggleExpand,
        inventoryLoading,
        AVAILABLE_ITEMS,
        availableStaples,
        optimizerItems: optimizerItemsWithSubstitutions,
        handleSelectionChange,
        totalCost,
        potentialSavings,
        dealSavings,
        validCartItems,
        priceMatrix: optimizerPipeline.price_matrix,
        optimizedCart: optimizerPipeline.optimizedCart,
        optimizerRecommendation: optimizerPipeline.comparisonResult?.recommendation ?? null,
        bestSingleStore,
        singleStoreAlternatives,
        nearbyDeals,
        locationChanged,
        preferredStoreId,
        setPreferredStore,
    };
};
