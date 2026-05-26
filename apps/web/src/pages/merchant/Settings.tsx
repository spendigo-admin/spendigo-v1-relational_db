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
import { collection, query, where, onSnapshot, arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { auditBridge } from '../../utils/auditBridge';
import { BUSINESS_TYPES } from '../../data/businessTypes';

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
        desc: 'Can manage products, orders, and operations settings. Read-only access to payouts & subscriptions.',
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

    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'profile' | 'operations' | 'team' | 'payments' | 'notifications' | 'verification'>((searchParams.get('tab') as any) || 'profile');
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [showCloseStoreModal, setShowCloseStoreModal] = useState(false);
    const [closeStoreInput, setCloseStoreInput] = useState('');
    const [isApplyingPreset, setIsApplyingPreset] = useState(false);

    const TABS = [
        { id: 'profile', label: 'Store Profile', icon: '🏪', visible: true },
        { id: 'operations', label: 'Operations', icon: '⚙️', visible: hasSettingsAccess || user?.merchantRole === 'STAFF' },
        { id: 'team', label: 'Team Roles', icon: '👥', visible: hasTeamAccess },
        { id: 'payments', label: 'Payments', icon: '💳', visible: hasSettingsAccess },
        { id: 'notifications', label: 'Alerts', icon: '🔔', visible: true },
        { id: 'verification', label: 'Verification', icon: '🪪', visible: user?.merchantRole === 'OWNER' }
    ];

    const handleTabChange = (tabId: string) => {
        const targetTab = TABS.find(t => t.id === tabId);
        if (!targetTab || !targetTab.visible) return;
        setActiveTab(tabId as any);
        setSearchParams({ tab: tabId });
    };

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['profile', 'operations', 'team', 'payments', 'notifications', 'verification'].includes(tab)) {
            const targetTab = TABS.find(t => t.id === tab);
            if (targetTab && targetTab.visible) {
                setActiveTab(tab as any);
            } else if (user) {
                setActiveTab('profile');
                setSearchParams({ tab: 'profile' });
                addNotification({
                    type: 'alert',
                    title: 'Access Restricted',
                    message: 'You do not have permissions to access the requested settings panel.'
                });
            }
        }
    }, [searchParams, user, hasSettingsAccess, hasTeamAccess]);

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
    const [inviteStep, setInviteStep] = useState(1);
    const [inviteSuccess, setInviteSuccess] = useState<{ name: string, email: string, password: string } | null>(null);
    const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'STAFF' as MerchantRole });
    const [inviteError, setInviteError] = useState('');

    // Change Role State
    const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
    const [newRole, setNewRole] = useState<MerchantRole>('STAFF');
    const [isUpdatingRole, setIsUpdatingRole] = useState(false);
    const [updateRoleError, setUpdateRoleError] = useState('');

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
                notificationPreferences: {
                    ...(currentStore?.notificationPreferences || {}),
                    ...notifications
                },
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

    const handleChangeRole = async () => {
        if (!selectedMember) return;
        setIsUpdatingRole(true);
        setUpdateRoleError('');

        try {
            const userDocRef = doc(db, 'users', selectedMember.id);
            await updateDoc(userDocRef, {
                merchantRole: newRole
            });

            // Emit audit event log
            auditBridge.emit(
                'STORE_TEAM_ROLE_CHANGE',
                {
                    storeId,
                    targetUserId: selectedMember.id,
                    targetUserEmail: selectedMember.email,
                    oldRole: selectedMember.role,
                    newRole
                },
                `users/${selectedMember.id}`
            );

            addNotification({
                type: 'system',
                title: 'Role Updated',
                message: `Successfully changed role of ${selectedMember.name} to ${ROLE_INFO[newRole].label}.`
            });
            setSelectedMember(null);
        } catch (error: any) {
            console.error('Error changing member role:', error);
            const errMsg = error.message || 'Could not change member role';
            setUpdateRoleError(errMsg);
            addNotification({
                type: 'alert',
                title: 'Update Failed',
                message: errMsg
            });
        } finally {
            setIsUpdatingRole(false);
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
        if (user?.merchantRole === 'STAFF') return;
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
                    onClick={() => {
                        setInviteStep(1);
                        setShowInviteModal(true);
                    }}
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
                                    <div className="flex items-center justify-end gap-2">
                                        {user?.merchantRole === 'OWNER' && member.role !== 'OWNER' && (
                                            <button
                                                onClick={() => {
                                                    setSelectedMember(member);
                                                    setNewRole(member.role);
                                                    setUpdateRoleError('');
                                                }}
                                                className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded transition-colors"
                                            >
                                                Change Role
                                            </button>
                                        )}
                                        {member.role !== 'OWNER' && (
                                            <button
                                                onClick={() => removeMember(member.id)}
                                                className="text-xs font-bold text-red-600 hover:bg-red-50 px-2.5 py-1 rounded transition-colors"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-fade-in p-4 backdrop-blur-sm">
                    <div className={`bg-white p-6 rounded-2xl w-full shadow-2xl transition-all duration-300 ${inviteStep === 2 ? 'max-w-2xl' : 'max-w-md'}`}>
                        {/* Progress Header */}
                        <div className="mb-6">
                            <h2 className="text-xl font-black text-[var(--text-main)]">Invite Team Member</h2>
                            <p className="text-xs text-[var(--text-muted)] mt-1 font-semibold">
                                {inviteStep === 1 ? 'Step 1 of 2: Contact Information' : 'Step 2 of 2: Access & Roles'}
                            </p>
                            
                            {/* Visual Progress Bar */}
                            <div className="w-full bg-gray-100 h-1.5 rounded-full mt-4 overflow-hidden">
                                <div 
                                    className="bg-[var(--brand-primary)] h-full transition-all duration-500 rounded-full"
                                    style={{ width: inviteStep === 1 ? '50%' : '100%' }}
                                />
                            </div>
                        </div>

                        <form onSubmit={(e) => {
                            if (inviteStep === 1) {
                                e.preventDefault();
                                setInviteStep(2);
                            } else {
                                handleInvite(e);
                            }
                        }} className="space-y-4">
                            {inviteStep === 1 && (
                                <div className="space-y-4 animate-fade-in">
                                    <div>
                                        <label className="block text-sm font-bold text-[var(--text-main)] mb-1">Full Name</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="e.g. John Doe"
                                            className="w-full p-3 border border-[var(--glass-border)] rounded-xl focus:ring-2 ring-[var(--brand-primary)] outline-none font-semibold bg-gray-50/30"
                                            value={inviteForm.name} 
                                            onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-[var(--text-main)] mb-1">Email Address</label>
                                        <input
                                            required
                                            type="email" 
                                            placeholder="e.g. john.doe@example.com"
                                            className="w-full p-3 border border-[var(--glass-border)] rounded-xl focus:ring-2 ring-[var(--brand-primary)] outline-none font-semibold bg-gray-50/30"
                                            value={inviteForm.email} 
                                            onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                                        />
                                    </div>

                                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--glass-border)]">
                                        <button 
                                            type="button" 
                                            onClick={() => setShowInviteModal(false)} 
                                            className="px-5 py-2.5 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            type="submit" 
                                            disabled={!inviteForm.name.trim() || !inviteForm.email.trim() || !inviteForm.email.includes('@')}
                                            className="px-5 py-2.5 bg-[var(--brand-primary)] text-white font-bold rounded-xl hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shadow-md shadow-blue-500/10"
                                        >
                                            Next Step →
                                        </button>
                                    </div>
                                </div>
                            )}

                            {inviteStep === 2 && (
                                <div className="space-y-4 animate-fade-in">
                                    <label className="block text-sm font-bold text-[var(--text-main)] mb-2">Select Access Role</label>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto pr-1">
                                        {(Object.keys(ROLE_INFO) as MerchantRole[]).filter(roleKey => roleKey !== 'OWNER').map((roleKey) => {
                                            const role = ROLE_INFO[roleKey];
                                            const isSelected = inviteForm.role === roleKey;
                                            return (
                                                <div
                                                    key={roleKey}
                                                    onClick={() => setInviteForm({ ...inviteForm, role: roleKey })}
                                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:bg-gray-50/50 flex flex-col justify-between ${
                                                        isSelected 
                                                            ? 'border-[var(--brand-primary)] bg-blue-50/5 shadow-md shadow-blue-500/5' 
                                                            : 'border-[var(--glass-border)] bg-white'
                                                    }`}
                                                >
                                                    <div>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${role.color}`}>
                                                                {role.label}
                                                            </span>
                                                            {isSelected && (
                                                                <span className="w-5 h-5 rounded-full bg-[var(--brand-primary)] text-white flex items-center justify-center text-xs font-bold animate-scale-in">✓</span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs font-semibold text-[var(--text-main)] mb-1">
                                                            {roleKey === 'STAFF' ? 'Staff / Picker' : role.label}
                                                        </p>
                                                        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                                                            {role.desc}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {inviteError && (
                                        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                                            {inviteError}
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--glass-border)]">
                                        <button 
                                            type="button" 
                                            disabled={isSaving} 
                                            onClick={() => setInviteStep(1)} 
                                            className="px-5 py-2.5 font-bold text-gray-500 hover:bg-gray-100 rounded-xl disabled:opacity-50 transition-all"
                                        >
                                            ← Back
                                        </button>
                                        <button 
                                            type="submit" 
                                            disabled={isSaving} 
                                            className="px-5 py-2.5 bg-[var(--brand-primary)] text-white font-bold rounded-xl hover:brightness-110 disabled:opacity-50 flex justify-center items-center gap-2 min-w-[130px] transition-all shadow-md shadow-blue-500/10"
                                        >
                                            {isSaving ? (
                                                <>
                                                    <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                                                    Sending...
                                                </>
                                            ) : (
                                                'Send Invite'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
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

            {/* Change Role Modal / Wizard */}
            {selectedMember && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-fade-in p-4 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-xl shadow-2xl transition-all duration-300 animate-scale-in">
                        {/* Header */}
                        <div className="mb-6">
                            <h2 className="text-xl font-black text-[var(--text-main)]">Manage Your Store Team</h2>
                            <p className="text-xs text-[var(--text-muted)] mt-1 font-semibold">
                                Assign roles to restrict access based on job function.
                            </p>
                            
                            {/* Selected Member Info */}
                            <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-[var(--glass-border)] flex items-center justify-between">
                                <div>
                                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Modifying Member</div>
                                    <div className="text-sm font-bold text-[var(--text-main)]">{selectedMember.name}</div>
                                    <div className="text-xs text-[var(--text-muted)]">{selectedMember.email}</div>
                                </div>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${ROLE_INFO[selectedMember.role].color}`}>
                                    Current: {ROLE_INFO[selectedMember.role].label}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="block text-sm font-bold text-[var(--text-main)] mb-2">Select New Access Role</label>
                            
                            <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-1">
                                {(Object.keys(ROLE_INFO) as MerchantRole[]).filter(roleKey => roleKey !== 'OWNER').map((roleKey) => {
                                    const role = ROLE_INFO[roleKey];
                                    const isSelected = newRole === roleKey;
                                    return (
                                        <div
                                            key={roleKey}
                                            onClick={() => setNewRole(roleKey)}
                                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:bg-gray-50/50 flex items-center justify-between ${
                                                isSelected 
                                                    ? 'border-[var(--brand-primary)] bg-blue-50/5 shadow-md shadow-blue-500/5' 
                                                    : 'border-[var(--glass-border)] bg-white'
                                            }`}
                                        >
                                            <div className="flex-1 pr-4">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${role.color}`}>
                                                        {role.label}
                                                    </span>
                                                </div>
                                                <p className="text-xs font-bold text-[var(--text-main)] mb-0.5">
                                                    {roleKey === 'STAFF' ? 'Staff / Picker' : role.label}
                                                </p>
                                                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                                                    {role.desc}
                                                </p>
                                            </div>
                                            <div className="flex items-center justify-center shrink-0">
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                                    isSelected 
                                                        ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white' 
                                                        : 'border-gray-300 bg-white'
                                                }`}>
                                                    {isSelected && <span className="text-xs font-bold">✓</span>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {updateRoleError && (
                                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                                    {updateRoleError}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--glass-border)]">
                                <button 
                                    type="button" 
                                    disabled={isUpdatingRole} 
                                    onClick={() => setSelectedMember(null)} 
                                    className="px-5 py-2.5 font-bold text-gray-500 hover:bg-gray-100 rounded-xl disabled:opacity-50 transition-all text-sm"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="button"
                                    disabled={isUpdatingRole || newRole === selectedMember.role} 
                                    onClick={handleChangeRole}
                                    className="px-5 py-2.5 bg-[var(--brand-primary)] text-white font-bold rounded-xl hover:brightness-110 disabled:opacity-50 flex justify-center items-center gap-2 min-w-[130px] transition-all shadow-md shadow-blue-500/10 text-sm"
                                >
                                    {isUpdatingRole ? (
                                        <>
                                            <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                                            Saving...
                                        </>
                                    ) : (
                                        'Save Role'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderProfile = () => (
        <div className="space-y-6 animate-fade-in">
            {user?.merchantRole === 'STAFF' && (
                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                    <span className="text-2xl shrink-0">🔒</span>
                    <div>
                        <h3 className="font-black text-orange-900 text-sm">Read-Only Access</h3>
                        <p className="text-xs text-orange-700 mt-0.5 font-medium leading-relaxed">
                            Staff and Picker accounts have read-only access to the Store Profile. Please contact your store manager or owner if updates are required.
                        </p>
                    </div>
                </div>
            )}

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
                                    disabled={uploading || user?.merchantRole === 'STAFF'}
                                    className="px-4 py-2 border border-[var(--glass-border)] rounded-lg text-sm font-medium hover:bg-gray-50 mb-1 disabled:opacity-50 disabled:cursor-not-allowed"
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
                            onClick={() => !uploading && user?.merchantRole !== 'STAFF' && triggerUpload('cover')}
                            className={`h-20 w-full rounded-lg overflow-hidden relative group border-2 border-[var(--surface-2)] transition-colors ${
                                user?.merchantRole === 'STAFF' ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:border-[var(--brand-primary)]'
                            }`}
                        >
                            <img src={storeInfo.coverUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="Cover" />
                            {user?.merchantRole !== 'STAFF' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 text-white font-medium text-sm">
                                    {uploading && uploadTarget === 'cover' ? 'Uploading...' : 'Change Cover'}
                                </div>
                            )}
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
                                <option key={type} value={type}>{BUSINESS_TYPES[type].label || type}</option>
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
                            disabled={user?.merchantRole === 'STAFF'}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg font-medium text-lg disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Tagline</label>
                        <input
                            type="text"
                            value={storeInfo.tagline}
                            onChange={e => setStoreInfo({ ...storeInfo, tagline: e.target.value })}
                            disabled={user?.merchantRole === 'STAFF'}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                            placeholder="e.g. Fresh groceries, delivered fast."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Phone Number</label>
                        <input
                            type="tel"
                            value={storeInfo.phone}
                            onChange={e => setStoreInfo({ ...storeInfo, phone: e.target.value })}
                            disabled={user?.merchantRole === 'STAFF'}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Email</label>
                        <input
                            type="email"
                            value={storeInfo.email}
                            onChange={e => setStoreInfo({ ...storeInfo, email: e.target.value })}
                            disabled={user?.merchantRole === 'STAFF'}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                        />
                    </div>
                    <div className="md:col-span-2 mt-2 pt-4 border-t border-[var(--glass-border)] flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-[var(--text-main)]">Store Location</h3>
                            <p className="text-sm text-[var(--text-muted)]">Enter your physical address to calculate delivery and distance.</p>
                        </div>
                        <button
                            onClick={handleGeocode}
                            disabled={isLocatingStatus === 'loading' || user?.merchantRole === 'STAFF'}
                            className={`px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ${isLocatingStatus === 'success' ? 'bg-green-100 text-green-700' :
                                isLocatingStatus === 'error' ? 'bg-red-100 text-red-700' :
                                    user?.merchantRole === 'STAFF' ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed' :
                                        'bg-blue-600 text-white hover:brightness-110 shadow-md'
                                }`}
                        >
                            {isLocatingStatus === 'loading' ? '⏳ Verifying...' :
                                isLocatingStatus === 'success' ? '✅ Address Verified' :
                                    isLocatingStatus === 'error' ? '❌ Address Not Found' :
                                        user?.merchantRole === 'STAFF' ? '🔒 View Only' :
                                            '📍 Verify Address & Locate'}
                        </button>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Street Address</label>
                        <input
                            type="text"
                            value={storeInfo.address}
                            onChange={e => setStoreInfo({ ...storeInfo, address: e.target.value })}
                            disabled={user?.merchantRole === 'STAFF'}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                            placeholder="e.g. 123 Main St"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">City</label>
                        <input
                            type="text"
                            value={storeInfo.city}
                            onChange={e => setStoreInfo({ ...storeInfo, city: e.target.value })}
                            disabled={user?.merchantRole === 'STAFF'}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                            placeholder="e.g. Toronto"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Province (Sets Tax Rate)</label>
                        <select
                            value={storeInfo.province}
                            onChange={e => setStoreInfo({ ...storeInfo, province: e.target.value })}
                            disabled={user?.merchantRole === 'STAFF'}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg bg-white disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
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
                            disabled={user?.merchantRole === 'STAFF'}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
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
                            disabled={user?.merchantRole === 'STAFF'}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg h-24 resize-none disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
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
                    disabled={isExporting || user?.merchantRole === 'STAFF'}
                    className="flex items-center gap-2 px-4 py-2 border border-[var(--glass-border)] rounded-lg text-sm font-bold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
            {user?.merchantRole === 'STAFF' && (
                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                    <span className="text-2xl shrink-0">🔒</span>
                    <div>
                        <h3 className="font-black text-orange-900 text-sm">Read-Only Access</h3>
                        <p className="text-xs text-orange-700 mt-0.5 font-medium leading-relaxed">
                            Staff and Picker accounts have read-only access to Store Operations. Please contact your store manager or owner if updates are required.
                        </p>
                    </div>
                </div>
            )}

            <fieldset disabled={user?.merchantRole === 'STAFF'} className="space-y-6 disabled:opacity-90">
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
                    {/* Delivery Radius */}
                    <div className="bg-gray-50/50 p-4 rounded-xl border border-[var(--glass-border)] flex flex-col justify-between transition-all hover:shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-bold text-[var(--text-main)]">Delivery Radius</label>
                            <span className="text-xs font-black bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] px-2 py-0.5 rounded-full">
                                {operations.deliveryRadiusKm} km
                            </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mb-3">Define the distance within which your store will deliver.</p>
                        
                        <div className="flex items-center gap-3 mb-4">
                            <button
                                type="button"
                                onClick={() => setOperations(o => ({ ...o, deliveryRadiusKm: Math.max(1, o.deliveryRadiusKm - 1) }))}
                                className="w-10 h-10 rounded-lg bg-white border border-[var(--glass-border)] flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 hover:text-[var(--brand-primary)] active:scale-95 transition-all shadow-sm"
                            >
                                −
                            </button>
                            <input
                                type="range"
                                min="1"
                                max="50"
                                value={operations.deliveryRadiusKm}
                                onChange={e => setOperations({ ...operations, deliveryRadiusKm: Number(e.target.value) })}
                                className="flex-1 h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 accent-[var(--brand-primary)] transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setOperations(o => ({ ...o, deliveryRadiusKm: Math.min(50, o.deliveryRadiusKm + 1) }))}
                                className="w-10 h-10 rounded-lg bg-white border border-[var(--glass-border)] flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 hover:text-[var(--brand-primary)] active:scale-95 transition-all shadow-sm"
                            >
                                +
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {[2, 5, 10, 15, 20, 30].map(val => (
                                <button
                                    key={val}
                                    type="button"
                                    onClick={() => setOperations({ ...operations, deliveryRadiusKm: val })}
                                    className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${
                                        operations.deliveryRadiusKm === val
                                            ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-sm'
                                            : 'bg-white text-gray-600 border-[var(--glass-border)] hover:bg-gray-50'
                                    }`}
                                >
                                    {val} km
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Base Delivery Fee */}
                    <div className="bg-gray-50/50 p-4 rounded-xl border border-[var(--glass-border)] flex flex-col justify-between transition-all hover:shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-bold text-[var(--text-main)]">Base Delivery Fee</label>
                            <span className="text-xs font-black bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] px-2 py-0.5 rounded-full">
                                {operations.deliveryFee === 0 ? 'Free' : `$${operations.deliveryFee.toFixed(2)}`}
                            </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mb-3">Starting fee charged to customers for local deliveries.</p>
                        
                        <div className="flex items-center gap-3 mb-4">
                            <button
                                type="button"
                                onClick={() => setOperations(o => ({ ...o, deliveryFee: Math.max(0, Number((o.deliveryFee - 0.50).toFixed(2))) }))}
                                className="w-10 h-10 rounded-lg bg-white border border-[var(--glass-border)] flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 hover:text-[var(--brand-primary)] active:scale-95 transition-all shadow-sm"
                            >
                                −
                            </button>
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={operations.deliveryFee}
                                    onChange={e => setOperations({ ...operations, deliveryFee: Math.max(0, Number(e.target.value)) })}
                                    className="w-full pl-7 pr-3 py-2.5 border border-[var(--glass-border)] rounded-lg text-sm font-bold bg-white text-gray-800 focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] outline-none"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setOperations(o => ({ ...o, deliveryFee: Number((o.deliveryFee + 0.50).toFixed(2)) }))}
                                className="w-10 h-10 rounded-lg bg-white border border-[var(--glass-border)] flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 hover:text-[var(--brand-primary)] active:scale-95 transition-all shadow-sm"
                            >
                                +
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {[0, 2.99, 3.99, 4.99, 5.00, 7.50].map(val => (
                                <button
                                    key={val}
                                    type="button"
                                    onClick={() => setOperations({ ...operations, deliveryFee: val })}
                                    className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${
                                        operations.deliveryFee === val
                                            ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-sm'
                                            : 'bg-white text-gray-600 border-[var(--glass-border)] hover:bg-gray-50'
                                    }`}
                                >
                                    {val === 0 ? 'Free' : `$${val}`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Free Delivery Threshold */}
                    <div className="bg-gray-50/50 p-4 rounded-xl border border-[var(--glass-border)] flex flex-col justify-between transition-all hover:shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-bold text-[var(--text-main)]">Free Delivery Threshold</label>
                            <span className="text-xs font-black bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] px-2 py-0.5 rounded-full">
                                {operations.freeDeliveryThreshold === 0 ? 'Disabled' : `Over $${operations.freeDeliveryThreshold}`}
                            </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mb-3">Order total above which delivery fee is waived (0 to disable).</p>
                        
                        <div className="flex items-center gap-3 mb-4">
                            <button
                                type="button"
                                onClick={() => setOperations(o => ({ ...o, freeDeliveryThreshold: Math.max(0, o.freeDeliveryThreshold - 5) }))}
                                className="w-10 h-10 rounded-lg bg-white border border-[var(--glass-border)] flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 hover:text-[var(--brand-primary)] active:scale-95 transition-all shadow-sm"
                            >
                                −
                            </button>
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">$</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={operations.freeDeliveryThreshold}
                                    onChange={e => setOperations({ ...operations, freeDeliveryThreshold: Math.max(0, Number(e.target.value)) })}
                                    className="w-full pl-7 pr-3 py-2.5 border border-[var(--glass-border)] rounded-lg text-sm font-bold bg-white text-gray-800 focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] outline-none"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setOperations(o => ({ ...o, freeDeliveryThreshold: o.freeDeliveryThreshold + 5 }))}
                                className="w-10 h-10 rounded-lg bg-white border border-[var(--glass-border)] flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 hover:text-[var(--brand-primary)] active:scale-95 transition-all shadow-sm"
                            >
                                +
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {[0, 25, 35, 50, 75, 100].map(val => (
                                <button
                                    key={val}
                                    type="button"
                                    onClick={() => setOperations({ ...operations, freeDeliveryThreshold: val })}
                                    className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${
                                        operations.freeDeliveryThreshold === val
                                            ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-sm'
                                            : 'bg-white text-gray-600 border-[var(--glass-border)] hover:bg-gray-50'
                                    }`}
                                >
                                    {val === 0 ? 'No Limit' : `$${val}`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Minimum Order Amount */}
                    <div className="bg-gray-50/50 p-4 rounded-xl border border-[var(--glass-border)] flex flex-col justify-between transition-all hover:shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-bold text-[var(--text-main)]">Minimum Order Amount</label>
                            <span className="text-xs font-black bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] px-2 py-0.5 rounded-full">
                                {operations.minOrder === 0 ? 'No Minimum' : `$${operations.minOrder}`}
                            </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mb-3">Minimum total checkout value required to place an order.</p>
                        
                        <div className="flex items-center gap-3 mb-4">
                            <button
                                type="button"
                                onClick={() => setOperations(o => ({ ...o, minOrder: Math.max(0, o.minOrder - 5) }))}
                                className="w-10 h-10 rounded-lg bg-white border border-[var(--glass-border)] flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 hover:text-[var(--brand-primary)] active:scale-95 transition-all shadow-sm"
                            >
                                −
                            </button>
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">$</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={operations.minOrder}
                                    onChange={e => setOperations({ ...operations, minOrder: Math.max(0, Number(e.target.value)) })}
                                    className="w-full pl-7 pr-3 py-2.5 border border-[var(--glass-border)] rounded-lg text-sm font-bold bg-white text-gray-800 focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] outline-none"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setOperations(o => ({ ...o, minOrder: o.minOrder + 5 }))}
                                className="w-10 h-10 rounded-lg bg-white border border-[var(--glass-border)] flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 hover:text-[var(--brand-primary)] active:scale-95 transition-all shadow-sm"
                            >
                                +
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {[0, 10, 15, 20, 25, 35, 50].map(val => (
                                <button
                                    key={val}
                                    type="button"
                                    onClick={() => setOperations({ ...operations, minOrder: val })}
                                    className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${
                                        operations.minOrder === val
                                            ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-sm'
                                            : 'bg-white text-gray-600 border-[var(--glass-border)] hover:bg-gray-50'
                                    }`}
                                >
                                    {val === 0 ? 'No Min' : `$${val}`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Default Prep Time */}
                    <div className="bg-gray-50/50 p-4 rounded-xl border border-[var(--glass-border)] flex flex-col justify-between transition-all hover:shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-bold text-[var(--text-main)]">Default Prep Time</label>
                            <span className="text-xs font-black bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] px-2 py-0.5 rounded-full">
                                {operations.defaultPrepTime} mins
                            </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mb-3">Estimated time required to prepare and pack an order.</p>
                        
                        <div className="flex items-center gap-3 mb-4">
                            <button
                                type="button"
                                onClick={() => setOperations(o => ({ ...o, defaultPrepTime: Math.max(5, o.defaultPrepTime - 5) }))}
                                className="w-10 h-10 rounded-lg bg-white border border-[var(--glass-border)] flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 hover:text-[var(--brand-primary)] active:scale-95 transition-all shadow-sm"
                            >
                                −
                            </button>
                            <input
                                type="range"
                                min="5"
                                max="180"
                                step="5"
                                value={operations.defaultPrepTime}
                                onChange={e => setOperations({ ...operations, defaultPrepTime: Number(e.target.value) })}
                                className="flex-1 h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 accent-[var(--brand-primary)] transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setOperations(o => ({ ...o, defaultPrepTime: Math.min(180, o.defaultPrepTime + 5) }))}
                                className="w-10 h-10 rounded-lg bg-white border border-[var(--glass-border)] flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 hover:text-[var(--brand-primary)] active:scale-95 transition-all shadow-sm"
                            >
                                +
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {[15, 20, 30, 45, 60, 90].map(val => (
                                <button
                                    key={val}
                                    type="button"
                                    onClick={() => setOperations({ ...operations, defaultPrepTime: val })}
                                    className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${
                                        operations.defaultPrepTime === val
                                            ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-sm'
                                            : 'bg-white text-gray-600 border-[var(--glass-border)] hover:bg-gray-50'
                                    }`}
                                >
                                    {val} min
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Displayed Delivery Time */}
                    <div className="bg-gray-50/50 p-4 rounded-xl border border-[var(--glass-border)] flex flex-col justify-between transition-all hover:shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-bold text-[var(--text-main)]">Displayed Delivery Time</label>
                            <span className="text-xs font-black bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] px-2 py-0.5 rounded-full truncate max-w-[120px]">
                                {operations.deliveryTime || 'None'}
                            </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mb-3">The time estimate displayed to customers on the store list.</p>
                        
                        <div className="flex items-center gap-2 mb-4">
                            <input
                                type="text"
                                value={operations.deliveryTime}
                                onChange={e => setOperations({ ...operations, deliveryTime: e.target.value })}
                                className="w-full p-2.5 border border-[var(--glass-border)] rounded-lg text-sm font-bold bg-white text-gray-800 focus:ring-2 focus:ring-[var(--brand-primary)]/20 focus:border-[var(--brand-primary)] outline-none"
                                placeholder="e.g. 45-60 min"
                            />
                            {operations.defaultPrepTime && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const minTime = Math.max(15, Math.floor((operations.defaultPrepTime + 10) / 5) * 5);
                                        const maxTime = Math.max(minTime + 15, Math.ceil((operations.defaultPrepTime + 25) / 5) * 5);
                                        setOperations(o => ({ ...o, deliveryTime: `${minTime}-${maxTime} min` }));
                                    }}
                                    title="Auto-calculate based on current prep time"
                                    className="px-3 py-2 bg-blue-50 hover:bg-blue-100 hover:border-[var(--brand-primary)]/40 text-[var(--brand-primary)] font-bold text-xs rounded-lg border border-[var(--glass-border)] whitespace-nowrap transition-all active:scale-95 shadow-sm"
                                >
                                    ⚡️ Suggest
                                </button>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {['15-30 min', '30-45 min', '45-60 min', '60-75 min', '75-90 min'].map(val => (
                                <button
                                    key={val}
                                    type="button"
                                    onClick={() => setOperations({ ...operations, deliveryTime: val })}
                                    className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${
                                        operations.deliveryTime === val
                                            ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-sm'
                                            : 'bg-white text-gray-600 border-[var(--glass-border)] hover:bg-gray-50'
                                    }`}
                                >
                                    {val}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="md:col-span-2 pt-4 border-t border-[var(--glass-border)] mt-4 space-y-4">
                        {/* Toggle: Local Delivery */}
                        <div 
                            onClick={() => {
                                if (user?.merchantRole === 'STAFF') return;
                                if (!user?.subscriptionTier || user.subscriptionTier === 'free') return;
                                setOperations(o => ({ ...o, deliveryEnabled: !o.deliveryEnabled }));
                            }}
                            className={`flex items-center justify-between p-4 rounded-xl border border-[var(--glass-border)] transition-all hover:bg-gray-50/50 cursor-pointer ${
                                operations.deliveryEnabled ? 'bg-blue-50/10' : 'bg-white'
                            }`}
                        >
                            <div className="flex-1 pr-4">
                                <div className="font-bold text-sm text-[var(--text-main)]">Enable Local Delivery</div>
                                <div className="text-xs text-[var(--text-muted)] mt-0.5">Offer local delivery within your radius. (Core/Growth only)</div>
                            </div>
                            <button
                                type="button"
                                disabled={(!user?.subscriptionTier || user.subscriptionTier === 'free')}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ring-2 ring-transparent focus:ring-[var(--brand-primary)]/20 ${
                                    operations.deliveryEnabled ? 'bg-[var(--brand-primary)]' : 'bg-gray-200'
                                } ${(!user?.subscriptionTier || user.subscriptionTier === 'free') ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                        operations.deliveryEnabled ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                />
                            </button>
                        </div>

                        {/* Toggle: Pickup */}
                        <div 
                            onClick={() => {
                                if (user?.merchantRole === 'STAFF') return;
                                setOperations(o => ({ ...o, pickupEnabled: !o.pickupEnabled }));
                            }}
                            className={`flex items-center justify-between p-4 rounded-xl border border-[var(--glass-border)] transition-all hover:bg-gray-50/50 cursor-pointer ${
                                operations.pickupEnabled ? 'bg-blue-50/10' : 'bg-white'
                            }`}
                        >
                            <div className="flex-1 pr-4">
                                <div className="font-bold text-sm text-[var(--text-main)]">Enable Store Pickup / Click & Collect</div>
                                <div className="text-xs text-[var(--text-muted)] mt-0.5">Allow customers to order online and pick up in store.</div>
                            </div>
                            <button
                                type="button"
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ring-2 ring-transparent focus:ring-[var(--brand-primary)]/20 ${
                                    operations.pickupEnabled ? 'bg-[var(--brand-primary)]' : 'bg-gray-200'
                                }`}
                            >
                                <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                        operations.pickupEnabled ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                />
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Business Hours */}
            <section className="bg-white p-6 rounded-xl border border-[var(--glass-border)] shadow-sm">
                <h2 className="text-lg font-bold text-[var(--text-main)] mb-4">Business Hours</h2>
                <div className="space-y-1">
                    {hours.map((day, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 border-b border-[var(--surface-1)] last:border-0 hover:bg-[var(--surface-1)]/30 px-3 rounded-xl transition-all duration-200">
                            {/* Day and Status Indicator */}
                            <div className="flex items-center gap-3 min-w-[145px]">
                                <div className="font-bold text-sm text-[var(--text-main)] w-24">{day.day}</div>
                                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border tracking-wide uppercase ${
                                    day.closed 
                                        ? 'bg-red-50 text-red-600 border-red-100' 
                                        : 'bg-green-50 text-green-600 border-green-100'
                                }`}>
                                    {day.closed ? 'Closed' : 'Open'}
                                </span>
                            </div>

                            {/* Controls: Switch + Hours */}
                            <div className="flex-1 flex items-center justify-end gap-6 flex-wrap">
                                {/* Small Slider Switch */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-[var(--text-muted)] font-medium">Status:</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newHours = [...hours];
                                            newHours[idx].closed = !day.closed;
                                            setHours(newHours);
                                        }}
                                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20 ${
                                            !day.closed ? 'bg-green-500' : 'bg-gray-300'
                                        }`}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                                                !day.closed ? 'translate-x-4' : 'translate-x-0'
                                            }`}
                                        />
                                    </button>
                                </div>

                                {/* Hours Inputs */}
                                <div className="flex items-center gap-2 min-w-[210px] justify-end">
                                    {day.closed ? (
                                        <span className="text-xs font-semibold text-[var(--text-muted)] italic py-2 bg-gray-50 px-3 rounded-lg border border-gray-100 w-full text-center">
                                            Store closed all day
                                        </span>
                                    ) : (
                                        <div className="flex items-center gap-2 w-full justify-end animate-fade-in">
                                            <input
                                                type="time"
                                                value={day.open}
                                                onChange={e => {
                                                    const newHours = [...hours];
                                                    newHours[idx].open = e.target.value;
                                                    setHours(newHours);
                                                }}
                                                className="p-1.5 border border-[var(--glass-border)] rounded-lg text-xs font-bold bg-white text-gray-800 focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none w-24 text-center shadow-sm"
                                            />
                                            <span className="text-xs font-bold text-[var(--text-muted)]">to</span>
                                            <input
                                                type="time"
                                                value={day.close}
                                                onChange={e => {
                                                    const newHours = [...hours];
                                                    newHours[idx].close = e.target.value;
                                                    setHours(newHours);
                                                }}
                                                className="p-1.5 border border-[var(--glass-border)] rounded-lg text-xs font-bold bg-white text-gray-800 focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none w-24 text-center shadow-sm"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
            </fieldset>
        </div>
    );

    const renderPayments = () => {
        const store = stores[storeId];
        const isConnected = !!store?.stripeAccountId;
        const isPayoutEditable = can('payouts:write') && !isLocked;

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
                                {isPayoutEditable && (
                                    <button onClick={handleDisconnectStripe} className="text-xs text-red-500 hover:underline text-right">
                                        Disconnect
                                    </button>
                                )}
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
                                    disabled={isSaving || !isPayoutEditable}
                                    className="px-6 py-3 bg-[#635BFF] text-white font-bold rounded-lg hover:brightness-110 shadow-lg shadow-[#635BFF]/30 transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
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
                                    disabled={!isConnected || !isPayoutEditable}
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
                                    disabled={!isConnected || !isPayoutEditable}
                                    placeholder={storeInfo.name.substring(0, 22)}
                                    className="w-full p-3 border border-[var(--glass-border)] rounded-lg bg-[var(--surface-1)] disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                                />
                            <p className="text-xs text-[var(--text-muted)] mt-1 flex justify-between">
                                <span>This is what customers will see on their bank statements.</span>
                                <span className={payments.statementDescriptor.length >= 20 ? 'text-orange-500' : ''}>{payments.statementDescriptor.length}/22</span>
                            </p>
                        </div>
                    </div>
                    {isConnected && isPayoutEditable && (
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
                    ].map((item) => {
                        const isChecked = (notifications as any)[item.key];
                        return (
                            <div 
                                key={item.key}
                                onClick={() => setNotifications({ ...notifications, [item.key]: !isChecked })}
                                className={`flex items-center justify-between p-4 rounded-xl border border-[var(--glass-border)] transition-all hover:bg-gray-50/50 cursor-pointer ${
                                    isChecked ? 'bg-blue-50/10' : 'bg-white'
                                }`}
                            >
                                <div className="flex-1 pr-4">
                                    <div className="font-bold text-sm text-[var(--text-main)]">{item.title}</div>
                                    <div className="text-xs text-[var(--text-muted)] mt-0.5">{item.desc}</div>
                                </div>
                                <button
                                    type="button"
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ring-2 ring-transparent focus:ring-[var(--brand-primary)]/20 ${
                                        isChecked ? 'bg-[var(--brand-primary)]' : 'bg-gray-200'
                                    }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                            isChecked ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </section>

            {user?.merchantRole === 'OWNER' && (
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
            )}
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
                            onClick={() => handleTabChange(tab.id)}
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

            <div className="animate-fade-in duration-300">
                {activeTab === 'profile' && (
                    <div id="section-profile">
                        <h3 className="text-xl font-black text-[var(--brand-primary)] mb-6 flex items-center gap-3 bg-[var(--surface-2)] p-4 rounded-2xl border border-[var(--glass-border)]">
                            <span className="text-2xl">🏪</span>
                            Store Profile & Branding
                        </h3>
                        {renderProfile()}
                    </div>
                )}

                {activeTab === 'operations' && (hasSettingsAccess || user?.merchantRole === 'STAFF') && (
                    <div id="section-operations">
                        <h3 className="text-xl font-black text-[var(--brand-primary)] mb-6 flex items-center gap-3 bg-[var(--surface-2)] p-4 rounded-2xl border border-[var(--glass-border)]">
                            <span className="text-2xl">⚙️</span>
                            Store Operations & Logistics
                        </h3>
                        {renderOperations()}
                    </div>
                )}

                {activeTab === 'team' && hasTeamAccess && (
                    <div id="section-team">
                        <h2 className="text-xl font-black text-[var(--brand-primary)] mb-6 flex items-center gap-3 bg-[var(--surface-2)] p-4 rounded-2xl border border-[var(--glass-border)]">
                            <span className="text-2xl">👥</span>
                            Team & User Management
                        </h2>
                        {renderTeam()}

                        {/* ── Role Permissions Reference ── */}
                        {(() => {
                            type AccessLevel = 'full' | 'read' | 'none';
                            interface MRow { label: string; access: [AccessLevel, AccessLevel, AccessLevel, AccessLevel]; note?: string; }
                            interface MSection { category: string; rows: MRow[]; }

                            const COLS = [
                                { key: 'OWNER',     label: 'Store Owner',     icon: '👑', badge: ROLE_INFO.OWNER.color },
                                { key: 'MANAGER',   label: 'Store Manager',   icon: '🏢', badge: ROLE_INFO.MANAGER.color },
                                { key: 'STAFF',     label: 'Staff / Picker',  icon: '📦', badge: ROLE_INFO.STAFF.color },
                                { key: 'MARKETING', label: 'Marketing Spec',  icon: '📣', badge: ROLE_INFO.MARKETING.color },
                            ];

                            const MATRIX: MSection[] = [
                                {
                                    category: '🏪 Store Settings',
                                    rows: [
                                        { label: 'Edit store profile',             access: ['full', 'full', 'read', 'none'] },
                                        { label: 'Operations settings',            access: ['full', 'full', 'read', 'none'] },
                                        { label: 'Business verification (KYB)',    access: ['full', 'none', 'none', 'none'] },
                                        { label: 'Export store data',              access: ['full', 'full', 'none', 'none'] },
                                        { label: 'Request account deletion',       access: ['full', 'none', 'none', 'none'] },
                                    ],
                                },
                                {
                                    category: '📦 Products',
                                    rows: [
                                        { label: 'View products',                  access: ['full', 'full', 'full', 'full'] },
                                        { label: 'Add / edit products',            access: ['full', 'full', 'none', 'full'] },
                                        { label: 'Delete products',                access: ['full', 'full', 'none', 'full'] },
                                    ],
                                },
                                {
                                    category: '🧾 Orders & Delivery',
                                    rows: [
                                        { label: 'View orders',                    access: ['full', 'full', 'full', 'none'] },
                                        { label: 'Update order status',            access: ['full', 'full', 'full', 'none'] },
                                        { label: 'Process refunds',                access: ['full', 'full', 'full', 'none'] },
                                        { label: 'Manage delivery',                access: ['full', 'full', 'full', 'none'] },
                                    ],
                                },
                                {
                                    category: '🗞️ Flyers & Deals',
                                    rows: [
                                        { label: 'Create / edit flyers',           access: ['full', 'full', 'none', 'full'] },
                                        { label: 'Create / edit deals',            access: ['full', 'full', 'none', 'full'] },
                                    ],
                                },
                                {
                                    category: '📊 Analytics & Marketing',
                                    rows: [
                                        { label: 'View analytics dashboard',       access: ['full', 'full', 'none', 'full'] },
                                        { label: 'Digital marketing campaigns',    access: ['full', 'full', 'none', 'full'] },
                                    ],
                                },
                                {
                                    category: '👥 Team Management',
                                    rows: [
                                        { label: 'View team roster',               access: ['full', 'none', 'none', 'none'] },
                                        { label: 'Invite members',                 access: ['full', 'none', 'none', 'none'] },
                                        { label: 'Change member roles',            access: ['full', 'none', 'none', 'none'] },
                                        { label: 'Remove members',                 access: ['full', 'none', 'none', 'none'] },
                                    ],
                                },
                                {
                                    category: '💳 Subscription & Billing',
                                    rows: [
                                        { label: 'View subscription plan',         access: ['full', 'read', 'read', 'read'] },
                                        { label: 'Upgrade / downgrade plan',       access: ['full', 'read', 'none', 'none'] },
                                        { label: 'View payout settings',           access: ['full', 'read', 'none', 'none'] },
                                    ],
                                },
                                {
                                    category: '🔔 Notifications',
                                    rows: [
                                        { label: 'Manage notification preferences', access: ['full', 'full', 'full', 'full'], note: 'Own prefs only' },
                                    ],
                                },
                            ];

                            const cellCls = (level: AccessLevel) =>
                                level === 'full' ? 'bg-green-100 text-green-800' :
                                level === 'read' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-400';
                            const cellLbl = (level: AccessLevel) =>
                                level === 'full' ? '✅ Full' :
                                level === 'read' ? '🔍 View' : '—';

                            return (
                                <div className="mt-8 space-y-5">
                                    {/* Header */}
                                    <div className="flex items-start gap-3 bg-[var(--surface-2)] p-4 rounded-2xl border border-[var(--glass-border)]">
                                        <span className="text-2xl">🔐</span>
                                        <div>
                                            <h3 className="font-bold text-[var(--text-main)]">Role Permissions Reference</h3>
                                            <p className="text-sm text-[var(--text-muted)]">What each team role can see and do in your merchant portal.</p>
                                        </div>
                                    </div>

                                    {/* Role summary cards */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {COLS.map(col => {
                                            const info = ROLE_INFO[col.key as keyof typeof ROLE_INFO];
                                            return (
                                                <div key={col.key} className="bg-white rounded-xl border border-[var(--glass-border)] p-4 shadow-sm">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-xl">{col.icon}</span>
                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${info.color}`}>{info.label}</span>
                                                    </div>
                                                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">{info.desc}</p>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Legend */}
                                    <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-[var(--glass-border)] px-4 py-2.5 text-xs">
                                        <span className="font-bold text-[var(--text-muted)] uppercase tracking-wider">Legend:</span>
                                        <span className="px-2.5 py-1 rounded-full font-semibold bg-green-100 text-green-800">✅ Full Access</span>
                                        <span className="px-2.5 py-1 rounded-full font-semibold bg-blue-100 text-blue-800">🔍 View Only</span>
                                        <span className="px-2.5 py-1 rounded-full font-semibold bg-gray-100 text-gray-400">— No Access</span>
                                    </div>

                                    {/* Matrix table */}
                                    <div className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden shadow-sm">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 border-b border-[var(--glass-border)]">
                                                    <tr>
                                                        <th className="p-3 text-left text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider w-56">Feature / Action</th>
                                                        {COLS.map(col => (
                                                            <th key={col.key} className="p-3 text-center text-xs font-bold uppercase tracking-wider">
                                                                <span className={`px-2 py-0.5 rounded-full border ${ROLE_INFO[col.key as keyof typeof ROLE_INFO].color}`}>
                                                                    {col.icon} {col.label}
                                                                </span>
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {MATRIX.map(section => (
                                                        <React.Fragment key={section.category}>
                                                            <tr className="bg-gray-50">
                                                                <td colSpan={5} className="px-3 py-2 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                                                                    {section.category}
                                                                </td>
                                                            </tr>
                                                            {section.rows.map(row => (
                                                                <tr key={row.label} className="hover:bg-gray-50/50 transition-colors">
                                                                    <td className="px-3 py-2.5 text-[var(--text-main)]">
                                                                        {row.label}
                                                                        {row.note && <span className="ml-1 text-xs text-[var(--text-muted)]">({row.note})</span>}
                                                                    </td>
                                                                    {row.access.map((level, i) => (
                                                                        <td key={i} className="px-3 py-2.5 text-center">
                                                                            <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${cellCls(level)}`}>
                                                                                {cellLbl(level)}
                                                                            </span>
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        </React.Fragment>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}

                {activeTab === 'payments' && hasSettingsAccess && (
                    <div id="section-payments">
                        <h2 className="text-xl font-black text-[var(--brand-primary)] mb-6 flex items-center gap-3 bg-[var(--surface-2)] p-4 rounded-2xl border border-[var(--glass-border)]">
                            <span className="text-2xl">💳</span>
                            Payments & Payouts
                        </h2>
                        {!can('payouts:write') && (
                            <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-center gap-3 text-orange-800 text-sm animate-fade-in">
                                <span className="text-xl">🔒</span>
                                <span className="font-medium">
                                    Payout settings are read-only. Editing or linking Stripe accounts is restricted to Owners.
                                </span>
                            </div>
                        )}
                        {renderPayments()}
                    </div>
                )}

                {activeTab === 'notifications' && (
                    <div id="section-notifications">
                        <h2 className="text-xl font-black text-[var(--brand-primary)] mb-6 flex items-center gap-3 bg-[var(--surface-2)] p-4 rounded-2xl border border-[var(--glass-border)]">
                            <span className="text-2xl">🔔</span>
                            Notification Preferences
                        </h2>
                        {renderNotifications()}
                    </div>
                )}

                {activeTab === 'verification' && user?.merchantRole === 'OWNER' && (
                    <div id="section-verification">
                        <h2 className="text-xl font-black text-[var(--brand-primary)] mb-6 flex items-center gap-3 bg-[var(--surface-2)] p-4 rounded-2xl border border-[var(--glass-border)]">
                            <span className="text-2xl">🪪</span>
                            Business Verification
                        </h2>
                        {renderVerification()}
                    </div>
                )}
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
