import React, { useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import '../../styles/design-system.css';
import { useAuth } from '../../context/AuthContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useNotifications } from '../../context/NotificationContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { BUSINESS_TYPES } from '../merchant/Settings';

const StoreManagement: React.FC = () => {
    const { user } = useAuth();
    const { stores, updateStore, updateStoreStatus, addStore, requestDeleteStore, approveDeleteStore } = useMarketplace();
    const { addNotification } = useNotifications();
    const { confirm } = useConfirmation();
    const storeList = Object.values(stores);

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
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
                    merchantRole: data.merchantRole
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

                await updateStore(editingStoreId, updateData);
                addNotification({ type: 'system', title: 'Store Updated', message: `${formData.name} updated successfully.` });
            } else {
                await addStore({
                    ...formData,
                    businessType: formData.type,
                    status: 'pending',
                    rating: 0,
                    products: [],
                    coordinates: finalCoordinates,
                    logo: `https://ui-avatars.com/api/?name=${formData.name}&background=random`
                });
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
        setIsModalOpen(true);
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

    return (
        <div className="space-y-6 animate-fade-in relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-main)]">Store Management</h1>
                    <p className="text-[var(--text-muted)] text-sm">Review merchant applications and manage existing stores</p>
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-lg text-sm font-medium hover:bg-[var(--surface-2)]">
                        Export List
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
            </div>

            {/* Main Table */}
            <div className="glass-panel overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left bg-[var(--surface-1)]">
                        <thead className="bg-[var(--surface-2)] text-[var(--text-muted)] text-xs uppercase">
                            <tr>
                                <th className="p-4">Store Name</th>
                                <th className="p-4">Merchant Email</th>
                                <th className="p-4">Products</th>
                                <th className="p-4">Subscription</th> {/* New Column */}
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
                                    // Subscription Data Lookup
                                    const emailKey = (store.merchantEmail || '').toLowerCase();

                                    // Handle array of owners
                                    const storeOwners = merchantDataMap.byStoreId[store.id];
                                    let subData: any = { tier: 'free', status: 'active' };

                                    if (Array.isArray(storeOwners) && storeOwners.length > 0) {
                                        // Find designated owner or fallback to first found user
                                        subData = storeOwners.find(u => u.merchantRole === 'OWNER') || storeOwners[0];
                                    } else if (merchantDataMap.byEmail[emailKey]) {
                                        subData = merchantDataMap.byEmail[emailKey];
                                    }

                                    const displayEmail = subData.ownerEmail || store.merchantEmail || 'N/A';

                                    return (
                                        <tr key={store.id} className="hover:bg-[var(--surface-2)] transition-colors group">
                                            <td className="p-4">
                                                <div className="font-bold text-[var(--text-main)]">{store.name}</div>
                                                <div className="text-xs text-[var(--text-muted)] md:hidden">ID: {store.id}</div>
                                            </td>
                                            <td className="p-4 text-sm text-[var(--text-main)]">
                                                <div className="flex flex-col gap-1 items-start">
                                                    <span>{displayEmail}</span>
                                                    {subData.ownerEmail && subData.ownerEmail !== store.merchantEmail && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-orange-600 bg-orange-50 px-1 rounded border border-orange-100">
                                                                Mismatch: {store.merchantEmail}
                                                            </span>
                                                            <button
                                                                onClick={() => handleSyncEmail(store.id, subData.ownerEmail)}
                                                                className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                                                                title="Sync Store data to match Owner data"
                                                            >
                                                                ↻ Sync
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-[var(--text-main)]">{store.productCount || store.products?.length || 0}</td>

                                            {/* Subscription Column */}
                                            <td className="p-4">
                                                {(() => {
                                                    const emailKey = (store.merchantEmail || '').toLowerCase();
                                                    // Handle array of owners
                                                    const storeOwners = merchantDataMap.byStoreId[store.id];
                                                    let subData: any = { tier: 'free', status: 'active' };

                                                    if (Array.isArray(storeOwners) && storeOwners.length > 0) {
                                                        subData = storeOwners.find(u => u.merchantRole === 'OWNER') || storeOwners[0];
                                                    } else if (merchantDataMap.byEmail[emailKey]) {
                                                        subData = merchantDataMap.byEmail[emailKey];
                                                    }

                                                    return (
                                                        <div className="flex flex-col gap-1">
                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded w-fit border capitalize
                                                            ${subData.tier === 'growth' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                                                    subData.tier === 'core' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                                        'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                                {subData.tier}
                                                            </span>
                                                            {subData.end && (
                                                                <span className="text-[10px] text-[var(--text-muted)]">
                                                                    Exp: {new Date(subData.end).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </td>

                                            <td className="p-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                                ${store.status === 'active' ? 'bg-green-100 text-green-800' :
                                                        store.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                                                            'bg-red-100 text-red-800'}`}>
                                                    {store.status === 'active' && <span className="mr-1">●</span>}
                                                    {store.status === 'pending' && <span className="mr-1">○</span>}
                                                    {store.status === 'suspended' && <span className="mr-1">✕</span>}
                                                    {store.status === 'pending_deletion' && <span className="mr-1">⚠️</span>}
                                                    {(store.status || 'active').replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                                </span>
                                            </td>
                                             <td className="p-4 text-right space-x-2">
                                                <button
                                                    onClick={() => handleEditClick(store)}
                                                    className="text-xs text-blue-600 hover:text-blue-800 font-bold px-2 py-1 bg-blue-50 rounded border border-blue-100 transition-colors"
                                                >
                                                    Edit
                                                </button>
                                                {store.status === 'pending' && (
                                                    <>
                                                        <button
                                                            onClick={() => updateStoreStatus(store.id, 'active')}
                                                            className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => updateStoreStatus(store.id, 'suspended')}
                                                            className="text-xs bg-[var(--surface-2)] hover:bg-red-50 text-red-600 px-3 py-1.5 rounded-lg transition-colors border border-[var(--glass-border)]"
                                                        >
                                                            Reject
                                                        </button>
                                                    </>
                                                )}
                                                {(store.status === 'active' || !store.status) && (
                                                    <button
                                                        onClick={() => updateStoreStatus(store.id, 'suspended')}
                                                        className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1"
                                                    >
                                                        Suspend
                                                    </button>
                                                )}
                                                {store.status === 'suspended' && (
                                                    <button
                                                        onClick={() => updateStoreStatus(store.id, 'active')}
                                                        className="text-xs text-green-500 hover:text-green-700 font-medium px-2 py-1"
                                                    >
                                                        Reactivate
                                                    </button>
                                                )}
                                                {store.status === 'pending_deletion' && (
                                                    <>
                                                        {store.deletionRequest?.requestedBy !== user?.id ? (
                                                            <button
                                                                onClick={async () => {
                                                                    const confirmed = await confirm({
                                                                        title: 'Approve Deletion',
                                                                        message: `Approve deletion for ${store.name}? This is final.`,
                                                                        confirmText: 'Approve & Delete',
                                                                        type: 'danger'
                                                                    });
                                                                    if (confirmed) approveDeleteStore(store.id);
                                                                }}
                                                                className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-bold"
                                                            >
                                                                Approve Deletion
                                                            </button>
                                                        ) : (
                                                            <span className="text-xs text-orange-600 font-medium bg-orange-50 border border-orange-100 px-2 py-1 rounded inline-block">
                                                                ⏳ Waiting for other admin
                                                            </span>
                                                        )}
                                                        <button
                                                            onClick={() => updateStoreStatus(store.id, 'active')}
                                                            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-300 px-2 py-1 rounded ml-1"
                                                        >
                                                            Reject
                                                        </button>
                                                    </>
                                                )}

                                                {store.status !== 'pending_deletion' && (
                                                    <button
                                                        onClick={async () => {
                                                            const confirmed = await confirm({
                                                                title: 'Request Deletion',
                                                                message: `Request deletion for ${store.name}? Another admin will need to approve this.`,
                                                                confirmText: 'Submit Request',
                                                                type: 'warning'
                                                            });

                                                            if (confirmed) {
                                                                try {
                                                                    await requestDeleteStore(store.id, user?.id || 'admin', 'admin');
                                                                    addNotification({
                                                                        type: 'system',
                                                                        title: 'Request Submitted',
                                                                        message: `Deletion request for ${store.name} submitted.`
                                                                    });
                                                                } catch (e) {
                                                                    addNotification({
                                                                        type: 'alert',
                                                                        title: 'Error',
                                                                        message: 'Failed to submit request.'
                                                                    });
                                                                }
                                                            }
                                                        }}
                                                        className="text-xs text-red-600 hover:text-red-800 font-medium px-3 py-1.5 ml-2 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                                                        title="Initiate Maker-Checker Deletion Workflow"
                                                    >
                                                        Request Delete
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Store Modal */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in shadow-2xl">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
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
        </div >
    );
};

export default StoreManagement;
