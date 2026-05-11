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
import { EmptyState } from '../../components/ui/EmptyState';
import ThemeSwitcher from '../../components/ThemeSwitcher';

const Profile: React.FC = () => {
    const { profile, orders, updateProfile, addAddress, updateAddress, deleteAddress, setDefaultAddress, reorder, downloadOrderReceipt } = useOrders();
    const { items: wishlistItems, removeItem, clearComparison, addItem } = useComparison();
    const { stores } = useMarketplace();
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'account' | 'orders' | 'wishlist' | 'settings' | 'support'>(
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
        try {
            await requestPermission();
        } catch {
            // errors are logged inside requestPermission
        } finally {
            setIsRequestingNotifications(false);
        }
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
            case 'delivered': 
                return 'bg-emerald-600 text-white border border-emerald-600 shadow-sm';
            case 'preparing': 
                return 'bg-amber-50 text-amber-600 border border-amber-100';
            case 'out_for_delivery': 
                return 'bg-[#EBF5FF] text-[#007AFF] border border-blue-100';
            case 'placed': 
                return 'bg-gray-50 text-gray-500 border border-gray-100';
            case 'cancelled': 
                return 'bg-red-600 text-white border border-red-600 shadow-sm';
            default: 
                return 'bg-blue-50 text-blue-600 border border-blue-100';
        }
    };

    const formatStatus = (status: string) => {
        return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    return (
        <div className="bg-[var(--surface-0)] min-h-screen animate-fade-in pb-20">
            <SEO title="My Profile" description="Manage your Spendigo account, addresses, and order history." path="/profile" noIndex />
            
            {/* Premium Hero Section */}
            <section className="relative overflow-hidden pt-12 pb-16 md:pt-16 md:pb-20 px-6">
                {/* Background Decorative Elements */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,var(--brand-primary-light),transparent_70%)]" />
                    <div className="absolute top-1/4 -right-20 w-64 h-64 md:w-96 md:h-96 bg-blue-100/30 rounded-full blur-[100px] opacity-60 animate-pulse" />
                    <div className="absolute bottom-0 -left-20 w-64 h-64 md:w-96 md:h-96 bg-purple-100/30 rounded-full blur-[100px] opacity-60 animate-pulse" style={{ animationDelay: '2s' }} />
                </div>

                <div className="max-w-4xl mx-auto relative z-10">
                    <div className="flex items-center gap-6">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-light)] rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                            <div className="w-20 h-20 md:w-28 md:h-28 rounded-full bg-white flex items-center justify-center text-3xl md:text-5xl shadow-2xl relative border-4 border-white/10 overflow-hidden">
                                {user?.avatar ? (
                                    <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="font-black text-[var(--brand-navy)]">{(user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase()}</span>
                                )}
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-[9px] font-black bg-[var(--brand-primary)] text-white px-2 py-0.5 rounded tracking-widest uppercase shadow-lg">Premium Member</span>
                                <span className="text-[9px] font-black bg-white shadow-sm text-[var(--text-muted)] px-2 py-0.5 rounded border border-gray-100 tracking-widest uppercase">Since 2024</span>
                            </div>
                            <h1 className="text-3xl md:text-5xl font-black text-[var(--brand-navy)] tracking-tighter leading-none italic capitalize">
                                {user?.name?.toLowerCase() || 'Spendigo Shopper'}
                            </h1>
                            <p className="text-sm font-bold text-[var(--text-muted)] tracking-widest mt-2">{user?.email}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Tabs */}
            <div className="max-w-4xl mx-auto px-6 -mt-8 relative z-20">
                <div className="bg-white rounded-3xl p-1 md:p-2 shadow-2xl border border-gray-100 flex gap-1">
                    {[
                        { id: 'account', label: 'Profile', icon: '👤' },
                        { id: 'orders', label: 'History', icon: '📦' },
                        { id: 'wishlist', label: 'Wishlist', icon: '✨' },
                        { id: 'settings', label: 'Preferences', icon: '⚙️' }
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id as any)}
                            className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex flex-col items-center gap-1 ${activeTab === t.id
                                ? 'bg-[var(--brand-navy)] text-white shadow-lg'
                                : 'text-[var(--text-muted)] hover:bg-gray-50'}`}
                        >
                            <span className="text-xl">{t.icon}</span>
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto p-4 min-h-[60vh]">
                {/* ACCOUNT TAB */}
                {activeTab === 'account' && (
                    <div className="glass-panel-premium rounded-[2.5rem] p-6 md:p-10 animate-fade-in border border-[var(--glass-border)] bg-[var(--glass-bg)]">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-black text-[var(--text-main)] tracking-tight italic">Account Overview</h2>
                            {!editingProfile && (
                                <button onClick={() => setEditingProfile(true)} className="px-4 py-2 rounded-xl bg-blue-50 text-[#007AFF] text-[10px] font-black uppercase tracking-widest hover:bg-[#007AFF] hover:text-white transition-all">
                                    Edit Profile
                                </button>
                            )}
                        </div>

                        {/* IMPACT STATS */}
                        {!editingProfile && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
                                <div className="p-6 bg-gradient-to-br from-emerald-50 to-white rounded-3xl border-2 border-emerald-300 flex items-center justify-between group hover:scale-[1.02] transition-all">
                                    <div>
                                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-1">Lifetime Savings</p>
                                        <p className="text-3xl font-black text-[#112244] tracking-tighter italic">${(orders.reduce((acc, o) => acc + (o.total * 0.12), 0)).toFixed(2)}</p>
                                        <p className="text-[10px] font-bold text-emerald-600/60 mt-1 uppercase tracking-tight">SmartCart Protocol Optimized</p>
                                    </div>
                                    <div className="w-12 h-12 bg-white rounded-[1rem] flex items-center justify-center text-2xl shadow-sm border border-emerald-50 group-hover:rotate-12 transition-transform">
                                        💰
                                    </div>
                                </div>

                                <div className="p-6 bg-gradient-to-br from-indigo-50 to-white rounded-3xl border-2 border-indigo-300 flex items-center justify-between group hover:scale-[1.02] transition-all">
                                    <div>
                                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-1">Neighbourhood Impact</p>
                                        <p className="text-3xl font-black text-[#112244] tracking-tighter italic">${(orders.reduce((acc, o) => acc + o.total, 0)).toFixed(2)}</p>
                                        <p className="text-[10px] font-bold text-indigo-600/60 mt-1 uppercase tracking-tight">Invested in Local Economy</p>
                                    </div>
                                    <div className="w-12 h-12 bg-white rounded-[1rem] flex items-center justify-center text-2xl shadow-sm border border-indigo-50 group-hover:-rotate-12 transition-transform">
                                        🤝
                                    </div>
                                </div>
                            </div>
                        )}

                        {editingProfile ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Full Name</label>
                                    <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Email</label>
                                    <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Phone</label>
                                    <input type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)} className="w-full px-4 py-3 border border-[var(--glass-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent transition-colors" />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button onClick={handleSaveProfile} className="btn-primary flex-1 py-3">Save Changes</button>
                                    <button onClick={() => setEditingProfile(false)} className="flex-1 py-3 border border-[var(--glass-border)] rounded-full text-[var(--text-muted)] text-sm font-medium hover:bg-[var(--surface-2)] transition-colors">Cancel</button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex justify-between py-3 border-b border-[var(--glass-border)]">
                                    <span className="text-[var(--text-muted)]">Name</span>
                                    <span className="font-medium text-[var(--text-main)] capitalize">{profile.name?.toLowerCase()}</span>
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

                        {/* ADDRESSES SECTION */}
                        <div className="mt-10 pt-8 border-t border-[var(--glass-border)]">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-[var(--text-main)] italic flex items-center gap-2">
                                    <span>📍</span> Saved Addresses
                                </h3>
                                {!showAddAddress && (
                                    <button onClick={() => setShowAddAddress(true)} className="text-[10px] font-black uppercase tracking-widest text-[#007AFF] bg-blue-50 px-4 py-2 rounded-xl hover:bg-[#007AFF] hover:text-white transition-all">
                                        + Add New
                                    </button>
                                )}
                            </div>

                            <div className="space-y-4">
                                {profile.addresses.map(addr => (
                                    <div key={addr.id} className={`glass-panel rounded-2xl p-5 border border-[var(--glass-border)] bg-[var(--surface-0)] hover:bg-[var(--surface-1)] transition-all group ${addr.isDefault ? 'ring-1 ring-[#007AFF]' : ''}`}>
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${addr.isDefault ? 'bg-[#112244] text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                        {addr.label.toLowerCase().includes('home') ? '🏠' : addr.label.toLowerCase().includes('work') ? '🏢' : '📍'}
                                                    </div>
                                                    <span className="text-xs font-black uppercase tracking-widest text-[#112244] italic">{addr.label}</span>
                                                    {addr.isDefault && <span className="text-[8px] font-black uppercase tracking-widest text-[#007AFF] bg-blue-50 px-2 py-0.5 rounded">Default</span>}
                                                    {addr.lat && addr.lng ? (
                                                        <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                                                            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                                            GPS Verified
                                                        </span>
                                                    ) : (
                                                        <button 
                                                            onClick={() => handleVerifyAddress(addr.id)} 
                                                            disabled={isValidating}
                                                            className="text-[8px] font-black uppercase tracking-widest text-[#007AFF] bg-blue-50 px-2 py-0.5 rounded border border-blue-100 hover:bg-[#007AFF] hover:text-white transition-all disabled:opacity-50"
                                                        >
                                                            {isValidating ? 'Verifying...' : 'Verify GPS'}
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-sm font-bold text-[var(--text-main)]">{addr.street}</p>
                                                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-tight">{addr.city}, {addr.province} {addr.postalCode}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {!addr.isDefault && (
                                                    <button onClick={() => setDefaultAddress(addr.id)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-blue-50 hover:text-[#007AFF] transition-all" title="Set as Default">★</button>
                                                )}
                                                <button onClick={() => deleteAddress(addr.id)} className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all">✕</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {showAddAddress && (
                                    <div className="bg-[var(--surface-1)] rounded-2xl border border-[var(--glass-border)] p-5 space-y-4 animate-fade-in">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <input type="text" placeholder="Label (e.g., Home)" value={newAddress.label} onChange={e => setNewAddress({ ...newAddress, label: e.target.value })} className="w-full px-4 py-3 bg-white border border-[var(--glass-border)] rounded-xl text-sm outline-none focus:border-[var(--brand-primary)]" />
                                            <input type="text" placeholder="Street Address" value={newAddress.street} onChange={e => setNewAddress({ ...newAddress, street: e.target.value })} className="w-full px-4 py-3 bg-white border border-[var(--glass-border)] rounded-xl text-sm outline-none focus:border-[var(--brand-primary)]" />
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            <input type="text" placeholder="City" value={newAddress.city} onChange={e => setNewAddress({ ...newAddress, city: e.target.value })} className="w-full px-4 py-3 bg-white border border-[var(--glass-border)] rounded-xl text-sm outline-none focus:border-[var(--brand-primary)]" />
                                            <select
                                                value={newAddress.province}
                                                onChange={e => setNewAddress({ ...newAddress, province: e.target.value })}
                                                className="w-full px-4 py-3 bg-white border border-[var(--glass-border)] rounded-xl text-sm outline-none focus:border-[var(--brand-primary)]"
                                            >
                                                <option value="ON">Ontario</option>
                                                <option value="QC">Quebec</option>
                                                <option value="BC">BC</option>
                                                <option value="AB">Alberta</option>
                                            </select>
                                            <input type="text" placeholder="Postal Code" value={newAddress.postalCode} onChange={e => setNewAddress({ ...newAddress, postalCode: e.target.value })} className="w-full px-4 py-3 bg-white border border-[var(--glass-border)] rounded-xl text-sm outline-none focus:border-[var(--brand-primary)]" />
                                        </div>

                                        {validationError && <p className="text-[10px] text-red-500 font-bold uppercase px-1">⚠️ {validationError}</p>}

                                        <div className="flex gap-3">
                                            <button onClick={handleAddAddress} disabled={isValidating} className="btn-primary flex-1 py-3 text-[10px]">{isValidating ? 'Verifying...' : 'Save Address'}</button>
                                            <button onClick={() => { setShowAddAddress(false); setValidationError(''); }} className="flex-1 py-3 border border-[var(--glass-border)] rounded-full text-[10px] font-black uppercase">Cancel</button>
                                        </div>
                                    </div>
                                )}

                                {!showAddAddress && profile.addresses.length === 0 && (
                                    <div className="text-center py-10 border-2 border-dashed border-[var(--glass-border)] rounded-3xl">
                                        <p className="text-sm text-[var(--text-muted)] font-medium">No addresses saved yet.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* PREFERENCES TAB */}
                {activeTab === 'settings' && (
                    <div className="glass-panel-premium rounded-[2.5rem] p-6 md:p-10 animate-fade-in border border-[var(--glass-border)] bg-[var(--glass-bg)]">
                        <div className="mb-8">
                            <h2 className="text-xl font-black text-[var(--text-main)] tracking-tight italic">Preferences & Settings</h2>
                            <p className="text-sm text-[var(--text-muted)] mt-1">Manage your app experience and security.</p>
                        </div>

                        {/* NOTIFICATIONS */}
                        <div className="pt-6">
                            <h3 className="text-lg font-bold text-[var(--text-main)] mb-2 flex items-center gap-2">
                                <span>🔔</span> Push Notifications
                            </h3>
                            <p className="text-sm text-[var(--text-muted)] mb-4">
                                Receive alerts for order updates and price drops on your devices.
                            </p>
                            
                            <div className="flex flex-wrap gap-3">
                                {permissionStatus === 'granted' ? (
                                    <>
                                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-700 rounded-lg text-sm font-bold border border-green-500/30">
                                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                            Active on this device
                                        </div>
                                        <button
                                            onClick={async () => {
                                                setIsRequestingNotifications(true);
                                                try {
                                                    await disableNotifications();
                                                } catch {
                                                    // errors are logged inside disableNotifications
                                                } finally {
                                                    setIsRequestingNotifications(false);
                                                }
                                            }}
                                            disabled={isRequestingNotifications}
                                            className="px-6 py-2.5 bg-[var(--surface-1)] text-red-600 font-bold text-sm rounded-xl border border-red-500/20 hover:bg-red-500/10 hover:border-red-500/30 transition-all disabled:opacity-50"
                                        >
                                            {isRequestingNotifications ? 'Working...' : 'Disable Notifications'}
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={handleRequestNotifications}
                                        disabled={isRequestingNotifications}
                                        className="px-6 py-2.5 bg-[var(--surface-2)] text-[var(--brand-primary)] font-bold text-sm rounded-xl border border-[var(--glass-border)] hover:bg-blue-100 hover:border-[var(--brand-primary)] transition-all disabled:opacity-50"
                                    >
                                        {isRequestingNotifications ? 'Enabling...' : 'Enable Push Notifications'}
                                    </button>
                                )}
                            </div>
                            
                            {permissionStatus === 'denied' && (
                                <p className="mt-3 text-xs text-red-500 font-medium bg-red-500/10 p-2 rounded-lg border border-red-500/20">
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
                                <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${permissionStatus === 'granted' ? 'badge-best' : 'badge-info'}`}>
                                    <span className={`w-2 h-2 rounded-full bg-[var(--surface-1)] ${permissionStatus === 'granted' ? 'animate-pulse' : 'opacity-60'}`}></span>
                                    {permissionStatus === 'granted' ? 'Real-time Linked' : 'Offline Mode'}
                                </span>
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
                                        className="flex items-center justify-between p-4 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-2xl group hover:border-[var(--brand-primary)]/20 hover:bg-[var(--surface-1)] transition-all cursor-pointer"
                                        onClick={() => togglePreference(item.id as any)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-[var(--surface-1)] shadow-sm flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                                                {item.icon}
                                            </div>
                                            <div>
                                                <p className="font-bold text-[var(--text-main)] text-sm">{item.label}</p>
                                                <p className="text-[10px] text-[var(--text-muted)] tracking-tight">{item.desc}</p>
                                            </div>
                                        </div>
                                        <div className={`w-12 h-6 rounded-full transition-colors relative ${preferences[item.id as keyof NotificationPreferences] ? 'bg-[#007AFF]' : 'bg-gray-200'}`}>
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${preferences[item.id as keyof NotificationPreferences] ? 'left-7 shadow-[-2px_0_4px_rgba(0,0,0,0.1)]' : 'left-1'}`}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Alert Radius Selector */}
                            <div className="mt-8 p-5 bg-[var(--surface-1)] border border-[var(--glass-border)] rounded-2xl">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-[var(--brand-primary-light)] text-[var(--brand-primary)] rounded-2xl flex items-center justify-center text-2xl shadow-sm">
                                            📍
                                        </div>
                                        <div>
                                            <p className="font-bold text-[var(--text-main)] text-sm">Proximity Alerts</p>
                                            <p className="text-xs text-[var(--text-muted)] mt-0.5">Radius from default address</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center bg-[var(--surface-2)] rounded-full p-1.5 border border-[var(--glass-border)]">
                                        {[5, 10, 20, 50].map(dist => (
                                            <button
                                                key={dist}
                                                onClick={() => setPreference('maxDistance', dist)}
                                                className={`px-4 py-1.5 rounded-full text-xs font-black transition-all ${preferences.maxDistance === dist ? 'bg-white shadow-sm text-[#007AFF]' : 'text-[var(--text-muted)] hover:text-[#112244]'}`}
                                            >
                                                {dist}km
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* APP APPEARANCE */}
                        <div className="mt-10 pt-6 border-t border-[var(--glass-border)]">
                            <h3 className="text-lg font-bold text-[var(--text-main)] mb-2 flex items-center gap-2">
                                <span>🎨</span> App Appearance
                            </h3>
                            <p className="text-sm text-[var(--text-muted)] mb-4">
                                Customize your Spendigo experience with different premium themes.
                            </p>
                            <ThemeSwitcher variant="inline" />
                        </div>

                        {/* DANGER ZONE */}
                        <div className="mt-10 pt-6 border-t-2 border-red-500/30">
                            <h3 className="text-lg font-bold text-red-600 mb-2 flex items-center gap-2">
                                <span>⚠️</span> Danger Zone
                            </h3>
                            <p className="text-sm text-[var(--text-muted)] mb-4">
                                Permanently delete your account and all associated data. This action cannot be undone.
                            </p>
                            <button
                                onClick={() => setShowDeleteModal(true)}
                                className="px-6 py-3 bg-red-500/10 text-red-600 font-bold text-sm rounded-xl border-2 border-red-500/30 hover:bg-red-100 hover:border-red-400 transition-all"
                            >
                                🗑️ Delete My Account
                            </button>
                        </div>
                    </div>
                )}

                {/* DELETE ACCOUNT MODAL */}
                {showDeleteModal && (
                    <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !isDeleting && setShowDeleteModal(false)}>
                        <div className="bg-[var(--surface-1)] rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
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
                                    Type <span className="text-red-600 font-mono bg-red-500/10 px-2 py-0.5 rounded">DELETE</span> to confirm:
                                </label>
                                <input
                                    type="text"
                                    value={deleteConfirmText}
                                    onChange={e => setDeleteConfirmText(e.target.value)}
                                    placeholder="Type DELETE"
                                    className="w-full px-4 py-3 border-2 border-red-500/30 rounded-xl font-mono text-center text-lg focus:border-red-500 focus:ring-4 focus:ring-red-100 outline-none transition-all"
                                    disabled={isDeleting}
                                    autoFocus
                                />
                            </div>

                            {deleteError && (
                                <p className="text-sm text-red-600 bg-red-500/10 rounded-lg p-3 mb-4 font-medium">
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
                                    <span className="w-4 h-4 border-2 border-[var(--glass-border)]/30 border-t-white rounded-full animate-spin"></span>
                                            Deleting...
                                        </>
                                    ) : 'Permanently Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}



                {/* ORDERS TAB */}
                {activeTab === 'orders' && (
                    <div className="space-y-8 animate-fade-in min-w-0 overflow-hidden pb-10">
                        <div className="flex items-center justify-between px-2 mb-2">
                            <h2 className="text-xl font-black text-[var(--text-main)] italic tracking-tight">Order History</h2>
                            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] bg-[var(--glass-bg)] px-3 py-1 rounded-full border border-[var(--glass-border)]">{orders.length} Total</span>
                        </div>
                        {orders.length === 0 ? (
                            <EmptyState icon="📦" heading="No orders yet" subtext="Your order history will appear here." action={<Link to="/" className="btn-primary">Start Shopping</Link>} />
                        ) : (
                            orders.map(order => (
                                <Link key={order.id} to={`/order/${order.id}`} className="block relative bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-5 md:p-8 transition-all duration-500 border-2 border-gray-300 shadow-sm hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] hover:border-[var(--brand-primary)]/30 hover:translate-y-[-4px] group overflow-hidden">
                                    {/* Decorative Gradient Edge */}
                                    <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-[var(--brand-primary)] to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 mb-6 md:mb-8 relative z-10">
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-black text-[var(--text-main)] tracking-tight italic uppercase">#{order.id.slice(-8)}</span>
                                                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${getStatusColor(order.status)}`}>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                                    {formatStatus(order.status)}
                                                </div>
                                            </div>
                                            <p className="text-xs font-bold text-[var(--text-muted)] mt-1">
                                                Placed on {new Date(order.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </p>
                                        </div>
                                        <div className="md:text-right">
                                            <p className="text-xl md:text-2xl font-black text-[var(--text-main)] tracking-tighter italic">${order.total.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6 p-2 md:p-3 bg-gray-50 rounded-xl md:rounded-2xl border border-gray-100">
                                        <div className="flex -space-x-3">
                                            {order.items.slice(0, 4).map((item, i) => (
                                                <img key={i} src={item.image} alt="" className="w-12 h-12 rounded-[1rem] border-4 border-[var(--glass-border)] shadow-sm object-cover" />
                                            ))}
                                            {order.items.length > 4 && (
                                                <div className="w-12 h-12 rounded-[1rem] border-4 border-[var(--glass-border)] shadow-sm bg-[var(--surface-3)] flex items-center justify-center text-[10px] font-black text-[var(--text-muted)]">
                                                    +{order.items.length - 4}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-black text-[var(--text-main)] truncate">{order.storeName}</p>
                                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tight flex items-center gap-1.5">
                                                <span className="w-1 h-1 rounded-full bg-emerald-500" />
                                                Express Delivery Tracking Active
                                            </p>
                                        </div>
                                        <div className="hidden md:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--brand-primary)] opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                            View Details
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3">
                                        <button
                                            onClick={(e) => handleDownloadReceipt(e, order.id)}
                                            disabled={downloadingReceiptId === order.id}
                                            className="px-6 py-2.5 bg-[var(--surface-1)] text-[var(--text-muted)] text-[10px] font-black uppercase tracking-widest rounded-xl border border-[var(--glass-border)] hover:bg-[var(--surface-2)] disabled:opacity-50 transition-all flex items-center gap-2"
                                        >
                                            {downloadingReceiptId === order.id ? (
                                                <span className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></span>
                                            ) : <span>📄 Receipt</span>}
                                        </button>
                                        <button
                                            onClick={(e) => handleReorder(e, order.id)}
                                            disabled={reorderingId === order.id}
                                            className="px-6 py-2.5 bg-[#112244] text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-500/10 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all"
                                        >
                                            {reorderingId === order.id ? 'Working...' : 'Reorder'}
                                        </button>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                )}

                {/* WISHLIST TAB */}
                {activeTab === 'wishlist' && (
                    <div className="space-y-10 animate-fade-in pb-10">
                        <div className="flex items-center justify-between mb-2 px-2">
                            <h2 className="text-xl font-black text-[var(--text-main)] italic tracking-tight">Shopping Wishlist</h2>
                            {wishlistItems.length > 0 && (
                                <button onClick={clearComparison} className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 px-3 py-1 rounded-full transition-all">Clear All</button>
                            )}
                        </div>
                        
                        {wishlistItems.length === 0 ? (
                            <EmptyState icon="✨" heading="Wishlist is empty" subtext="Type a product name below to start building your list." />
                        ) : null}

                        <div className="flex flex-col sm:flex-row items-center gap-3 mb-8 p-2">
                            <input 
                                type="text"
                                placeholder="Add an item (e.g. 'Milk')"
                                value={newItemName}
                                onChange={e => setNewItemName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddWishlistItem()}
                                className="w-full sm:flex-1 px-5 py-4 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[1.25rem] outline-none focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--brand-primary)]/10 text-sm font-bold placeholder:text-[var(--text-muted)]/50 transition-all shadow-sm"
                            />
                            <button 
                                onClick={handleAddWishlistItem}
                                disabled={!newItemName.trim()}
                                className="w-full sm:w-auto px-8 py-4 bg-[var(--brand-primary)] text-white text-xs font-black uppercase tracking-widest rounded-[1.25rem] disabled:opacity-50 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[var(--brand-primary)]/20"
                            >
                                Add Item
                            </button>
                        </div>
                        
                        {wishlistItems.length > 0 && (
                            <div className="grid grid-cols-1 gap-6">
                                {wishlistItems.map((item, i) => (
                                    <div key={i} className="glass-panel-premium rounded-[2rem] p-6 flex items-center gap-6 group border border-[var(--glass-border)] bg-[var(--glass-bg)] hover:bg-[var(--surface-1)] hover:shadow-xl hover:translate-x-2 transition-all duration-300 relative overflow-hidden">
                                        <div className="w-20 h-20 rounded-2xl bg-[var(--surface-1)] flex-shrink-0 overflow-hidden border border-[var(--glass-border)] shadow-sm group-hover:scale-105 transition-transform duration-500">
                                            {item.image ? (
                                                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 relative">
                                            <h3 className="text-sm font-black text-[var(--text-main)] italic tracking-tight leading-tight truncate">{item.name}</h3>
                                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tight mt-0.5">{item.category || 'Local Shop'}</p>
                                            <div className="mt-4 flex items-center gap-3">
                                                <span className="badge-info text-[9px] uppercase font-black tracking-widest px-3 py-1 bg-[var(--surface-2)] text-blue-600 border-[var(--glass-border)]">Live Monitor</span>
                                                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--brand-primary)] opacity-0 group-hover:opacity-100 transition-all">Price Comparison Ready</span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => removeItem(item.id)}
                                            className="w-10 h-10 rounded-2xl flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-500/10 transition-all group-hover:scale-110"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                                <button 
                                    onClick={() => navigate('/compare')}
                                    className="w-full py-5 mt-4 bg-gradient-to-r from-[var(--brand-primary)] to-indigo-600 text-white text-xs font-black uppercase tracking-[0.25em] rounded-[2rem] shadow-2xl shadow-[var(--brand-primary)]/30 hover:scale-[1.02] active:scale-[0.98] transition-all group"
                                >
                                    <span className="flex items-center justify-center gap-3">
                                        ⚖️ <span className="group-hover:tracking-[0.35em] transition-all">Compare Real-time Prices</span>
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* SIGN OUT - Global Action at end of page */}
                <div className="max-w-4xl mx-auto px-6 mt-12 pb-12">
                    <button
                        onClick={logout}
                        className="w-full py-5 bg-white border-2 border-[var(--surface-2)] text-[var(--brand-navy)] font-black text-sm uppercase tracking-[0.2em] rounded-2xl hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-all flex items-center justify-center gap-3"
                    >
                        <span>🚪</span> Secure Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Profile;
