import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import '../../styles/design-system.css';

// Mock all products from all stores for search
const ALL_PRODUCTS = [
    // FreshMart
    { id: 'p1', name: 'Organic Avocados (5pk)', price: 6.99, originalPrice: 8.99, storeId: '1', storeName: 'FreshMart', category: 'Fresh Produce', image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=300&h=300&fit=crop' },
    { id: 'p2', name: 'Almond Milk (1L)', price: 4.49, storeId: '1', storeName: 'FreshMart', category: 'Dairy', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&h=300&fit=crop' },
    { id: 'p3', name: 'Sourdough Loaf', price: 5.99, storeId: '1', storeName: 'FreshMart', category: 'Bakery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=300&fit=crop' },
    { id: 'p4', name: 'Organic Bananas (bunch)', price: 2.99, storeId: '1', storeName: 'FreshMart', category: 'Fresh Produce', image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=300&h=300&fit=crop' },
    { id: 'p5', name: 'Greek Yogurt (500g)', price: 5.49, storeId: '1', storeName: 'FreshMart', category: 'Dairy', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300&h=300&fit=crop' },
    { id: 'p6', name: 'Olive Oil (750ml)', price: 12.99, storeId: '1', storeName: 'FreshMart', category: 'Pantry', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=300&h=300&fit=crop' },
    // QuickPick
    { id: 'p7', name: 'Energy Drink (4pk)', price: 9.99, storeId: '2', storeName: 'QuickPick', category: 'Drinks', image: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=300&h=300&fit=crop' },
    { id: 'p8', name: 'Chips Party Size', price: 4.99, storeId: '2', storeName: 'QuickPick', category: 'Snacks', image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=300&h=300&fit=crop' },
    { id: 'p9', name: 'Ice Cream Pint', price: 6.99, storeId: '2', storeName: 'QuickPick', category: 'Snacks', image: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=300&h=300&fit=crop' },
    // Metro Express
    { id: 'p10', name: 'Chicken Breast (1kg)', price: 14.99, storeId: '3', storeName: 'Metro Express', category: 'Meat', image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=300&h=300&fit=crop' },
    { id: 'p11', name: 'Salmon Fillet (500g)', price: 18.99, storeId: '3', storeName: 'Metro Express', category: 'Seafood', image: 'https://images.unsplash.com/photo-1499125562588-29fb8a56b5d5?w=300&h=300&fit=crop' },
    // Costco Business
    { id: 'p12', name: 'Paper Towels (12pk)', price: 24.99, storeId: '4', storeName: 'Costco Business', category: 'Cleaning', image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=300&h=300&fit=crop' },
    { id: 'p13', name: 'Bottled Water (24pk)', price: 8.99, storeId: '4', storeName: 'Costco Business', category: 'Bulk', image: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=300&h=300&fit=crop' },
    // Mac's Corner (Convenience)
    { id: 'p14', name: 'Coca-Cola (2L)', price: 3.49, storeId: '5', storeName: "Mac's Corner", category: 'Drinks', image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=300&h=300&fit=crop' },
    { id: 'p15', name: "Lay's Classic Chips", price: 4.29, storeId: '5', storeName: "Mac's Corner", category: 'Snacks', image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=300&h=300&fit=crop' },
    { id: 'p16', name: 'Red Bull (4pk)', price: 9.99, storeId: '5', storeName: "Mac's Corner", category: 'Drinks', image: 'https://images.unsplash.com/photo-1613214153279-af3eb67fc2c9?w=300&h=300&fit=crop' },
    { id: 'p17', name: 'Doritos Nacho Cheese', price: 4.49, storeId: '5', storeName: "Mac's Corner", category: 'Snacks', image: 'https://images.unsplash.com/photo-1600952841320-db92ec4047ca?w=300&h=300&fit=crop' },
    // Hasty Mart (Convenience)
    { id: 'p20', name: 'Monster Energy', price: 3.99, storeId: '6', storeName: 'Hasty Mart', category: 'Drinks', image: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=300&h=300&fit=crop' },
    { id: 'p21', name: 'Snickers Bar', price: 1.79, storeId: '6', storeName: 'Hasty Mart', category: 'Candy', image: 'https://images.unsplash.com/photo-1534260164206-2a3a4a72891d?w=300&h=300&fit=crop' },
    { id: 'p22', name: 'Pepsi (6pk)', price: 5.99, storeId: '6', storeName: 'Hasty Mart', category: 'Drinks', image: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=300&h=300&fit=crop' },
    { id: 'p23', name: 'Pringles Original', price: 3.49, storeId: '6', storeName: 'Hasty Mart', category: 'Snacks', image: 'https://images.unsplash.com/photo-1600952841320-db92ec4047ca?w=300&h=300&fit=crop' },
    // Corner Bodega
    { id: 'p26', name: 'Deli Sandwich', price: 7.99, storeId: '7', storeName: 'Corner Bodega', category: 'Deli', image: 'https://images.unsplash.com/photo-1539252554453-80ab65ce3586?w=300&h=300&fit=crop' },
    { id: 'p27', name: 'Arizona Iced Tea', price: 1.29, storeId: '7', storeName: 'Corner Bodega', category: 'Drinks', image: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=300&h=300&fit=crop' },
    { id: 'p28', name: 'Takis Fuego', price: 3.99, storeId: '7', storeName: 'Corner Bodega', category: 'Snacks', image: 'https://images.unsplash.com/photo-1600952841320-db92ec4047ca?w=300&h=300&fit=crop' },
    { id: 'p30', name: 'Chopped Cheese Sandwich', price: 8.99, storeId: '7', storeName: 'Corner Bodega', category: 'Deli', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=300&h=300&fit=crop' },
];

const CATEGORIES = ['All', 'Fresh Produce', 'Dairy', 'Bakery', 'Snacks', 'Drinks', 'Candy', 'Deli', 'Meat', 'Seafood', 'Cleaning', 'Bulk'];

const Search: React.FC = () => {
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [sortBy, setSortBy] = useState<'relevance' | 'price_low' | 'price_high'>('relevance');

    const filteredProducts = useMemo(() => {
        let results = ALL_PRODUCTS;

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            results = results.filter(p =>
                p.name.toLowerCase().includes(query) ||
                p.category.toLowerCase().includes(query) ||
                p.storeName.toLowerCase().includes(query)
            );
        }

        // Filter by category
        if (selectedCategory !== 'All') {
            results = results.filter(p => p.category === selectedCategory);
        }

        // Sort
        if (sortBy === 'price_low') {
            results = [...results].sort((a, b) => a.price - b.price);
        } else if (sortBy === 'price_high') {
            results = [...results].sort((a, b) => b.price - a.price);
        }

        return results;
    }, [searchQuery, selectedCategory, sortBy]);

    // Group by store
    const groupedByStore = useMemo(() => {
        const groups: Record<string, typeof ALL_PRODUCTS> = {};
        filteredProducts.forEach(product => {
            if (!groups[product.storeName]) {
                groups[product.storeName] = [];
            }
            groups[product.storeName].push(product);
        });
        return groups;
    }, [filteredProducts]);

    const handleQuickAdd = (product: typeof ALL_PRODUCTS[0]) => {
        addToCart({
            productId: product.id,
            productName: product.name,
            price: product.price,
            quantity: 1,
            storeId: product.storeId,
            storeName: product.storeName,
            image: product.image
        });
    };

    return (
        <div className="animate-fade-in pb-20">
            {/* Search Header */}
            <div className="sticky top-14 z-30 bg-white border-b border-[var(--glass-border)] p-4">
                <div className="max-w-3xl mx-auto">
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">🔍</span>
                        <input
                            type="text"
                            placeholder="Search products across all stores..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-xl text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--brand-primary)]"
                            autoFocus
                        />
                    </div>

                    {/* Category Filters */}
                    <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${selectedCategory === cat ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sort & Results Count */}
            <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
                <p className="text-sm text-[var(--text-muted)]">
                    {filteredProducts.length} result{filteredProducts.length !== 1 ? 's' : ''}
                </p>
                <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as any)}
                    className="text-sm bg-transparent text-[var(--text-muted)] border-none cursor-pointer"
                >
                    <option value="relevance">Relevance</option>
                    <option value="price_low">Price: Low to High</option>
                    <option value="price_high">Price: High to Low</option>
                </select>
            </div>

            {/* Results */}
            <div className="max-w-3xl mx-auto px-4 space-y-6">
                {filteredProducts.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-5xl mb-4">🔍</p>
                        <p className="text-lg font-medium text-[var(--text-main)]">No products found</p>
                        <p className="text-sm text-[var(--text-muted)]">Try a different search term or category</p>
                    </div>
                ) : (
                    Object.entries(groupedByStore).map(([storeName, products]) => (
                        <div key={storeName}>
                            <h3 className="text-lg font-bold text-[var(--text-main)] mb-3 flex items-center gap-2">
                                <span className="text-xl">🏪</span> {storeName}
                                <span className="text-sm font-normal text-[var(--text-muted)]">({products.length})</span>
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {products.map(product => (
                                    <div key={product.id} className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden shadow-sm">
                                        <div onClick={() => navigate(`/product/${product.id}`)} className="h-28 bg-[var(--surface-1)] cursor-pointer">
                                            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="p-3">
                                            <p className="font-medium text-sm text-[var(--text-main)] truncate">{product.name}</p>
                                            <div className="flex items-baseline gap-2 mt-1">
                                                <span className="font-bold text-[var(--brand-primary)]">${product.price.toFixed(2)}</span>
                                                {product.originalPrice && (
                                                    <span className="text-xs text-[var(--text-muted)] line-through">${product.originalPrice.toFixed(2)}</span>
                                                )}
                                            </div>
                                            <button onClick={() => handleQuickAdd(product)} className="w-full mt-2 py-2 bg-[var(--brand-primary)] text-white text-xs font-medium rounded-lg">
                                                + Add
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Search;
