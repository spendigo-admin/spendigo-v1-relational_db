import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import '../../styles/design-system.css';
import { useAuth } from '../../context/AuthContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useNotifications } from '../../context/NotificationContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { useFileUpload } from '../../hooks/useFileUpload';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../lib/firebase';

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


const BUSINESS_TYPES: Record<string, { logo: string; cover: string; tagline: string }> = {
    'Grocery': {
        logo: '/defaults/branding/grocery_logo.jpg?v=4',
        cover: '/defaults/branding/grocery_cover.jpg?v=4',
        tagline: 'Fresh groceries and daily essentials.'
    },
    'Desi Grocery': {
        logo: '/defaults/branding/desi_logo.jpg?v=4',
        cover: '/defaults/branding/desi_cover.jpg?v=4',
        tagline: 'Authentic flavors, spices and traditional ingredients.'
    },
    'Asian Market': {
        logo: '/defaults/branding/asian_logo.jpg?v=4',
        cover: '/defaults/branding/asian_cover.jpg?v=4',
        tagline: 'Your destination for premium Asian products.'
    },
    'Organic Market': {
        logo: '/defaults/branding/grocery_logo.jpg?v=4', // Re-use grocery for reliability
        cover: '/defaults/branding/grocery_cover.jpg?v=4',
        tagline: 'Healthy, organic, and locally sourced goodness.'
    },
    'Convenience': {
        logo: '/defaults/branding/convenience_logo.jpg?v=4',
        cover: '/defaults/branding/convenience_cover.jpg?v=4',
        tagline: 'Quick stops for all your immediate needs.'
    },
    'Bakery': {
        logo: '/defaults/branding/bakery_logo.jpg?v=4',
        cover: '/defaults/branding/bakery_cover.jpg?v=4',
        tagline: 'Freshly baked breads and sweet treats daily.'
    },
    'Cafe': {
        logo: '/defaults/branding/cafe_logo.jpg?v=4',
        cover: '/defaults/branding/cafe_cover.jpg?v=4',
        tagline: 'Premium coffee and cozy vibes.'
    },
    'Butcher': {
        logo: '/defaults/branding/butcher_logo.jpg?v=4',
        cover: '/defaults/branding/butcher_cover.jpg?v=4',
        tagline: 'Quality cuts and fresh meats.'
    },
    'Florist': {
        logo: '/defaults/branding/florist_logo.jpg?v=4',
        cover: '/defaults/branding/florist_cover.jpg?v=4',
        tagline: 'Beautiful blooms for every occasion.'
    },
    'Pet Store': {
        logo: '/defaults/branding/pet_logo.jpg?v=4',
        cover: '/defaults/branding/pet_cover.jpg?v=4',
        tagline: 'Everything your furry friends need.'
    },
    'Pharmacy': {
        logo: '/defaults/branding/pharmacy_logo.jpg?v=4',
        cover: '/defaults/branding/pharmacy_cover.jpg?v=4',
        tagline: 'Health, wellness, and prescriptions.'
    },
    'Other': {
        logo: '/defaults/branding/other_logo.jpg?v=4',
        cover: '/defaults/branding/other_cover.jpg?v=4',
        tagline: 'Quality service for our community.'
    }
};

const MerchantSettings: React.FC = () => {
    const { can, user } = useAuth();
    const { stores, updateStore, updateStoreTeam, requestDeleteStore } = useMarketplace();
    const { addNotification } = useNotifications();
    const { confirm } = useConfirmation();
    const { uploadFile, deleteFile, uploading } = useFileUpload(); // New Hook
    const hasTeamAccess = can('team:manage');
    const hasSettingsAccess = can('settings:write');
    const storeId = user?.storeId || '1'; // Fallback to 1 if missing

    // Hidden File Input Ref
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [uploadTarget, setUploadTarget] = useState<'logo' | 'cover' | null>(null);

    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'profile' | 'operations' | 'team' | 'payments' | 'notifications'>((searchParams.get('tab') as any) || 'profile');
    const [isSaving, setIsSaving] = useState(false);
    const [showCloseStoreModal, setShowCloseStoreModal] = useState(false);
    const [closeStoreInput, setCloseStoreInput] = useState('');
    const [isApplyingPreset, setIsApplyingPreset] = useState(false);

    const TABS = [
        { id: 'profile', label: '🏪 Store Profile', visible: true },
        { id: 'operations', label: '⚙️ Operations', visible: hasSettingsAccess },
        { id: 'team', label: '👥 Team & Roles', visible: hasTeamAccess },
        { id: 'payments', label: '💳 Payments', visible: hasSettingsAccess },
        { id: 'notifications', label: '🔔 Notifications', visible: true }
    ];

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['profile', 'operations', 'team', 'payments', 'notifications'].includes(tab)) {
            setActiveTab(tab as any);
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
        businessType: 'Grocery', // Default
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
        bankLast4: '4242'
    });

    // Notifications State
    const [notifications, setNotifications] = useState({
        emailOrderAlerts: true,
        smsOrderAlerts: true,
        marketingEmails: false,
        dailyReports: true
    });

    const [isLocatingStatus, setIsLocatingStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    // Team State - derived from MarketplaceContext
    const team = (stores[storeId]?.team as TeamMember[]) || [];
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteSuccess, setInviteSuccess] = useState<{ name: string, email: string, password: string } | null>(null);
    const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'STAFF' as MerchantRole });

    // Initialize team if empty (Real behavior: Add current user as Owner)
    useEffect(() => {
        const store = stores[storeId];
        if (store && user) {
            // 1. Cleanup Mock Data (Migration)
            // If we find the specific mock IDs from previous versions, remove them.
            if (store.team && store.team.some((m: TeamMember) => ['t1', 't2', 't3'].includes(m.id))) {
                const cleanTeam = store.team.filter((m: TeamMember) => !['t1', 't2', 't3'].includes(m.id));
                // Ensure we don't leave it completely empty (if only mocks existed)
                if (cleanTeam.length === 0) {
                    const initialOwner: TeamMember = {
                        id: user.id,
                        name: user.name || 'Store Owner',
                        email: user.email,
                        role: 'OWNER',
                        lastActive: 'Now'
                    };
                    updateStoreTeam(storeId, [initialOwner]);
                } else {
                    updateStoreTeam(storeId, cleanTeam);
                }
                return; // Stop here, next render will handle init if needed
            }

            // 2. Init if empty
            if (!store.team || store.team.length === 0) {
                const initialOwner: TeamMember = {
                    id: user.id,
                    name: user.name || 'Store Owner',
                    email: user.email,
                    role: 'OWNER',
                    lastActive: 'Now'
                };
                updateStoreTeam(storeId, [initialOwner]);
            }
        }
    }, [storeId, stores, user]);

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
                businessType: store.businessType || 'Grocery',
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

    const handleSave = async () => {
        setIsSaving(true);

        let displayFee = `$${operations.deliveryFee.toFixed(2)}`;
        if (operations.freeDeliveryThreshold > 0) {
            displayFee = `Free over $${operations.freeDeliveryThreshold}`;
        }

        const updates = {
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
            coordinates: storeInfo.coordinates, // Save real coordinates!
            businessType: storeInfo.businessType,
            logoUrl: storeInfo.logoUrl,
            image: storeInfo.coverUrl, // Map local coverUrl to DB 'image' field
            // Operations
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
            // Force sync subscription tier from user profile to store
            // This fixes issues where the store doc might be out of sync with user doc
            subscriptionTier: user?.subscriptionTier || 'free',
            // Legacy/Display Fields
            deliveryFee: displayFee
        };

        // Simulate processing for UX
        await new Promise(resolve => setTimeout(resolve, 1500));

        await updateStore(storeId, updates);
        setIsSaving(false);
        addNotification({ type: 'system', title: 'Settings Saved', message: 'Store configuration updated successfully.' });
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

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
                // Add to local team member list
                const newMember: TeamMember = {
                    id: result.data.uid,
                    name: inviteForm.name,
                    email: inviteForm.email,
                    role: inviteForm.role,
                    lastActive: '🟡 Pending Invite'
                };
                const updatedTeam = [...team, newMember];
                await updateStoreTeam(storeId, updatedTeam);

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
            const updatedTeam = team.filter((t: TeamMember) => t.id !== id);
            updateStoreTeam(storeId, updatedTeam); // Persist to context
            addNotification({ type: 'system', title: 'Member Removed', message: 'Team access updated.' });
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

    const renderTabs = () => (
        <div className="flex gap-2 overflow-x-auto pb-2 border-b border-[var(--glass-border)] mb-6 scrollbar-hide">
            {TABS.filter(t => t.visible).map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${activeTab === tab.id
                        ? 'bg-[var(--brand-primary)] text-white shadow-md'
                        : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
                        }`}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );

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
                        {team.map(member => (
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

                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowInviteModal(false)} className="px-4 py-2 font-bold text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-[var(--brand-primary)] text-white font-bold rounded-lg hover:brightness-110">Send Invite</button>
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
                            disabled={isApplyingPreset || isSaving}
                            onChange={async (e) => {
                                const newType = e.target.value;
                                const defaultAssets = BUSINESS_TYPES[newType];
                                if (!defaultAssets) {
                                    setStoreInfo(prev => ({ ...prev, businessType: newType }));
                                    return;
                                }

                                setIsApplyingPreset(true);
                                let newLogoUrl = defaultAssets.logo;
                                let newCoverUrl = defaultAssets.cover;

                                try {
                                    // Helper to fetch and upload an asset
                                    const mirrorAsset = async (url: string, type: 'logo' | 'cover'): Promise<string> => {
                                        try {
                                            // Determine fetch options based on URL type
                                            const isLocal = url.startsWith('/');
                                            const options = isLocal ? {} : { method: 'GET', mode: 'cors' as RequestMode, credentials: 'omit' as RequestCredentials };

                                            const response = await fetch(url, options);
                                            if (!response.ok) throw new Error(`Network response was not ok: ${response.status}`);

                                            const blob = await response.blob();
                                            // Generate a unique name for the new file
                                            const fileName = `${type}_preset_${newType.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}.jpg`;
                                            const path = `stores/${storeId}/${fileName}`;

                                            const uploadedUrl = await uploadFile(new File([blob], fileName, { type: 'image/jpeg' }), path);
                                            return uploadedUrl || url;
                                        } catch (err) {
                                            console.warn(`Failed to mirror ${type}, falling back to source link`, err);
                                            // Don't show alert for local files, just fallback silently if it fails (it will still work as a path)
                                            return url;
                                        }
                                    };

                                    addNotification({ type: 'system', title: 'Updating Branding', message: `Applying ${newType} theme...` });

                                    // 1. Mirror Logo
                                    newLogoUrl = await mirrorAsset(defaultAssets.logo, 'logo');
                                    // 2. Mirror Cover
                                    newCoverUrl = await mirrorAsset(defaultAssets.cover, 'cover');

                                    // 3. Clean up old assets to save space
                                    // The deleteFile hook automatically checks if it's a firebase URL before deleting
                                    if (storeInfo.logoUrl) await deleteFile(storeInfo.logoUrl);
                                    if (storeInfo.coverUrl) await deleteFile(storeInfo.coverUrl);

                                } catch (err) {
                                    console.error('Preset application failed', err);
                                    addNotification({ type: 'alert', title: 'Warning', message: 'Could not save images to storage. Using external links.' });
                                } finally {
                                    setStoreInfo(prev => ({
                                        ...prev,
                                        businessType: newType,
                                        logoUrl: newLogoUrl,
                                        coverUrl: newCoverUrl,
                                        tagline: defaultAssets.tagline || prev.tagline
                                    }));
                                    setIsApplyingPreset(false);
                                }
                            }}
                            className="w-full p-3 border border-blue-200 rounded-lg bg-white font-medium focus:ring-2 ring-blue-500 outline-none disabled:opacity-50"
                        >
                            {Object.keys(BUSINESS_TYPES).map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                        <p className="text-xs text-blue-700 mt-2">
                            {isApplyingPreset ? '⏳ Uploading assets to your storage...' : '✨ Selecting a type will automatically suggest match.'}
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
                            <option value="NL">NL - Newfoundland (15%)</option>
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

    const renderPayments = () => (
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

                {/* Mock Connected State */}
                <div className="flex items-center gap-4 p-5 bg-green-50 border border-green-200 rounded-lg mb-6">
                    <div className="w-12 h-12 rounded-full bg-green-200 flex items-center justify-center text-green-700 font-bold text-xl">✓</div>
                    <div className="flex-1">
                        <div className="font-bold text-green-900 text-lg">Stripe Connect Active</div>
                        <div className="text-green-800">Your account is ready to receive payouts.</div>
                        <div className="text-sm text-green-700 mt-1">Connected: TD Canada Trust •••• {payments.bankLast4}</div>
                    </div>
                    <button className="px-4 py-2 bg-white border border-green-200 text-green-800 font-bold rounded-lg hover:bg-green-100 transition-colors shadow-sm">
                        Manage in Stripe
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Payout Schedule</label>
                        <select
                            value={payments.payoutSchedule}
                            onChange={e => setPayments({ ...payments, payoutSchedule: e.target.value })}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg bg-[var(--surface-1)]"
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
                            value={storeInfo.name.substring(0, 20)}
                            readOnly
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                        <p className="text-xs text-[var(--text-muted)] mt-2">
                            This is what customers will see on their bank statements.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );

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
                                addNotification({
                                    type: 'system',
                                    title: 'Store Paused',
                                    message: 'Your store is now hidden from the marketplace. Contact support to resume.'
                                });
                            }
                        }}
                        className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-100 font-medium transition-colors"
                    >
                        Pause Store Operations
                    </button>
                    <button
                        onClick={() => setShowCloseStoreModal(true)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors shadow-sm"
                    >
                        Close Store Permanently
                    </button>
                </div>
            </section>
        </div>
    );

    return (
        <div className="p-6 animate-fade-in max-w-5xl mx-auto pb-24">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-[var(--text-main)]">Store Settings</h1>
                <div className="flex gap-3">
                    <button onClick={() => window.location.reload()} className="px-4 py-2 text-[var(--text-muted)] hover:text-[var(--text-main)] font-medium">
                        Discard Changes
                    </button>
                    {hasSettingsAccess ? (
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-6 py-2 bg-[var(--brand-primary)] text-white font-bold rounded-lg shadow-lg shadow-[var(--brand-primary)]/20 hover:brightness-110 transition-all flex items-center gap-2"
                        >
                            {isSaving ? 'Saving...' : '💾 Save All Changes'}
                        </button>
                    ) : (
                        <div className="text-sm font-medium text-orange-600 bg-orange-50 px-4 py-2 rounded-lg border border-orange-100 flex items-center gap-2">
                            <span>🛡️</span> View Only Mode
                        </div>
                    )}
                </div>
            </div>

            {renderTabs()}

            {activeTab === 'profile' && renderProfile()}
            {activeTab === 'operations' && renderOperations()}
            {activeTab === 'team' && renderTeam()}
            {activeTab === 'payments' && renderPayments()}
            {activeTab === 'notifications' && renderNotifications()}

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
