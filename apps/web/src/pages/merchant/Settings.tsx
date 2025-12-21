import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import '../../styles/design-system.css';
import { useAuth } from '../../context/AuthContext';
import { useMarketplace } from '../../context/MarketplaceContext';

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

const INITIAL_TEAM: TeamMember[] = [
    { id: 't1', name: 'John Doe', email: 'owner@freshmart.ca', role: 'OWNER', lastActive: 'Now' },
    { id: 't2', name: 'Alice Staff', email: 'alice@freshmart.ca', role: 'STAFF', lastActive: '2 hours ago' },
    { id: 't3', name: 'Bob Manager', email: 'bob@freshmart.ca', role: 'MANAGER', lastActive: '1 day ago' },
];

const MerchantSettings: React.FC = () => {
    const { can, user } = useAuth();
    const { stores, updateStoreTeam } = useMarketplace();
    const hasTeamAccess = can('team:manage');
    const hasSettingsAccess = can('settings:write');
    const storeId = user?.storeId || '1'; // Fallback to 1 if missing

    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'profile' | 'operations' | 'team' | 'payments' | 'notifications'>((searchParams.get('tab') as any) || 'profile');
    const [isSaving, setIsSaving] = useState(false);

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
        address: '123 Queen St W, Toronto, ON',
        description: 'Your local source for fresh produce and daily essentials. We partner with local farmers to bring you the best quality items.',
        website: 'www.freshmart.ca',
        logoUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200',
        coverUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&h=300&fit=crop'
    });

    // Operations State
    const [operations, setOperations] = useState({
        deliveryRadiusKm: 5,
        minOrder: 15.00,
        deliveryFee: 3.99,
        freeDeliveryThreshold: 50.00,
        pickupEnabled: true,
        autoAcceptOrders: false,
        taxRate: 13
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

    // Team State - derived from MarketplaceContext
    const team = (stores[storeId]?.team as TeamMember[]) || [];
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'STAFF' as MerchantRole });

    // Initialize team if empty (Mock behavior)
    useEffect(() => {
        if (!stores[storeId]?.team) {
            updateStoreTeam(storeId, INITIAL_TEAM);
        }
    }, [storeId, stores]);

    const handleSave = () => {
        setIsSaving(true);
        // Simulate API call
        setTimeout(() => {
            setIsSaving(false);
            alert('Settings saved successfully!');
        }, 1000);
    };

    const handleInvite = (e: React.FormEvent) => {
        e.preventDefault();
        const newMember: TeamMember = {
            id: `t${Date.now()}`,
            name: inviteForm.name,
            email: inviteForm.email,
            role: inviteForm.role,
            lastActive: 'Pending Invite'
        };
        const updatedTeam = [...team, newMember];
        updateStoreTeam(storeId, updatedTeam); // Persist to context

        setShowInviteModal(false);
        setInviteForm({ name: '', email: '', role: 'STAFF' });
        alert(`Invitation sent to ${newMember.email}`);
    };

    const removeMember = (id: string) => {
        if (confirm('Are you sure you want to remove this team member?')) {
            const updatedTeam = team.filter((t: TeamMember) => t.id !== id);
            updateStoreTeam(storeId, updatedTeam); // Persist to context
        }
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
                                <button className="px-4 py-2 border border-[var(--glass-border)] rounded-lg text-sm font-medium hover:bg-gray-50 mb-1">
                                    Upload New Logo
                                </button>
                                <p className="text-xs text-[var(--text-muted)]">Recommended: 400x400px</p>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Cover Image</label>
                        <div className="h-20 w-full rounded-lg overflow-hidden relative group cursor-pointer border-2 border-[var(--surface-2)] transition-colors hover:border-[var(--brand-primary)]">
                            <img src={storeInfo.coverUrl} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="Cover" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 text-white font-medium text-sm">Change Cover</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* General Info */}
            <section className="bg-white p-6 rounded-xl border border-[var(--glass-border)] shadow-sm">
                <h2 className="text-lg font-bold text-[var(--text-main)] mb-4">Store Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Store Address</label>
                        <input
                            type="text"
                            value={storeInfo.address}
                            onChange={e => setStoreInfo({ ...storeInfo, address: e.target.value })}
                            className="w-full p-3 border border-[var(--glass-border)] rounded-lg"
                        />
                    </div>
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
                    <div className="md:col-span-2 pt-2 border-t border-[var(--glass-border)] mt-2">
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
            <section className="bg-white p-6 rounded-xl border border-[var(--glass-border)] shadow-sm">
                <h2 className="text-lg font-bold text-[var(--text-main)] mb-4">Accepted Payment Methods</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { key: 'acceptVisa', label: 'Visa' },
                        { key: 'acceptMastercard', label: 'Mastercard' },
                        { key: 'acceptAmex', label: 'American Express' },
                        { key: 'acceptApplePay', label: 'Apple Pay' },
                        { key: 'acceptCash', label: 'Cash on Delivery' },
                    ].map((method) => (
                        <label key={method.key} className="flex items-center gap-3 p-3 border border-[var(--glass-border)] rounded-lg cursor-pointer hover:bg-gray-50">
                            <input
                                type="checkbox"
                                checked={(payments as any)[method.key]}
                                onChange={e => setPayments({ ...payments, [method.key]: e.target.checked })}
                                className="w-5 h-5 accent-[var(--brand-primary)]"
                            />
                            <span className="font-medium">{method.label}</span>
                        </label>
                    ))}
                </div>
            </section>

            <section className="bg-white p-6 rounded-xl border border-[var(--glass-border)] shadow-sm">
                <h2 className="text-lg font-bold text-[var(--text-main)] mb-4">Payout Settings</h2>
                <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-100 rounded-lg mb-4">
                    <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center text-green-700 font-bold">✓</div>
                    <div>
                        <div className="font-bold text-green-900">Bank Account Connected</div>
                        <div className="text-sm text-green-700">TD Canada Trust •••• {payments.bankLast4}</div>
                    </div>
                    <button className="ml-auto text-sm text-green-700 font-bold hover:underline">Edit</button>
                </div>

                <div>
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Payout Schedule</label>
                    <select
                        value={payments.payoutSchedule}
                        onChange={e => setPayments({ ...payments, payoutSchedule: e.target.value })}
                        className="w-full p-3 border border-[var(--glass-border)] rounded-lg"
                    >
                        <option value="daily">Daily (Next Business Day)</option>
                        <option value="weekly">Weekly (Every Monday)</option>
                        <option value="monthly">Monthly</option>
                    </select>
                    <p className="text-xs text-[var(--text-muted)] mt-2">Payouts are processed automatically according to your schedule.</p>
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
                        { key: 'smsOrderAlerts', title: 'SMS Order Alerts', desc: 'Receive a text message when a new order is placed.' },
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
                    <button className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-100 font-medium">
                        Pause Store Operations
                    </button>
                    <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">
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
        </div>
    );
};

export default MerchantSettings;
