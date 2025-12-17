import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import '../../styles/design-system.css';

// Product database with prices across different stores
const PRODUCT_PRICES: Record<string, { name: string; category: string; image: string; stores: { storeId: string; storeName: string; price: number; inStock: boolean }[] }> = {
    'avocados': {
        name: 'Organic Avocados (5pk)',
        category: 'Fresh Produce',
        image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=300',
        stores: [
            { storeId: '1', storeName: 'FreshMart', price: 6.99, inStock: true },
            { storeId: '3', storeName: 'Metro Express', price: 7.49, inStock: true },
            { storeId: '4', storeName: 'Costco Business', price: 5.99, inStock: true },
        ]
    },
    'milk': {
        name: 'Almond Milk (1L)',
        category: 'Dairy',
        image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300',
        stores: [
            { storeId: '1', storeName: 'FreshMart', price: 4.49, inStock: true },
            { storeId: '2', storeName: 'QuickPick', price: 5.29, inStock: true },
            { storeId: '3', storeName: 'Metro Express', price: 4.99, inStock: false },
        ]
    },
    'bread': {
        name: 'Sourdough Loaf',
        category: 'Bakery',
        image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300',
        stores: [
            { storeId: '1', storeName: 'FreshMart', price: 5.99, inStock: true },
            { storeId: '3', storeName: 'Metro Express', price: 4.99, inStock: true },
        ]
    },
    'bananas': {
        name: 'Organic Bananas (bunch)',
        category: 'Fresh Produce',
        image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=300',
        stores: [
            { storeId: '1', storeName: 'FreshMart', price: 2.99, inStock: true },
            { storeId: '3', storeName: 'Metro Express', price: 2.49, inStock: true },
            { storeId: '4', storeName: 'Costco Business', price: 3.99, inStock: true },
        ]
    },
    'yogurt': {
        name: 'Greek Yogurt (500g)',
        category: 'Dairy',
        image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300',
        stores: [
            { storeId: '1', storeName: 'FreshMart', price: 5.49, inStock: true },
            { storeId: '2', storeName: 'QuickPick', price: 5.99, inStock: true },
        ]
    },
    'chicken': {
        name: 'Chicken Breast (1kg)',
        category: 'Meat',
        image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=300',
        stores: [
            { storeId: '3', storeName: 'Metro Express', price: 14.99, inStock: true },
            { storeId: '4', storeName: 'Costco Business', price: 12.99, inStock: true },
        ]
    },
    'eggs': {
        name: 'Organic Eggs (12pk)',
        category: 'Dairy',
        image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=300',
        stores: [
            { storeId: '1', storeName: 'FreshMart', price: 6.99, inStock: true },
            { storeId: '3', storeName: 'Metro Express', price: 5.99, inStock: true },
            { storeId: '4', storeName: 'Costco Business', price: 8.99, inStock: true },
        ]
    },
    'chips': {
        name: 'Chips Party Size',
        category: 'Snacks',
        image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=300',
        stores: [
            { storeId: '2', storeName: 'QuickPick', price: 4.99, inStock: true },
            { storeId: '4', storeName: 'Costco Business', price: 7.99, inStock: true },
        ]
    },
};

// Available items to add to wishlist
const AVAILABLE_ITEMS = Object.entries(PRODUCT_PRICES).map(([id, data]) => ({
    id,
    name: data.name,
    category: data.category,
    image: data.image,
}));

const SmartCartWishlist: React.FC = () => {
    const { items: wishlistItems, addItem, removeItem, isInWishlist, clearWishlist } = useWishlist();
    const { addItemsToCart } = useCart();
    const [showAddItems, setShowAddItems] = useState(false);

    // Calculate optimized cart - find cheapest price for each wishlist item
    const optimizedCart = useMemo(() => {
        return wishlistItems.map(wishItem => {
            const productData = PRODUCT_PRICES[wishItem.id];
            if (!productData) return null;

            // Find cheapest in-stock option
            const inStockStores = productData.stores.filter(s => s.inStock);
            const cheapest = inStockStores.reduce((min, store) =>
                store.price < min.price ? store : min
                , inStockStores[0]);

            const highestPrice = Math.max(...productData.stores.map(s => s.price));
            const savings = highestPrice - cheapest.price;

            return {
                ...wishItem,
                stores: productData.stores,
                cheapest,
                savings,
                allPrices: productData.stores,
            };
        }).filter(Boolean);
    }, [wishlistItems]);

    // Group by store for the optimized cart
    const groupedByStore = useMemo(() => {
        const groups: Record<string, { storeName: string; items: typeof optimizedCart; total: number }> = {};

        optimizedCart.forEach(item => {
            if (!item?.cheapest) return;
            const { storeId, storeName, price } = item.cheapest;
            if (!groups[storeId]) {
                groups[storeId] = { storeName, items: [], total: 0 };
            }
            groups[storeId].items.push(item);
            groups[storeId].total += price;
        });

        return groups;
    }, [optimizedCart]);

    const totalSavings = optimizedCart.reduce((sum, item) => sum + (item?.savings || 0), 0);
    const totalCost = optimizedCart.reduce((sum, item) => sum + (item?.cheapest?.price || 0), 0);

    const handleAddAllToCart = () => {
        const itemsToCart = optimizedCart
            .map(item => {
                if (item?.cheapest) {
                    return {
                        productId: item.id,
                        productName: item.name,
                        price: item.cheapest.price,
                        quantity: 1,
                        storeId: item.cheapest.storeId,
                        storeName: item.cheapest.storeName,
                        image: item.image,
                    };
                }
                return null;
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);

        if (itemsToCart.length > 0) {
            addItemsToCart(itemsToCart);
        }
    };

    return (
        <div className="animate-fade-in pb-24">
            {/* Header */}
            <div className="bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-secondary)] text-white p-6">
                <div className="max-w-3xl mx-auto">
                    <h1 className="text-2xl font-bold mb-1">🛒 SmartCart Optimizer</h1>
                    <p className="text-white/80 text-sm">Add items to your wishlist and we'll find the cheapest prices across all stores</p>
                </div>
            </div>

            <div className="max-w-3xl mx-auto p-4 space-y-6">
                {/* Add Items Button */}
                <button
                    onClick={() => setShowAddItems(!showAddItems)}
                    className="w-full py-4 border-2 border-dashed border-[var(--brand-primary)] rounded-xl text-[var(--brand-primary)] font-medium hover:bg-[var(--brand-primary)]/5 transition-colors"
                >
                    + Add Items to Wishlist
                </button>

                {/* Add Items Panel */}
                {showAddItems && (
                    <div className="bg-white rounded-xl border border-[var(--glass-border)] p-4">
                        <h3 className="font-bold text-[var(--text-main)] mb-3">Select items to add:</h3>
                        <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                            {AVAILABLE_ITEMS.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => isInWishlist(item.id) ? removeItem(item.id) : addItem(item)}
                                    className={`flex items-center gap-2 p-2 rounded-lg text-left transition-all ${isInWishlist(item.id)
                                        ? 'bg-[var(--brand-primary)] text-white'
                                        : 'bg-[var(--surface-1)] hover:bg-[var(--surface-2)]'
                                        }`}
                                >
                                    <img src={item.image} alt="" className="w-10 h-10 rounded-lg object-cover" />
                                    <span className="text-sm font-medium truncate">{item.name}</span>
                                    {isInWishlist(item.id) && <span className="ml-auto">✓</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Wishlist Empty State */}
                {wishlistItems.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-5xl mb-4">💫</p>
                        <h2 className="text-xl font-bold text-[var(--text-main)] mb-2">Your wishlist is empty</h2>
                        <p className="text-[var(--text-muted)]">Add items above to see the best prices across stores</p>
                    </div>
                ) : (
                    <>
                        {/* Savings Banner */}
                        {totalSavings > 0 && (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                                <span className="text-3xl">💰</span>
                                <div>
                                    <p className="font-bold text-green-700">You're saving ${totalSavings.toFixed(2)}!</p>
                                    <p className="text-sm text-green-600">By shopping smart across {Object.keys(groupedByStore).length} stores</p>
                                </div>
                            </div>
                        )}

                        {/* Price Comparison Table */}
                        <div className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden">
                            <div className="p-4 border-b border-[var(--glass-border)] bg-[var(--surface-1)]">
                                <h3 className="font-bold text-[var(--text-main)]">📊 Price Comparison</h3>
                            </div>
                            <div className="divide-y divide-[var(--glass-border)]">
                                {optimizedCart.map(item => item && (
                                    <div key={item.id} className="p-4">
                                        <div className="flex items-start gap-3 mb-3">
                                            <img src={item.image} alt="" className="w-12 h-12 rounded-lg object-cover" />
                                            <div className="flex-1">
                                                <p className="font-medium text-[var(--text-main)]">{item.name}</p>
                                                <p className="text-xs text-[var(--text-muted)]">{item.category}</p>
                                            </div>
                                            <button onClick={() => removeItem(item.id)} className="text-red-500 text-sm">Remove</button>
                                        </div>

                                        {/* Store Prices */}
                                        <div className="space-y-2 ml-15">
                                            {item.allPrices?.map(store => (
                                                <div
                                                    key={store.storeId}
                                                    className={`flex items-center justify-between p-2 rounded-lg ${store.storeId === item.cheapest?.storeId
                                                        ? 'bg-green-50 border border-green-200'
                                                        : 'bg-[var(--surface-1)]'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {store.storeId === item.cheapest?.storeId && <span className="text-green-600">✓</span>}
                                                        <span className={`text-sm ${!store.inStock ? 'line-through text-[var(--text-muted)]' : ''}`}>
                                                            {store.storeName}
                                                        </span>
                                                        {!store.inStock && <span className="text-xs text-red-500">(Out of stock)</span>}
                                                    </div>
                                                    <span className={`font-bold ${store.storeId === item.cheapest?.storeId
                                                        ? 'text-green-600'
                                                        : 'text-[var(--text-main)]'
                                                        }`}>
                                                        ${store.price.toFixed(2)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Optimized Cart Summary */}
                        <div className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden">
                            <div className="p-4 border-b border-[var(--glass-border)] bg-[var(--surface-1)]">
                                <h3 className="font-bold text-[var(--text-main)]">🎯 Your Optimized Cart</h3>
                                <p className="text-sm text-[var(--text-muted)]">Items grouped by store for easy shopping</p>
                            </div>

                            {Object.entries(groupedByStore).map(([storeId, data]) => (
                                <div key={storeId} className="p-4 border-b border-[var(--glass-border)] last:border-b-0">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-[var(--text-main)]">🏪 {data.storeName}</span>
                                        <span className="font-bold text-[var(--brand-primary)]">${data.total.toFixed(2)}</span>
                                    </div>
                                    <div className="space-y-1">
                                        {data.items.map(item => item && (
                                            <div key={item.id} className="flex justify-between text-sm">
                                                <span className="text-[var(--text-muted)]">{item.name}</span>
                                                <span>${item.cheapest?.price.toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            <div className="p-4 bg-[var(--surface-1)] flex justify-between items-center">
                                <div>
                                    <p className="text-sm text-[var(--text-muted)]">Total</p>
                                    <p className="text-2xl font-bold text-[var(--brand-primary)]">${totalCost.toFixed(2)}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={clearWishlist} className="px-4 py-2 border border-[var(--glass-border)] rounded-lg text-sm">
                                        Clear List
                                    </button>
                                    <button onClick={handleAddAllToCart} className="px-6 py-2 bg-[var(--brand-primary)] text-white font-medium rounded-lg hover:brightness-110">
                                        Add All to Cart
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* How It Works */}
                <div className="bg-blue-50 rounded-xl p-4">
                    <h3 className="font-bold text-blue-800 mb-2">💡 How SmartCart Works</h3>
                    <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                        <li>Add items you want to buy to your wishlist</li>
                        <li>We compare prices across all partner stores</li>
                        <li>SmartCart finds the cheapest option for each item</li>
                        <li>Add everything to cart with one click!</li>
                    </ol>
                </div>
            </div>
        </div>
    );
};

export default SmartCartWishlist;
