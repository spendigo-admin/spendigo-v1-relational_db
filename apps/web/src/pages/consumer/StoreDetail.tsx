import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import '../../styles/design-system.css';

// Mock Store Data with flyers, discounts, sale items, and one-day offers
const STORE_DATA: Record<string, any> = {
    '1': {
        id: '1',
        name: 'FreshMart',
        tagline: 'Fresh groceries, delivered fast',
        image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&h=400&fit=crop',
        logo: '🥬',
        rating: 4.8,
        deliveryTime: '25-35 min',
        deliveryFee: 'Free over $35',
        categories: ['All', 'Fresh Produce', 'Dairy', 'Bakery', 'Pantry'],
        // Weekly Flyer
        flyer: {
            title: 'Weekly Savings Flyer',
            validUntil: 'Dec 22, 2024',
            image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600&h=400&fit=crop'
        },
        // One Day Offers
        oneDayOffers: [
            { id: 'od1', name: 'Fresh Strawberries', price: 2.99, originalPrice: 5.99, endsIn: '8 hours', image: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=300&h=300&fit=crop' },
            { id: 'od2', name: 'Orange Juice (2L)', price: 3.49, originalPrice: 6.99, endsIn: '8 hours', image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=300&h=300&fit=crop' },
        ],
        // Sale Items
        saleItems: [
            { id: 's1', name: 'Organic Eggs (12pk)', price: 4.99, originalPrice: 7.99, discount: '38% OFF', image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=300&h=300&fit=crop' },
            { id: 's2', name: 'Whole Wheat Bread', price: 2.49, originalPrice: 3.99, discount: '38% OFF', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=300&fit=crop' },
        ],
        // Regular Products
        products: [
            { id: 'p1', name: 'Organic Avocados (5pk)', price: 6.99, originalPrice: 8.99, category: 'Fresh Produce', image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=300&h=300&fit=crop' },
            { id: 'p2', name: 'Almond Milk (1L)', price: 4.49, category: 'Dairy', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&h=300&fit=crop' },
            { id: 'p3', name: 'Sourdough Loaf', price: 5.99, category: 'Bakery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=300&fit=crop' },
            { id: 'p4', name: 'Organic Bananas (bunch)', price: 2.99, category: 'Fresh Produce', image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=300&h=300&fit=crop' },
            { id: 'p5', name: 'Greek Yogurt (500g)', price: 5.49, category: 'Dairy', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300&h=300&fit=crop' },
            { id: 'p6', name: 'Olive Oil (750ml)', price: 12.99, category: 'Pantry', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=300&h=300&fit=crop' },
        ]
    },
    '2': {
        id: '2',
        name: 'QuickPick',
        tagline: '24/7 convenience at your fingertips',
        image: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=1200&h=400&fit=crop',
        logo: '🏪',
        rating: 4.5,
        deliveryTime: '15-25 min',
        deliveryFee: '$2.99',
        categories: ['All', 'Snacks', 'Drinks', 'Essentials'],
        flyer: {
            title: 'Midnight Madness Sale',
            validUntil: 'Dec 20, 2024',
            image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=400&fit=crop'
        },
        oneDayOffers: [
            { id: 'od3', name: 'Coffee (Large)', price: 1.99, originalPrice: 3.99, endsIn: '5 hours', image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300&h=300&fit=crop' },
        ],
        saleItems: [
            { id: 's3', name: 'Candy Bars (3pk)', price: 2.99, originalPrice: 4.99, discount: '40% OFF', image: 'https://images.unsplash.com/photo-1575377427642-087cf684f29d?w=300&h=300&fit=crop' },
        ],
        products: [
            { id: 'p7', name: 'Energy Drink (4pk)', price: 9.99, category: 'Drinks', image: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=300&h=300&fit=crop' },
            { id: 'p8', name: 'Chips Party Size', price: 4.99, category: 'Snacks', image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=300&h=300&fit=crop' },
            { id: 'p9', name: 'Ice Cream Pint', price: 6.99, category: 'Snacks', image: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=300&h=300&fit=crop' },
        ]
    },
    '3': {
        id: '3',
        name: 'Metro Express',
        tagline: 'Quality groceries, everyday low prices',
        image: 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=1200&h=400&fit=crop',
        logo: '🛒',
        rating: 4.6,
        deliveryTime: '30-45 min',
        deliveryFee: 'Free over $50',
        categories: ['All', 'Meat', 'Seafood', 'Frozen'],
        flyer: {
            title: 'Fresh Meat Specials',
            validUntil: 'Dec 21, 2024',
            image: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&h=400&fit=crop'
        },
        oneDayOffers: [
            { id: 'od4', name: 'Prime Ribeye Steak', price: 14.99, originalPrice: 24.99, endsIn: '10 hours', image: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=300&h=300&fit=crop' },
        ],
        saleItems: [
            { id: 's4', name: 'Frozen Shrimp (1lb)', price: 9.99, originalPrice: 15.99, discount: '37% OFF', image: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=300&h=300&fit=crop' },
        ],
        products: [
            { id: 'p10', name: 'Chicken Breast (1kg)', price: 14.99, category: 'Meat', image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=300&h=300&fit=crop' },
            { id: 'p11', name: 'Salmon Fillet (500g)', price: 18.99, category: 'Seafood', image: 'https://images.unsplash.com/photo-1499125562588-29fb8a56b5d5?w=300&h=300&fit=crop' },
        ]
    },
    '4': {
        id: '4',
        name: 'Costco Business',
        tagline: 'Bulk savings for smart shoppers',
        image: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=1200&h=400&fit=crop',
        logo: '📦',
        rating: 4.7,
        deliveryTime: '45-60 min',
        deliveryFee: '$4.99',
        categories: ['All', 'Bulk', 'Office', 'Cleaning'],
        flyer: {
            title: 'Bulk Buy Bonanza',
            validUntil: 'Dec 25, 2024',
            image: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=600&h=400&fit=crop'
        },
        oneDayOffers: [
            { id: 'od5', name: 'Toilet Paper (48 rolls)', price: 19.99, originalPrice: 34.99, endsIn: '12 hours', image: 'https://images.unsplash.com/photo-1584556812952-905ffd0c611a?w=300&h=300&fit=crop' },
        ],
        saleItems: [
            { id: 's5', name: 'Laundry Detergent (5L)', price: 14.99, originalPrice: 24.99, discount: '40% OFF', image: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=300&h=300&fit=crop' },
        ],
        products: [
            { id: 'p12', name: 'Paper Towels (12pk)', price: 24.99, category: 'Cleaning', image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=300&h=300&fit=crop' },
            { id: 'p13', name: 'Bottled Water (24pk)', price: 8.99, category: 'Bulk', image: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=300&h=300&fit=crop' },
        ]
    },
    // LOCAL CONVENIENCE STORES
    '5': {
        id: '5',
        name: "Mac's Corner",
        tagline: 'Your neighborhood convenience store',
        image: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=1200&h=400&fit=crop',
        logo: '🏪',
        rating: 4.3,
        deliveryTime: '10-20 min',
        deliveryFee: '$1.99',
        categories: ['All', 'Snacks', 'Drinks', 'Tobacco', 'Lottery'],
        flyer: {
            title: 'Weekly Snack Deals',
            validUntil: 'Dec 22, 2024',
            image: 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=600&h=400&fit=crop'
        },
        oneDayOffers: [
            { id: 'od6', name: 'Slurpee (Large)', price: 0.99, originalPrice: 2.49, endsIn: '6 hours', image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=300&h=300&fit=crop' },
        ],
        saleItems: [
            { id: 's6', name: 'Hot Dog Combo', price: 2.99, originalPrice: 4.99, discount: '40% OFF', image: 'https://images.unsplash.com/photo-1612392166886-ee8475b03af2?w=300&h=300&fit=crop' },
        ],
        products: [
            { id: 'p14', name: 'Coca-Cola (2L)', price: 3.49, category: 'Drinks', image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=300&h=300&fit=crop' },
            { id: 'p15', name: "Lay's Classic Chips", price: 4.29, category: 'Snacks', image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=300&h=300&fit=crop' },
            { id: 'p16', name: 'Red Bull (4pk)', price: 9.99, category: 'Drinks', image: 'https://images.unsplash.com/photo-1613214153279-af3eb67fc2c9?w=300&h=300&fit=crop' },
            { id: 'p17', name: 'Doritos Nacho Cheese', price: 4.49, category: 'Snacks', image: 'https://images.unsplash.com/photo-1600952841320-db92ec4047ca?w=300&h=300&fit=crop' },
            { id: 'p18', name: 'Gatorade (6pk)', price: 7.99, category: 'Drinks', image: 'https://images.unsplash.com/photo-1622766815178-641bef2b0cf5?w=300&h=300&fit=crop' },
            { id: 'p19', name: 'Cigarettes Pack', price: 15.99, category: 'Tobacco', image: 'https://images.unsplash.com/photo-1527099908998-5c4960c81d21?w=300&h=300&fit=crop' },
        ]
    },
    '6': {
        id: '6',
        name: 'Hasty Mart',
        tagline: 'Fast service, great prices',
        image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&h=400&fit=crop',
        logo: '⚡',
        rating: 4.1,
        deliveryTime: '10-15 min',
        deliveryFee: '$1.49',
        categories: ['All', 'Snacks', 'Drinks', 'Candy', 'Essentials'],
        flyer: {
            title: 'Quick Grab Specials',
            validUntil: 'Dec 21, 2024',
            image: 'https://images.unsplash.com/photo-1601758124096-1fd661873b95?w=600&h=400&fit=crop'
        },
        oneDayOffers: [
            { id: 'od7', name: 'Coffee (Any Size)', price: 0.99, originalPrice: 2.29, endsIn: '8 hours', image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300&h=300&fit=crop' },
        ],
        saleItems: [
            { id: 's7', name: 'Candy Bar (3pk)', price: 1.99, originalPrice: 3.49, discount: '43% OFF', image: 'https://images.unsplash.com/photo-1575377427642-087cf684f29d?w=300&h=300&fit=crop' },
        ],
        products: [
            { id: 'p20', name: 'Monster Energy', price: 3.99, category: 'Drinks', image: 'https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=300&h=300&fit=crop' },
            { id: 'p21', name: 'Snickers Bar', price: 1.79, category: 'Candy', image: 'https://images.unsplash.com/photo-1534260164206-2a3a4a72891d?w=300&h=300&fit=crop' },
            { id: 'p22', name: 'Pepsi (6pk)', price: 5.99, category: 'Drinks', image: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=300&h=300&fit=crop' },
            { id: 'p23', name: 'Pringles Original', price: 3.49, category: 'Snacks', image: 'https://images.unsplash.com/photo-1600952841320-db92ec4047ca?w=300&h=300&fit=crop' },
            { id: 'p24', name: 'Gum (5 packs)', price: 4.99, category: 'Candy', image: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=300&h=300&fit=crop' },
            { id: 'p25', name: 'Hand Sanitizer', price: 2.99, category: 'Essentials', image: 'https://images.unsplash.com/photo-1584483766114-2cea6facdf57?w=300&h=300&fit=crop' },
        ]
    },
    '7': {
        id: '7',
        name: 'Corner Bodega',
        tagline: 'Local favorites, fresh daily',
        image: 'https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?w=1200&h=400&fit=crop',
        logo: '🏬',
        rating: 4.5,
        deliveryTime: '10-20 min',
        deliveryFee: '$1.99',
        categories: ['All', 'Deli', 'Drinks', 'Snacks', 'Grocery'],
        flyer: {
            title: 'Fresh Deli Deals',
            validUntil: 'Dec 23, 2024',
            image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&h=400&fit=crop'
        },
        oneDayOffers: [
            { id: 'od8', name: 'Bacon Egg & Cheese', price: 3.99, originalPrice: 6.99, endsIn: '10 hours', image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=300&h=300&fit=crop' },
        ],
        saleItems: [
            { id: 's8', name: 'Fresh Bagel w/ Cream Cheese', price: 1.99, originalPrice: 3.49, discount: '43% OFF', image: 'https://images.unsplash.com/photo-1585535375030-3de2f1da06f2?w=300&h=300&fit=crop' },
        ],
        products: [
            { id: 'p26', name: 'Deli Sandwich', price: 7.99, category: 'Deli', image: 'https://images.unsplash.com/photo-1539252554453-80ab65ce3586?w=300&h=300&fit=crop' },
            { id: 'p27', name: 'Arizona Iced Tea', price: 1.29, category: 'Drinks', image: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=300&h=300&fit=crop' },
            { id: 'p28', name: 'Takis Fuego', price: 3.99, category: 'Snacks', image: 'https://images.unsplash.com/photo-1600952841320-db92ec4047ca?w=300&h=300&fit=crop' },
            { id: 'p29', name: 'Fresh OJ (Large)', price: 4.49, category: 'Drinks', image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=300&h=300&fit=crop' },
            { id: 'p30', name: 'Chopped Cheese Sandwich', price: 8.99, category: 'Deli', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=300&h=300&fit=crop' },
            { id: 'p31', name: 'Milk (1L)', price: 2.99, category: 'Grocery', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=300&h=300&fit=crop' },
        ]
    }
};

const StoreDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const store = STORE_DATA[id || ''] || null;
    const [activeTab, setActiveTab] = useState<'products' | 'flyer' | 'offers'>('products');
    const [activeCategory, setActiveCategory] = useState('All');

    if (!store) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-[var(--text-muted)]">Store not found.</p>
            </div>
        );
    }

    const filteredProducts = activeCategory === 'All'
        ? store.products
        : store.products.filter((p: any) => p.category === activeCategory);

    const handleQuickAdd = (product: any) => {
        addToCart({
            productId: product.id,
            productName: product.name,
            price: product.price,
            quantity: 1,
            storeId: store.id,
            storeName: store.name,
            image: product.image
        });
    };

    return (
        <div className="animate-fade-in pb-20">
            {/* STORE HEADER */}
            <div className="relative h-48 md:h-64 bg-[var(--surface-2)]">
                <img src={store.image} alt={store.name} className="w-full h-full object-cover opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-0)] via-transparent to-transparent"></div>

                {/* Back Button */}
                <button
                    onClick={() => navigate('/')}
                    className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/90 shadow-lg text-[var(--text-main)] flex items-center justify-center hover:bg-white transition-colors"
                >
                    ←
                </button>

                {/* Store Info Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
                    <div className="flex items-end gap-4">
                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white border-2 border-[var(--glass-border)] flex items-center justify-center text-3xl md:text-4xl shadow-lg">
                            {store.logo}
                        </div>
                        <div className="flex-1">
                            <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-main)]">{store.name}</h1>
                            <p className="text-sm text-[var(--text-muted)]">{store.tagline}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* STORE STATS */}
            <div className="px-4 py-4 flex items-center gap-4 text-sm border-b border-[var(--glass-border)] overflow-x-auto">
                <div className="flex items-center gap-1 whitespace-nowrap">
                    <span className="text-yellow-500">★</span>
                    <span className="font-medium text-[var(--text-main)]">{store.rating}</span>
                </div>
                <div className="w-px h-4 bg-[var(--glass-border)]"></div>
                <div className="flex items-center gap-1 whitespace-nowrap">
                    <span>🚚</span>
                    <span className="text-[var(--text-muted)]">{store.deliveryTime}</span>
                </div>
                <div className="w-px h-4 bg-[var(--glass-border)]"></div>
                <div className="flex items-center gap-1 whitespace-nowrap">
                    <span>💰</span>
                    <span className="text-[var(--text-muted)]">{store.deliveryFee}</span>
                </div>
            </div>

            {/* MAIN TABS: Products | Flyer | Offers */}
            <div className="px-4 py-3 sticky top-14 z-40 bg-[var(--surface-0)] border-b border-[var(--glass-border)]">
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('products')}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'products' ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
                    >
                        🛒 Products
                    </button>
                    <button
                        onClick={() => setActiveTab('flyer')}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'flyer' ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
                    >
                        📰 Weekly Flyer
                    </button>
                    <button
                        onClick={() => setActiveTab('offers')}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'offers' ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}
                    >
                        🔥 Deals
                    </button>
                </div>
            </div>

            {/* TAB CONTENT */}
            {activeTab === 'products' && (
                <>
                    {/* Category Filters */}
                    <div className="px-4 py-3 bg-[var(--surface-1)] border-b border-[var(--glass-border)]">
                        <div className="overflow-x-auto scrollbar-hide">
                            <div className="flex gap-2 min-w-max">
                                {store.categories.map((cat: string) => (
                                    <button
                                        key={cat}
                                        onClick={() => setActiveCategory(cat)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeCategory === cat ? 'bg-[var(--text-main)] text-white' : 'bg-white text-[var(--text-muted)] border border-[var(--glass-border)]'}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Product Grid */}
                    <div className="p-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filteredProducts.map((product: any) => (
                                <div key={product.id} className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden group shadow-sm hover:shadow-md transition-shadow">
                                    <div onClick={() => navigate(`/product/${product.id}`)} className="h-32 md:h-40 bg-[var(--surface-1)] relative cursor-pointer overflow-hidden">
                                        <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                        {product.originalPrice && (
                                            <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">SALE</div>
                                        )}
                                    </div>
                                    <div className="p-3">
                                        <p onClick={() => navigate(`/product/${product.id}`)} className="font-medium text-sm text-[var(--text-main)] truncate cursor-pointer hover:text-[var(--brand-primary)]">{product.name}</p>
                                        <div className="flex items-baseline gap-2 mt-1">
                                            <span className="font-bold text-[var(--brand-primary)]">${product.price.toFixed(2)}</span>
                                            {product.originalPrice && (
                                                <span className="text-xs text-[var(--text-muted)] line-through">${product.originalPrice.toFixed(2)}</span>
                                            )}
                                        </div>
                                        <button onClick={() => handleQuickAdd(product)} className="w-full mt-3 py-2 bg-[var(--brand-primary)] text-white text-sm font-medium rounded-lg hover:brightness-110 transition-all">
                                            + Add to Cart
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'flyer' && (
                <div className="p-4">
                    {/* Flyer Card */}
                    <div className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden shadow-sm">
                        <img src={store.flyer.image} alt={store.flyer.title} className="w-full h-48 object-cover" />
                        <div className="p-4">
                            <h3 className="text-xl font-bold text-[var(--text-main)]">{store.flyer.title}</h3>
                            <p className="text-sm text-[var(--text-muted)] mt-1">Valid until {store.flyer.validUntil}</p>
                            <button className="mt-4 w-full py-3 bg-[var(--brand-primary)] text-white font-medium rounded-lg hover:brightness-110">
                                View Full Flyer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'offers' && (
                <div className="p-4 space-y-6">
                    {/* One Day Offers */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xl">⏰</span>
                            <h3 className="text-lg font-bold text-[var(--text-main)]">One-Day Offers</h3>
                            <span className="ml-auto text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">Limited Time</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {store.oneDayOffers?.map((offer: any) => (
                                <div key={offer.id} className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border border-red-100 p-3">
                                    <img src={offer.image} alt={offer.name} className="w-full h-24 object-cover rounded-lg mb-2" />
                                    <p className="font-medium text-sm text-[var(--text-main)] truncate">{offer.name}</p>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="font-bold text-red-600">${offer.price.toFixed(2)}</span>
                                        <span className="text-xs text-[var(--text-muted)] line-through">${offer.originalPrice.toFixed(2)}</span>
                                    </div>
                                    <p className="text-xs text-red-500 mt-1">⏱ Ends in {offer.endsIn}</p>
                                    <button onClick={() => handleQuickAdd(offer)} className="w-full mt-2 py-2 bg-red-500 text-white text-xs font-medium rounded-lg">
                                        + Add
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sale Items */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xl">🏷️</span>
                            <h3 className="text-lg font-bold text-[var(--text-main)]">Items on Sale</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {store.saleItems?.map((item: any) => (
                                <div key={item.id} className="bg-white rounded-xl border border-[var(--glass-border)] p-3 shadow-sm">
                                    <div className="relative">
                                        <img src={item.image} alt={item.name} className="w-full h-24 object-cover rounded-lg mb-2" />
                                        <span className="absolute top-1 left-1 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">{item.discount}</span>
                                    </div>
                                    <p className="font-medium text-sm text-[var(--text-main)] truncate">{item.name}</p>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="font-bold text-green-600">${item.price.toFixed(2)}</span>
                                        <span className="text-xs text-[var(--text-muted)] line-through">${item.originalPrice.toFixed(2)}</span>
                                    </div>
                                    <button onClick={() => handleQuickAdd(item)} className="w-full mt-2 py-2 bg-[var(--brand-primary)] text-white text-xs font-medium rounded-lg">
                                        + Add
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StoreDetail;
