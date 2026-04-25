import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useOrders } from '../../context/OrderContext';
import { useAuth } from '../../context/AuthContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useNotifications, NotificationPreferences } from '../../context/NotificationContext';
import { useComparison } from '../../context/ComparisonContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import '../../styles/design-system.css';
import SEO from '../../components/SEO';

const Profile: React.FC = () => {
    const { profile, orders, updateProfile, addAddress, updateAddress, deleteAddress, setDefaultAddress, reorder, downloadOrderReceipt } = useOrders();
    const { items: wishlistItems, removeItem, clearComparison, addItem } = useComparison();
    const { stores } = useMarketplace();
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'account' | 'addresses' | 'orders' | 'wishlist'>(
        (location.state as any)?.activeTab || 'account'
    );

    // Update active tab when location state changes
    useEffect(() => {
        const state = location.state as any;
        if (state?.activeTab) {
            setActiveTab(state.activeTab);
        } else {
            setActiveTab('account');
        }
    }, [location.state]);
    const [editingProfile, setEditingProfile] = useState(false);
    const [showAddAddress, setShowAddAddress] = useState(false);
    const [newItemName, setNewItemName] = useState('');

    const handleAddWishlistItem = () => {
        if (!newItemName.trim()) return;
        addItem({
            id: `generic-${Date.now()}`,
            name: newItemName.trim(),
            image: `https://ui-avatars.com/api/?name=${newItemName.trim().charAt(0)}&background=random&length=1&size=128`,
            category: 'General'
        } as any);
        setNewItemName('');
    };

    // Push Notifications
    const { permissionStatus, requestPermission, disableNotifications } = usePushNotifications(user?.id);
    const { preferences, togglePreference, setPreference, addNotification } = useNotifications();
    const [isRequestingNotifications, setIsRequestingNotifications] = useState(false);
    
    const handleRequestNotifications = async () => {
        setIsRequestingNotifications(true);
        await requestPermission();
        setIsRequestingNotifications(false);
    };

    // Reorder Handlers
    const [reorderingId, setReorderingId] = useState<string | null>(null);

    const handleReorder = async (e: React.MouseEvent, orderId: string) => {
        e.preventDefault(); // Prevent navigating to OrderTracking
        setReorderingId(orderId);
        try {
            const messages = await reorder(orderId);
            if (messages.length > 0) {
                addNotification({
                    type: 'alert',
                    title: 'Partial Reorder',
                    message: "Some items could not be perfectly reordered:\n\n" + messages.join("\n")
                });
            }
            navigate('/cart');
        } catch (error: any) {
             addNotification({ type: 'alert', title: 'Reorder Failed', message: error.message });
        } finally {
            setReorderingId(null);
        }
    };

    const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);
    const handleDownloadReceipt = async (e: React.MouseEvent, orderId: string) => {
        e.preventDefault();
        setDownloadingReceiptId(orderId);
        try {
            await downloadOrderReceipt(orderId);
        } catch (error: any) {
            addNotification({ type: 'alert', title: 'Receipt Error', message: "Failed to generate receipt: " + error.message });
        } finally {
            setDownloadingReceiptId(null);
        }
    };

    // Form states
    const [formName, setFormName] = useState(profile.name);
    const [formEmail, setFormEmail] = useState(profile.email);
    const [formPhone, setFormPhone] = useState(profile.phone);

    // New address form
    const [newAddress, setNewAddress] = useState({ label: '', street: '', city: '', province: 'ON', postalCode: '', isDefault: false });
    const [isValidating, setIsValidating] = useState(false);
    const [validationError, setValidationError] = useState('');

    // Deletion flow state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== 'DELETE') return;
        setIsDeleting(true);
        setDeleteError('');
        try {
            const deleteFn = httpsCallable(functions, 'requestAccountDeletion');
            await deleteFn();
            await logout();
            navigate('/login', { replace: true });
        } catch (err: any) {
            console.error('Account deletion failed:', err);
            setDeleteError(err.message || 'Failed to delete account. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    // Sync profile data when it loads
    useEffect(() => {
        setFormName(profile.name);
        setFormEmail(profile.email);
        setFormPhone(profile.phone);
    }, [profile]);

    const handleSaveProfile = async () => {
        await updateProfile({ name: formName, email: formEmail, phone: formPhone });
        setEditingProfile(false);
    };

    const handleVerifyAddress = async (addrId: string) => {
        const addr = profile.addresses.find(a => a.id === addrId);
        if (!addr) return;

        setIsValidating(true);
        try {
            const query = `${addr.street}, ${addr.city}, ${addr.province}, ${addr.postalCode}, Canada`;
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1`);
            const data = await response.json();

            if (data && data.length > 0) {
                const result = data[0];
                await updateAddress(addrId, {
                    lat: parseFloat(result.lat),
                    lng: parseFloat(result.lon)
                });
            }
        } catch (e) {
            console.error("Verification error:", e);
        } finally {
            setIsValidating(false);
        }
    };

    const handleAddAddress = async () => {
        setValidationError('');
        if (!newAddress.street || !newAddress.city || !newAddress.postalCode) {
            setValidationError('Please fill in all address fields.');
            return;
        }

        setIsValidating(true);
        try {
            // Validate via Nominatim
            const query = `${newAddress.street}, ${newAddress.city}, ${newAddress.province}, ${newAddress.postalCode}, Canada`;
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1`);
            const data = await response.json();

            if (data && data.length > 0) {
                // Address found! Let's use the normalized data from Nominatim if possible
                const result = data[0];
                const addr = result.address;

                // Construct normalized address
                const validatedAddress = {
                    ...newAddress,
                    city: addr.city || addr.town || addr.village || newAddress.city,
                    postalCode: addr.postcode ? addr.postcode.toUpperCase() : newAddress.postalCode.toUpperCase(),
                    lat: parseFloat(result.lat),
                    lng: parseFloat(result.lon)
                };

                await addAddress(validatedAddress);
                setNewAddress({ label: '', street: '', city: '', province: 'ON', postalCode: '', isDefault: false });
                setShowAddAddress(false);
            } else {
                setValidationError('We couldn\'t verify this address. Please check for typos.');
            }
        } catch (e) {
            console.error("Validation error:", e);
            setValidationError('Connection error. Could not validate address.');
        } finally {
            setIsValidating(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'delivered': return 'bg-green-100 text-green-700';
            case 'out_for_delivery': return 'bg-blue-100 text-blue-700';
            case 'preparing': return 'bg-yellow-100 text-yellow-700';
            case 'placed': return 'bg-gray-100 text-gray-700';
            case 'cancelled': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const formatStatus = (status: string) => {
        return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    return (
        <div className="animate-fade-in pb-20">
            <SEO title="My Profile" description="Manage your Spendigo account, addresses, and order history." path="/profile" noIndex />
            {/* Header */}
            <div className="bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-secondary)] text-white p-6">
                <div className="max-w-3xl mx-auto flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl">
                        👤
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">{profile.name}</h1>
                        <p className="text-white/80 text-sm">{profile.email}</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-[var(--glass-border)] bg-white sticky top-[calc(4rem+var(--safe-area-top))] z-30">
                <div className="max-w-3xl mx-auto flex">
                    {(['account', 'addresses', 'orders', 'wishlist'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-4 text-sm font-medium capitalize transition-colors ${activeTab === tab ? 'text-[var(--brand-primary)] border-b-2 border-[var(--brand-primary)]' : 'text-[var(--text-muted)]'}`}
                        >
                            {tab === 'orders' ? 'Orders' : tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto p-4 min-h-[60vh]">
                {/* ACCOUNT TAB */}
                {activeTab === 'account' && (
                    <div className="bg-white rounded-xl border border-[var(--glass-border)] p-6 animate-fade-in">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-[var(--text-main)]">Account Information</h2>
                            {!editingProfile && (
                                <button onClick={() => setEditingProfile(true)} className="text-[var(--brand-primary)] text-sm font-medium">
                                    Edit Profile
                                </button>
                            )}
                        </div>

                        {/* IMPACT STATS */}
                        {!editingProfile && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl border border-blue-100 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Lifetime Savings</p>
                                        <p className="text-2xl font-black text-blue-800">${(orders.reduce((acc, o) => acc + (o.total * 0.12), 0)).toFixed(2)}</p>
                                        <p className="text-[10px] text-blue-600/80 mt-1 font-bold">Via SmartCart optimization</p>
                                    </div>
                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm text-blue-600">
                                        💰
                                    </div>
                                </div>

                                <div className="p-6 bg-gradient-to-br from-purple-50 to-fuchsia-50 rounded-3xl border border-purple-100 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-1">Neighborhood Impact</p>
                                        <p className="text-2xl font-black text-purple-800">${(orders.reduce((acc, o) => acc + o.total, 0)).toFixed(2)}</p>
                                        <p className="text-[10px] text-purple-600/80 mt-1 font-bold">Invested in local economy</p>
                                    </div>
                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm text-purple-600">
                                        🤝
                                    </div>
                                </div>
                            </div>
                        )}

                        {editingProfile ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Full Name</label>
                                    <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Email</label>
                                    <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Phone</label>
                                    <input type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)} className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg" />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button onClick={handleSaveProfile} className="flex-1 py-3 bg-[var(--brand-primary)] text-white font-medium rounded-lg">Save Changes</button>
                                    <button onClick={() => setEditingProfile(false)} className="flex-1 py-3 border border-[var(--glass-border)] rounded-lg text-[var(--text-muted)]">Cancel</button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex justify-between py-3 border-b border-[var(--glass-border)]">
                                    <span className="text-[var(--text-muted)]">Name</span>
                                    <span className="font-medium text-[var(--text-main)]">{profile.name}</span>
                                </div>
                                <div className="flex justify-between py-3 border-b border-[var(--glass-border)]">
                                    <span className="text-[var(--text-muted)]">Email</span>
                                    <span className="font-medium text-[var(--text-main)]">{profile.email}</span>
                                </div>
                                <div className="flex justify-between py-3">
                                    <span className="text-[var(--text-muted)]">Phone</span>
                                    <span className="font-medium text-[var(--text-main)]">{profile.phone}</span>
                                </div>
                            </div>
                        )}

                    {/* NOTIFICATIONS */}
                        <div className="mt-10 pt-6 border-t border-[var(--glass-border)]">
                            <h3 className="text-lg font-bold text-[var(--text-main)] mb-2 flex items-center gap-2">
                                <span>🔔</span> Push Notifications
                            </h3>
                            <p className="text-sm text-[var(--text-muted)] mb-4">
                                Receive alerts for order updates and price drops on your devices.
                            </p>
                            
                            <div className="flex flex-wrap gap-3">
                                {permissionStatus === 'granted' ? (
                                    <>
                                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-bold border border-green-200">
                                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                            Active on this device
                                        </div>
                                        <button
                                            onClick={async () => {
                                                setIsRequestingNotifications(true);
                                                await disableNotifications();
                                                setIsRequestingNotifications(false);
                                            }}
                                            disabled={isRequestingNotifications}
                                            className="px-6 py-2.5 bg-white text-red-600 font-bold text-sm rounded-xl border border-red-100 hover:bg-red-50 hover:border-red-200 transition-all disabled:opacity-50"
                                        >
                                            {isRequestingNotifications ? 'Working...' : 'Disable Notifications'}
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={handleRequestNotifications}
                                        disabled={isRequestingNotifications}
                                        className="px-6 py-2.5 bg-blue-50 text-[var(--brand-primary)] font-bold text-sm rounded-xl border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all disabled:opacity-50"
                                    >
                                        {isRequestingNotifications ? 'Enabling...' : 'Enable Push Notifications'}
                                    </button>
                                )}
                            </div>
                            
                            {permissionStatus === 'denied' && (
                                <p className="mt-3 text-xs text-red-500 font-medium bg-red-50 p-2 rounded-lg border border-red-100">
                                    ⚠️ Notifications are blocked by your browser. Please enable them in your browser settings to receive updates.
                                </p>
                            )}
                        </div>

                        {/* COMMUNICATION PREFERENCES */}
                        <div className="mt-10 pt-6 border-t border-[var(--glass-border)]">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-lg font-bold text-[var(--text-main)] mb-1">Alert Preferences</h3>
                                    <p className="text-sm text-[var(--text-muted)]">Configure which real-time alerts you receive.</p>
                                </div>
                                <div className={`px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase border-2 flex items-center gap-1.5 ${permissionStatus === 'granted' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                                    <span className={`w-2 h-2 rounded-full ${permissionStatus === 'granted' ? 'bg-blue-600 animate-ping' : 'bg-gray-300'}`}></span>
                                    {permissionStatus === 'granted' ? 'Real-time Linked' : 'Offline Mode'}
                                </div>
                            </div>

                            <div className="space-y-3">
                                {[
                                    { id: 'priceDrop', icon: '📉', label: 'Price Alerts', desc: 'When items in your wishlist or cart drop in price.' },
                                    { id: 'orderUpdates', icon: '📦', label: 'Order Tracking', desc: 'Real-time updates on status, cooking, and delivery.' },
                                    { id: 'promotions', icon: '✨', label: 'Exclusives', desc: 'Personalized marketplace deals and local offers.' },
                                    { id: 'newArrivals', icon: '🚚', label: 'Merchant Drops', desc: 'Notify me when my favorite shops add new inventory.' }
                                ].map(item => (
                                    <div 
                                        key={item.id} 
                                        className="flex items-center justify-between p-4 bg-gray-50/50 border border-gray-100 rounded-2xl group hover:border-blue-200 hover:bg-white transition-all cursor-pointer"
                                        onClick={() => togglePreference(item.id as any)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                                                {item.icon}
                                            </div>
                                            <div>
                                                <p className="font-bold text-[var(--text-main)] text-sm">{item.label}</p>
                                                <p className="text-[10px] text-[var(--text-muted)] tracking-tight">{item.desc}</p>
                                            </div>
                                        </div>
                                        <div className={`w-12 h-6 rounded-full transition-colors relative ${preferences[item.id as keyof NotificationPreferences] ? 'bg-blue-600' : 'bg-gray-200'}`}>
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${preferences[item.id as keyof NotificationPreferences] ? 'left-7 shadow-[-2px_0_4px_rgba(0,0,0,0.1)]' : 'left-1'}`}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Alert Radius Selector */}
                            <div className="mt-8 p-5 bg-white border-2 border-dashed border-gray-100 rounded-[2rem]">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl shadow-sm">
                                            📍
                                        </div>
                                        <div>
                                            <p className="font-black text-gray-900 text-sm tracking-tight">Proximity Alerts</p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Radius from default address</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center bg-gray-50 rounded-full p-1.5 border border-gray-100 shadow-inner">
                                        {[5, 10, 20, 50].map(dist => (
                                            <button
                                                key={dist}
                                                onClick={() => setPreference('maxDistance', dist)}
                                                className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${preferences.maxDistance === dist ? 'bg-white shadow-md text-blue-600 scale-105' : 'text-gray-400 hover:text-gray-600'}`}
                                            >
                                                {dist}KM
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 p-4 bg-blue-50/30 rounded-2xl border border-blue-100/50">
                                <p className="text-[10px] text-blue-700 font-medium leading-relaxed italic text-center">
                                    "Spendigo Real-time Alerts use high-performance FCM streams for millisecond-latency order tracking."
                                </p>
                            </div>
                        </div>



                        {/* DANGER ZONE */}
                        <div className="mt-10 pt-6 border-t-2 border-red-200">
                            <h3 className="text-lg font-bold text-red-600 mb-2 flex items-center gap-2">
                                <span>⚠️</span> Danger Zone
                            </h3>
                            <p className="text-sm text-[var(--text-muted)] mb-4">
                                Permanently delete your account and all associated data. This action cannot be undone.
                            </p>
                            <button
                                onClick={() => setShowDeleteModal(true)}
                                className="px-6 py-3 bg-red-50 text-red-600 font-bold text-sm rounded-xl border-2 border-red-200 hover:bg-red-100 hover:border-red-400 transition-all"
                            >
                                🗑️ Delete My Account
                            </button>
                        </div>
                    </div>
                )}

                {/* DELETE ACCOUNT MODAL */}
                {showDeleteModal && (
                    <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !isDeleting && setShowDeleteModal(false)}>
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
                            <div className="text-center mb-6">
                                <div className="text-5xl mb-3">🚨</div>
                                <h3 className="text-xl font-bold text-[var(--text-main)] mb-2">Delete Your Account?</h3>
                                <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                                    This will <strong>permanently</strong> erase your profile, addresses, and login credentials.
                                    Your order history will be anonymized for merchant accounting purposes.
                                </p>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-bold text-[var(--text-main)] mb-2">
                                    Type <span className="text-red-600 font-mono bg-red-50 px-2 py-0.5 rounded">DELETE</span> to confirm:
                                </label>
                                <input
                                    type="text"
                                    value={deleteConfirmText}
                                    onChange={e => setDeleteConfirmText(e.target.value)}
                                    placeholder="Type DELETE"
                                    className="w-full px-4 py-3 border-2 border-red-200 rounded-xl font-mono text-center text-lg focus:border-red-500 focus:ring-4 focus:ring-red-100 outline-none transition-all"
                                    disabled={isDeleting}
                                    autoFocus
                                />
                            </div>

                            {deleteError && (
                                <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3 mb-4 font-medium">
                                    ⚠️ {deleteError}
                                </p>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); setDeleteError(''); }}
                                    disabled={isDeleting}
                                    className="flex-1 py-3 border border-[var(--glass-border)] rounded-xl font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteAccount}
                                    disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                                    className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isDeleting ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                            Deleting...
                                        </>
                                    ) : 'Permanently Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ADDRESSES TAB */}
                {activeTab === 'addresses' && (
                    <div className="space-y-4 animate-fade-in">
                        {profile.addresses.map(addr => (
                            <div key={addr.id} className={`bg-white rounded-xl border p-4 ${addr.isDefault ? 'border-[var(--brand-primary)]' : 'border-[var(--glass-border)]'}`}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-[var(--text-main)]">{addr.label}</span>
                                            {addr.isDefault && <span className="text-xs bg-[var(--brand-primary)] text-white px-2 py-0.5 rounded shadow-sm">Default</span>}
                                            {addr.lat && addr.lng ? (
                                                <span className="text-[8px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full border border-green-100 font-black uppercase tracking-tighter decoration-dotted flex items-center gap-1">
                                                    <span className="w-1 h-1 bg-green-500 rounded-full"></span>
                                                    Proximity Ready
                                                </span>
                                            ) : (
                                                <button 
                                                    onClick={() => handleVerifyAddress(addr.id)}
                                                    className="text-[8px] bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded-full border border-yellow-200 font-black uppercase tracking-tighter hover:bg-yellow-100 transition-colors flex items-center gap-1"
                                                >
                                                    <span className="w-1 h-1 bg-yellow-500 rounded-full animate-pulse"></span>
                                                    Sync Location
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-sm text-[var(--text-muted)]">{addr.street}</p>
                                        <p className="text-sm text-[var(--text-muted)]">{addr.city}, {addr.province} {addr.postalCode}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {!addr.isDefault && (
                                            <button onClick={() => setDefaultAddress(addr.id)} className="text-xs text-[var(--brand-primary)]">Set Default</button>
                                        )}
                                        <button onClick={() => deleteAddress(addr.id)} className="text-xs text-red-500">Delete</button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {showAddAddress ? (
                            <div className="bg-white rounded-xl border border-[var(--glass-border)] p-4 space-y-3">
                                <input type="text" placeholder="Label (e.g., Home, Work)" value={newAddress.label} onChange={e => setNewAddress({ ...newAddress, label: e.target.value })} className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg outline-none focus:border-[var(--brand-primary)]" />
                                <input type="text" placeholder="Street Address" value={newAddress.street} onChange={e => setNewAddress({ ...newAddress, street: e.target.value })} className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg outline-none focus:border-[var(--brand-primary)]" />
                                <div className="grid grid-cols-2 gap-3">
                                    <input type="text" placeholder="City" value={newAddress.city} onChange={e => setNewAddress({ ...newAddress, city: e.target.value })} className="px-4 py-3 border border-[var(--glass-border)] rounded-lg outline-none focus:border-[var(--brand-primary)]" />
                                    <select
                                        value={newAddress.province}
                                        onChange={e => setNewAddress({ ...newAddress, province: e.target.value })}
                                        className="px-4 py-3 border border-[var(--glass-border)] rounded-lg outline-none focus:border-[var(--brand-primary)] bg-white"
                                    >
                                        <option value="ON">Ontario</option>
                                        <option value="QC">Quebec</option>
                                        <option value="BC">British Columbia</option>
                                        <option value="AB">Alberta</option>
                                        <option value="MB">Manitoba</option>
                                        <option value="SK">Saskatchewan</option>
                                        <option value="NS">Nova Scotia</option>
                                        <option value="NB">New Brunswick</option>
                                        <option value="PE">PEI</option>
                                        <option value="NL">Newfoundland</option>
                                    </select>
                                </div>
                                <input type="text" placeholder="Postal Code (e.g. M5V 2H1)" value={newAddress.postalCode} onChange={e => setNewAddress({ ...newAddress, postalCode: e.target.value })} className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg outline-none focus:border-[var(--brand-primary)]" />

                                {validationError && (
                                    <p className="text-xs text-red-500 font-medium px-1 flex items-center gap-1">
                                        <span>⚠️</span> {validationError}
                                    </p>
                                )}

                                <div className="flex gap-3">
                                    <button
                                        onClick={handleAddAddress}
                                        disabled={isValidating}
                                        className="flex-1 py-3 bg-[var(--brand-primary)] text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isValidating ? (
                                            <>
                                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                                Validating...
                                            </>
                                        ) : 'Add Address'}
                                    </button>
                                    <button
                                        onClick={() => { setShowAddAddress(false); setValidationError(''); }}
                                        disabled={isValidating}
                                        className="flex-1 py-3 border border-[var(--glass-border)] rounded-lg disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => setShowAddAddress(true)} className="w-full py-4 border-2 border-dashed border-[var(--glass-border)] rounded-xl text-[var(--text-muted)] hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-colors">
                                + Add New Address
                            </button>
                        )}
                    </div>
                )}

                {/* ORDERS TAB */}
                {activeTab === 'orders' && (
                    <div className="space-y-4 animate-fade-in min-w-0 overflow-hidden">
                        {orders.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-4xl mb-4">📦</p>
                                <p className="text-[var(--text-muted)]">No orders yet</p>
                                <Link to="/" className="text-[var(--brand-primary)] text-sm font-medium">Start Shopping</Link>
                            </div>
                        ) : (
                            orders.map(order => (
                                <Link key={order.id} to={`/order/${order.id}`} className="block bg-white rounded-xl border border-[var(--glass-border)] p-4 hover:shadow-md transition-shadow">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <span className="font-bold text-[var(--text-main)]">{order.id}</span>
                                            <span className="text-sm text-[var(--text-muted)] ml-2">
                                                {new Date(order.date).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(order.status)}`}>
                                            {formatStatus(order.status)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="flex -space-x-2">
                                            {order.items.slice(0, 3).map((item, i) => (
                                                <img key={i} src={item.image} alt="" className="w-10 h-10 rounded-lg border-2 border-white object-cover" />
                                            ))}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm text-[var(--text-main)]">{order.storeName}</p>
                                            <p className="text-xs text-[var(--text-muted)]">{order.items.length} item{order.items.length > 1 ? 's' : ''}</p>
                                        </div>
                                        <p className="font-bold text-[var(--text-main)]">${order.total.toFixed(2)}</p>
                                    </div>
                                    <div className="mt-2 pt-3 border-t border-[var(--glass-border)] flex justify-end gap-2">
                                        <button
                                            onClick={(e) => handleDownloadReceipt(e, order.id)}
                                            disabled={downloadingReceiptId === order.id}
                                            className="px-4 py-2 bg-[var(--surface-3)] text-[var(--text-muted)] text-sm font-bold rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors flex items-center gap-1"
                                        >
                                            {downloadingReceiptId === order.id ? '...' : <span>📄 Receipt</span>}
                                        </button>
                                        <button
                                            onClick={(e) => handleReorder(e, order.id)}
                                            disabled={reorderingId === order.id}
                                            className="px-4 py-2 bg-[var(--surface-3)] text-[var(--brand-primary)] text-sm font-bold rounded-lg hover:bg-[var(--brand-primary)] hover:text-white disabled:opacity-50 transition-colors"
                                        >
                                            {reorderingId === order.id ? 'Reordering...' : 'Reorder'}
                                        </button>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                )}

                {/* WISHLIST TAB */}
                {activeTab === 'wishlist' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-[var(--text-main)]">My Wishlist</h2>
                            {wishlistItems.length > 0 && (
                                <button onClick={clearComparison} className="text-xs text-red-500 font-bold">Clear All</button>
                            )}
                        </div>
                        
                        {wishlistItems.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-xl border border-[var(--glass-border)] mb-4 px-4">
                                <p className="text-4xl mb-4">✨</p>
                                <p className="text-[var(--text-main)] font-bold text-lg mb-1">Your wishlist is empty</p>
                                <p className="text-[var(--text-muted)] text-sm">Type keywords or product names below to start building your list.</p>
                            </div>
                        ) : null}

                        <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
                            <input 
                                type="text"
                                placeholder="Add an item (e.g. 'Milk')"
                                value={newItemName}
                                onChange={e => setNewItemName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddWishlistItem()}
                                className="w-full sm:flex-1 px-4 py-3 border border-[var(--glass-border)] rounded-xl outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 text-sm font-medium"
                            />
                            <button 
                                onClick={handleAddWishlistItem}
                                disabled={!newItemName.trim()}
                                className="w-full sm:w-auto px-6 py-3 bg-[var(--brand-primary)] text-white font-bold rounded-xl disabled:opacity-50 transition-all hover:bg-[var(--brand-primary)]/90"
                            >
                                Add Item
                            </button>
                        </div>
                        
                        {wishlistItems.length > 0 && (
                            <div className="grid grid-cols-1 gap-3">
                                {wishlistItems.map((item, i) => (
                                    <div key={i} className="bg-white rounded-xl border border-[var(--glass-border)] p-4 flex items-center gap-4 group">
                                        <div className="w-16 h-16 rounded-lg bg-[var(--surface-1)] flex-shrink-0 overflow-hidden">
                                            {item.image ? (
                                                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-[var(--text-main)] leading-tight">{item.name}</h3>
                                            <p className="text-xs text-[var(--text-muted)]">{item.category || 'Local Merchant'}</p>
                                            <div className="mt-2 flex items-center gap-2">
                                                <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">Price Alert Active</span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => removeItem(item.id)}
                                            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                                <button 
                                    onClick={() => navigate('/compare')}
                                    className="w-full py-4 mt-2 bg-[var(--brand-primary)] text-white font-black rounded-2xl shadow-xl shadow-[var(--brand-primary)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                >
                                    ⚖️ Compare Prices
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Profile;
