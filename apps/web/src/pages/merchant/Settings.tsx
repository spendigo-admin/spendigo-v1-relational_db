import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import '../../styles/design-system.css';
import { useAuth } from '../../context/AuthContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useNotifications } from '../../context/NotificationContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { useFileUpload } from '../../hooks/useFileUpload';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, auth, storage } from '../../lib/firebase';
import { collection, query, where, onSnapshot, arrayUnion } from 'firebase/firestore';
import { auditBridge } from '../../utils/auditBridge';

// --- TYPES ---
type MerchantRole = 'OWNER' | 'MANAGER' | 'STAFF' | 'MARKETING';

interface TeamMember {
    id: string;
    name: string;
    email: string;
    role: MerchantRole;
    lastActive: string;
}

// --- CONSTANTS ---
const ROLE_INFO: Record<MerchantRole, { label: string; desc: string; permissions: string[]; color: string }> = {
    OWNER: {
        label: 'Store Owner',
        desc: 'Full access to all settings, payouts, and user management.',
        permissions: ['ALL_ACCESS'],
        color: 'bg-purple-100 text-purple-700 border-purple-200'
    },
    MANAGER: {
        label: 'Store Manager',
        desc: 'Can manage products, orders, and operations settings. Cannot access payouts.',
        permissions: ['products:write', 'orders:write', 'settings:write'],
        color: 'bg-blue-100 text-blue-700 border-blue-200'
    },
    STAFF: {
        label: 'Staff / Picker',
        desc: 'Restricted access to Order Management only. Great for floor staff.',
        permissions: ['orders:read', 'orders:write'],
        color: 'bg-green-100 text-green-700 border-green-200'
    },
    MARKETING: {
        label: 'Marketing Spec',
        desc: 'Can create Flyers and Deals. No access to orders or store settings.',
        permissions: ['flyers:write', 'deals:write'],
        color: 'bg-pink-100 text-pink-700 border-pink-200'
    }
};


export const BUSINESS_TYPES: Record<string, { logo: string; cover: string; tagline: string }> = {
    'Grocery Store': {
        logo: '/defaults/branding/grocery_logo.png?v=6',
        cover: '/defaults/branding/grocery_cover.png?v=5',
        tagline: 'Fresh groceries and daily essentials.'
    },
    'Convenience Store': {
        logo: '/defaults/branding/convenience_logo.png?v=5',
        cover: '/defaults/branding/convenience_cover.png?v=5',
        tagline: 'Quick stops for all your immediate needs.'
    },
    'Discount / Dollar Store': {
        logo: '/defaults/branding/discount_logo.png?v=5',
        cover: '/defaults/branding/discount_cover.png?v=5',
        tagline: 'Great deals and everyday value.'
    },
    'Ethnic / Specialty Grocery': {
        logo: '/defaults/branding/ethnic_logo.png?v=5',
        cover: '/defaults/branding/ethnic_cover.png?v=5',
        tagline: 'Authentic flavors, spices and traditional ingredients.'
    },
    'Ethnic Speciality Grocery': {
        logo: '/defaults/branding/ethnic_logo.png?v=5',
        cover: '/defaults/branding/ethnic_cover.png?v=5',
        tagline: 'Authentic flavors, spices and traditional ingredients.'
    },
    'Asian Grocers': {
        logo: '/defaults/branding/asian_logo.jpg?v=5',
        cover: '/defaults/branding/asian_cover.jpg?v=5',
        tagline: 'Fresh Asian produce, spices, and specialty goods.'
    },
    'Indo-Pak / Desi Grocery': {
        logo: '/defaults/branding/desi_logo.jpg?v=5',
        cover: '/defaults/branding/desi_cover.jpg?v=5',
        tagline: 'Authentic South Asian groceries and spices.'
    },
    'Farmers Market Vendor': {
        logo: '/defaults/branding/farmers_logo.png?v=5',
        cover: '/defaults/branding/farmers_cover.png?v=5',
        tagline: 'Fresh, local, and direct from the farm.'
    },
    'Organic / Health Food Store': {
        logo: '/defaults/branding/organic_logo.png?v=5',
        cover: '/defaults/branding/organic_cover.png?v=5',
        tagline: 'Healthy, organic, and locally sourced goodness.'
    },
    'Artisan Bakery': {
        logo: '/defaults/branding/bakery_logo.png?v=5',
        cover: '/defaults/branding/bakery_cover.png?v=5',
        tagline: 'Freshly baked breads and sweet treats daily.'
    },
    'Butcher Shop': {
        logo: '/defaults/branding/butcher_logo.png?v=5',
        cover: '/defaults/branding/butcher_cover.png?v=5',
        tagline: 'Quality cuts and fresh meats.'
    },
    'Fishmonger / Seafood Shop': {
        logo: '/defaults/branding/seafood_logo.png?v=5',
        cover: '/defaults/branding/seafood_cover.png?v=5',
        tagline: 'Fresh catches from the sea.'
    },
    'Deli / Prepared Foods': {
        logo: '/defaults/branding/deli_logo.png?v=5',
        cover: '/defaults/branding/deli_cover.png?v=5',
        tagline: 'Ready-to-eat meals and deli meats.'
    },
    'Restaurant': {
        logo: '/defaults/branding/restaurant_logo.png?v=5',
        cover: '/defaults/branding/restaurant_cover.png?v=5',
        tagline: 'Delicious meals made to order.'
    },
    'Local Café / Coffee Shop': {
        logo: '/defaults/branding/cafe_logo.png?v=5',
        cover: '/defaults/branding/cafe_cover.png?v=5',
        tagline: 'Premium coffee and cozy vibes.'
    },
    'Dessert & Sweets Shop': {
        logo: '/defaults/branding/sweets_logo.png?v=5',
        cover: '/defaults/branding/sweets_cover.png?v=5',
        tagline: 'Treat yourself to something sweet.'
    },
    'Meal Prep / Tiffin Service': {
        logo: '/defaults/branding/tiffin_logo.png?v=5',
        cover: '/defaults/branding/tiffin_cover.png?v=5',
        tagline: 'Home-cooked meals delivered fresh.'
    },
    'Pharmacy / Health Store': {
        logo: '/defaults/branding/pharmacy_logo.png?v=5',
        cover: '/defaults/branding/pharmacy_cover.png?v=5',
        tagline: 'Health, wellness, and prescriptions.'
    },
    'Pet Store': {
        logo: '/defaults/branding/pet_logo.png?v=5',
        cover: '/defaults/branding/pet_cover.png?v=5',
        tagline: 'Everything your furry friends need.'
    },
    'Florist': {
        logo: '/defaults/branding/florist_logo.png?v=5',
        cover: '/defaults/branding/florist_cover.png?v=5',
        tagline: 'Beautiful blooms for every occasion.'
    },
    'Home & Garden Store': {
        logo: '/defaults/branding/home_garden_logo.png?v=5',
        cover: '/defaults/branding/home_garden_cover.png?v=5',
        tagline: 'Everything to make your house a home.'
    },
    'Hardware Store': {
        logo: '/defaults/branding/hardware_logo.png?v=5',
        cover: '/defaults/branding/hardware_cover.png?v=5',
        tagline: 'Tools and supplies for every project.'
    },
    'Bookstore / Stationery': {
        logo: '/defaults/branding/books_logo.png?v=5',
        cover: '/defaults/branding/books_cover.png?v=5',
        tagline: 'Books, supplies, and inspiration.'
    },
    'Craft / Handmade Goods Store': {
        logo: '/defaults/branding/craft_logo.png?v=5',
        cover: '/defaults/branding/craft_cover.png?v=5',
        tagline: 'Unique, handmade goods and crafts.'
    },
    'Clothing / Boutique': {
        logo: '/defaults/branding/clothing_logo.png?v=5',
        cover: '/defaults/branding/clothing_cover.png?v=5',
        tagline: 'Apparel and accessories for every style.'
    },
    'Toy & Gift Store': {
        logo: '/defaults/branding/toys_logo.png?v=5',
        cover: '/defaults/branding/toys_cover.png?v=5',
        tagline: 'Fun toys and perfect gifts.'
    },
    'Electronics / Mobile Accessories': {
        logo: '/defaults/branding/electronics_logo.png?v=5',
        cover: '/defaults/branding/electronics_cover.png?v=5',
        tagline: 'Tech gadgets and accessories.'
    },
    'Thrift / Second-Hand Store': {
        logo: '/defaults/branding/thrift_logo.png?v=5',
        cover: '/defaults/branding/thrift_cover.png?v=5',
        tagline: 'Pre-loved goods and hidden treasures.'
    },
    'General Retail': {
        logo: '/defaults/branding/general_logo.png?v=5',
        cover: '/defaults/branding/general_cover.png?v=5',
        tagline: 'Quality goods and services.'
    },
    'Specialty Retail': {
        logo: '/defaults/branding/specialty_logo.png?v=5',
        cover: '/defaults/branding/specialty_cover.png?v=5',
        tagline: 'Unique specialty items and goods.'
    }
};

const MerchantSettings: React.FC = () => {
    const { can, user } = useAuth();
    const { stores, updateStore, updateStoreTeam, requestDeleteStore } = useMarketplace();
    const { addNotification } = useNotifications();
    const { confirm } = useConfirmation();
    const { uploadFile, deleteFile, uploading } = useFileUpload(); // New Hook
    const storeId = user?.storeId || '1'; // Fallback to 1 if missing
    const isLocked = stores[storeId]?.status === 'pending_deletion';
    const hasTeamAccess = can('team:manage') && !isLocked;
    const hasSettingsAccess = can('settings:write') && !isLocked;


    // Hidden File Input Ref
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [uploadTarget, setUploadTarget] = useState<'logo' | 'cover' | null>(null);

    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'profile' | 'operations' | 'team' | 'payments' | 'notifications' | 'verification'>((searchParams.get('tab') as any) || 'profile');
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [showCloseStoreModal, setShowCloseStoreModal] = useState(false);
    const [closeStoreInput, setCloseStoreInput] = useState('');
    const [isApplyingPreset, setIsApplyingPreset] = useState(false);

    const TABS = [
        { id: 'profile', label: 'Store Profile', icon: '🏪', visible: true },
        { id: 'operations', label: 'Operations', icon: '⚙️', visible: hasSettingsAccess },
        { id: 'team', label: 'Team Roles', icon: '👥', visible: hasTeamAccess },
        { id: 'payments', label: 'Payments', icon: '💳', visible: hasSettingsAccess },
        { id: 'notifications', label: 'Alerts', icon: '🔔', visible: true },
        { id: 'verification', label: 'Verification', icon: '🪪', visible: true }
    ];

    // Scroll Sync for Settings Sections
    const settingsContainerRef = useRef<HTMLDivElement>(null);
    const isScrollingRef = useRef(false); // To prevent observer from triggering while we are programmatic scrolling

    useEffect(() => {
        const observerOptions = {
            root: null, // Use viewport
            rootMargin: '-10% 0px -80% 0px', // Trigger when section is near top
            threshold: 0
        };

        const observer = new IntersectionObserver((entries) => {
            if (isScrollingRef.current) return;
            
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const tabId = entry.target.id.replace('section-', '');
                    setActiveTab(tabId as any);
                }
            });
        }, observerOptions);

        const sections = document.querySelectorAll('[id^="section-"]');
        sections.forEach((sec) => observer.observe(sec));

        return () => observer.disconnect();
    }, []);

    const scrollToSection = (id: string) => {
        const element = document.getElementById(`section-${id}`);
        if (element) {
            isScrollingRef.current = true;
            setActiveTab(id as any);
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Re-enable observer after scroll finishes
            setTimeout(() => {
                isScrollingRef.current = false;
            }, 800);
        }
    };

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['profile', 'operations', 'team', 'payments', 'notifications', 'verification'].includes(tab)) {
            setActiveTab(tab as any);
            setTimeout(() => scrollToSection(tab), 100);
        }
    }, [searchParams]);

    // Profile State
    const [storeInfo, setStoreInfo] = useState({
        name: 'FreshMart Queen St',
        tagline: 'Fresh groceries, delivered fast.',
        phone: '416-555-0123',
        email: 'merchant@freshmart.ca',
        address: '123 Queen St W',
        city: 'Toronto',
        province: 'ON',
        postalCode: 'M5V 2H1',
        description: 'Your local source for fresh produce and daily essentials. We partner with local farmers to bring you the best quality items.',
        website: 'www.freshmart.ca',
        businessType: 'Grocery Store', // Fixed default to match BUSINESS_TYPES key
        logoUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200',
        coverUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=300&fit=crop',
        coordinates: { lat: 0, lng: 0 }
    });

    // Operations State
    const [operations, setOperations] = useState({
        deliveryRadiusKm: 5,
        minOrder: 15.00,
        deliveryFee: 3.99,
        freeDeliveryThreshold: 50.00,
        pickupEnabled: true,
        defaultPrepTime: 20,
        autoAcceptOrders: false,
        taxRate: 13,
        deliveryEnabled: true,
        deliveryTime: '45-60 min'
    });

    // Hours State
    const [hours, setHours] = useState([
        { day: 'Monday', open: '09:00', close: '21:00', closed: false },
        { day: 'Tuesday', open: '09:00', close: '21:00', closed: false },
        { day: 'Wednesday', open: '09:00', close: '21:00', closed: false },
        { day: 'Thursday', open: '09:00', close: '21:00', closed: false },
        { day: 'Friday', open: '09:00', close: '22:00', closed: false },
        { day: 'Saturday', open: '10:00', close: '22:00', closed: false },
        { day: 'Sunday', open: '10:00', close: '18:00', closed: false },
    ]);

    // Payment State
    const [payments, setPayments] = useState({
        acceptVisa: true,
        acceptMastercard: true,
        acceptAmex: false,
        acceptApplePay: true,
        acceptCash: false, // Cash on delivery
        payoutSchedule: 'weekly',
        statementDescriptor: '',
        bankLast4: '4242'
    });
    const [isSavingPayout, setIsSavingPayout] = useState(false);

    // Notifications State
    const [notifications, setNotifications] = useState({
        emailOrderAlerts: true,
        smsOrderAlerts: true,
        marketingEmails: false,
        dailyReports: true
    });

    // KYB State
    type KybStatus = 'not_submitted' | 'pending_review' | 'approved' | 'rejected';
    interface KybDocument {
        type: 'business_license' | 'incorporation_certificate' | 'other';
        storagePath: string;
        url?: string;
        filename: string;
        uploadedAt: string;
    }
    const [kybStatus, setKybStatus] = useState<KybStatus>('not_submitted');
    const [kybDocuments, setKybDocuments] = useState<KybDocument[]>([]);
    const [kybReviewNote, setKybReviewNote] = useState('');
    const [kybDocType, setKybDocType] = useState<KybDocument['type']>('business_license');
    const [kybUploading, setKybUploading] = useState(false);
    const kybFileInputRef = useRef<HTMLInputElement>(null);

    const [isLocatingStatus, setIsLocatingStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    // Team State - derived from MarketplaceContext (Legacy) & Real-time Users
    // const team = (stores[storeId]?.team as TeamMember[]) || []; // Deprecated
    const [realTeam, setRealTeam] = useState<TeamMember[]>([]);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteSuccess, setInviteSuccess] = useState<{ name: string, email: string, password: string } | null>(null);
    const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'STAFF' as MerchantRole });
    const [inviteError, setInviteError] = useState('');

    // NEW: Check Stripe status when returning from Stripe
    useEffect(() => {
        const stripeParam = searchParams.get('stripe');
        if (stripeParam === 'return' || stripeParam === 'refresh') {
            const checkStatus = async () => {
                try {
                    const functions = getFunctions();
                    const checkStatusFn = httpsCallable(functions, 'checkStripeAccountStatus');
                    const result = await checkStatusFn({ storeId }) as { data: { status: string } };
                    
                    if (result.data.status === 'complete') {
                        addNotification({ 
                            type: 'system', 
                            title: 'Stripe Connected!', 
                            message: 'Your account is fully verified and ready for payouts.' 
                        });
                    } else {
                        addNotification({ 
                            type: 'system', 
                            title: 'Stripe Sync', 
                            message: 'We updated your connection status. Some details may still be pending.' 
                        });
                    }
                } catch (err) {
                    console.error("Status check failed:", err);
                }
            };
            checkStatus();
        }
    }, [searchParams, storeId, addNotification]);

    // Fetch Real-time Team Members
    useEffect(() => {
        if (!storeId) return;

        // Fallback: Query constraint might be an issue. Let's try to debug with a console log.
        console.log(`Fetching team for Store ID: ${storeId}`);

        const q = query(collection(db, 'users'), where('storeId', '==', storeId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log(`Found ${snapshot.size} team members.`);
            const members: TeamMember[] = [];
            snapshot.forEach(doc => {
                const d = doc.data();
                console.log(' - Member:', d.email, d.merchantRole);
                if (d.role === 'merchant' || d.merchantRole) {
                    members.push({
                        id: doc.id,
                        name: d.name || 'Unknown',
                        email: d.email,
                        role: d.merchantRole || 'STAFF',
                        lastActive: d.status === 'pending_invite'
                            ? '🟡 Pending Invite'
                            : (d.lastLogin ? new Date(d.lastLogin).toLocaleDateString() : 'Active')
                    });
                }
            });
            members.sort((a, b) => {
                if (a.role === 'OWNER') return -1;
                if (b.role === 'OWNER') return 1;
                return a.name.localeCompare(b.name);
            });
            setRealTeam(members);
        });
        return () => unsubscribe();
    }, [storeId]);

    // Initialize state from Context
    useEffect(() => {
        const store = stores[storeId];
        if (store) {
            setStoreInfo({
                name: store.name || '',
                tagline: store.tagline || '',
                phone: store.phone || '',
                email: store.email || '',
                address: store.address || '',
                city: store.city || 'Toronto',
                province: store.province || 'ON',
                postalCode: store.postalCode || '',
                description: store.description || '',
                website: store.website || '',
                logoUrl: store.logoUrl || store.logo || 'https://via.placeholder.com/150?text=Logo', // Handle emoji vs url vs empty
                coverUrl: store.image || '',
                businessType: store.businessType || 'Grocery Store',
                coordinates: store.coordinates || { lat: 43.6510, lng: -79.3820 } // default Toronto
            });

            setOperations({
                deliveryRadiusKm: store.deliveryRadiusKm || 5,
                minOrder: store.minDeliveryOrder || 0,
                deliveryFee: store.deliveryFeeValue || 3.99, // New numeric field
                freeDeliveryThreshold: store.freeDeliveryThreshold || 0,
                pickupEnabled: store.pickupEnabled !== false, // Default true
                defaultPrepTime: store.defaultPrepTime || 20,
                autoAcceptOrders: store.autoAcceptOrders || false,
                taxRate: store.taxRate || 13,
                deliveryEnabled: store.deliveryEnabled !== false, // Default true
                deliveryTime: store.deliveryTime || '45-60 min'
            });

            if (store.hours) {
                setHours(store.hours);
            }

            if (store.notificationPreferences) {
                setNotifications(prev => ({
                    ...prev,
                    ...store.notificationPreferences
                }));
            }

            setPayments(prev => ({
                ...prev,
                payoutSchedule: store.payoutSchedule || 'weekly',
                statementDescriptor: store.statementDescriptor || store.name?.substring(0, 22) || '',
            }));

            if (store.kybStatus) setKybStatus(store.kybStatus as KybStatus);
            if (store.kybDocuments) setKybDocuments(store.kybDocuments as KybDocument[]);
            if (store.kybReviewNote) setKybReviewNote(store.kybReviewNote);
        }
    }, [storeId, stores]);

    const handleGeocode = async () => {
        setIsLocatingStatus('loading');
        const fullAddress = `${storeInfo.address}, ${storeInfo.city}, ${storeInfo.province}, ${storeInfo.postalCode}, Canada`;

        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`);
            const data = await response.json();

            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                setStoreInfo(prev => ({
                    ...prev,
                    coordinates: { lat: parseFloat(lat), lng: parseFloat(lon) }
                }));
                setIsLocatingStatus('success');
            } else {
                setIsLocatingStatus('error');
            }
        } catch (error) {
            console.error('Geocoding error:', error);
            setIsLocatingStatus('error');
        }
    };

    const handleExportData = async () => {
        if (!await confirm({
            title: 'Export Store Data?',
            message: 'This will download a JSON file with your store profile, products, order history (customer PII redacted), price history, deals, and flyers. May take up to 30 seconds.',
            confirmText: 'Export Data',
        })) return;

        setIsExporting(true);
        try {
            const fn = httpsCallable(getFunctions(), 'exportMerchantData');
            const result = await fn({}) as { data: { success: boolean; data: unknown } };
            if (result.data.success) {
                const blob = new Blob([JSON.stringify(result.data.data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `spendigo-store-export-${new Date().toISOString().slice(0, 10)}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                addNotification({ type: 'system', title: 'Export Complete', message: 'Your store data has been downloaded.' });
            }
        } catch (err: any) {
            addNotification({ type: 'alert', title: 'Export Failed', message: err.message || 'Could not export data.' });
        } finally {
            setIsExporting(false);
        }
    };

    const handleSavePayoutConfig = async () => {
        setIsSavingPayout(true);
        try {
            const fns = getFunctions();
            const updateFn = httpsCallable(fns, 'updatePayoutConfig');
            await updateFn({
                storeId,
                payoutSchedule: payments.payoutSchedule,
                statementDescriptor: payments.statementDescriptor,
            });
            addNotification({ type: 'system', title: 'Payout Settings Saved', message: 'Your payout schedule and statement descriptor have been updated.' });
        } catch (err: any) {
            addNotification({ type: 'alert', title: 'Save Failed', message: err.message || 'Could not update payout settings.' });
        } finally {
            setIsSavingPayout(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);

        try {
            let finalCoordinates = storeInfo.coordinates;
            
            // Auto-geocode if coordinates are missing or explicitly 0,0
            if (!finalCoordinates || (finalCoordinates.lat === 0 && finalCoordinates.lng === 0) || (finalCoordinates.lat === 43.6510 && finalCoordinates.lng === -79.3820)) {
                const fullAddress = `${storeInfo.address}, ${storeInfo.city}, ${storeInfo.province}, ${storeInfo.postalCode}, Canada`;
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`);
                    const data = await response.json();

                    if (data && data.length > 0) {
                        finalCoordinates = {
                            lat: parseFloat(data[0].lat),
                            lng: parseFloat(data[0].lon)
                        };
                        setStoreInfo(prev => ({ ...prev, coordinates: finalCoordinates }));
                    }
                } catch (error) {
                    console.warn('Auto-geocoding failed during save:', error);
                }
            }

            let displayFee = `$${Number(operations.deliveryFee || 0).toFixed(2)}`;
            if (operations.freeDeliveryThreshold > 0) {
                displayFee = `Free over $${operations.freeDeliveryThreshold}`;
            }

            const updates: any = {
                // Profile
                name: storeInfo.name,
                tagline: storeInfo.tagline,
                phone: storeInfo.phone,
                email: storeInfo.email,
                address: storeInfo.address,
                city: storeInfo.city,
                province: storeInfo.province,
                postalCode: storeInfo.postalCode,
                description: storeInfo.description,
                website: storeInfo.website,
                coordinates: finalCoordinates, // Save real coordinates!
                businessType: storeInfo.businessType,
                logoUrl: storeInfo.logoUrl,
                image: storeInfo.coverUrl, // Map local coverUrl to DB 'image' field
            };

            // --- Branding Auto-Refresh Logic ---
            const currentStore = stores[storeId];
            const typeChanged = currentStore && currentStore.businessType !== storeInfo.businessType;
            
            if (typeChanged) {
                const newDefaults = BUSINESS_TYPES[storeInfo.businessType];
                if (newDefaults) {
                    // Only update if current assets are defaults (start with /defaults/branding/)
                    const currentLogo = storeInfo.logoUrl; 
                    const currentCover = storeInfo.coverUrl;

                    const isCurrentLogoDefault = !currentLogo || (typeof currentLogo === 'string' && currentLogo.includes('/defaults/branding/'));
                    const isCurrentCoverDefault = !currentCover || (typeof currentCover === 'string' && currentCover.includes('/defaults/branding/'));

                    if (isCurrentLogoDefault) {
                        updates.logoUrl = newDefaults.logo;
                        // Clear legacy logo field if present in current store
                        if (currentStore?.logo) {
                            updates.logo = '';
                        }
                    }
                    if (isCurrentCoverDefault) {
                        updates.image = newDefaults.cover;
                    }
                }
            }

            // Operations
            Object.assign(updates, {
                deliveryRadiusKm: operations.deliveryRadiusKm,
                minDeliveryOrder: operations.minOrder,
                deliveryFeeValue: operations.deliveryFee, // Numeric
                freeDeliveryThreshold: operations.freeDeliveryThreshold,
                pickupEnabled: operations.pickupEnabled,
                defaultPrepTime: operations.defaultPrepTime,
                autoAcceptOrders: operations.autoAcceptOrders,
                taxRate: operations.taxRate,
                deliveryEnabled: operations.deliveryEnabled,
                deliveryTime: operations.deliveryTime,
                hours: hours,
                notificationPreferences: notifications,
                // Legacy/Display Fields
                deliveryFee: displayFee
            });

            // Remove any undefined payload fields to prevent Firestore crashes
            Object.keys(updates).forEach(key => {
                if (updates[key] === undefined) {
                    delete updates[key];
                }
            });

            // Simulate processing for UX
            await new Promise(resolve => setTimeout(resolve, 1000));

            await updateStore(storeId, updates);
            auditBridge.emit('STORE_SETTINGS_SAVE', { storeId, name: storeInfo.name, address: storeInfo.address }, `stores/${storeId}`);
            addNotification({ type: 'system', title: 'Settings Saved', message: 'Store configuration updated successfully.' });
        } catch (error: any) {
            console.error("Save failed:", error);
            addNotification({ type: 'alert', title: 'Error Saving Settings', message: error.message || 'An unexpected error occurred.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setInviteError('');

        try {
            // Generate temporary password
            const tempPassword = `Spendigo${Math.random().toString(36).slice(-8)}!`;

            // Call Cloud Function to create Auth user and Firestore record
            const functions = getFunctions();
            const inviteFunction = httpsCallable(functions, 'inviteTeamMember');

            const result = await inviteFunction({
                email: inviteForm.email,
                name: inviteForm.name,
                merchantRole: inviteForm.role,
                storeId: storeId,
                tempPassword: tempPassword
            }) as { data: { success: boolean; uid: string; message: string } };

            if (result.data.success) {
                // Success: Cloud function created user. 
                // The onSnapshot listener will automatically pick up the new member in 'realTeam'.

                // Show success modal instead of alert
                setInviteSuccess({
                    name: inviteForm.name,
                    email: inviteForm.email,
                    password: tempPassword
                });

                setShowInviteModal(false);
                setInviteForm({ name: '', email: '', role: 'STAFF' });
            } else {
                throw new Error('Invitation failed');
            }
        } catch (error: any) {
            console.error('Error inviting team member:', error);
            const errorMessage = error.message || 'Failed to send invitation';
            setInviteError(errorMessage);
            addNotification({ type: 'alert', title: 'Invitation Failed', message: errorMessage });
        } finally {
            setIsSaving(false);
        }
    };

    const removeMember = async (id: string) => {
        const confirmed = await confirm({
            title: 'Remove Team Member',
            message: 'Are you sure you want to remove this team member? Their access will be revoked immediately.',
            confirmText: 'Remove',
            type: 'danger'
        });

        if (confirmed) {
            setIsSaving(true);
            try {
                const functions = getFunctions();
                const removeFunc = httpsCallable(functions, 'removeTeamMember');
                await removeFunc({ targetUserId: id, storeId });
                addNotification({ type: 'system', title: 'Member Removed', message: 'User unlinked from store.' });
            } catch (error: any) {
                console.error('Error removing member:', error);
                addNotification({ type: 'alert', title: 'Removal Failed', message: error.message || 'Could not remove member' });
            } finally {
                setIsSaving(false);
            }
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0] || !uploadTarget) return;

        const file = e.target.files[0];
        const path = `stores/${storeId}/${uploadTarget}_${Date.now()}_${file.name}`;

        const url = await uploadFile(file, path, 5); // 5MB limit

        if (url) {
            // Delete old file if exists
            try {
                if (uploadTarget === 'logo' && storeInfo.logoUrl) {
                    await deleteFile(storeInfo.logoUrl);
                    setStoreInfo(prev => ({ ...prev, logoUrl: url }));
                }
                if (uploadTarget === 'cover' && storeInfo.coverUrl) {
                    await deleteFile(storeInfo.coverUrl);
                    setStoreInfo(prev => ({ ...prev, coverUrl: url }));
                }
            } catch (err) {
                console.warn('Auto-delete failed, but upload succeeded.', err);
            }

            addNotification({ type: 'system', title: 'Upload Success', message: 'Image updated successfully. Don\'t forget to save changes.' });
        }

        // Reset
        if (fileInputRef.current) fileInputRef.current.value = '';
        setUploadTarget(null);
    };

    const triggerUpload = (target: 'logo' | 'cover') => {
        setUploadTarget(target);
        fileInputRef.current?.click();
    };


    const renderTeam = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-100">
                <div>
                    <h3 className="font-bold text-blue-900">Manage Your Store Team</h3>
                    <p className="text-sm text-blue-800">Assign roles to restrict access based on job function.</p>
                </div>
                <button
                    onClick={() => setShowInviteModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-blue-700 transition-colors"
                >
                    + Add Member
                </button>
            </div>

            <div className="bg-white rounded-xl border border-[var(--glass-border)] shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-[var(--surface-1)] text-[var(--text-muted)] text-xs uppercase font-bold border-b border-[var(--glass-border)]">
                        <tr>
                            <th className="p-4">Name</th>
                            <th className="p-4">Role</th>
                            <th className="p-4">Permissions Scope</th>
                            <th className="p-4">Last Active</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--glass-border)]">
                        {realTeam.map(member => (
                            <tr key={member.id} className="hover:bg-[var(--surface-1)] transition-colors">
                                <td className="p-4">
                                    <div className="font-bold text-[var(--text-main)] text-sm">{member.name}</div>
                                    <div className="text-xs text-[var(--text-muted)]">{member.email}</div>
                                </td>
                                <td className="p-4">
                                    <span className={`text-xs font-bold px-2 py-1 rounded border uppercase ${ROLE_INFO[member.role].color}`}>
                                        {ROLE_INFO[member.role].label}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <div className="text-xs text-[var(--text-muted)] max-w-xs leading-tight">
                                        {ROLE_INFO[member.role].desc}
                                    </div>
                                </td>
                                <td className="p-4 text-xs text-[var(--text-muted)]">{member.lastActive}</td>
                                <td className="p-4 text-right">
                                    {member.role !== 'OWNER' && (
                                        <button
                                            onClick={() => removeMember(member.id)}
                                            className="text-xs font-bold text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Role Helper Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                {(Object.keys(ROLE_INFO) as MerchantRole[]).slice(1).map(role => (
                    <div key={role} className="bg-white p-4 rounded-xl border border-[var(--glass-border)] opacity-75">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${ROLE_INFO[role].color}`}>
                            {ROLE_INFO[role].label}
                        </span>
                        <p className="text-[10px] text-[var(--text-muted)] mt-2">{ROLE_INFO[role].desc}</p>
                    </div>
                ))}
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-fade-in p-4">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold mb-4">Invite Team Member</h2>
                        <form onSubmit={handleInvite} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Full Name</label>
                                <input
                                    required
                                    className="w-full p-2 border rounded-lg focus:ring-2 ring-[var(--brand-primary)] outline-none"
                                    value={inviteForm.name} onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Email Address</label>
                                <input
                                    type="email" required
                                    className="w-full p-2 border rounded-lg focus:ring-2 ring-[var(--brand-primary)] outline-none"
                                    value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Role</label>
                                <select
                                    className="w-full p-2 border rounded-lg focus:ring-2 ring-[var(--brand-primary)] outline-none bg-white"
                                    value={inviteForm.role} onChange={e => setInviteForm({ ...inviteForm, role: e.target.value as MerchantRole })}
                                >
                                    {Object.keys(ROLE_INFO).map(role => (
                                        <option key={role} value={role}>{ROLE_INFO[role as MerchantRole].label}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-[var(--text-muted)] mt-2 bg-gray-50 p-2 rounded">
                                    Access: {ROLE_INFO[inviteForm.role].desc}
                                </p>
                            </div>

                            {inviteError && (
                                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                                    {inviteError}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" disabled={isSaving} onClick={() => setShowInviteModal(false)} className="px-4 py-2 font-bold text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-50">Cancel</button>
                                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-[var(--brand-primary)] text-white font-bold rounded-lg hover:brightness-110 disabled:opacity-50 flex justify-center items-center min-w-[120px]">
                                    {isSaving ? 'Sending...' : 'Send Invite'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {inviteSuccess && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in p-4 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl border-2 border-green-100">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                                ✅
                            </div>
                            <h2 className="text-2xl font-bold text-green-900">Invitation Sent!</h2>
                            <p className="text-green-700">Account created successfully.</p>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3 mb-6">
                            <div>
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Name</span>
                                <div className="font-medium">{inviteSuccess.name}</div>
                            </div>
                            <div>
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Email</span>
                                <div className="font-medium">{inviteSuccess.email}</div>
                            </div>
                            <div className="pt-2 border-t border-gray-200">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Temporary Password</span>
                                <div className="flex items-center gap-2 mt-1">
                                    <code className="bg-white px-3 py-1.5 rounded border border-gray-300 font-mono text-lg font-bold text-blue-600 select-all">
                                        {inviteSuccess.password}
                                    </code>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(inviteSuccess.password);
                                            addNotification({ type: 'system', title: 'Copied', message: 'Password copied to clipboard!' });
                                        }}
                                        className="text-sm bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-200 transition-colors"
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-sm text-yellow-800 mb-6 flex gap-3">
                            <span className="text-xl">⚠️</span>
                            <p>
                                <strong>Important:</strong> Provide these credentials to your team member immediately. For security, ask them to change their password after logging in.
                            </p>
                        </div>

                        <button
                            onClick={() => setInviteSuccess(null)}
                            className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 transition-all"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    const renderProfile = () => (
        <div className="space-y-6 animate-fade-in">
            {/* Branding */}
            <section className="bg-white p-6 rounded-xl border border-[var(--glass-border)] shadow-sm">
                <h2 className="text-lg font-bold text-[var(--text-main)] mb-4">Branding & Appearance</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Store Logo</label>
                        <div className="flex items-center gap-4">
                            <img src={storeInfo.logoUrl} className="w-20 h-20 rounded-full object-cover border-2 border-[var(--surface-2)]" alt="Logo" />
                            <div>
                                <button
                                    onClick={() => triggerUpload('logo')}
                                    disabled={uploading}
                                    className="px-4 py-2 border border-[var(--glass-border)] rounded-lg text-sm font-medium hover:bg-gray-50 mb-1 disabled:opacity-50"
                                >
                                    {uploading && uploadTarget === 'logo' ? 'Uploading...' : 'Upload New Logo'}
                                </button>
                                <p className="text-xs text-[var(--text-muted)]">Recommended: 400x400px</p>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Cover Image</label>
                        <div
                            onClick={() => !uploading && triggerUpload('cover')}
                            className="h-20 w-full rounded-lg overflow-hidden relative group cursor-pointer border-2 border-[var(--surface-2)] transition-colors hover:border-[var(--brand-primary)]"
                        >
                            <img src={storeInfo.coverUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="Cover" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 text-white font-medium text-sm">
                                {uploading && uploadTarget === 'cover' ? 'Uploading...' : 'Change Cover'}
                            </div>
                        </div>
                    </div>

                    {/* Hidden File Input */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/png, image/jpeg, image/webp"
                        onChange={handleImageUpload}
                    />
                </div>
            </section>

            {/* General Info */}
            <section className="bg-white p-6 rounded-xl border border-[var(--glass-border)] shadow-sm">
                <h2 className="text-lg font-bold text-[var(--text-main)] mb-4">Store Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2 bg-blue-50 p-4 rounded-lg border border-blue-100 mb-2">
                        <label className="block text-sm font-bold text-blue-900 mb-2">Primary Business Type</label>
                        <select
                            value={storeInfo.businessType}
                            disabled={true}
                            className="w-full p-2 border rounded-lg bg-white/50 focus:ring-2 ring-[var(--brand-primary)] outline-none text-[var(--text-main)] font-semibold cursor-not-allowed opacity-75"
                        >
                            {Object.keys(BUSINESS_TYPES).map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                        <p className="text-xs text-blue-700 mt-2 font-medium">
                            🔒 Business type is locked. Please contact support if you need to change this.
                        </p>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Store Name</label>
                        <input
                            type="text"
                            value={storeInfo.name}
                            onChange={e => setStoreInfo({ ...storeInfo, name: e.target.value })}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg font-medium text-lg"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Tagline</label>
                        <input
                            type="text"
                            value={storeInfo.tagline}
                            onChange={e => setStoreInfo({ ...storeInfo, tagline: e.target.value })}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg"
                            placeholder="e.g. Fresh groceries, delivered fast."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Phone Number</label>
                        <input
                            type="tel"
                            value={storeInfo.phone}
                            onChange={e => setStoreInfo({ ...storeInfo, phone: e.target.value })}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Email</label>
                        <input
                            type="email"
                            value={storeInfo.email}
                            onChange={e => setStoreInfo({ ...storeInfo, email: e.target.value })}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg"
                        />
                    </div>
                    <div className="md:col-span-2 mt-2 pt-4 border-t border-[var(--glass-border)] flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-[var(--text-main)]">Store Location</h3>
                            <p className="text-sm text-[var(--text-muted)]">Enter your physical address to calculate delivery and distance.</p>
                        </div>
                        <button
                            onClick={handleGeocode}
                            disabled={isLocatingStatus === 'loading'}
                            className={`px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ${isLocatingStatus === 'success' ? 'bg-green-100 text-green-700' :
                                isLocatingStatus === 'error' ? 'bg-red-100 text-red-700' :
                                    'bg-blue-600 text-white hover:brightness-110 shadow-md'
                                }`}
                        >
                            {isLocatingStatus === 'loading' ? '⏳ Verifying...' :
                                isLocatingStatus === 'success' ? '✅ Address Verified' :
                                    isLocatingStatus === 'error' ? '❌ Address Not Found' :
                                        '📍 Verify Address & Locate'}
                        </button>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Street Address</label>
                        <input
                            type="text"
                            value={storeInfo.address}
                            onChange={e => setStoreInfo({ ...storeInfo, address: e.target.value })}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg"
                            placeholder="e.g. 123 Main St"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">City</label>
                        <input
                            type="text"
                            value={storeInfo.city}
                            onChange={e => setStoreInfo({ ...storeInfo, city: e.target.value })}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg"
                            placeholder="e.g. Toronto"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Province (Sets Tax Rate)</label>
                        <select
                            value={storeInfo.province}
                            onChange={e => setStoreInfo({ ...storeInfo, province: e.target.value })}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg bg-white"
                        >
                            <option value="ON">ON - Ontario (13% HST)</option>
                            <option value="BC">BC - British Columbia (12%)</option>
                            <option value="QC">QC - Quebec (14.975%)</option>
                            <option value="AB">AB - Alberta (5%)</option>
                            <option value="NS">NS - Nova Scotia (15%)</option>
                            <option value="NB">NB - New Brunswick (15%)</option>
                            <option value="MB">MB - Manitoba (12%)</option>
                            <option value="SK">SK - Saskatchewan (11%)</option>
                            <option value="PE">PE - PEI (15%)</option>
                            <option value="NL">NL - Newfoundland & Labrador (15%)</option>
                            <option value="YT">YT - Yukon (5%)</option>
                            <option value="NT">NT - Northwest Territories (5%)</option>
                            <option value="NU">NU - Nunavut (5%)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Postal Code</label>
                        <input
                            type="text"
                            value={storeInfo.postalCode}
                            onChange={e => setStoreInfo({ ...storeInfo, postalCode: e.target.value })}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg"
                            placeholder="e.g. M5V 2H1"
                        />
                    </div>

                    {storeInfo.coordinates.lat !== 0 && (
                        <div className="md:col-span-2 p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-blue-700 text-xs font-semibold">
                                <span>🎯 Coordinates:</span>
                                <code>{storeInfo.coordinates.lat.toFixed(4)}, {storeInfo.coordinates.lng.toFixed(4)}</code>
                            </div>
                            <span className="text-[10px] text-blue-500 italic">Automatically saved on Verify</span>
                        </div>
                    )}

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Description</label>
                        <textarea
                            value={storeInfo.description}
                            onChange={e => setStoreInfo({ ...storeInfo, description: e.target.value })}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg h-24 resize-none"
                            placeholder="Tell customers about your store..."
                        />
                    </div>
                </div>
            </section>

            {/* Data Portability */}
            <section className="bg-white p-6 rounded-xl border border-[var(--glass-border)] shadow-sm">
                <h2 className="text-lg font-bold text-[var(--text-main)] mb-1">Data Portability</h2>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                    Download a complete export of your store data — products, orders (customer PII redacted), price history, deals, and flyers.
                </p>
                <button
                    onClick={handleExportData}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-4 py-2 border border-[var(--glass-border)] rounded-lg text-sm font-bold hover:bg-gray-50 disabled:opacity-50 transition-all"
                >
                    {isExporting ? (
                        <>
                            <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                            Generating Export...
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download Store Data
                        </>
                    )}
                </button>
            </section>
        </div>
    );

    const renderOperations = () => (
        <div className="space-y-6 animate-fade-in">
            {/* Delivery & Fees */}
            <section className="bg-white p-6 rounded-xl border border-[var(--glass-border)] shadow-sm">
                <h2 className="text-lg font-bold text-[var(--text-main)] mb-4">Delivery Configuration</h2>

                {(!user?.subscriptionTier || user.subscriptionTier === 'free') && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4 flex items-start gap-3">
                        <span className="text-2xl">🔒</span>
                        <div>
                            <h3 className="font-bold text-orange-800">Delivery is a Premium Feature</h3>
                            <p className="text-sm text-orange-700 mb-2">Upgrade to Core or Growth plan to enable delivery options.</p>
                            <a href="/merchant/subscription" className="text-sm font-bold text-orange-900 underline">View Plans & Upgrade</a>
                        </div>
                    </div>
                )}

                <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 relative ${(!user?.subscriptionTier || user.subscriptionTier === 'free') ? 'opacity-50 pointer-events-none select-none grayscale' : ''}`}>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Delivery Radius (km)</label>
                        <input
                            type="number"
                            value={operations.deliveryRadiusKm}
                            onChange={e => setOperations({ ...operations, deliveryRadiusKm: Number(e.target.value) })}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Base Delivery Fee ($)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={operations.deliveryFee}
                            onChange={e => setOperations({ ...operations, deliveryFee: Number(e.target.value) })}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Free Delivery Threshold ($)</label>
                        <input
                            type="number"
                            value={operations.freeDeliveryThreshold}
                            onChange={e => setOperations({ ...operations, freeDeliveryThreshold: Number(e.target.value) })}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Minimum Order Amount ($)</label>
                        <input
                            type="number"
                            value={operations.minOrder}
                            onChange={e => setOperations({ ...operations, minOrder: Number(e.target.value) })}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Default Prep Time (mins)</label>
                        <input
                            type="number"
                            value={operations.defaultPrepTime}
                            onChange={e => setOperations({ ...operations, defaultPrepTime: Number(e.target.value) })}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Displayed Delivery Time</label>
                        <input
                            type="text"
                            value={operations.deliveryTime}
                            onChange={e => setOperations({ ...operations, deliveryTime: e.target.value })}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg"
                            placeholder="e.g. 45-60 min"
                        />
                        <p className="text-xs text-[var(--text-muted)] mt-1">This text is shown to customers on the store list.</p>
                    </div>
                    <div className="md:col-span-2 pt-2 border-t border-[var(--glass-border)] mt-2 space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg">
                            <input
                                type="checkbox"
                                checked={operations.deliveryEnabled}
                                onChange={e => setOperations({ ...operations, deliveryEnabled: e.target.checked })}
                                className="w-5 h-5 accent-[var(--brand-primary)]"
                                disabled={(!user?.subscriptionTier || user.subscriptionTier === 'free')}
                            />
                            <div>
                                <div className="font-medium text-[var(--text-main)]">Enable Local Delivery</div>
                                <div className="text-xs text-[var(--text-muted)]">Offer local delivery within your radius. (Core/Growth only)</div>
                            </div>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg">
                            <input
                                type="checkbox"
                                checked={operations.pickupEnabled}
                                onChange={e => setOperations({ ...operations, pickupEnabled: e.target.checked })}
                                className="w-5 h-5 accent-[var(--brand-primary)]"
                            />
                            <div>
                                <div className="font-medium text-[var(--text-main)]">Enable Store Pickup / Click & Collect</div>
                                <div className="text-xs text-[var(--text-muted)]">Allow customers to order online and pick up in store.</div>
                            </div>
                        </label>
                    </div>
                </div>
            </section>

            {/* Business Hours */}
            <section className="bg-white p-6 rounded-xl border border-[var(--glass-border)] shadow-sm">
                <h2 className="text-lg font-bold text-[var(--text-main)] mb-4">Business Hours</h2>
                <div className="space-y-1">
                    {hours.map((day, idx) => (
                        <div key={idx} className="flex items-center gap-4 py-2 border-b border-[var(--surface-1)] last:border-0 hover:bg-[var(--surface-1)] px-2 rounded-lg transition-colors">
                            <div className="w-32 font-medium text-[var(--text-main)]">{day.day}</div>
                            <div className="flex-1 flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={day.closed}
                                        onChange={e => {
                                            const newHours = [...hours];
                                            newHours[idx].closed = e.target.checked;
                                            setHours(newHours);
                                        }}
                                        className="accent-[var(--brand-primary)]"
                                    />
                                    <span className="text-sm text-[var(--text-muted)]">Closed</span>
                                </label>

                                {!day.closed && (
                                    <>
                                        <input
                                            type="time"
                                            value={day.open}
                                            onChange={e => {
                                                const newHours = [...hours];
                                                newHours[idx].open = e.target.value;
                                                setHours(newHours);
                                            }}
                                            className="p-2 border border-[var(--glass-border)] rounded-md text-sm bg-gray-50"
                                        />
                                        <span className="text-[var(--text-muted)]">-</span>
                                        <input
                                            type="time"
                                            value={day.close}
                                            onChange={e => {
                                                const newHours = [...hours];
                                                newHours[idx].close = e.target.value;
                                                setHours(newHours);
                                            }}
                                            className="p-2 border border-[var(--glass-border)] rounded-md text-sm bg-gray-50"
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );

    const renderPayments = () => {
        const store = stores[storeId];
        const isConnected = !!store?.stripeAccountId;

        // --- STRIPE CONNECT LOGIC ---
        const handleConnectStripe = async () => {
            if (!user?.subscriptionTier || user.subscriptionTier === 'free') {
                addNotification({
                    type: 'alert',
                    title: 'Feature Locked',
                    message: 'Stripe Payout integration is a premium feature. Please upgrade your subscription.'
                });
                return;
            }
            setIsSaving(true);
            try {
                const functions = getFunctions();
                const onboardStoreFn = httpsCallable(functions, 'onboardStore');
                
                const result = await onboardStoreFn({ storeId }) as { data: { url: string } };

                if (result.data?.url) {
                    auditBridge.emit('STORE_STRIPE_CONNECT_INITIATED', { storeId }, `stores/${storeId}`);
                    // Redirect to Stripe Onboarding
                    window.location.href = result.data.url;
                } else {
                    throw new Error('No redirect URL returned from Stripe.');
                }
            } catch (err: any) {
                console.error("Stripe Onboarding Error:", err);
                addNotification({ 
                    type: 'alert', 
                    title: 'Connection Failed', 
                    message: err.message || 'Could not initiate Stripe connection.' 
                });
            } finally {
                setIsSaving(false);
            }
        };




        const handleDisconnectStripe = async () => {
            if (await confirm({ title: 'Disconnect Stripe?', message: 'You will stop receiving payouts until you reconnect.', confirmText: 'Disconnect', type: 'danger' })) {
                setIsSaving(true);
                try {
                    const { getFunctions, httpsCallable } = await import('firebase/functions');
                    const functions = getFunctions();
                    const disconnectStripeFn = httpsCallable(functions, 'disconnectStripe');
                    await disconnectStripeFn({ storeId });

                    auditBridge.emit('STORE_STRIPE_DISCONNECT', { storeId }, `stores/${storeId}`);
                    addNotification({ type: 'system', title: 'Disconnected', message: 'Stripe account unlinked.' });
                } catch (err: any) {
                    console.error('[disconnectStripe] Error:', err);
                    addNotification({ type: 'alert', title: 'Error', message: err.message || 'Failed to disconnect.' });
                } finally {
                    setIsSaving(false);
                }
            }
        };

        return (
            <div className="space-y-6 animate-fade-in">
                {/* Context / Information */}
                <section className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                    <div className="flex gap-4">
                        <div className="text-3xl">🏦</div>
                        <div>
                            <h3 className="font-bold text-blue-900 text-lg">Direct Payouts</h3>
                            <p className="text-blue-800 mt-1">
                                Spendigo does not hold your funds. All payments from customers are routed directly to your connected bank account via our payment partner, Stripe.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Payout Configuration */}
                <section className="bg-white p-6 rounded-xl border border-[var(--glass-border)] shadow-sm">
                    <h2 className="text-lg font-bold text-[var(--text-main)] mb-4">Payout Configuration</h2>

                    {(!user?.subscriptionTier || user.subscriptionTier === 'free') ? (
                        <div className="space-y-4">
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3 text-left">
                                <span className="text-2xl">🔒</span>
                                <div>
                                    <h3 className="font-bold text-orange-800">Stripe Payouts are a Premium Feature</h3>
                                    <p className="text-sm text-orange-700 mb-2">Upgrade to Core, Growth, or Pro to enable custom payouts and receive customer credit card payments directly to your bank account.</p>
                                    <a href="/merchant/subscription" className="text-sm font-bold text-orange-900 underline">View Plans & Upgrade</a>
                                </div>
                            </div>
                            
                            <div className="opacity-40 pointer-events-none select-none grayscale flex flex-col md:flex-row items-center gap-6 p-6 bg-gray-50 border border-gray-200 rounded-xl">
                                <div className="w-16 h-16 bg-[#635BFF] rounded-xl flex items-center justify-center text-white text-3xl shadow-lg shrink-0">
                                    S
                                </div>
                                <div className="flex-1 text-center md:text-left">
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">Connect with Stripe</h3>
                                    <p className="text-gray-600 mb-4">
                                        To start selling on Spendigo, you must connect a Stripe account. This allows us to securely transfer earnings to your bank account automatically.
                                    </p>
                                </div>
                                <button className="px-6 py-3 bg-[#635BFF] text-white font-bold rounded-lg whitespace-nowrap">
                                    Connect Stripe Account
                                </button>
                            </div>
                        </div>
                    ) : isConnected ? (
                        /* Connected State */
                        <div className="flex items-center gap-4 p-5 bg-green-50 border border-green-200 rounded-lg mb-6">
                            <div className="w-12 h-12 rounded-full bg-green-200 flex items-center justify-center text-green-700 font-bold text-xl">✓</div>
                            <div className="flex-1">
                                <div className="font-bold text-green-900 text-lg">Stripe Connect Active</div>
                                <div className="text-green-800">Your account is ready to receive payouts.</div>
                                <div className="text-sm text-green-700 mt-1">Account ID: <span className="font-mono bg-green-100 px-1 rounded">{store.stripeAccountId}</span></div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <button className="px-4 py-2 bg-white border border-green-200 text-green-800 font-bold rounded-lg hover:bg-green-100 transition-colors shadow-sm">
                                    Manage in Stripe
                                </button>
                                <button onClick={handleDisconnectStripe} className="text-xs text-red-500 hover:underline text-right">
                                    Disconnect
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Not Connected State */
                        <div className="flex flex-col gap-6 mb-6">
                            <div className="flex flex-col md:flex-row items-center gap-6 p-6 bg-gray-50 border border-gray-200 rounded-xl">
                                <div className="w-16 h-16 bg-[#635BFF] rounded-xl flex items-center justify-center text-white text-3xl shadow-lg shrink-0">
                                    S
                                </div>
                                <div className="flex-1 text-center md:text-left">
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">Connect with Stripe</h3>
                                    <p className="text-gray-600 mb-4">
                                        To start selling on Spendigo, you must connect a Stripe account. This allows us to securely transfer earnings to your bank account automatically.
                                    </p>
                                    <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                                        <span className="text-xs bg-white border px-2 py-1 rounded text-gray-500">🔒 Secure processing</span>
                                        <span className="text-xs bg-white border px-2 py-1 rounded text-gray-500">⚡️ Daily payouts</span>
                                        <span className="text-xs bg-white border px-2 py-1 rounded text-gray-500">🌍 Major cards accepted</span>
                                    </div>
                                </div>
                                <button
                                    onClick={handleConnectStripe}
                                    disabled={isSaving}
                                    className="px-6 py-3 bg-[#635BFF] text-white font-bold rounded-lg hover:brightness-110 shadow-lg shadow-[#635BFF]/30 transition-all whitespace-nowrap"
                                >
                                    {isSaving ? 'Connecting...' : 'Connect Stripe Account'}
                                </button>
                            </div>

                            <div className="bg-white p-6 rounded-xl border border-[var(--glass-border)]">
                                <h4 className="font-bold text-gray-800 mb-2">Information Required to Connect</h4>
                                <p className="text-sm text-gray-600 mb-6">Please have the following information ready before starting the Stripe onboarding process:</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="flex gap-4">
                                        <div className="text-2xl pt-1">🏢</div>
                                        <div>
                                            <div className="font-bold text-sm text-gray-800 mb-2">Business Details</div>
                                            <ul className="text-xs text-gray-600 space-y-2 list-disc list-inside">
                                                <li>Business type & structure</li>
                                                <li>Business address</li>
                                                <li>Tax ID / Registration number</li>
                                            </ul>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="text-2xl pt-1">👤</div>
                                        <div>
                                            <div className="font-bold text-sm text-gray-800 mb-2">Representative Info</div>
                                            <ul className="text-xs text-gray-600 space-y-2 list-disc list-inside">
                                                <li>Full legal name & DOB</li>
                                                <li>Home address</li>
                                                <li>SSN / SIN details</li>
                                            </ul>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="text-2xl pt-1">🏦</div>
                                        <div>
                                            <div className="font-bold text-sm text-gray-800 mb-2">Bank Account</div>
                                            <ul className="text-xs text-gray-600 space-y-2 list-disc list-inside">
                                                <li>Institution / Transit number</li>
                                                <li>Checking account number</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${!isConnected ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Payout Schedule</label>
                            <select
                                value={payments.payoutSchedule}
                                onChange={e => setPayments({ ...payments, payoutSchedule: e.target.value })}
                                className="w-full p-3 border border-[var(--glass-border)] rounded-lg bg-[var(--surface-1)]"
                                disabled={!isConnected}
                            >
                                <option value="daily">Daily (Rolling 2 Day Window)</option>
                                <option value="weekly">Weekly (Every Monday)</option>
                                <option value="manual">Manual Payouts</option>
                            </select>
                            <p className="text-xs text-[var(--text-muted)] mt-2">
                                Funds are typically available 2 business days after transaction.
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Statement Descriptor</label>
                            <input
                                type="text"
                                value={payments.statementDescriptor}
                                onChange={e => setPayments({ ...payments, statementDescriptor: e.target.value.substring(0, 22) })}
                                maxLength={22}
                                disabled={!isConnected}
                                placeholder={storeInfo.name.substring(0, 22)}
                                className="w-full p-3 border border-[var(--glass-border)] rounded-lg bg-[var(--surface-1)] disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                            />
                            <p className="text-xs text-[var(--text-muted)] mt-1 flex justify-between">
                                <span>This is what customers will see on their bank statements.</span>
                                <span className={payments.statementDescriptor.length >= 20 ? 'text-orange-500' : ''}>{payments.statementDescriptor.length}/22</span>
                            </p>
                        </div>
                    </div>
                    {isConnected && (
                        <div className="flex justify-end mt-4">
                            <button
                                onClick={handleSavePayoutConfig}
                                disabled={isSavingPayout || payments.statementDescriptor.length < 5}
                                className="px-5 py-2 bg-[var(--brand-primary)] text-white rounded-lg font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSavingPayout ? 'Saving...' : 'Save Payout Settings'}
                            </button>
                        </div>
                    )}
                </section>
            </div>
        );
    };

    const renderNotifications = () => (
        <div className="space-y-6 animate-fade-in">
            <section className="bg-white p-6 rounded-xl border border-[var(--glass-border)] shadow-sm">
                <h2 className="text-lg font-bold text-[var(--text-main)] mb-4">Notification Preferences</h2>
                <div className="space-y-4">
                    {[
                        { key: 'emailOrderAlerts', title: 'Email Order Alerts', desc: 'Receive an email immediately when a new order is placed.' },

                        { key: 'dailyReports', title: 'Daily Business Reports', desc: 'Receive a daily summary of sales and orders each morning.' },
                        { key: 'marketingEmails', title: 'Marketing Communications', desc: 'Receive tips, trends, and promotional offers from Spendigo.' },
                    ].map((item) => (
                        <div key={item.key} className="flex items-start gap-3 pb-4 border-b border-[var(--glass-border)] last:border-0 last:pb-0">
                            <input
                                type="checkbox"
                                checked={(notifications as any)[item.key]}
                                onChange={e => setNotifications({ ...notifications, [item.key]: e.target.checked })}
                                className="w-5 h-5 mt-1 accent-[var(--brand-primary)]"
                            />
                            <div>
                                <div className="font-medium text-[var(--text-main)]">{item.title}</div>
                                <div className="text-sm text-[var(--text-muted)]">{item.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="p-6 rounded-xl border border-red-200 bg-red-50">
                <h2 className="text-lg font-bold text-red-700 mb-2">Danger Zone</h2>
                <p className="text-sm text-red-600 mb-4">These actions can affect your store's visibility.</p>
                <div className="flex gap-4">
                    <button
                        onClick={async () => {
                            const confirmed = await confirm({
                                title: 'Pause Store Operations?',
                                message: 'This will pause your store operations.\n\nYour store will be hidden from customers and new orders will be disabled.\n\nYou can resume operations at any time.',
                                confirmText: 'Pause Store',
                                type: 'warning'
                            });

                            if (confirmed) {
                                await updateStore(storeId, { status: 'suspended' });
                                auditBridge.emit('STORE_PAUSED', { storeId }, `stores/${storeId}`);
                                addNotification({
                                    type: 'system',
                                    title: 'Store Paused',
                                    message: 'Your store is now hidden from the marketplace. Contact support to resume.'
                                });
                            }
                        }}
                        disabled={isLocked}
                        className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-100 font-medium transition-colors disabled:opacity-50"
                    >
                        Pause Store Operations
                    </button>
                    <button
                        onClick={() => setShowCloseStoreModal(true)}
                        disabled={stores[storeId]?.status === 'pending_deletion'}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors shadow-sm disabled:opacity-50"
                    >
                        {stores[storeId]?.status === 'pending_deletion' ? 'Deletion Pending...' : 'Close Store Permanently'}
                    </button>
                </div>
            </section>
        </div>
    );

    const handleKybUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;

        if (!auth.currentUser) {
            addNotification({ type: 'alert', title: 'Session Expired', message: 'Please sign out and sign back in, then try again.' });
            return;
        }
        try {
            await auth.currentUser.getIdToken(true);
        } catch {
            addNotification({ type: 'alert', title: 'Session Error', message: 'Could not refresh your session. Please sign in again.' });
            return;
        }

        const file = e.target.files[0];

        if (file.size > 5 * 1024 * 1024) {
            addNotification({ type: 'alert', title: 'File Too Large', message: 'Document must be under 5 MB.' });
            return;
        }
        const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowed.includes(file.type)) {
            addNotification({ type: 'alert', title: 'Invalid File', message: 'Please upload a PDF, JPEG, or PNG.' });
            return;
        }

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `stores/${storeId}/documents/${kybDocType}_${Date.now()}_${safeName}`;

        try {
            setKybUploading(true);
            // Use uploadBytes directly — getDownloadURL is intentionally omitted.
            // The Storage read rule restricts KYB documents to admins only; calling
            // getDownloadURL here would throw storage/unauthorized for merchant users.
            await uploadBytes(storageRef(storage, path), file);
        } catch (err: any) {
            const msg = err?.code === 'storage/unauthorized'
                ? 'Permission denied. Only the store owner can upload KYB documents.'
                : err?.message || 'Could not upload file.';
            addNotification({ type: 'alert', title: 'Upload Failed', message: msg });
            return;
        } finally {
            setKybUploading(false);
        }

        const newDoc: KybDocument = {
            type: kybDocType,
            storagePath: path,
            filename: file.name,
            uploadedAt: new Date().toISOString()
        };

        await updateStore(storeId, {
            kybDocuments: arrayUnion(newDoc),
            kybStatus: 'pending_review'
        });

        setKybDocuments(prev => [...prev, newDoc]);
        setKybStatus('pending_review');
        auditBridge.emit('KYB_DOCUMENT_UPLOADED', { storeId, docType: kybDocType }, `stores/${storeId}`);
        addNotification({ type: 'system', title: 'Document Submitted', message: 'Your document has been submitted for review.' });

        if (kybFileInputRef.current) kybFileInputRef.current.value = '';
    };

    const KYB_STATUS_CONFIG: Record<KybStatus, { label: string; color: string }> = {
        not_submitted: { label: 'Not Submitted', color: 'bg-gray-100 text-gray-600 border-gray-200' },
        pending_review: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
        approved: { label: 'Verified', color: 'bg-green-100 text-green-700 border-green-200' },
        rejected: { label: 'Action Required', color: 'bg-red-100 text-red-700 border-red-200' }
    };

    const DOC_TYPE_LABELS: Record<KybDocument['type'], string> = {
        business_license: 'Business License',
        incorporation_certificate: 'Certificate of Incorporation',
        other: 'Other Document'
    };

    const renderVerification = () => (
        <div className="space-y-6 animate-fade-in">
            <section className="bg-white p-6 rounded-xl border border-[var(--glass-border)] shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                            Business Verification (KYB)
                            {kybStatus === 'approved' && (
                                <span className="inline-flex items-center justify-center w-5 h-5 bg-green-500 text-white rounded-full text-[11px] font-black leading-none">✓</span>
                            )}
                        </h2>
                        <p className="text-sm text-[var(--text-muted)] mt-1">Upload your business license or incorporation certificate so Spendigo can verify your store.</p>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${KYB_STATUS_CONFIG[kybStatus].color}`}>
                        {KYB_STATUS_CONFIG[kybStatus].label}
                    </span>
                </div>

                {kybStatus === 'rejected' && kybReviewNote && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                        <p className="font-semibold mb-1">Review Note from Spendigo:</p>
                        <p>{kybReviewNote}</p>
                    </div>
                )}

                {kybStatus === 'approved' ? (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium">
                        Your business has been verified. No further action is needed.
                    </div>
                ) : user?.merchantRole === 'OWNER' ? (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-main)] mb-1">Document Type</label>
                            <select
                                value={kybDocType}
                                onChange={e => setKybDocType(e.target.value as KybDocument['type'])}
                                className="w-full border border-[var(--glass-border)] rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30"
                            >
                                <option value="business_license">Business License</option>
                                <option value="incorporation_certificate">Certificate of Incorporation</option>
                                <option value="other">Other Document</option>
                            </select>
                        </div>

                        <button
                            onClick={() => kybFileInputRef.current?.click()}
                            disabled={kybUploading}
                            className="w-full border-2 border-dashed border-[var(--glass-border)] rounded-xl p-6 text-center hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="text-3xl mb-2">📎</div>
                            <p className="font-semibold text-[var(--text-main)]">{kybUploading ? 'Uploading...' : 'Upload Document'}</p>
                            <p className="text-xs text-[var(--text-muted)] mt-1">PDF, JPEG, or PNG — max 5 MB</p>
                        </button>

                        <input
                            ref={kybFileInputRef}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                            className="hidden"
                            onChange={handleKybUpload}
                        />
                    </div>
                ) : (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-[var(--text-muted)]">
                        KYB document submission is restricted to the store owner. Please ask your store owner to upload the required documents.
                    </div>
                )}
            </section>

            {kybDocuments.length > 0 && (
                <section className="bg-white p-6 rounded-xl border border-[var(--glass-border)] shadow-sm">
                    <h3 className="text-sm font-bold text-[var(--text-main)] mb-4">Submitted Documents</h3>
                    <div className="space-y-3">
                        {kybDocuments.map((doc, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-[var(--surface-2)] rounded-xl border border-[var(--glass-border)]">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-[var(--text-main)] truncate">{doc.filename}</p>
                                    <p className="text-xs text-[var(--text-muted)]">{DOC_TYPE_LABELS[doc.type]} · {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );

    return (
        <div className="p-6 animate-fade-in max-w-5xl mx-auto pb-24">
            {stores[storeId]?.status === 'pending_deletion' && (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6 animate-pulse-subtle shadow-lg mb-8">
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-3xl shrink-0">
                        🗑️
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h2 className="text-xl font-bold text-orange-900 mb-1">Store Deletion Pending</h2>
                        <p className="text-sm text-orange-700 font-medium">
                            Status: <span className="font-bold underline">Approved for Deletion</span>
                        </p>
                        <p className="text-xs text-orange-600 mt-2 leading-relaxed">
                            Your store is currently <strong>unavailable</strong> to shoppers and will be permanently deleted in 30 days. 
                            All products, deals, and account data will be wiped at the end of the grace period.
                        </p>
                        <p className="text-xs text-orange-500 mt-2 italic">
                            Changed your mind? To cancel this deletion request, please contact Spendigo Support immediately.
                        </p>
                    </div>
                    <button 
                        onClick={() => window.location.href = 'mailto:support@spendigo.ca?subject=Cancel Store Deletion: ' + encodeURIComponent(storeInfo.name)}
                        className="px-6 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all shadow-md active:scale-95 whitespace-nowrap"
                    >
                        Cancel Deletion Request
                    </button>
                </div>
            )}
            {/* Combined Sticky Header */}
            <div className="sticky top-[64px] md:top-0 z-30 -mx-6 px-6 pt-6 pb-2 bg-[var(--surface-1)]/95 backdrop-blur-xl border-b border-[var(--glass-border)] mb-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="page-headline">Store Settings</h1>
                        <p className="text-xs text-[var(--text-muted)] hidden md:block">Configure your marketplace presence and logistics.</p>
                    </div>
                    <div className="flex gap-2 md:gap-3">
                        <button onClick={() => window.location.reload()} className="px-3 py-1.5 md:px-4 md:py-2 text-[var(--text-muted)] hover:text-[var(--text-main)] font-medium text-xs md:text-sm">
                            Discard
                        </button>
                        {hasSettingsAccess ? (
                            <button
                                onClick={handleSave}
                                disabled={isSaving || isApplyingPreset || isLocatingStatus === 'loading'}
                                className="px-4 py-1.5 md:px-6 md:py-2 bg-[var(--brand-primary)] text-white font-bold rounded-xl shadow-lg shadow-[var(--brand-primary)]/20 hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm"
                            >
                                {isSaving || isApplyingPreset ? 'Saving...' : '💾 Save All'}
                            </button>
                        ) : (
                            <div className="text-[10px] md:text-sm font-medium text-orange-600 bg-orange-50 px-3 py-1.5 md:px-4 md:py-2 rounded-lg border border-orange-100 flex items-center gap-2">
                                <span>🛡️</span> View Only
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-[var(--surface-2)] p-1 rounded-2xl shadow-inner flex overflow-x-auto no-scrollbar scroll-smooth">
                    {TABS.filter(t => t.visible).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => scrollToSection(tab.id as any)}
                            className={`flex-1 min-w-[70px] md:min-w-[120px] px-1 py-2 md:py-3 rounded-xl text-[9px] md:text-sm font-black whitespace-nowrap transition-all flex flex-col items-center gap-1 ${activeTab === tab.id
                                ? 'bg-white shadow-md text-[var(--brand-primary)] scale-100'
                                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                                }`}
                        >
                            <span className="text-sm md:text-lg">{tab.icon}</span>
                            <span className="hidden md:inline">{tab.label}</span>
                            <span className="md:hidden">{tab.id.charAt(0).toUpperCase() + tab.id.slice(1)}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-16">
                <div id="section-profile" className="scroll-mt-48">
                    <h3 className="text-xl font-black text-[var(--brand-primary)] mb-6 flex items-center gap-3 bg-[var(--surface-2)] p-4 rounded-2xl border border-[var(--glass-border)]">
                        <span className="text-2xl">🏪</span>
                        Store Profile & Branding
                    </h3>
                    {renderProfile()}
                </div>

                <div id="section-operations" className="scroll-mt-48">
                    <h3 className="text-xl font-black text-[var(--brand-primary)] mb-6 flex items-center gap-3 bg-[var(--surface-2)] p-4 rounded-2xl border border-[var(--glass-border)]">
                        <span className="text-2xl">⚙️</span>
                        Store Operations & Logistics
                    </h3>
                    {renderOperations()}
                </div>

                <div id="section-team" className="scroll-mt-48">
                    <h2 className="text-xl font-black text-[var(--brand-primary)] mb-6 flex items-center gap-3 bg-[var(--surface-2)] p-4 rounded-2xl border border-[var(--glass-border)]">
                        <span className="text-2xl">👥</span>
                        Team & User Management
                    </h2>
                    {renderTeam()}
                </div>

                <div id="section-payments" className="scroll-mt-48">
                    <h2 className="text-xl font-black text-[var(--brand-primary)] mb-6 flex items-center gap-3 bg-[var(--surface-2)] p-4 rounded-2xl border border-[var(--glass-border)]">
                        <span className="text-2xl">💳</span>
                        Payments & Payouts
                    </h2>
                    {renderPayments()}
                </div>

                <div id="section-notifications" className="scroll-mt-48">
                    <h2 className="text-xl font-black text-[var(--brand-primary)] mb-6 flex items-center gap-3 bg-[var(--surface-2)] p-4 rounded-2xl border border-[var(--glass-border)]">
                        <span className="text-2xl">🔔</span>
                        Notification Preferences
                    </h2>
                    {renderNotifications()}
                </div>

                <div id="section-verification" className="scroll-mt-48">
                    <h2 className="text-xl font-black text-[var(--brand-primary)] mb-6 flex items-center gap-3 bg-[var(--surface-2)] p-4 rounded-2xl border border-[var(--glass-border)]">
                        <span className="text-2xl">🪪</span>
                        Business Verification
                    </h2>
                    {renderVerification()}
                </div>
            </div>

            {/* Close Store Modal */}
            {showCloseStoreModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl relative border border-red-200">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                                🚨
                            </div>
                            <h2 className="text-2xl font-bold text-red-900 mb-1">Delete {storeInfo.name}</h2>
                            <p className="text-sm text-red-800">Permanent Action - Cannot be undone</p>
                        </div>

                        <div className="space-y-4 mb-6">
                            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                                You are about to permanently close this store. All products, deals, and current orders will be <strong>permanently deleted</strong>.
                            </p>
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2">
                                    Type <span className="text-black select-all">"{storeInfo.name}"</span> to confirm:
                                </label>
                                <input
                                    type="text"
                                    value={closeStoreInput}
                                    onChange={(e) => setCloseStoreInput(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                                    placeholder={storeInfo.name}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowCloseStoreModal(false); setCloseStoreInput(''); }}
                                className="flex-1 py-3 font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={closeStoreInput !== storeInfo.name}
                                onClick={async () => {
                                    try {
                                        await requestDeleteStore(storeId, user?.id || 'unknown', 'merchant');
                                        addNotification({
                                            type: 'system',
                                            title: 'Deletion Requested',
                                            message: 'Your request to delete the store has been submitted for admin approval.'
                                        });
                                        setShowCloseStoreModal(false);
                                    } catch (error) {
                                        addNotification({
                                            type: 'alert',
                                            title: 'Error',
                                            message: 'Failed to submit deletion request.'
                                        });
                                    }
                                }}
                                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Close Permanently
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MerchantSettings;
