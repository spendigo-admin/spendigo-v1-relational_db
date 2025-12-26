import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../../styles/design-system.css';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useAuth } from '../../context/AuthContext';
import { useOrders } from '../../context/OrderContext';

const CATEGORIES = ['All', 'Fastest', 'Offers', 'Low Prices', 'Grocery', 'Convenience', 'Wholesale'];

// Helper to parse delivery time range and get min minutes
const parseDeliveryTime = (timeStr: string): number => {
    const match = timeStr.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 60;
};

const StoreList: React.FC = () => {
    const navigate = useNavigate();
    const { stores, loading } = useMarketplace();
    const { user } = useAuth();
    const { profile } = useOrders();
    const [userCoords, setUserCoords] = useState<{ lat: number, lng: number } | null>(null);
    const [address, setAddress] = useState('');
    const [isLocating, setIsLocating] = useState(false);

    // Calculate distance between two points in km
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // Radius of the earth in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Auto-detect location from profile
    useEffect(() => {
        const detectProfileLocation = async () => {
            if (user && profile.addresses.length > 0) {
                const defaultAddr = profile.addresses.find(a => a.isDefault) || profile.addresses[0];
                const addrStr = `${defaultAddr.street}, ${defaultAddr.city}, ${defaultAddr.province}, ${defaultAddr.postalCode}`;

                // Set the display address
                setAddress(defaultAddr.label || "Home");

                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addrStr)}`);
                    const data = await response.json();
                    if (data && data.length > 0) {
                        setUserCoords({
                            lat: parseFloat(data[0].lat),
                            lng: parseFloat(data[0].lon)
                        });
                    }
                } catch (e) {
                    console.error("Failed to geocode profile address", e);
                }
            }
        };

        if (!userCoords && address === '') {
            detectProfileLocation();
        }
    }, [user, profile.addresses, userCoords, address]);

    const handleLocateMe = () => {
        setIsLocating(true);
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            setIsLocating(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setUserCoords({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
                setAddress("Current Location");
                setIsLocating(false);
            },
            () => {
                alert('Unable to retrieve your location');
                setIsLocating(false);
            }
        );
    };

    const handleSearch = async () => {
        if (!address.trim() || address === "Current Location") return;
        setIsLocating(true);

        try {
            // Check if it's a Canadian postal code pattern
            const postalCodeRegex = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
            let query = address;
            if (postalCodeRegex.test(address)) {
                query = `${address}, Canada`;
            }

            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                setUserCoords({
                    lat: parseFloat(lat),
                    lng: parseFloat(lon)
                });
                if (postalCodeRegex.test(address)) {
                    setAddress(address.toUpperCase());
                }
            } else {
                alert('Location not found. Please try a different postal code or address.');
            }
        } catch (error) {
            console.error('Search error:', error);
            alert('Error finding location. Please try again.');
        } finally {
            setIsLocating(false);
        }
    };

    const allStores = useMemo(() => {
        if (!stores) return [];
        return Object.values(stores).map((store: any) => {
            let distanceVal = 'Distance unknown';
            let distanceNum = 9999;

            if (userCoords && store.coordinates) {
                distanceNum = calculateDistance(
                    userCoords.lat,
                    userCoords.lng,
                    store.coordinates.lat,
                    store.coordinates.lng
                );
                distanceVal = `${distanceNum.toFixed(1)} km`;
            }

            return {
                id: store.id,
                name: store.name,
                distance: distanceVal,
                distanceNum: distanceNum,
                image: store.image,
                logo: store.logo,
                tags: store.tags || [],
                deliveryTime: store.deliveryTime,
                deliveryFee: store.deliveryFee || '$3.99',
                rating: store.rating,
                hasFlyer: store.flyer?.validUntil ? true : false,
                activeDealsCount: (store.oneDayOffers?.length || 0) + (store.saleItems?.length || 0)
            };
        });
    }, [stores, userCoords]);

    const [activeCategory, setActiveCategory] = useState('All');

    // Filter stores based on selected category
    const filteredStores = useMemo(() => {
        let result = [...allStores];

        switch (activeCategory) {
            case 'Fastest':
                result = result
                    .sort((a, b) => parseDeliveryTime(a.deliveryTime) - parseDeliveryTime(b.deliveryTime))
                    .filter(store => parseDeliveryTime(store.deliveryTime) <= 25);
                break;
            case 'Offers':
                result = result.filter(store =>
                    store.activeDealsCount > 0 ||
                    store.hasFlyer ||
                    store.tags.some((tag: string) => ['Deals', 'Offers', 'Sale', 'Wholesale'].includes(tag))
                );
                break;
            case 'Low Prices':
                result = result.filter(store =>
                    store.deliveryFee?.includes('Free') ||
                    (store.deliveryFee?.includes('$') && parseFloat(store.deliveryFee.replace(/[^0-9.]/g, '')) <= 2.5)
                );
                break;
            case 'Grocery':
                result = result.filter(store =>
                    store.tags.some((tag: string) => ['Grocery', 'Organic', 'Farmers Market'].includes(tag))
                );
                break;
            case 'Convenience':
                result = result.filter(store =>
                    store.tags.some((tag: string) => ['Convenience', '24/7', 'Local'].includes(tag))
                );
                break;
            case 'Wholesale':
                result = result.filter(store =>
                    store.tags.some((tag: string) => ['Wholesale', 'Bulk'].includes(tag))
                );
                break;
            default:
                break;
        }

        // If location is set, sort by distance by default
        if (userCoords) {
            result.sort((a, b) => a.distanceNum - b.distanceNum);
        }

        return result;
    }, [activeCategory, allStores, userCoords]);

    return (
        <div className="animate-fade-in">
            {loading && (
                <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="animate-spin text-4xl">⏳</div>
                </div>
            )}
            {/* HERO SECTION - Instacart Style */}
            <section className="relative overflow-hidden bg-gradient-to-br from-[var(--brand-primary)] via-[#4f46e5] to-[var(--brand-secondary)] py-12 px-4 pt-safe">
                {/* Animated background shapes */}
                <div className="absolute inset-0 overflow-hidden opacity-20">
                    <div className="absolute -top-20 -left-20 w-72 h-72 bg-white rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
                </div>

                <div className="relative z-10 max-w-4xl mx-auto text-center">
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
                        Shop Local,<br />Save Smarter
                    </h1>
                    <p className="text-white/80 text-lg mb-6 max-w-2xl mx-auto">
                        Browse digital flyers and automatically optimize your grocery list for the best prices across all your favorite neighborhood stores.
                    </p>

                    {/* Search Bar */}
                    <div className="flex items-center bg-white rounded-full p-2 max-w-xl mx-auto shadow-xl">
                        <button
                            onClick={handleLocateMe}
                            className={`px-4 transition-colors ${userCoords ? 'text-[var(--brand-primary)]' : 'text-gray-400 hover:text-gray-600'}`}
                            title="Use my current location"
                        >
                            {isLocating && address === "Current Location" ? '⌛' : '📍'}
                        </button>
                        <input
                            type="text"
                            placeholder="Type postal code or address..."
                            className="flex-1 py-3 px-2 bg-transparent outline-none text-gray-800 placeholder-gray-400"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <button
                            onClick={handleSearch}
                            disabled={isLocating}
                            className="bg-[var(--brand-primary)] text-white px-6 py-3 rounded-full font-bold hover:brightness-110 transition-all flex items-center justify-center min-w-[100px]"
                        >
                            {isLocating && address !== "Current Location" ? '...' : 'Search'}
                        </button>
                    </div>
                </div>
            </section>

            {/* STATS SECTION - Social Proof */}
            <section className="py-8 px-4 bg-[var(--surface-1)] border-b border-[var(--glass-border)]">
                <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                        <p className="text-3xl font-bold text-[var(--brand-primary)]">50+</p>
                        <p className="text-sm text-[var(--text-muted)]">Local Grocers</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-[var(--brand-primary)]">Real-time</p>
                        <p className="text-sm text-[var(--text-muted)]">Digital Flyers</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-[var(--brand-primary)]">100%</p>
                        <p className="text-sm text-[var(--text-muted)]">Price Comparison</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-[var(--brand-primary)]">15%</p>
                        <p className="text-sm text-[var(--text-muted)]">Estimated Savings</p>
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
                                    className="glass-panel overflow-hidden cursor-pointer group hover:border-[var(--brand-primary)] hover:shadow-lg hover:shadow-[var(--brand-primary)]/10 transition-all duration-300 relative"
                                >
                                    {/* Badges for Flyer/Deals */}
                                    <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 items-end">
                                        {store.hasFlyer && (
                                            <span className="bg-red-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded shadow-sm">
                                                New Flyer
                                            </span>
                                        )}
                                        {store.activeDealsCount > 0 && (
                                            <span className="bg-green-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded shadow-sm">
                                                {store.activeDealsCount} Deals
                                            </span>
                                        )}
                                    </div>

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
