import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useOrders } from './OrderContext';
import { useNotifications } from './NotificationContext';

interface LocationContextType {
    userCoords: { lat: number, lng: number } | null;
    setUserCoords: React.Dispatch<React.SetStateAction<{ lat: number, lng: number } | null>>;
    address: string;
    setAddress: React.Dispatch<React.SetStateAction<string>>;
    searchDistance: number;
    setSearchDistance: React.Dispatch<React.SetStateAction<number>>;
    isLocating: boolean;
    handleLocateMe: () => void;
    handleSearch: (searchAddress?: string) => Promise<void>;
    calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { profile } = useOrders();
    const { addNotification } = useNotifications();

    const [userCoords, setUserCoords] = useState<{ lat: number, lng: number } | null>(null);
    const [address, setAddress] = useState('');
    const [searchDistance, setSearchDistance] = useState<number>(5); // default 5km
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
                if (user.address) {
                    setAddress("Home");
                }
                return;
            }

            // Priority 2: Geocode address from Profile Addresses list
            if (user && profile?.addresses?.length > 0) {
                const defaultAddr = profile.addresses.find((a: any) => a.isDefault) || profile.addresses[0];
                const addrStr = `${defaultAddr.street}, ${defaultAddr.city}, ${defaultAddr.province}, ${defaultAddr.postalCode}`;

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
    }, [user, profile, userCoords, address]);

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

    const handleSearch = async (searchAddress?: string) => {
        const queryAddress = searchAddress !== undefined ? searchAddress : address;
        if (!queryAddress.trim() || queryAddress === "Current Location") return;
        setIsLocating(true);

        try {
            // Improved Canadian Postal Code Handling
            const postalCodeRegex = /^([A-Za-z]\d[A-Za-z])\s?[-]?\s?(\d[A-Za-z]\d)?$/;
            let query = queryAddress;

            const match = queryAddress.trim().match(postalCodeRegex);

            if (match) {
                const fsa = match[1].toUpperCase();
                const { CANADIAN_FSA_MAP } = await import('../data/canadianFSAs');

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
                if (match) setAddress(queryAddress.toUpperCase());
            } else {
                if (query !== queryAddress) {
                    const fallbackResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryAddress)}&countrycodes=ca`);
                    const fallbackData = await fallbackResponse.json();
                    if (fallbackData && fallbackData.length > 0) {
                        const { lat, lon } = fallbackData[0];
                        setUserCoords({ lat: parseFloat(lat), lng: parseFloat(lon) });
                        return;
                    }
                }
                addNotification({ type: 'alert', title: 'Location Not Found', message: `We couldn't find "${queryAddress}".` });
            }
        } catch (error) {
            console.error('Search error:', error);
            addNotification({ type: 'alert', title: 'Search Failed', message: 'Error finding location.' });
        } finally {
            setIsLocating(false);
        }
    };

    return (
        <LocationContext.Provider value={{
            userCoords,
            setUserCoords,
            address,
            setAddress,
            searchDistance,
            setSearchDistance,
            isLocating,
            handleLocateMe,
            handleSearch,
            calculateDistance
        }}>
            {children}
        </LocationContext.Provider>
    );
};

export const useLocation = () => {
    const context = useContext(LocationContext);
    if (context === undefined) {
        throw new Error('useLocation must be used within a LocationProvider');
    }
    return context;
};
