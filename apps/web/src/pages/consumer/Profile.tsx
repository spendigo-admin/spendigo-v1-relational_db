import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useOrders } from '../../context/OrderContext';
import { useAuth } from '../../context/AuthContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useNotifications, NotificationPreferences } from '../../context/NotificationContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import '../../styles/design-system.css';
import SEO from '../../components/SEO';

const Profile: React.FC = () => {
    const { profile, orders, updateProfile, addAddress, deleteAddress, setDefaultAddress, reorder, downloadOrderReceipt } = useOrders();
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'account' | 'addresses' | 'orders'>(
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

    // Push Notifications
    const { permissionStatus, requestPermission, disableNotifications } = usePushNotifications(user?.id);
    const { preferences, togglePreference } = useNotifications();
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
                alert("Some items could not be perfectly reordered:\n\n" + messages.join("\n"));
            }
            navigate('/cart');
        } catch (error: any) {
             alert(error.message);
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
            alert("Failed to generate receipt: " + error.message);
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
            <div className="border-b border-[var(--glass-border)] bg-white sticky top-14 z-30">
                <div className="max-w-3xl mx-auto flex">
                    {(['account', 'addresses', 'orders'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-4 text-sm font-medium capitalize transition-colors ${activeTab === tab ? 'text-[var(--brand-primary)] border-b-2 border-[var(--brand-primary)]' : 'text-[var(--text-muted)]'}`}
                        >
                            {tab === 'orders' ? 'Order History' : tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto p-4">
                {/* ACCOUNT TAB */}
                {activeTab === 'account' && (
                    <div className="bg-white rounded-xl border border-[var(--glass-border)] p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-[var(--text-main)]">Account Information</h2>
                            {!editingProfile && (
                                <button onClick={() => setEditingProfile(true)} className="text-[var(--brand-primary)] text-sm font-medium">
                                    Edit
                                </button>
                            )}
                        </div>

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
                    <div className="space-y-4">
                        {profile.addresses.map(addr => (
                            <div key={addr.id} className={`bg-white rounded-xl border p-4 ${addr.isDefault ? 'border-[var(--brand-primary)]' : 'border-[var(--glass-border)]'}`}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-[var(--text-main)]">{addr.label}</span>
                                            {addr.isDefault && <span className="text-xs bg-[var(--brand-primary)] text-white px-2 py-0.5 rounded">Default</span>}
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
                    <div className="space-y-4">
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
            </div>
        </div>
    );
};

export default Profile;
