import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../../styles/design-system.css';
import { getStoreList } from '../../data/productData';

// Get stores from unified data source
const ALL_STORES = getStoreList();

const CATEGORIES = ['All', 'Fastest', 'Offers', 'Low Prices', 'Grocery', 'Convenience', 'Wholesale'];

// Helper to parse delivery time range and get min minutes
const parseDeliveryTime = (timeStr: string): number => {
    const match = timeStr.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 60;
};

const StoreList: React.FC = () => {
    const navigate = useNavigate();
    const [activeCategory, setActiveCategory] = useState('All');

    // Filter stores based on selected category
    const filteredStores = useMemo(() => {
        switch (activeCategory) {
            case 'Fastest':
                // Sort by delivery time (fastest first), show stores with < 25 min delivery
                return [...ALL_STORES]
                    .sort((a, b) => parseDeliveryTime(a.deliveryTime) - parseDeliveryTime(b.deliveryTime))
                    .filter(store => parseDeliveryTime(store.deliveryTime) <= 25);
            case 'Offers':
                // Show stores that have special offers/deals tag or known deal stores
                return ALL_STORES.filter(store =>
                    store.tags.some((tag: string) =>
                        ['Deals', 'Offers', 'Sale', 'Wholesale'].includes(tag)
                    ) || store.rating >= 4.5
                );
            case 'Low Prices':
                // Show stores with low/free delivery fees
                return ALL_STORES.filter(store =>
                    store.deliveryFee?.includes('Free') ||
                    (store.deliveryFee?.includes('$') && parseFloat(store.deliveryFee.replace(/[^0-9.]/g, '')) <= 2.5)
                );
            case 'Grocery':
                return ALL_STORES.filter(store =>
                    store.tags.some((tag: string) => ['Grocery', 'Organic', 'Farmers Market'].includes(tag))
                );
            case 'Convenience':
                return ALL_STORES.filter(store =>
                    store.tags.some((tag: string) => ['Convenience', '24/7', 'Local'].includes(tag))
                );
            case 'Wholesale':
                return ALL_STORES.filter(store =>
                    store.tags.some((tag: string) => ['Wholesale', 'Bulk'].includes(tag))
                );
            default:
                return ALL_STORES;
        }
    }, [activeCategory]);

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
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-[var(--text-main)]">
                            {activeCategory === 'All' ? 'Stores Near You' : `${activeCategory} Stores`}
                        </h2>
                        <span className="text-sm text-[var(--text-muted)]">{filteredStores.length} stores</span>
                    </div>

                    {filteredStores.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-5xl mb-4">🔍</p>
                            <p className="text-[var(--text-muted)]">No stores match this filter</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredStores.map(store => (
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
                                            {store.tags.map((tag: string) => (
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
                    )}
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
