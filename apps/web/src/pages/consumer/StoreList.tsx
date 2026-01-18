import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../../styles/design-system.css';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useAuth } from '../../context/AuthContext';
import { useOrders } from '../../context/OrderContext';
import { useNotifications } from '../../context/NotificationContext';
import AdCarousel from '../../components/AdCarousel';

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
    const { addNotification } = useNotifications();
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

    // Auto-detect location from profile or use saved coordinates
    useEffect(() => {
        const detectProfileLocation = async () => {
            // Priority 1: Use saved coordinates from User Profile (set during registration)
            if (user?.coordinates) {
                setUserCoords(user.coordinates);
                // Also try to set a friendly address name if possible
                if (user.address) {
                    setAddress("Home");
                }
                return;
            }

            // Priority 2: Geocode address from Profile Addresses list
            if (user && profile.addresses.length > 0) {
                const defaultAddr = profile.addresses.find(a => a.isDefault) || profile.addresses[0];
                const addrStr = `${defaultAddr.street}, ${defaultAddr.city}, ${defaultAddr.province}, ${defaultAddr.postalCode}`;

                // Set the display address
                setAddress(defaultAddr.label || "Home");

                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addrStr)}&countrycodes=ca`);
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
            const t = setTimeout(detectProfileLocation, 0); // Defer to next tick to unblock render
            return () => clearTimeout(t);
        }
    }, [user, profile.addresses, userCoords, address]);

    const handleLocateMe = () => {
        setIsLocating(true);
        if (!navigator.geolocation) {
            addNotification({ type: 'alert', title: 'Geolocation Not Supported', message: 'Your browser does not support Geolocation.' });
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
                addNotification({ type: 'alert', title: 'Location Error', message: 'Unable to retrieve your location.' });
                setIsLocating(false);
            }
        );
    };

    const handleSearch = async () => {
        if (!address.trim() || address === "Current Location") return;
        setIsLocating(true);

        try {
            // Improved Canadian Postal Code Handling
            // Matches: "K6V", "K6V5T3", "K6V 5T3", "K6V-5T3"
            const postalCodeRegex = /^([A-Za-z]\d[A-Za-z])\s?[-]?\s?(\d[A-Za-z]\d)?$/;
            let query = address;

            const match = address.trim().match(postalCodeRegex);

            if (match) {
                const fsa = match[1].toUpperCase();
                const { CANADIAN_FSA_MAP } = await import('../../data/canadianFSAs');

                if (CANADIAN_FSA_MAP[fsa]) {
                    query = CANADIAN_FSA_MAP[fsa];
                } else {
                    const PROVINCE_MAP: Record<string, string> = {
                        'A': 'NL', 'B': 'NS', 'C': 'PE', 'E': 'NB',
                        'G': 'QC', 'H': 'QC', 'J': 'QC',
                        'K': 'ON', 'L': 'ON', 'M': 'ON', 'N': 'ON', 'P': 'ON',
                        'R': 'MB', 'S': 'SK', 'T': 'AB', 'V': 'BC',
                        'X': 'NU', 'Y': 'YT'
                    };
                    const province = PROVINCE_MAP[fsa[0]];
                    query = province ? `${fsa}, ${province}, Canada` : `${fsa}, Canada`;
                }
            }

            console.log(`Searching location for: ${query}`);
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ca`);
            const data = await response.json();

            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                setUserCoords({ lat: parseFloat(lat), lng: parseFloat(lon) });
                if (match) setAddress(address.toUpperCase());
            } else {
                if (query !== address) {
                    const fallbackResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=ca`);
                    const fallbackData = await fallbackResponse.json();
                    if (fallbackData && fallbackData.length > 0) {
                        const { lat, lon } = fallbackData[0];
                        setUserCoords({ lat: parseFloat(lat), lng: parseFloat(lon) });
                        return;
                    }
                }
                addNotification({ type: 'alert', title: 'Location Not Found', message: `We couldn't find "${address}".` });
            }
        } catch (error) {
            console.error('Search error:', error);
            addNotification({ type: 'alert', title: 'Search Failed', message: 'Error finding location.' });
        } finally {
            setIsLocating(false);
        }
    };

    const allStores = useMemo(() => {
        if (!stores) return [];
        const activeStores = Object.values(stores).filter((s: any) => s.status === 'active' || !s.status);
        return activeStores.map((store: any) => {
            let distanceVal = 'Distance unknown';
            let distanceNum = 9999;

            if (userCoords && store.coordinates) {
                distanceNum = calculateDistance(userCoords.lat, userCoords.lng, store.coordinates.lat, store.coordinates.lng);
                distanceVal = `${distanceNum.toFixed(1)} km`;
            }

            return {
                id: store.id,
                name: store.name,
                distance: distanceVal,
                distanceNum: distanceNum,
                image: store.image,
                logoUrl: store.logoUrl || store.logo,
                tags: store.tags || [],
                deliveryTime: store.deliveryTime,
                deliveryFee: store.deliveryFee || '$3.99',
                rating: store.rating,
                hasFlyer: store.flyer?.validUntil ? true : false,
                flyerImage: store.flyer?.image,
                activeDealsCount: [...(store.oneDayOffers || []), ...(store.saleItems || [])].filter((d: any) => {
                    if (!d.validUntil) return true;
                    return new Date(d.validUntil) > new Date();
                }).length,
                productCount: store.productCount || store.products?.length || 0
            };
        });
    }, [stores, userCoords]);

    const stats = useMemo(() => {
        return {
            totalStores: allStores.length,
            totalFlyers: allStores.filter(s => s.hasFlyer).length,
            totalDeals: allStores.reduce((acc, s) => acc + s.activeDealsCount, 0),
            totalProducts: allStores.reduce((acc, s) => acc + s.productCount, 0)
        };
    }, [allStores]);

    const [activeCategory, setActiveCategory] = useState('All');

    const filteredStores = useMemo(() => {
        let result = [...allStores];
        switch (activeCategory) {
            case 'Fastest':
                result = result.sort((a, b) => parseDeliveryTime(a.deliveryTime) - parseDeliveryTime(b.deliveryTime))
                    .filter(store => parseDeliveryTime(store.deliveryTime) <= 25);
                break;
            case 'Offers':
                result = result.filter(store => store.activeDealsCount > 0 || store.hasFlyer || store.tags.some((tag: string) => ['Deals', 'Offers', 'Sale', 'Wholesale'].includes(tag)));
                break;
            case 'Low Prices':
                result = result.filter(store => store.deliveryFee?.includes('Free') || (store.deliveryFee?.includes('$') && parseFloat(store.deliveryFee.replace(/[^0-9.]/g, '')) <= 2.5));
                break;
            case 'Grocery':
                result = result.filter(store => store.tags.some((tag: string) => ['Grocery', 'Organic', 'Farmers Market'].includes(tag)));
                break;
            case 'Convenience':
                result = result.filter(store => store.tags.some((tag: string) => ['Convenience', '24/7', 'Local'].includes(tag)));
                break;
            case 'Wholesale':
                result = result.filter(store => store.tags.some((tag: string) => ['Wholesale', 'Bulk'].includes(tag)));
                break;
            default: break;
        }
        if (userCoords) result.sort((a, b) => a.distanceNum - b.distanceNum);
        return result;
    }, [activeCategory, allStores, userCoords]);

    return (
        <div className="animate-fade-in">
            {loading && (
                <div className="fixed inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="animate-spin text-4xl">⏳</div>
                </div>
            )}

            <AdCarousel
                handleSearch={handleSearch}
                address={address}
                setAddress={setAddress}
                isLocating={isLocating}
                handleLocateMe={handleLocateMe}
            />

            <section className="py-8 px-4 bg-[var(--surface-1)] border-b border-[var(--glass-border)]">
                <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                        <p className="text-3xl font-bold text-[var(--brand-primary)]">{stats.totalStores > 0 ? stats.totalStores : '50+'}</p>
                        <p className="text-sm text-[var(--text-muted)]">Local Grocers</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-[var(--brand-primary)]">{stats.totalFlyers > 0 ? stats.totalFlyers : '10+'}</p>
                        <p className="text-sm text-[var(--text-muted)]">Active Flyers</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-[var(--brand-primary)]">{stats.totalDeals > 0 ? stats.totalDeals : '100+'}</p>
                        <p className="text-sm text-[var(--text-muted)]">Active Deals</p>
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-[var(--brand-primary)]">{stats.totalProducts > 0 ? `${(stats.totalProducts / 1000).toFixed(1)}k+` : '15%'}</p>
                        <p className="text-sm text-[var(--text-muted)]">{stats.totalProducts > 0 ? 'Products Available' : 'Estimated Savings'}</p>
                    </div>
                </div>
            </section>

            {allStores.filter(s => s.hasFlyer).length > 0 && (
                <section className="py-6 px-4 bg-[var(--surface-0)] border-b border-[var(--glass-border)]">
                    <div className="max-w-5xl mx-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span className="text-2xl">📰</span> Weekly Flyers
                            </h2>
                            <span className="text-sm text-[var(--brand-primary)] font-medium">Swipe for Savings →</span>
                        </div>
                        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
                            {allStores.filter(s => s.hasFlyer).map(store => (
                                <div
                                    key={store.id}
                                    onClick={() => navigate(`/store/${store.id}`, { state: { initialTab: 'flyer' } })}
                                    className="min-w-[280px] md:min-w-[320px] bg-white rounded-xl border border-[var(--glass-border)] shadow-sm hover:shadow-md transition-all cursor-pointer snap-center group overflow-hidden"
                                >
                                    <div className="relative h-40">
                                        <img src={store.flyerImage || store.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                                            <div>
                                                <h3 className="text-white font-bold text-lg drop-shadow-md">{store.name}</h3>
                                                <p className="text-white/90 text-xs">Expires soon</p>
                                            </div>
                                        </div>
                                        <div className="absolute top-3 right-3 bg-red-600 text-white text-[10px] uppercase font-bold px-2 py-1 rounded shadow-sm animate-pulse">Live Flyer</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            <section className="py-4 px-4 bg-[var(--surface-0)] sticky top-16 z-40 border-b border-[var(--glass-border)]">
                <div className="max-w-5xl mx-auto overflow-x-auto scrollbar-hide">
                    <div className="flex gap-2 min-w-max">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-1)] hover:text-[var(--text-main)]'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-8 px-4">
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-[var(--text-main)]">{activeCategory === 'All' ? 'Stores Near You' : `${activeCategory} Stores`}</h2>
                        <span className="text-sm text-[var(--text-muted)]">{filteredStores.length} stores</span>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3, 4, 5, 6].map((n) => (
                                <div key={n} className="h-80 bg-gray-100 rounded-xl animate-pulse border border-gray-200">
                                    <div className="h-40 bg-gray-200 w-full mb-4"></div>
                                    <div className="px-4">
                                        <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredStores.length === 0 ? (
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
                                    <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 items-end">
                                        {store.hasFlyer && <span className="bg-red-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded shadow-sm">New Flyer</span>}
                                        {store.activeDealsCount > 0 && <span className="bg-green-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded shadow-sm">{store.activeDealsCount} Deals</span>}
                                    </div>

                                    <div className="h-36 bg-[var(--surface-2)] relative overflow-hidden">
                                        <img src={store.image} alt={store.name} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 will-change-transform" />
                                        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-md text-xs text-white font-medium">{store.deliveryTime}</div>
                                    </div>

                                    <div className="p-4 relative">
                                        <div className="absolute -top-6 left-4 w-12 h-12 rounded-xl bg-[var(--surface-0)] border-2 border-[var(--glass-border)] flex items-center justify-center text-2xl shadow-lg overflow-hidden">
                                            {store.logoUrl && store.logoUrl.startsWith('http') ? <img src={store.logoUrl} alt="Logo" loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <span>{store.logoUrl || '🏪'}</span>}
                                        </div>

                                        <div className="ml-14">
                                            <h3 className="font-bold text-lg text-[var(--text-main)] group-hover:text-[var(--brand-primary)] transition-colors">{store.name}</h3>
                                            <p className="text-sm text-[var(--text-muted)]">{store.distance} away</p>
                                        </div>

                                        <div className="flex gap-2 mt-3 flex-wrap">
                                            {store.tags.map((tag: string) => (
                                                <span key={tag} className="text-xs bg-[var(--surface-2)] px-2 py-1 rounded-full text-[var(--text-muted)]">{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

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
