import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../../styles/design-system.css';

// Mock Stores Data with real images
const STORES = [
    { id: '1', name: 'FreshMart', distance: '0.4 km', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=200&fit=crop', logo: '🥬', tags: ['Grocery', 'Organic'], deliveryTime: '25-35 min' },
    { id: '2', name: 'QuickPick', distance: '1.2 km', image: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400&h=200&fit=crop', logo: '🏪', tags: ['Convenience', '24/7'], deliveryTime: '15-25 min' },
    { id: '3', name: 'Metro Express', distance: '2.5 km', image: 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=400&h=200&fit=crop', logo: '🛒', tags: ['Grocery', 'Deals'], deliveryTime: '30-45 min' },
    { id: '4', name: 'Costco Business', distance: '3.8 km', image: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=400&h=200&fit=crop', logo: '📦', tags: ['Wholesale', 'Bulk'], deliveryTime: '45-60 min' },
    // Local Convenience Stores
    { id: '5', name: "Mac's Corner", distance: '0.2 km', image: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400&h=200&fit=crop', logo: '🏪', tags: ['Convenience', 'Snacks'], deliveryTime: '10-20 min' },
    { id: '6', name: 'Hasty Mart', distance: '0.5 km', image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=200&fit=crop', logo: '⚡', tags: ['Convenience', '24/7'], deliveryTime: '10-15 min' },
    { id: '7', name: 'Corner Bodega', distance: '0.3 km', image: 'https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?w=400&h=200&fit=crop', logo: '🏬', tags: ['Convenience', 'Local'], deliveryTime: '10-20 min' },
    // Local Specialty Stores
    { id: '8', name: "Green Valley Market", distance: '1.5 km', image: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=400&h=200&fit=crop', logo: '🌽', tags: ['Farmers Market', 'Organic'], deliveryTime: '30-45 min' },
    { id: '9', name: "The Daily Loaf", distance: '0.8 km', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=200&fit=crop', logo: '🥖', tags: ['Bakery', 'Artisan'], deliveryTime: '20-30 min' },
    { id: '10', name: "The Butcher's Block", distance: '1.1 km', image: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&h=200&fit=crop', logo: '🥩', tags: ['Butcher', 'Meat'], deliveryTime: '25-40 min' },
    { id: '11', name: "The Book Nook", distance: '2.0 km', image: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=400&h=200&fit=crop', logo: '📚', tags: ['Books', 'Gifts'], deliveryTime: '40-50 min' },
];

const CATEGORIES = ['All', 'Fastest', 'Offers', 'Low Prices', 'Grocery', 'Convenience', 'Wholesale'];

const StoreList: React.FC = () => {
    const navigate = useNavigate();
    const [activeCategory, setActiveCategory] = useState('All');

    return (
        <div className="animate-fade-in">
            {/* HERO SECTION - Instacart Style */}
            <section className="relative overflow-hidden bg-gradient-to-br from-[var(--brand-primary)] via-[#4f46e5] to-[var(--brand-secondary)] py-12 px-4">
                {/* Animated background shapes */}
                <div className="absolute inset-0 overflow-hidden opacity-20">
                    <div className="absolute -top-20 -left-20 w-72 h-72 bg-white rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
                </div>

                <div className="relative z-10 max-w-4xl mx-auto text-center">
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
                        Shop Local,<br />Optimize Savings
                    </h1>
                    <p className="text-white/80 text-lg mb-6">
                        Get groceries from nearby stores delivered in as fast as 1 hour.
                    </p>

                    {/* Search Bar */}
                    <div className="flex items-center bg-white rounded-full p-2 max-w-xl mx-auto shadow-xl">
                        <span className="px-4 text-gray-500">📍</span>
                        <input
                            type="text"
                            placeholder="Enter your delivery address..."
                            className="flex-1 py-3 px-2 bg-transparent outline-none text-gray-800 placeholder-gray-400"
                        />
                        <button className="bg-[var(--brand-primary)] text-white px-6 py-3 rounded-full font-bold hover:brightness-110 transition-all">
                            Search
                        </button>
                    </div>
                </div>
            </section>

            {/* STATS SECTION - Social Proof */}
            <section className="py-8 px-4 bg-[var(--surface-1)] border-b border-[var(--glass-border)]">
                <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                        <p className="text-3xl font-bold text-[var(--brand-primary)]">50+</p>
                        <p className="text-sm text-[var(--text-muted)]">Local Stores</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-[var(--brand-primary)]">10K+</p>
                        <p className="text-sm text-[var(--text-muted)]">Products</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-[var(--brand-primary)]">1 hr</p>
                        <p className="text-sm text-[var(--text-muted)]">Avg. Delivery</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-[var(--brand-primary)]">15%</p>
                        <p className="text-sm text-[var(--text-muted)]">Avg. Savings</p>
                    </div>
                </div>
            </section>

            {/* CATEGORY TABS */}
            <section className="py-4 px-4 bg-[var(--surface-0)] sticky top-16 z-40 border-b border-[var(--glass-border)]">
                <div className="max-w-5xl mx-auto overflow-x-auto scrollbar-hide">
                    <div className="flex gap-2 min-w-max">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${activeCategory === cat
                                    ? 'bg-[var(--brand-primary)] text-white'
                                    : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-1)] hover:text-[var(--text-main)]'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* STORE GRID */}
            <section className="py-8 px-4">
                <div className="max-w-5xl mx-auto">
                    <h2 className="text-2xl font-bold text-[var(--text-main)] mb-6">Stores Near You</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {STORES.map(store => (
                            <div
                                key={store.id}
                                onClick={() => navigate(`/store/${store.id}`)}
                                className="glass-panel overflow-hidden cursor-pointer group hover:border-[var(--brand-primary)] hover:shadow-lg hover:shadow-[var(--brand-primary)]/10 transition-all duration-300"
                            >
                                {/* Store Image */}
                                <div className="h-36 bg-[var(--surface-2)] relative overflow-hidden">
                                    <img
                                        src={store.image}
                                        alt={store.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                    {/* Delivery Badge */}
                                    <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-md text-xs text-white font-medium">
                                        {store.deliveryTime}
                                    </div>
                                </div>

                                {/* Store Info */}
                                <div className="p-4 relative">
                                    {/* Logo Avatar */}
                                    <div className="absolute -top-6 left-4 w-12 h-12 rounded-xl bg-[var(--surface-0)] border-2 border-[var(--glass-border)] flex items-center justify-center text-2xl shadow-lg">
                                        {store.logo}
                                    </div>

                                    <div className="ml-14">
                                        <h3 className="font-bold text-lg text-[var(--text-main)] group-hover:text-[var(--brand-primary)] transition-colors">
                                            {store.name}
                                        </h3>
                                        <p className="text-sm text-[var(--text-muted)]">{store.distance} away</p>
                                    </div>

                                    {/* Tags */}
                                    <div className="flex gap-2 mt-3 flex-wrap">
                                        {store.tags.map(tag => (
                                            <span
                                                key={tag}
                                                className="text-xs bg-[var(--surface-2)] px-2 py-1 rounded-full text-[var(--text-muted)]"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* SPENDIGO PROMO BANNER */}
            <section className="py-8 px-4">
                <div className="max-w-5xl mx-auto">
                    <div className="glass-panel p-6 md:p-8 bg-gradient-to-r from-[var(--brand-primary)]/20 to-[var(--brand-secondary)]/20 border-[var(--brand-primary)]/30">
                        <div className="flex flex-col md:flex-row items-center gap-6">
                            <div className="text-5xl">🛒✨</div>
                            <div className="flex-1 text-center md:text-left">
                                <h3 className="text-xl font-bold text-[var(--text-main)] mb-2">Spendigo Optimizer</h3>
                                <p className="text-[var(--text-muted)]">
                                    Our algorithm automatically splits your order across stores to maximize savings.
                                    Customers save an average of <span className="text-[var(--brand-secondary)] font-bold">15%</span> per order.
                                </p>
                            </div>
                            <Link to="/how-it-works" className="px-6 py-3 bg-[var(--brand-primary)] text-white font-bold rounded-full hover:brightness-110 transition-all whitespace-nowrap">
                                Learn More
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default StoreList;
