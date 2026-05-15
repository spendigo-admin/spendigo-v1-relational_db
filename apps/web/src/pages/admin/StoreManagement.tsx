import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import '../../styles/design-system.css';
import { useAuth } from '../../context/AuthContext';
import { useAudit } from '../../context/AuditContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useNotifications } from '../../context/NotificationContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { BUSINESS_TYPES } from '../merchant/Settings';

const SUSPENSION_REASONS = [
    'Compliance Issue',
    'Customer Complaint',
    'Policy Violation',
    'Maintenance',
    'Unusual Activity',
    'Other'
];

const StoreManagement: React.FC = () => {
    const { user } = useAuth();
    const { logEvent } = useAudit();
    const { stores, updateStore, updateStoreStatus, addStore, requestDeleteStore, approveDeleteStore, cancelStoreDeletion, forceDeleteStore } = useMarketplace();
    const { addNotification } = useNotifications();
    const { confirm } = useConfirmation();
    const storeList = Object.values(stores);

    const [searchParams] = useSearchParams();
    const paramStatus = searchParams.get('status') || 'all';
    const [statusFilter, setStatusFilter] = useState(paramStatus);
    const [searchTerm, setSearchTerm] = useState('');

    // Sync filter if URL changes (optional but good for UX)
    useEffect(() => {
        if (searchParams.get('status')) {
            setStatusFilter(searchParams.get('status')!);
        }
    }, [searchParams]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
    const [selectedStoreLegal, setSelectedStoreLegal] = useState<any>(null);
    const [showFullAgreement, setShowFullAgreement] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        legalName: '',
        merchantEmail: '',
        type: 'Grocery Store',
        address: '',
        city: '',
        province: 'ON',
        postalCode: '',
        subscriptionTier: 'free',
        subscriptionStatus: 'inactive',
        subscriptionEnd: ''
    });

    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [statusModalStore, setStatusModalStore] = useState<any>(null);
    const [statusReason, setStatusReason] = useState('');
    const [customReason, setCustomReason] = useState('');
    const [kybReviewNote, setKybReviewNote] = useState('');
    const [kybRejectMode, setKybRejectMode] = useState(false);

    const resetForm = () => {
        setFormData({
            name: '',
            legalName: '',
            merchantEmail: '',
            type: 'Grocery Store',
            address: '',
            city: '',
            province: 'ON',
            postalCode: '',
            subscriptionTier: 'free',
            subscriptionStatus: 'inactive',
            subscriptionEnd: ''
        });
        setEditingStoreId(null);
        setSelectedStoreLegal(null);
        setShowFullAgreement(false);
        setKybReviewNote('');
        setKybRejectMode(false);
    };

    const handleStatusUpdate = async (storeId: string, status: 'active' | 'suspended', reason?: string) => {
        try {
            await updateStoreStatus(storeId, status, reason);
            await logEvent(status === 'suspended' ? 'STORE_SUSPEND' : 'STORE_RESUME', {
                storeId,
                reason: reason || 'N/A'
            }, `stores/${storeId}`);
            
            addNotification({ 
                type: 'system', 
                title: status === 'suspended' ? 'Store Suspended' : 'Store Resumed', 
                message: `Store status updated to ${status}.` 
            });
            setIsStatusModalOpen(false);
            setStatusModalStore(null);
            setStatusReason('');
            setCustomReason('');
        } catch (error) {
            console.error(error);
            addNotification({ type: 'alert', title: 'Update Failed', message: 'Could not update store status.' });
        }
    };

    // --- Subscription Data Logic ---
    const [merchantDataMap, setMerchantDataMap] = useState<{ byEmail: Record<string, any>, byStoreId: Record<string, any[]> }>({ byEmail: {}, byStoreId: {} });

    // Fetch merchant subscription data
    React.useEffect(() => {
        const q = query(collection(db, 'users'), where('role', '==', 'merchant'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const emailMap: Record<string, any> = {};
            const storeIdMap: Record<string, any[]> = {};

            snapshot.forEach(doc => {
                const data = doc.data();
                const subInfo = {
                    uid: doc.id,
                    tier: data.subscriptionTier || 'free',
                    status: data.subscriptionStatus || 'inactive',
                    end: data.subscriptionEnd,
                    ownerEmail: data.email,
                    merchantRole: data.merchantRole,
                    bn: data.businessRegistrationNumber || data.bn
                };

                if (data.email) {
                    emailMap[data.email.toLowerCase()] = subInfo;
                }

                // Reliability Fix: Map by storeId to handle email mismatches
                // Priority to OWNER logic: If multiple users track same store, prefer OWNER
                if (data.storeId) {
                    if (!storeIdMap[data.storeId]) {
                        storeIdMap[data.storeId] = [];
                    }
                    storeIdMap[data.storeId].push(subInfo);
                }
            });
            setMerchantDataMap({ byEmail: emailMap, byStoreId: storeIdMap });
        });
        return () => unsubscribe();
    }, []);

    const filteredStores = storeList.filter((store: any) => {
        const matchesSearch = (store.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (store.merchantEmail?.toLowerCase() || '').includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || store.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            let finalCoordinates = null;
            const storeToUpdate = editingStoreId ? stores[editingStoreId] : null;
            
            // Re-geocode only if address components changed or it's a new store
            const addressChanged = !storeToUpdate || 
                storeToUpdate.address !== formData.address || 
                storeToUpdate.city !== formData.city || 
                storeToUpdate.postalCode !== formData.postalCode;

            if (addressChanged) {
                try {
                    const fullAddress = `${formData.address}, ${formData.city}, ${formData.province}, ${formData.postalCode}, Canada`;
                    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`);
                    const data = await response.json();
                    if (data && data.length > 0) {
                        finalCoordinates = {
                            lat: parseFloat(data[0].lat),
                            lng: parseFloat(data[0].lon)
                        };
                    }
                } catch (geocodingError) {
                    console.warn("Geocoding failed during admin update", geocodingError);
                }
            }

            if (editingStoreId) {
                const updateData: any = {
                    name: formData.name,
                    legalName: formData.legalName,
                    merchantEmail: formData.merchantEmail,
                    businessType: formData.type, // Map 'type' to 'businessType' for consistency
                    address: formData.address,
                    city: formData.city,
                    province: formData.province,
                    postalCode: formData.postalCode
                };
                if (finalCoordinates) updateData.coordinates = finalCoordinates;
                
                // --- Branding Auto-Refresh Logic ---
                const typeChanged = storeToUpdate.businessType !== formData.type;
                if (typeChanged) {
                    const newDefaults = BUSINESS_TYPES[formData.type];
                    if (newDefaults) {
                        // Only update if current assets are defaults (start with /defaults/branding/)
                        const currentLogo = storeToUpdate.logoUrl || storeToUpdate.logo;
                        const currentCover = storeToUpdate.image;

                        const isCurrentLogoDefault = !currentLogo || (typeof currentLogo === 'string' && currentLogo.includes('/defaults/branding/'));
                        const isCurrentCoverDefault = !currentCover || (typeof currentCover === 'string' && currentCover.includes('/defaults/branding/'));

                        if (isCurrentLogoDefault) {
                            updateData.logoUrl = newDefaults.logo;
                            // Also clear legacy logo field to avoid confusion
                            if (storeToUpdate.logo) {
                                updateData.logo = ''; 
                            }
                        }
                        if (isCurrentCoverDefault) {
                            updateData.image = newDefaults.cover;
                        }
                    }
                }

                await updateStore(editingStoreId, updateData);
                await logEvent('STORE_UPDATE', { 
                    storeId: editingStoreId, 
                    storeName: formData.name,
                    changes: updateData 
                }, `stores/${editingStoreId}`);
                addNotification({ type: 'system', title: 'Store Updated', message: `${formData.name} updated successfully.` });
            } else {
                const newDefaults = BUSINESS_TYPES[formData.type];
                const newStore = await addStore({
                    ...formData,
                    businessType: formData.type,
                    status: 'pending',
                    rating: 0,
                    products: [],
                    coordinates: finalCoordinates,
                    logoUrl: newDefaults?.logo || `/defaults/branding/grocery_logo.png?v=5`,
                    image: newDefaults?.cover || `/defaults/branding/grocery_cover.png?v=5`
                });
                await logEvent('STORE_CREATE', { 
                    storeName: formData.name,
                    merchantEmail: formData.merchantEmail
                }, `stores/${newStore?.id || 'new'}`);
                addNotification({ type: 'system', title: 'Store Created', message: `${formData.name} added to marketplace.` });
            }

            // --- Subscription Update Logic ---
            if (editingStoreId) {
                const storeOwners = merchantDataMap.byStoreId[editingStoreId];
                const emailKey = formData.merchantEmail?.toLowerCase();
                const owner = storeOwners?.find(u => u.merchantRole === 'OWNER') || storeOwners?.[0] || merchantDataMap.byEmail[emailKey];

                if (owner && owner.uid) {
                    const userRef = doc(db, 'users', owner.uid);
                    await updateDoc(userRef, {
                        subscriptionTier: formData.subscriptionTier,
                        subscriptionStatus: formData.subscriptionStatus,
                        subscriptionEnd: formData.subscriptionEnd,
                        manualOverride: true,
                        lastAdminEdit: new Date().toISOString()
                    });
                    await logEvent('SUBSCRIPTION_OVERRIDE', {
                        targetUserId: owner.uid,
                        storeId: editingStoreId,
                        newTier: formData.subscriptionTier,
                        newStatus: formData.subscriptionStatus
                    }, `users/${owner.uid}`);
                }
            }

            setIsModalOpen(false);
            resetForm();
        } catch (error) {
            console.error(error);
            addNotification({ type: 'alert', title: 'Operation Failed', message: 'Could not save store changes.' });
        }
    };

    const handleEditClick = (store: any) => {
        const MASTER_TYPES = Object.keys(BUSINESS_TYPES);
        const legacyType = store.businessType || store.type || 'Grocery Store';
        // Case-insensitive match for legacy data (e.g. 'grocery' -> 'Grocery Store')
        const normalizedType = MASTER_TYPES.find(t => 
            t.toLowerCase() === legacyType.toLowerCase() || 
            t.toLowerCase().startsWith(legacyType.toLowerCase())
        ) || 'Grocery Store';

        const emailKey = (store.merchantEmail || '').toLowerCase();
        const storeOwners = merchantDataMap.byStoreId[store.id];
        let subData: any = { tier: 'free', status: 'active' };
        if (Array.isArray(storeOwners) && storeOwners.length > 0) {
            subData = storeOwners.find(u => u.merchantRole === 'OWNER') || storeOwners[0];
        } else if (merchantDataMap.byEmail[emailKey]) {
            subData = merchantDataMap.byEmail[emailKey];
        }

        setFormData({
            name: store.name || '',
            legalName: store.legalName || '',
            merchantEmail: store.merchantEmail || '',
            type: normalizedType,
            address: store.address || '',
            city: store.city || '',
            province: store.province || 'ON',
            postalCode: store.postalCode || '',
            subscriptionTier: subData.tier || 'free',
            subscriptionStatus: subData.status || 'inactive',
            subscriptionEnd: subData.end || ''
        });
        setEditingStoreId(store.id);
        setSelectedStoreLegal(store.legal || null);
        setIsModalOpen(true);
    };

    const handleExportStores = () => {
        const headers = ['ID', 'Name', 'Legal Name', 'Email', 'Type', 'Status', 'Address', 'City', 'Province', 'Agreement Version', 'Accepted At'];
        const rows = filteredStores.map((s: any) => [
            s.id,
            s.name,
            s.legalName || '',
            s.merchantEmail || '',
            s.businessType || '',
            s.status,
            s.address || '',
            s.city || '',
            s.province || '',
            s.legal?.agreementVersion || 'N/A',
            s.legal?.acceptedAt || 'N/A'
        ]);

        const csvContent = [headers, ...rows].map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `spendigo_stores_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    const handleSyncEmail = async (storeId: string, ownerEmail: string) => {
        try {
            await updateStore(storeId, { merchantEmail: ownerEmail });
            addNotification({ type: 'system', title: 'Data Synced', message: 'Store email updated to match owner.' });
        } catch (e) {
            console.error(e);
            addNotification({ type: 'alert', title: 'Sync Failed', message: 'Could not update store email.' });
        }
    };

    const handleKybReview = async (storeId: string, decision: 'approved' | 'rejected') => {
        try {
            const updateData: any = {
                kybStatus: decision,
                kybReviewedAt: new Date().toISOString(),
                kybReviewedBy: user?.id || ''
            };
            if (decision === 'approved') {
                updateData.kybReviewNote = '';
            } else {
                updateData.kybReviewNote = kybReviewNote;
            }
            const storeRef = doc(db, 'stores', storeId);
            await updateDoc(storeRef, updateData);
            await logEvent(decision === 'approved' ? 'KYB_APPROVED' : 'KYB_REJECTED', {
                storeId,
                reviewNote: kybReviewNote || ''
            }, `stores/${storeId}`);
            addNotification({
                type: 'system',
                title: decision === 'approved' ? 'KYB Approved' : 'KYB Rejected',
                message: `Business verification ${decision} for store.`
            });
            setKybRejectMode(false);
            setKybReviewNote('');
        } catch (e) {
            console.error(e);
            addNotification({ type: 'alert', title: 'Review Failed', message: 'Could not update KYB status.' });
        }
    };

    return (
        <div className="space-y-6 animate-fade-in relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-main)]">Store Management</h1>
                    <p className="text-[var(--text-muted)] text-sm">Review merchant applications and manage existing stores</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handleExportStores}
                        className="px-4 py-2 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-lg text-sm font-medium hover:bg-[var(--surface-2)] flex items-center gap-2"
                    >
                        📥 Export List
                    </button>
                    <button
                        onClick={() => {
                            resetForm();
                            setIsModalOpen(true);
                        }}
                        className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded-lg text-sm font-medium hover:brightness-110 shadow-sm"
                    >
                        + Add Store
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-[var(--glass-border)] shadow-sm">
                    <p className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider">Total Stores</p>
                    <p className="text-2xl font-bold text-[var(--text-main)] mt-1">{storeList.length}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-[var(--glass-border)] shadow-sm">
                    <p className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider">Pending</p>
                    <p className="text-2xl font-bold text-orange-500 mt-1">{storeList.filter((s: any) => s.status === 'pending').length}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-[var(--glass-border)] shadow-sm">
                    <p className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider">Suspended</p>
                    <p className="text-2xl font-bold text-red-500 mt-1">{storeList.filter((s: any) => s.status === 'suspended').length}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-[var(--glass-border)] shadow-sm">
                    <p className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider">Deletion Req</p>
                    <p className="text-2xl font-bold text-red-500 mt-1">{storeList.filter((s: any) => s.status === 'pending_deletion').length}</p>
                </div>
            </div>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-[var(--glass-border)] shadow-sm">
                <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                    <input
                        type="text"
                        placeholder="Search by Store Name or Email..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] bg-white"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="suspended">Suspended</option>
                    <option value="pending_deletion">Deletion Requests</option>
                </select>
            </div> {/* Main Table / Mobile Card View */}
            <div className="glass-panel overflow-hidden">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left bg-[var(--surface-1)]">
                        <thead className="bg-[var(--surface-2)] text-[var(--text-muted)] text-xs uppercase">
                            <tr>
                                <th className="p-4">Store Name</th>
                                <th className="p-4">Merchant Email</th>
                                <th className="p-4">Products</th>
                                <th className="p-4">Subscription</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--glass-border)]">
                            {filteredStores.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-[var(--text-muted)]">
                                        No stores found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredStores.map((store: any) => {
                                    const emailKey = (store.merchantEmail || '').toLowerCase();
                                    const storeOwners = merchantDataMap.byStoreId[store.id];
                                    let subData: any = { tier: 'free', status: 'active' };
                                    if (Array.isArray(storeOwners) && storeOwners.length > 0) {
                                        subData = storeOwners.find(u => u.merchantRole === 'OWNER') || storeOwners[0];
                                    } else if (merchantDataMap.byEmail[emailKey]) {
                                        subData = merchantDataMap.byEmail[emailKey];
                                    }
                                    const displayEmail = subData.ownerEmail || store.merchantEmail || 'N/A';

                                    return (
                                        <tr key={store.id} className="hover:bg-[var(--surface-2)] transition-colors group text-sm">
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-lg overflow-hidden shrink-0">
                                                        {store.logoUrl ? <img src={store.logoUrl} alt="" className="w-full h-full object-cover" /> : <span>{store.logo || '🏪'}</span>}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-[var(--text-main)] group-hover:text-[var(--brand-primary)] transition-colors">{store.name}</div>
                                                        <div className="flex flex-col gap-0.5 mt-0.5">
                                                            <div className="text-[9px] text-[var(--text-muted)] font-mono">ID: {store.id.substring(0, 8)}...</div>
                                                            {store.status === 'pending' && subData.bn && (
                                                                <div className="text-[10px] text-orange-600 font-bold bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100 w-fit">
                                                                    BN: {subData.bn}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-1 items-start">
                                                    <span>{displayEmail}</span>
                                                    {subData.ownerEmail && subData.ownerEmail !== store.merchantEmail && (
                                                        <button onClick={() => handleSyncEmail(store.id, subData.ownerEmail)} className="text-[10px] font-bold text-blue-600 hover:underline">↻ Sync</button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 font-mono font-bold text-xs">{store.productCount || store.products?.length || 0}</td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-fit border uppercase
                                                        ${subData.tier === 'growth' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                                        subData.tier === 'core' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                        'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                        {subData.tier}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase
                                                    ${store.status === 'active' ? 'bg-green-100 text-green-800' :
                                                    store.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                                                    'bg-red-100 text-red-800'}`}>
                                                    {(store.status || 'active').replace('_', ' ')}
                                                </span>
                                                {store.status === 'suspended' && store.statusReason && (
                                                    <div className="text-[10px] text-red-600 mt-1 font-medium bg-red-50 px-1.5 py-0.5 rounded border border-red-100 max-w-[150px] truncate" title={store.statusReason}>
                                                        Reason: {store.statusReason}
                                                    </div>
                                                )}
                                                {store.kybStatus && store.kybStatus !== 'not_submitted' && (
                                                    <div className={`text-[10px] font-bold mt-1 px-1.5 py-0.5 rounded border inline-flex items-center gap-0.5
                                                        ${store.kybStatus === 'approved' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                                                        store.kybStatus === 'pending_review' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                        'bg-red-50 text-red-600 border-red-200'}`}>
                                                        kyb: {store.kybStatus === 'approved' ? '✓' : store.kybStatus === 'pending_review' ? '…' : '!'} {store.kybStatus.replace('_', ' ')}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 text-right space-x-1 whitespace-nowrap">
                                                <button onClick={() => handleEditClick(store)} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-1 rounded-lg font-bold hover:bg-blue-100 transition-colors">Edit</button>
                                                {store.status === 'pending' && (
                                                    <button 
                                                        onClick={async () => {
                                                            if (await confirm({ 
                                                                title: 'Approve Merchant?', 
                                                                message: `Are you sure you want to approve ${store.name}? This will activate their store in the marketplace.`,
                                                                confirmText: 'Approve & Activate',
                                                                type: 'success'
                                                            })) {
                                                                await updateStoreStatus(store.id, 'active');
                                                                await logEvent('STORE_APPROVE', { 
                                                                    storeId: store.id, 
                                                                    storeName: store.name,
                                                                    merchantEmail: displayEmail
                                                                }, `stores/${store.id}`);
                                                                
                                                                // Trigger Approval Email
                                                                if (displayEmail && displayEmail !== 'N/A') {
                                                                    await addDoc(collection(db, 'mail'), {
                                                                        to: displayEmail,
                                                                        message: {
                                                                            subject: 'Your Spendigo Store is Approved! 🚀',
                                                                            html: `
                                                                                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                                                                                    <h2 style="color: #2563eb;">Congratulations!</h2>
                                                                                    <p>Hi ${store.name},</p>
                                                                                    <p>We are happy to inform you that your merchant application has been <strong>approved</strong>. Your store is now live in the Spendigo marketplace!</p>
                                                                                    <p>You can now start managing your products, flyers, and deals to attract nearby shoppers.</p>
                                                                                    <div style="margin: 30px 0; text-align: center;">
                                                                                        <a href="${window.location.origin}/merchant/dashboard" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Go to Merchant Dashboard</a>
                                                                                    </div>
                                                                                    <p><strong>Pro Tip:</strong> Want to jumpstart your sales? Share your local deals with your current customers and promote your Spendigo presence on social media!</p>
                                                                                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                                                                                    <p style="font-size: 12px; color: #666;">If you have any questions, feel free to contact our support team at support@spendigo.ca.</p>
                                                                                </div>
                                                                            `
                                                                        }
                                                                    });
                                                                }

                                                                addNotification({ 
                                                                    type: 'system', 
                                                                    title: 'Merchant Approved', 
                                                                    message: `${store.name} is now live and notified.` 
                                                                });
                                                            }
                                                        }} 
                                                        className="text-[10px] bg-green-600 shadow-md shadow-green-200 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-green-700 transition-all transform active:scale-95"
                                                    >
                                                        Approve
                                                    </button>
                                                )}
                                                {store.status === 'active' && (
                                                    <button 
                                                        onClick={() => {
                                                            setStatusModalStore(store);
                                                            setStatusReason(SUSPENSION_REASONS[0]);
                                                            setIsStatusModalOpen(true);
                                                        }} 
                                                        className="text-[10px] bg-red-50 text-red-600 border border-red-100 px-2 py-1 rounded-lg font-bold hover:bg-red-100 transition-colors"
                                                    >
                                                        Pause
                                                    </button>
                                                )}
                                                {store.status === 'suspended' && (
                                                    <button
                                                        onClick={async () => {
                                                            if (await confirm({
                                                                title: 'Resume Store?',
                                                                message: `Are you sure you want to resume ${store.name}? It will be visible to shoppers again.`,
                                                                confirmText: 'Resume Store',
                                                                type: 'success'
                                                            })) {
                                                                await handleStatusUpdate(store.id, 'active');
                                                            }
                                                        }}
                                                        className="text-[10px] bg-green-50 text-green-600 border border-green-100 px-2 py-1 rounded-lg font-bold hover:bg-green-100 transition-colors"
                                                    >
                                                        Resume
                                                    </button>
                                                )}
                                                {store.status === 'pending_deletion' && (() => {
                                                    const approvedAt = store.deletionApprovedAt?.toDate?.() || (store.deletionApprovedAt?.seconds ? new Date(store.deletionApprovedAt.seconds * 1000) : null);
                                                    const daysLeft = approvedAt ? Math.max(0, 30 - Math.floor((Date.now() - approvedAt.getTime()) / 86400000)) : 30;
                                                    return (
                                                        <div className="flex gap-2">
                                                            {!store.deletionApprovedAt && (
                                                                <button
                                                                    onClick={async () => {
                                                                        if (await confirm({
                                                                            title: 'Approve Deletion?',
                                                                            message: `This will start the 30-day countdown for ${store.name}. After 30 days, all data will be permanently deleted.`,
                                                                            confirmText: 'Approve Deletion',
                                                                            type: 'danger'
                                                                        })) {
                                                                            await approveDeleteStore(store.id);
                                                                            addNotification({ type: 'system', title: 'Deletion Approved', message: `${store.name} is now scheduled for deletion in 30 days.` });
                                                                        }
                                                                    }}
                                                                    className="text-[10px] bg-red-600 shadow-md shadow-red-200 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-red-700 transition-all transform active:scale-95"
                                                                >
                                                                    Approve
                                                                </button>
                                                            )}
                                                            {store.deletionApprovedAt && (
                                                                <button
                                                                    onClick={async () => {
                                                                        if (await confirm({
                                                                            title: 'Force Delete Now?',
                                                                            message: `This permanently deletes ${store.name} and all its data immediately, bypassing the grace period. This cannot be undone.`,
                                                                            confirmText: 'Delete Now',
                                                                            type: 'danger'
                                                                        })) {
                                                                            await forceDeleteStore(store.id);
                                                                            addNotification({ type: 'alert', title: 'Store Deleted', message: `${store.name} has been permanently deleted.` });
                                                                        }
                                                                    }}
                                                                    className="text-[10px] bg-red-700 text-white px-2 py-1 rounded-lg font-bold hover:bg-red-800 transition-colors"
                                                                >
                                                                    Force Delete
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={async () => {
                                                                    if (await confirm({
                                                                        title: 'Cancel Deletion?',
                                                                        message: `This will cancel the scheduled deletion of ${store.name} and restore it to suspended status.`,
                                                                        confirmText: 'Cancel Deletion',
                                                                        type: 'success'
                                                                    })) {
                                                                        await cancelStoreDeletion(store.id);
                                                                        addNotification({ type: 'system', title: 'Deletion Cancelled', message: `${store.name} has been restored to suspended.` });
                                                                    }
                                                                }}
                                                                className="text-[10px] bg-orange-50 text-orange-600 border border-orange-100 px-2 py-1 rounded-lg font-bold hover:bg-orange-100 transition-colors"
                                                            >
                                                                Cancel {store.deletionApprovedAt ? `(${daysLeft}d left)` : ''}
                                                            </button>
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-[var(--glass-border)] bg-[var(--surface-1)]">
                    {filteredStores.length === 0 ? (
                        <div className="p-8 text-center text-[var(--text-muted)]">No stores found.</div>
                    ) : (
                        filteredStores.map((store: any) => {
                            const emailKey = (store.merchantEmail || '').toLowerCase();
                            const storeOwners = merchantDataMap.byStoreId[store.id];
                            let subData: any = { tier: 'free', status: 'active' };
                            if (Array.isArray(storeOwners) && storeOwners.length > 0) {
                                subData = storeOwners.find(u => u.merchantRole === 'OWNER') || storeOwners[0];
                            } else if (merchantDataMap.byEmail[emailKey]) {
                                subData = merchantDataMap.byEmail[emailKey];
                            }
                            const displayEmail = subData.ownerEmail || store.merchantEmail || 'N/A';

                            return (
                                <div key={store.id} className="p-4 space-y-4 hover:bg-[var(--surface-2)] transition-colors">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-2xl overflow-hidden shrink-0 shadow-sm">
                                                {store.logoUrl ? <img src={store.logoUrl} alt="" className="w-full h-full object-cover" /> : <span>{store.logo || '🏪'}</span>}
                                            </div>
                                            <div>
                                                <div className="font-bold text-[var(--text-main)]">{store.name}</div>
                                                <div className="text-xs text-[var(--text-muted)]">{displayEmail}</div>
                                            </div>
                                        </div>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase
                                            ${store.status === 'active' ? 'bg-green-100 text-green-800 border border-green-200' :
                                            store.status === 'pending' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                                            'bg-red-100 text-red-800 border border-red-200'}`}>
                                            {(store.status || 'active').replace('_', ' ')}
                                        </span>
                                        {store.status === 'suspended' && store.statusReason && (
                                            <div className="mt-1 text-[10px] text-red-600 font-medium italic">
                                                {store.statusReason}
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-[var(--surface-2)]/50 p-2 rounded-lg border border-[var(--glass-border)]">
                                            <p className="text-[8px] uppercase font-bold text-[var(--text-muted)] mb-0.5">Tier</p>
                                            <p className="text-xs font-bold text-[var(--text-main)] capitalize">{subData.tier}</p>
                                        </div>
                                        <div className="bg-[var(--surface-2)]/50 p-2 rounded-lg border border-[var(--glass-border)]">
                                            <p className="text-[8px] uppercase font-bold text-[var(--text-muted)] mb-0.5">Products</p>
                                            <p className="text-xs font-bold text-[var(--text-main)]">{store.productCount || store.products?.length || 0}</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button onClick={() => handleEditClick(store)} className="flex-1 py-2 bg-[var(--surface-2)] text-[var(--text-main)] rounded-lg text-xs font-bold border border-[var(--glass-border)] hover:bg-[var(--surface-3)]">
                                            Manage Store
                                        </button>
                                        {store.status === 'pending' && (
                                            <button 
                                                onClick={async () => {
                                                    if (await confirm({ 
                                                        title: 'Approve Merchant?', 
                                                        message: `Are you sure you want to approve ${store.name}? This will activate their store in the marketplace.`,
                                                        confirmText: 'Approve & Activate',
                                                        type: 'success'
                                                    })) {
                                                        await updateStoreStatus(store.id, 'active');
                                                        await logEvent('STORE_APPROVE', {
                                                            storeId: store.id,
                                                            storeName: store.name,
                                                            merchantEmail: displayEmail
                                                        }, `stores/${store.id}`);
                                                        addNotification({
                                                            type: 'system',
                                                            title: 'Merchant Approved',
                                                            message: `${store.name} is now live.`
                                                        });
                                                    }
                                                }} 
                                                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-xs font-bold shadow-sm active:scale-95 transition-transform"
                                            >
                                                Approve
                                            </button>
                                        )}
                                        {store.status === 'active' && (
                                            <button 
                                                onClick={() => {
                                                    setStatusModalStore(store);
                                                    setStatusReason(SUSPENSION_REASONS[0]);
                                                    setIsStatusModalOpen(true);
                                                }} 
                                                className="flex-1 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-100 hover:bg-red-100"
                                            >
                                                Pause Store
                                            </button>
                                        )}
                                        {store.status === 'suspended' && (
                                            <button 
                                                onClick={async () => {
                                                    if (await confirm({ 
                                                        title: 'Resume Store?', 
                                                        message: `Are you sure you want to resume ${store.name}?`,
                                                        confirmText: 'Resume',
                                                        type: 'success'
                                                    })) {
                                                        await handleStatusUpdate(store.id, 'active');
                                                    }
                                                }} 
                                                className="flex-1 py-2 bg-green-50 text-green-600 rounded-lg text-xs font-bold border border-green-100 hover:bg-green-100"
                                            >
                                                Resume
                                            </button>
                                        )}
                                        {store.status === 'pending_deletion' && (() => {
                                            const approvedAt = store.deletionApprovedAt?.toDate?.() || (store.deletionApprovedAt?.seconds ? new Date(store.deletionApprovedAt.seconds * 1000) : null);
                                            const daysLeft = approvedAt ? Math.max(0, 30 - Math.floor((Date.now() - approvedAt.getTime()) / 86400000)) : 30;
                                            return (
                                                <div className="flex gap-2 w-full">
                                                    {!store.deletionApprovedAt && (
                                                        <button
                                                            onClick={async () => {
                                                                if (await confirm({
                                                                    title: 'Approve Deletion?',
                                                                    message: `This will start the 30-day countdown for ${store.name}.`,
                                                                    confirmText: 'Approve',
                                                                    type: 'danger'
                                                                })) {
                                                                    await approveDeleteStore(store.id);
                                                                    addNotification({ type: 'system', title: 'Deletion Approved', message: `${store.name} scheduled for deletion.` });
                                                                }
                                                            }}
                                                            className="flex-1 py-2 bg-red-600 text-white rounded-lg text-xs font-bold shadow-sm"
                                                        >
                                                            Approve
                                                        </button>
                                                    )}
                                                    {store.deletionApprovedAt && (
                                                        <button
                                                            onClick={async () => {
                                                                if (await confirm({
                                                                    title: 'Force Delete Now?',
                                                                    message: `This permanently deletes ${store.name} and all its data immediately. This cannot be undone.`,
                                                                    confirmText: 'Delete Now',
                                                                    type: 'danger'
                                                                })) {
                                                                    await forceDeleteStore(store.id);
                                                                    addNotification({ type: 'alert', title: 'Store Deleted', message: `${store.name} has been permanently deleted.` });
                                                                }
                                                            }}
                                                            className="flex-1 py-2 bg-red-700 text-white rounded-lg text-xs font-bold shadow-sm"
                                                        >
                                                            Force Delete
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={async () => {
                                                            if (await confirm({
                                                                title: 'Cancel Deletion?',
                                                                message: `Restore ${store.name}?`,
                                                                confirmText: 'Restore Store',
                                                                type: 'success'
                                                            })) {
                                                                await cancelStoreDeletion(store.id);
                                                                addNotification({ type: 'system', title: 'Deletion Cancelled', message: `${store.name} restored.` });
                                                            }
                                                        }}
                                                        className="flex-1 py-2 bg-orange-50 text-orange-600 rounded-lg text-xs font-bold border border-orange-100"
                                                    >
                                                        Cancel {store.deletionApprovedAt ? `(${daysLeft}d)` : ''}
                                                    </button>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Add Store Modal */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col h-[90vh] md:h-auto md:max-h-[90vh] animate-slide-up md:animate-fade-in">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">{editingStoreId ? 'Edit Store Details' : 'Add New Store'}</h2>
                                    <p className="text-xs text-gray-500 mt-0.5">{editingStoreId ? `Updating unique ID: ${editingStoreId}` : 'Register a new merchant manually'}</p>
                                </div>
                                <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-full text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all">✕</button>
                            </div>
                            
                            <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6">
                                {/* Section: Core Identity */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-2">Core Identity</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Store Public Name</label>
                                            <input
                                                type="text"
                                                required
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent outline-none transition-all"
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                placeholder="e.g. Green Valley Grocers"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Legal Business Name</label>
                                            <input
                                                type="text"
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent outline-none transition-all"
                                                value={formData.legalName}
                                                onChange={e => setFormData({ ...formData, legalName: e.target.value })}
                                                placeholder="e.g. 1234567 Ontario Inc."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Merchant Email</label>
                                            <input
                                                type="email"
                                                required
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent outline-none transition-all"
                                                value={formData.merchantEmail}
                                                onChange={e => setFormData({ ...formData, merchantEmail: e.target.value })}
                                                placeholder="merchant@example.com"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Store Type</label>
                                            <select
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] outline-none transition-all bg-white"
                                                value={formData.type}
                                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                                            >
                                                {Object.keys(BUSINESS_TYPES).sort().map(type => (
                                                    <option key={type} value={type}>{type}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Section: Registration & Location */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-2">Location & Registration</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Street Address</label>
                                            <input
                                                type="text"
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent outline-none transition-all"
                                                value={formData.address}
                                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                                placeholder="123 Shopping St"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">City</label>
                                            <input
                                                type="text"
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent outline-none transition-all"
                                                value={formData.city}
                                                onChange={e => setFormData({ ...formData, city: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Province</label>
                                            <select
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] outline-none bg-white"
                                                value={formData.province}
                                                onChange={e => setFormData({ ...formData, province: e.target.value })}
                                            >
                                                {['ON', 'BC', 'AB', 'QC', 'MB', 'NS', 'NB', 'SK', 'NL', 'PE'].map(p => (
                                                    <option key={p} value={p}>{p}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Postal Code</label>
                                            <input
                                                type="text"
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent outline-none transition-all"
                                                value={formData.postalCode}
                                                onChange={e => setFormData({ ...formData, postalCode: e.target.value })}
                                                placeholder="L5V 2H1"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Section: Legal & Compliance */}
                                {selectedStoreLegal && (
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-green-600 border-b border-green-50 pb-2 flex items-center gap-2">
                                            <span className="text-sm">⚖️</span> Legal & Compliance Evidence
                                        </h3>
                                        <div className="bg-green-50/30 p-4 rounded-xl border border-green-100/50 space-y-3">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold text-gray-400">Agreement Version</p>
                                                    <p className="text-sm font-bold text-gray-700">{selectedStoreLegal.agreementVersion || '1.0'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold text-gray-400">Accepted At</p>
                                                    <p className="text-sm font-bold text-gray-700">{selectedStoreLegal.acceptedAt?.replace('T', ' ').slice(0, 19)} UTC</p>
                                                </div>
                                            </div>
                                            <div>
                                                <button 
                                                    type="button"
                                                    onClick={() => setShowFullAgreement(!showFullAgreement)}
                                                    className="text-xs font-bold text-green-700 hover:underline flex items-center gap-1"
                                                >
                                                    {showFullAgreement ? 'Hide Agreement Text' : 'View Accepted Agreement Snapshot ↓'}
                                                </button>
                                                {showFullAgreement && (
                                                    <div className="mt-2 p-3 bg-white border border-green-100 rounded-lg text-[10px] text-gray-600 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed shadow-inner">
                                                        {selectedStoreLegal.agreementTextSnapshot || 'Snapshot not available.'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Section: Subscription Override */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-500 border-b border-blue-50 pb-2 flex items-center gap-2">
                                        <span className="text-sm">💳</span> Subscription Lifecycle
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4 bg-blue-50/30 p-4 rounded-xl border border-blue-100/50">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Subscription Tier</label>
                                            <select
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                                                value={formData.subscriptionTier}
                                                onChange={e => setFormData({ ...formData, subscriptionTier: e.target.value })}
                                            >
                                                <option value="free">Free Starter</option>
                                                <option value="core">Core Professional</option>
                                                <option value="growth">Growth Enterprise</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Billing Status</label>
                                            <select
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                                                value={formData.subscriptionStatus}
                                                onChange={e => setFormData({ ...formData, subscriptionStatus: e.target.value })}
                                            >
                                                <option value="active">Active</option>
                                                <option value="trialing">Trialing</option>
                                                <option value="past_due">Past Due / Error</option>
                                                <option value="inactive">Inactive</option>
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Expiration Date</label>
                                            <input
                                                type="date"
                                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                value={formData.subscriptionEnd}
                                                onChange={e => setFormData({ ...formData, subscriptionEnd: e.target.value })}
                                            />
                                            <p className="text-[10px] text-blue-600/70 mt-1 italic">Note: Manual changes will set the "Manual Override" flag on the merchant record.</p>
                                        </div>
                                    </div>
                                </div>

                                                {/* KYB Review Panel */}
                                                {editingStoreId && (() => {
                                                    const editingStore = stores[editingStoreId];
                                                    const docs: any[] = editingStore?.kybDocuments || [];
                                                    const kybSt: string = editingStore?.kybStatus || 'not_submitted';
                                                    const DOC_LABELS: Record<string, string> = {
                                                        business_license: 'Business License',
                                                        incorporation_certificate: 'Certificate of Incorporation',
                                                        other: 'Other'
                                                    };
                                                    return (
                                                        <div className="mt-2 p-4 rounded-xl border border-[var(--glass-border)] bg-[var(--surface-2)] space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <h4 className="text-sm font-bold text-[var(--text-main)]">KYB / Business Verification</h4>
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border
                                                                    ${kybSt === 'approved' ? 'bg-teal-100 text-teal-700 border-teal-200' :
                                                                    kybSt === 'pending_review' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                                                    kybSt === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' :
                                                                    'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                                                    {kybSt.replace(/_/g, ' ')}
                                                                </span>
                                                            </div>

                                                            {docs.length === 0 ? (
                                                                <p className="text-xs text-[var(--text-muted)] italic">No documents submitted yet.</p>
                                                            ) : (
                                                                <div className="space-y-2">
                                                                    {docs.map((d: any, i: number) => (
                                                                        <div key={i} className="flex items-center justify-between p-2 bg-white rounded-lg border border-[var(--glass-border)]">
                                                                            <div className="min-w-0">
                                                                                <p className="text-xs font-medium truncate">{d.filename}</p>
                                                                                <p className="text-[10px] text-[var(--text-muted)]">{DOC_LABELS[d.type] || d.type} · {new Date(d.uploadedAt).toLocaleDateString()}</p>
                                                                            </div>
                                                                            <a
                                                                                href={d.url}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="ml-2 text-[10px] font-bold text-blue-600 hover:text-blue-800 whitespace-nowrap"
                                                                            >
                                                                                View
                                                                            </a>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {docs.length > 0 && kybSt !== 'approved' && (
                                                                <div className="space-y-2">
                                                                    {kybRejectMode ? (
                                                                        <div className="space-y-2">
                                                                            <textarea
                                                                                value={kybReviewNote}
                                                                                onChange={e => setKybReviewNote(e.target.value)}
                                                                                placeholder="Explain what the merchant needs to fix..."
                                                                                rows={2}
                                                                                className="w-full text-xs border border-red-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                                                                            />
                                                                            <div className="flex gap-2">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleKybReview(editingStoreId, 'rejected')}
                                                                                    className="flex-1 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors"
                                                                                >
                                                                                    Confirm Rejection
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => { setKybRejectMode(false); setKybReviewNote(''); }}
                                                                                    className="py-1.5 px-3 border text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors"
                                                                                >
                                                                                    Cancel
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex gap-2">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleKybReview(editingStoreId, 'approved')}
                                                                                className="flex-1 py-1.5 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 transition-colors"
                                                                            >
                                                                                Approve
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setKybRejectMode(true)}
                                                                                className="flex-1 py-1.5 border border-red-300 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50 transition-colors"
                                                                            >
                                                                                Reject
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}

                                <div className="pt-4 flex gap-3 sticky bottom-0 bg-white border-t border-gray-100 pt-6">
                                    <button
                                        type="button"
                                        onClick={() => { setIsModalOpen(false); resetForm(); }}
                                        className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-3 bg-[var(--brand-primary)] text-white rounded-xl font-bold hover:brightness-110 shadow-lg shadow-[var(--brand-primary)]/20 transition-all active:scale-[0.98]"
                                    >
                                        {editingStoreId ? 'Save Changes' : 'Create Store'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
            {/* Status Change Modal */}
            {isStatusModalOpen && statusModalStore && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Pause Store</h2>
                                <p className="text-xs text-gray-500 mt-0.5">Suspend {statusModalStore.name} from the marketplace</p>
                            </div>
                            <button onClick={() => { setIsStatusModalOpen(false); setStatusModalStore(null); }} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Reason for Suspension</label>
                                <select 
                                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none bg-white"
                                    value={statusReason}
                                    onChange={(e) => setStatusReason(e.target.value)}
                                >
                                    {SUSPENSION_REASONS.map(r => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>

                            {statusReason === 'Other' && (
                                <div className="animate-fade-in">
                                    <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Custom Reason</label>
                                    <textarea 
                                        className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none min-h-[100px]"
                                        placeholder="Explain the specific reason for suspension..."
                                        value={customReason}
                                        onChange={(e) => setCustomReason(e.target.value)}
                                    />
                                </div>
                            )}

                            <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                <p className="text-xs text-red-700 leading-relaxed">
                                    <strong>Note:</strong> Pausing this store will hide it from all shopper searches and category lists immediately. The merchant will still be able to access their dashboard but cannot create new deals until resumed.
                                </p>
                            </div>
                        </div>

                        <div className="p-6 bg-gray-50 flex gap-3">
                            <button 
                                onClick={() => { setIsStatusModalOpen(false); setStatusModalStore(null); }}
                                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => handleStatusUpdate(statusModalStore.id, 'suspended', statusReason === 'Other' ? customReason : statusReason)}
                                disabled={statusReason === 'Other' && !customReason.trim()}
                                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95 disabled:opacity-50"
                            >
                                Suspend Store
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default StoreManagement;
