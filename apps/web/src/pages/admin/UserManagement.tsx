import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, setDoc, updateDoc, where, deleteDoc, addDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useAudit } from '../../context/AuditContext';
import { useNotifications } from '../../context/NotificationContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import '../../styles/design-system.css';

// --- TYPES ---
type UserRole = 'consumer' | 'merchant';
type AdminRole = 'SUPER_ADMIN' | 'SUPPORT' | 'MODERATOR' | 'AUDITOR';

interface User {
    id: string;
    email: string;
    role: UserRole;
    status: 'active' | 'banned';
    joinedAt: string;
}

interface AdminStaff {
    id: string;
    name: string;
    email: string;
    role: AdminRole;
    status: 'active' | 'inactive';
    joinedAt: string;
}

// --- ROLE DEFINITIONS (Least Privilege) ---
const ROLE_DEFINITIONS: Record<AdminRole, { description: string; permissions: string[]; color: string }> = {
    SUPER_ADMIN: {
        description: 'Full system access. Can manage other admins.',
        permissions: ['ALL_ACCESS'],
        color: 'bg-purple-100 text-purple-700 border-purple-200'
    },
    MODERATOR: {
        description: 'verify content like flyers and deals.',
        permissions: ['files:read', 'files:write', 'stores:read'],
        color: 'bg-blue-100 text-blue-700 border-blue-200'
    },
    SUPPORT: {
        description: 'Customer support. Can view users and stores but cannot edit configuration.',
        permissions: ['users:read', 'stores:read', 'orders:read', 'logs:read'],
        color: 'bg-green-100 text-green-700 border-green-200'
    },
    AUDITOR: {
        description: 'Compliance review. Read-only access to logs and reports.',
        permissions: ['logs:read', 'reports:read'],
        color: 'bg-gray-100 text-gray-700 border-gray-200'
    }
};

const UserManagement: React.FC = () => {
    const { user: currentUser, can } = useAuth();
    const { logEvent } = useAudit();
    const { addNotification } = useNotifications();
    const { confirm } = useConfirmation();
    const [activeTab, setActiveTab] = useState<'staff' | 'users' | 'roles'>('staff');
    const [staff, setStaff] = useState<AdminStaff[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [showStaffModal, setShowStaffModal] = useState(false);
    const [staffStep, setStaffStep] = useState(1);
    const [userFilter, setUserFilter] = useState<'all' | 'merchant' | 'consumer'>('all');
    const [searchTerm, setSearchTerm] = useState(''); // Search by Email/ID
    const [statusFilter, setStatusFilter] = useState('all'); // Filter by Status

    // Form State
    const [newStaff, setNewStaff] = useState({ name: '', email: '', role: 'SUPPORT' as AdminRole });

    // Fetch Data
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Staff (Isolated Collection)
                const staffQuery = query(collection(db, 'staff'));
                const staffSnap = await getDocs(staffQuery);
                const staffMembers = staffSnap.docs.map(d => ({
                    id: d.id,
                    ...d.data()
                } as AdminStaff));

                // 2. Fetch Platform Users (Filtering out admins from the main list for clarity)
                const usersQuery = query(collection(db, 'users'));
                const usersSnap = await getDocs(usersQuery);
                const allPlatformUsers = usersSnap.docs
                    .map(d => ({ id: d.id, ...d.data() } as any))
                    .filter((u: any) => u.role !== 'admin')
                    .map((u: any) => ({
                        id: u.id,
                        email: u.email,
                        role: u.role,
                        status: u.status || 'active',
                        joinedAt: u.joinedAt ? new Date(u.joinedAt).toLocaleDateString() : 'Unknown'
                    }));

                setStaff(staffMembers.sort((a, b) => a.role === 'SUPER_ADMIN' ? -1 : 1));
                setUsers(allPlatformUsers);
            } catch (err) {
                console.error("Error fetching data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [activeTab]);

    const handleAddStaff = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const staffRef = doc(db, 'staff', newStaff.email.toLowerCase());
            const staffData: AdminStaff = {
                id: `staff-${Date.now()}`,
                name: newStaff.name,
                email: newStaff.email.toLowerCase(),
                role: newStaff.role,
                status: 'active',
                joinedAt: new Date().toISOString()
            };

            await setDoc(staffRef, staffData);

            // Trigger Welcome Email
            await addDoc(collection(db, 'mail'), {
                to: newStaff.email,
                message: {
                    subject: 'Welcome to Spendigo Admin Team',
                    html: `
                        <h2>Welcome Aboard!</h2>
                        <p>Hi ${newStaff.name},</p>
                        <p>You have been granted <strong>${newStaff.role}</strong> access to the Spendigo Admin Console.</p>
                        <p>
                            <strong>Step 1:</strong> If you don't have an account, <a href="${window.location.origin}/register">Register Here</a> using this email.<br/>
                            <strong>Step 2:</strong> <a href="${window.location.origin}/login">Log In</a> to access the dashboard.
                        </p>
                        <hr />
                        <p style="font-size:12px;color:gray">If you did not expect this, please contact support.</p>
                    `
                }
            });

            const usersRef = collection(db, 'users');
            const userQuery = query(usersRef, where('email', '==', newStaff.email.toLowerCase()));
            const userSnap = await getDocs(userQuery);

            if (!userSnap.empty) {
                const userDoc = userSnap.docs[0];
                await updateDoc(doc(db, 'users', userDoc.id), {
                    role: 'admin',
                    adminRole: newStaff.role
                });
            }

            setShowStaffModal(false);
            setStaffStep(1);
            setNewStaff({ name: '', email: '', role: 'SUPPORT' });

            addNotification({
                type: 'system',
                title: 'Staff Added',
                message: `${newStaff.email} authorized as ${newStaff.role}`,
            });

            await logEvent('STAFF_AUTHORIZE', { 
                targetEmail: newStaff.email.toLowerCase(), 
                role: newStaff.role 
            }, `staff/${newStaff.email.toLowerCase()}`);

            // Reload to refresh permissions/UI
            setTimeout(() => window.location.reload(), 1500);

        } catch (e) {
            console.error(e);
            addNotification({ type: 'alert', title: 'Error', message: 'Failed to add staff member' });
        }
    };

    const removeStaff = async (email: string) => {
        const confirmed = await confirm({
            title: 'Remove Staff',
            message: `Remove ${email} from Administrative Staff Pool?`,
            confirmText: 'Remove Access',
            type: 'danger'
        });

        if (confirmed) {
            try {
                await deleteDoc(doc(db, 'staff', email.toLowerCase()));

                const usersRef = collection(db, 'users');
                const userQuery = query(usersRef, where('email', '==', email.toLowerCase()));
                const userSnap = await getDocs(userQuery);

                if (!userSnap.empty) {
                    const userDoc = userSnap.docs[0];
                    await updateDoc(doc(db, 'users', userDoc.id), {
                        role: 'consumer',
                        adminRole: null
                    });
                }

                addNotification({ type: 'system', title: 'Staff Removed', message: 'Staff rights revoked.' });
                await logEvent('STAFF_DEAUTHORIZE', { targetEmail: email.toLowerCase() }, `staff/${email.toLowerCase()}`);
                setTimeout(() => window.location.reload(), 1500);
            } catch (e) {
                console.error(e);
                addNotification({ type: 'alert', title: 'Error', message: 'Failed to remove staff' });
            }
        }
    };

    const handleDeleteUser = async (user: User) => {
        const confirmed = await confirm({
            title: 'Delete User',
            message: `Are you sure you want to PERMANENTLY DELETE user ${user.email}? This action cannot be undone.`,
            confirmText: 'Delete Forever',
            type: 'danger'
        });

        if (!confirmed) return;

        try {
            setLoading(true);
            const functions = getFunctions();
            const deleteUserFunction = httpsCallable(functions, 'deleteUser');

            await deleteUserFunction({ targetUid: user.id });

            // Remove from local state
            setUsers(prev => prev.filter(u => u.id !== user.id));
            addNotification({
                type: 'system',
                title: 'User Deleted',
                message: `User ${user.email} deleted successfully.`
            });
            await logEvent('USER_DELETE', { targetUid: user.id, targetEmail: user.email }, `users/${user.id}`);
        } catch (error: any) {
            console.error("Delete failed:", error);
            addNotification({
                type: 'alert',
                title: 'Deletion Failed',
                message: error.message || 'Operation failed.'
            });
        } finally {
            setLoading(false);
        }
    };



    const toggleUserBan = async (id: string, currentStatus: 'active' | 'banned') => {
        const newStatus = currentStatus === 'active' ? 'banned' : 'active';
        const action = newStatus === 'banned' ? 'SUSPEND' : 'ACTIVATE';

        const confirmed = await confirm({
            title: `${action} User`,
            message: `Are you sure you want to ${action.toLowerCase()} this user?`,
            confirmText: 'Yes, proceed',
            type: 'warning'
        });

        if (confirmed) {
            try {
                await updateDoc(doc(db, 'users', id), {
                    status: newStatus
                });

                // Update local state
                setUsers(prev => prev.map(u =>
                    u.id === id ? { ...u, status: newStatus } : u
                ));

                addNotification({
                    type: 'system',
                    title: 'Status Updated',
                    message: `User status set to ${newStatus}`
                });

                await logEvent(newStatus === 'banned' ? 'USER_SUSPEND' : 'USER_ACTIVATE', { 
                    targetUid: id,
                    previousStatus: currentStatus
                }, `users/${id}`);
            } catch (e) {
                console.error("Error updating user status:", e);
                addNotification({ type: 'alert', title: 'Error', message: "Failed to update user status." });
            }
        }
    };

    const getFilteredUsers = () => {
        return users.filter(u => {
            // 1. Role Filter
            if (userFilter !== 'all' && u.role !== userFilter) return false;

            // 2. Status Filter
            if (statusFilter !== 'all' && u.status !== statusFilter) return false;

            // 3. Search Filter
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                const matchesEmail = u.email.toLowerCase().includes(searchLower);
                // Handle complex ID objects or simple strings just in case, though User interface says string
                const matchesId = typeof u.id === 'string' && u.id.toLowerCase().includes(searchLower);
                if (!matchesEmail && !matchesId) return false;
            }

            return true;
        });
    };

    if (loading) return <div className="p-10 text-center">Loading Management Data...</div>;

    return (
        <div className="p-6 animate-fade-in pb-20">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-main)]">Platform Governance</h1>
                    <p className="text-sm text-[var(--text-muted)]">Manage isolated staff and monitor external users.</p>
                </div>
                {activeTab === 'staff' && can('admin:all') && (
                    <button
                        onClick={() => {
                            setStaffStep(1);
                            setShowStaffModal(true);
                        }}
                        className="px-5 py-2.5 bg-black text-white font-bold rounded-xl shadow-xl hover:bg-gray-800 transition-all flex items-center gap-2"
                    >
                        <span className="text-lg">+</span> Add Admin Staff
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex gap-1 bg-[var(--surface-1)] p-1 rounded-xl w-fit border border-[var(--glass-border)]">
                    <button
                        onClick={() => setActiveTab('staff')}
                        className={`px-6 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === 'staff' ? 'bg-white shadow-sm text-[var(--brand-primary)]' : 'text-[var(--text-muted)] hover:bg-white/50'}`}
                    >
                        🔒 Admin Staff
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-6 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === 'users' ? 'bg-white shadow-sm text-[var(--brand-primary)]' : 'text-[var(--text-muted)] hover:bg-white/50'}`}
                    >
                        👥 Platform Users
                    </button>
                    <button
                        onClick={() => setActiveTab('roles')}
                        className={`px-6 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === 'roles' ? 'bg-white shadow-sm text-[var(--brand-primary)]' : 'text-[var(--text-muted)] hover:bg-white/50'}`}
                    >
                        🔐 Roles & Permissions
                    </button>
                </div>


            </div>

            {/* Enhanced Filters for Platform Users */}
            {activeTab === 'users' && (
                <div className="flex flex-col md:flex-row gap-3 bg-white p-3 md:p-4 rounded-xl border border-[var(--glass-border)] shadow-sm mb-6">
                    <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                        <input
                            type="text"
                            placeholder="Search by Email or ID..."
                            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <select
                            className="flex-1 md:w-32 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] bg-white"
                            value={userFilter}
                            onChange={(e) => setUserFilter(e.target.value as any)}
                        >
                            <option value="all">Roles</option>
                            <option value="merchant">Merchants</option>
                            <option value="consumer">Consumers</option>
                        </select>
                        <select
                            className="flex-1 md:w-32 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] bg-white"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">Status</option>
                            <option value="active">Active</option>
                            <option value="banned">Banned</option>
                        </select>

                    </div>
                </div>
            )}

            {activeTab === 'staff' && (
                <div className="bg-white rounded-2xl border border-[var(--glass-border)] overflow-hidden shadow-sm">
                    {/* Desktop Table */}
                    <table className="hidden md:table w-full text-left">
                        <thead className="bg-gray-50 text-[var(--text-muted)] text-[10px] uppercase font-bold tracking-wider border-b border-[var(--glass-border)]">
                            <tr>
                                <th className="p-5">Staff Member</th>
                                <th className="p-5">Permissions Level</th>
                                <th className="p-5">Status</th>
                                <th className="p-5">Joined</th>
                                <th className="p-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {staff.length > 0 ? staff.map(member => (
                                <tr key={member.id} className="group hover:bg-gray-50/50 transition-colors">
                                    <td className="p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-[var(--brand-primary)]/10 flex items-center justify-center text-lg">
                                                {member.role === 'SUPER_ADMIN' ? '🛡️' : '👤'}
                                            </div>
                                            <div>
                                                <div className="font-bold text-[var(--text-main)] text-sm">{member.name}</div>
                                                <div className="text-xs text-[var(--text-muted)]">{member.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md border uppercase inline-block ${ROLE_DEFINITIONS[member.role].color}`}>
                                            {member.role}
                                        </span>
                                    </td>
                                    <td className="p-5">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                            <span className="text-xs font-medium capitalize">{member.status}</span>
                                        </div>
                                    </td>
                                    <td className="p-5 text-xs text-[var(--text-muted)] font-medium">
                                        {new Date(member.joinedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </td>
                                    <td className="p-5 text-right">
                                        {member.email !== currentUser?.email ? (
                                            <button
                                                onClick={() => removeStaff(member.email)}
                                                className="text-xs text-red-500 font-bold hover:bg-red-50 px-3 py-1.5 rounded-lg border border-transparent hover:border-red-100 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                De-Authorize
                                            </button>
                                        ) : (
                                            <span className="text-xs text-[var(--text-muted)] italic px-3">Current User</span>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center">
                                        <div className="text-4xl mb-4 opacity-10">🛡️</div>
                                        <p className="text-[var(--text-muted)] font-medium">No administrative staff authorized.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-gray-100">
                        {staff.length > 0 ? staff.map(member => (
                            <div key={member.id} className="p-4 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[var(--brand-primary)]/10 flex items-center justify-center text-lg shadow-sm">
                                            {member.role === 'SUPER_ADMIN' ? '🛡️' : '👤'}
                                        </div>
                                        <div>
                                            <div className="font-bold text-[var(--text-main)] text-sm">{member.name}</div>
                                            <div className="text-xs text-[var(--text-muted)]">{member.email}</div>
                                        </div>
                                    </div>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${ROLE_DEFINITIONS[member.role].color}`}>
                                        {member.role}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center bg-[var(--surface-1)] p-2 rounded-lg border border-[var(--glass-border)]">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                        <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">{member.status}</span>
                                    </div>
                                    <span className="text-[10px] text-[var(--text-muted)] font-medium">
                                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                                    </span>
                                </div>
                                {member.email !== currentUser?.email && (
                                    <button
                                        onClick={() => removeStaff(member.email)}
                                        className="w-full py-2 bg-red-50 text-red-600 font-bold rounded-lg text-xs border border-red-100"
                                    >
                                        Revoke Administrative Access
                                    </button>
                                )}
                            </div>
                        )) : (
                            <div className="p-12 text-center text-[var(--text-muted)]">No staff members found.</div>
                        )}
                    </div>
                </div>
            )}
            {activeTab === 'users' && (
                /* Platform Users View */
                <div className="bg-white rounded-2xl border border-[var(--glass-border)] overflow-hidden shadow-sm">
                    {/* Desktop Table */}
                    <table className="hidden md:table w-full text-left">
                        <thead className="bg-gray-50 text-[var(--text-muted)] text-[10px] uppercase font-bold tracking-wider border-b border-[var(--glass-border)]">
                            <tr>
                                <th className="p-5">Account</th>
                                <th className="p-5">Type</th>
                                <th className="p-5">Status</th>
                                <th className="p-5">Member Since</th>
                                <th className="p-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {getFilteredUsers().length > 0 ? getFilteredUsers().map(user => (
                                <tr key={user.id} className="group hover:bg-gray-50/50 transition-colors">
                                    <td className="p-5">
                                        <div className="font-bold text-[var(--text-main)] text-sm">{user.email}</div>
                                        <div className="text-[10px] text-[var(--text-muted)] font-mono">UID: {user.id.substring(0, 12)}...</div>
                                    </td>
                                    <td className="p-5">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md border uppercase ${user.role === 'merchant' ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="p-5">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                            <span className="text-xs font-medium capitalize">{user.status}</span>
                                        </div>
                                    </td>
                                    <td className="p-5 text-xs text-[var(--text-muted)] font-medium">
                                        {user.joinedAt}
                                    </td>
                                    <td className="p-5 text-right whitespace-nowrap">
                                        {can('admin:stores') && (
                                        <button
                                            onClick={() => toggleUserBan(user.id, user.status)}
                                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${user.status === 'banned'
                                                ? 'text-green-600 bg-green-50 hover:bg-green-100 hover:text-green-700'
                                                : 'text-red-500 hover:bg-red-50 hover:text-red-700'
                                                }`}
                                        >
                                            {user.status === 'banned' ? 'Un-ban' : 'Suspend'}
                                        </button>
                                        )}
                                        {can('admin:all') && (
                                        <button
                                            onClick={() => handleDeleteUser(user)}
                                            className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg ml-2 transition-all"
                                        >
                                            Delete
                                        </button>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center text-[var(--text-muted)]">No users found for this filter.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-gray-100">
                        {getFilteredUsers().length > 0 ? getFilteredUsers().map(user => (
                            <div key={user.id} className="p-4 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="min-w-0">
                                        <div className="font-bold text-[var(--text-main)] text-sm truncate">{user.email}</div>
                                        <div className="text-[10px] text-[var(--text-muted)] font-mono">UID: {user.id.substring(0, 12)}...</div>
                                    </div>
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase shrink-0 ${user.role === 'merchant' ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                        {user.role}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-[var(--text-muted)] font-medium">
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-2 h-2 rounded-full ${user.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                        <span className="uppercase">{user.status}</span>
                                    </div>
                                    <span>Joined {user.joinedAt}</span>
                                </div>
                                <div className="flex gap-2">
                                    {can('admin:stores') && (
                                    <button
                                        onClick={() => toggleUserBan(user.id, user.status)}
                                        className={`flex-1 py-2 font-bold rounded-lg text-xs border transition-colors ${user.status === 'banned'
                                            ? 'text-green-600 bg-green-50 border-green-100'
                                            : 'text-red-600 bg-red-50 border-red-100'
                                            }`}
                                    >
                                        {user.status === 'banned' ? 'Restore Access' : 'Suspend User'}
                                    </button>
                                    )}
                                    {can('admin:all') && (
                                    <button
                                        onClick={() => handleDeleteUser(user)}
                                        className="flex-1 py-2 bg-red-500 text-white font-bold rounded-lg text-xs"
                                    >
                                        Delete Account
                                    </button>
                                    )}
                                </div>
                            </div>
                        )) : (
                            <div className="p-12 text-center text-[var(--text-muted)]">No platform users found.</div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Roles & Permissions Matrix ── */}
            {activeTab === 'roles' && (() => {
                type AccessLevel = 'full' | 'read' | 'partial' | 'none';
                interface MatrixRow { label: string; access: AccessLevel[]; note?: string; }
                interface MatrixSection { category: string; permission?: string; rows: MatrixRow[]; }

                const ROLE_COLS = [
                    { id: 'SUPER_ADMIN', label: 'Super Admin', icon: '👑', color: 'text-red-700' },
                    { id: 'MODERATOR',   label: 'Moderator',   icon: '🛡️', color: 'text-purple-700' },
                    { id: 'SUPPORT',     label: 'Support',     icon: '🎧', color: 'text-blue-700' },
                    { id: 'AUDITOR',     label: 'Auditor',     icon: '📋', color: 'text-amber-700' },
                ];

                const ROLE_CARDS = [
                    { id: 'SUPER_ADMIN', label: 'Super Admin', icon: '👑', border: 'border-red-200',    bg: 'bg-red-50',    badge: 'bg-red-100 text-red-800',       desc: 'Full platform control. Authorizes staff, manages billing, and can perform any admin action.', perms: ['admin:all', 'admin:users', 'admin:stores', 'admin:audit', 'admin:catalog', 'admin:marketing', 'admin:billing', 'admin:system'] },
                    { id: 'MODERATOR',   label: 'Moderator',   icon: '🛡️', border: 'border-purple-200', bg: 'bg-purple-50', badge: 'bg-purple-100 text-purple-800', desc: 'User and store management. Reviews merchant applications, resolves disputes, manages content.', perms: ['admin:users', 'admin:stores', 'admin:catalog', 'admin:marketing'] },
                    { id: 'SUPPORT',     label: 'Support',     icon: '🎧', border: 'border-blue-200',   bg: 'bg-blue-50',   badge: 'bg-blue-100 text-blue-800',     desc: 'Customer service. Can look up user accounts and perform soft support actions.', perms: ['admin:users'] },
                    { id: 'AUDITOR',     label: 'Auditor',     icon: '📋', border: 'border-amber-200',  bg: 'bg-amber-50',  badge: 'bg-amber-100 text-amber-800',   desc: 'Compliance and read-only audit access. Can verify the SHA-256 chain but cannot modify any data.', perms: ['admin:audit'] },
                ];

                const MATRIX: MatrixSection[] = [
                    {
                        category: '📊 Dashboard & Monitoring',
                        rows: [
                            { label: 'Admin Dashboard',              access: ['full', 'full', 'full', 'full'] },
                            { label: 'System Health Monitor',        access: ['full', 'full', 'read', 'read'] },
                            { label: 'Store Insights & Analytics',   access: ['full', 'full', 'none', 'none'] },
                        ],
                    },
                    {
                        category: '👥 User Management', permission: 'admin:users',
                        rows: [
                            { label: 'View platform users',          access: ['full', 'full', 'full', 'none'] },
                            { label: 'Suspend / ban users',          access: ['full', 'full', 'none', 'none'] },
                            { label: 'Delete user accounts',         access: ['full', 'none', 'none', 'none'] },
                            { label: 'Authorize admin staff',        access: ['full', 'none', 'none', 'none'] },
                        ],
                    },
                    {
                        category: '🏪 Store Management', permission: 'admin:stores',
                        rows: [
                            { label: 'View stores',                  access: ['full', 'full', 'none', 'none'] },
                            { label: 'Approve / suspend stores',     access: ['full', 'full', 'none', 'none'] },
                            { label: 'KYB document review',          access: ['full', 'full', 'none', 'none'] },
                            { label: 'Force delete store',           access: ['full', 'none', 'none', 'none'] },
                        ],
                    },
                    {
                        category: '📦 Catalog Management', permission: 'admin:catalog',
                        rows: [
                            { label: 'View / approve pending products', access: ['full', 'full', 'none', 'none'] },
                            { label: 'Edit master products',            access: ['full', 'full', 'none', 'none'] },
                            { label: 'Delete master products',          access: ['full', 'none', 'none', 'none'] },
                        ],
                    },
                    {
                        category: '📢 Marketing & Content', permission: 'admin:marketing',
                        rows: [
                            { label: 'Ad placement management',      access: ['full', 'full', 'none', 'none'] },
                            { label: 'Flyer ingestion & moderation', access: ['full', 'full', 'none', 'none'] },
                            { label: 'Survey & career management',   access: ['full', 'full', 'none', 'none'] },
                        ],
                    },
                    {
                        category: '💳 Billing & Finance', permission: 'admin:billing',
                        rows: [
                            { label: 'View billing ledger',          access: ['full', 'none', 'none', 'none'] },
                            { label: 'Create / delete promo codes',  access: ['full', 'none', 'none', 'none'] },
                            { label: 'Subscription overrides',       access: ['full', 'none', 'none', 'none'] },
                        ],
                    },
                    {
                        category: '⚙️ System Operations', permission: 'admin:system',
                        rows: [
                            { label: 'Platform settings',                          access: ['full', 'none', 'none', 'none'] },
                            { label: 'Database tools (orphan cleanup, migrations)', access: ['full', 'none', 'none', 'none'] },
                            { label: 'Maintenance mode (maker-checker)',           access: ['full', 'none', 'none', 'none'] },
                        ],
                    },
                    {
                        category: '🔍 Audit & Compliance', permission: 'admin:audit',
                        rows: [
                            { label: 'View & verify audit log chain', access: ['full', 'none', 'none', 'read'] },
                            { label: 'Export audit logs',             access: ['full', 'none', 'none', 'read'] },
                        ],
                    },
                    {
                        category: '🔔 Notifications',
                        rows: [
                            { label: 'Admin notifications inbox', access: ['full', 'full', 'full', 'full'], note: 'Own inbox only' },
                        ],
                    },
                ];

                const cellStyle = (level: AccessLevel) => {
                    if (level === 'full')    return 'bg-green-100 text-green-800';
                    if (level === 'read')    return 'bg-blue-100 text-blue-800';
                    if (level === 'partial') return 'bg-orange-100 text-orange-800';
                    return 'bg-gray-100 text-gray-400';
                };
                const cellLabel = (level: AccessLevel) => {
                    if (level === 'full')    return '✅ Full';
                    if (level === 'read')    return '🔍 Read';
                    if (level === 'partial') return '⚡ Limited';
                    return '—';
                };

                return (
                    <div className="space-y-6 mt-2">
                        {/* Page header */}
                        <div className="bg-white rounded-2xl border border-[var(--glass-border)] p-6 shadow-sm flex items-start gap-4">
                            <span className="text-3xl">🔐</span>
                            <div>
                                <h2 className="text-xl font-bold text-[var(--text-main)] mb-1">Admin Permission Matrix</h2>
                                <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                                    Defines what each admin sub-role can see and do across the platform. All permissions are enforced at the UI and page level.
                                </p>
                            </div>
                        </div>

                        {/* Role cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {ROLE_CARDS.map(r => (
                                <div key={r.id} className={`rounded-2xl border p-5 ${r.bg} ${r.border}`}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-2xl">{r.icon}</span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.badge}`}>{r.id}</span>
                                    </div>
                                    <h3 className="font-bold text-[var(--text-main)] mb-1 text-sm">{r.label}</h3>
                                    <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-3">{r.desc}</p>
                                    <div className="space-y-1">
                                        {r.perms.map(p => (
                                            <div key={p} className="text-xs font-mono bg-white/70 rounded px-2 py-0.5 text-[var(--text-main)]">{p}</div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-[var(--glass-border)] px-5 py-3 text-xs">
                            <span className="font-bold text-[var(--text-muted)] uppercase tracking-wider">Legend:</span>
                            {([
                                ['bg-green-100 text-green-800',   '✅ Full Access'],
                                ['bg-blue-100 text-blue-800',     '🔍 Read Only'],
                                ['bg-orange-100 text-orange-800', '⚡ Limited'],
                                ['bg-gray-100 text-gray-400',     '— No Access'],
                            ] as [string, string][]).map(([cls, lbl]) => (
                                <span key={lbl} className={`px-2.5 py-1 rounded-full font-semibold ${cls}`}>{lbl}</span>
                            ))}
                        </div>

                        {/* Matrix table */}
                        <div className="bg-white rounded-2xl border border-[var(--glass-border)] overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 border-b border-[var(--glass-border)]">
                                        <tr>
                                            <th className="p-4 text-left text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider w-72">Feature / Action</th>
                                            {ROLE_COLS.map(col => (
                                                <th key={col.id} className={`p-4 text-center text-xs font-bold uppercase tracking-wider ${col.color}`}>
                                                    {col.icon} {col.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {MATRIX.map(section => (
                                            <React.Fragment key={section.category}>
                                                <tr className="bg-gray-50">
                                                    <td colSpan={5} className="px-4 py-2">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{section.category}</span>
                                                            {section.permission && (
                                                                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                                                                    {section.permission}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                                {section.rows.map(row => (
                                                    <tr key={row.label} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-4 py-3 text-[var(--text-main)]">
                                                            <span>{row.label}</span>
                                                            {row.note && <span className="ml-1 text-xs text-[var(--text-muted)]">({row.note})</span>}
                                                        </td>
                                                        {row.access.map((level, i) => (
                                                            <td key={i} className="px-4 py-3 text-center">
                                                                <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${cellStyle(level)}`}>
                                                                    {cellLabel(level)}
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

            {/* Helper Section */}
            {activeTab !== 'roles' && (
            <div className="mt-8 p-6 bg-gray-50 rounded-2xl border border-gray-200 flex gap-4 items-start">
                <span className="text-2xl mt-1">💡</span>
                <div>
                    <h3 className="font-bold text-gray-900 mb-1">Administrative vs Platform Accounts</h3>
                    <p className="text-sm text-gray-800 opacity-70 leading-relaxed">
                        Administrators manage the platform through an authorized email pool. Platform users are consumers and merchants
                        interacting with the marketplace. You can monitor platform activity here, while staff permissions are managed
                        exclusively in the staff tab.
                    </p>
                </div>
            </div>
            )}

            {/* Add Staff Modal */}
            {showStaffModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className={`bg-white p-8 rounded-3xl w-full shadow-2xl relative border border-[var(--glass-border)] transition-all duration-300 ${staffStep === 2 ? 'max-w-2xl' : 'max-w-md'}`}>
                        
                        {/* Progress Header */}
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-[var(--text-main)] mb-1">Authorize New Staff</h2>
                            <p className="text-sm text-[var(--text-muted)]">Grant administrative privileges to an account.</p>
                            
                            {/* Visual Progress Bar */}
                            <div className="w-full bg-gray-100 h-1.5 rounded-full mt-4 overflow-hidden">
                                <div 
                                    className="bg-[var(--brand-primary)] h-full transition-all duration-500 rounded-full"
                                    style={{ width: staffStep === 1 ? '50%' : '100%' }}
                                />
                            </div>
                        </div>

                        {staffStep === 1 ? (
                            <div className="space-y-5 animate-fade-in">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider ml-1">Staff Name</label>
                                    <input
                                        required
                                        placeholder="e.g. John Doe"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-4 ring-[var(--brand-primary)]/10 focus:border-[var(--brand-primary)] outline-none transition-all"
                                        value={newStaff.name} 
                                        onChange={e => setNewStaff({ ...newStaff, name: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider ml-1">Email Address (Auth ID)</label>
                                    <input
                                        type="email" 
                                        required
                                        placeholder="admin@spendigo.ca"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-4 ring-[var(--brand-primary)]/10 focus:border-[var(--brand-primary)] outline-none transition-all"
                                        value={newStaff.email} 
                                        onChange={e => setNewStaff({ ...newStaff, email: e.target.value })}
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowStaffModal(false)}
                                        className="flex-1 py-3 font-bold text-[var(--text-muted)] hover:bg-gray-100 rounded-xl transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!newStaff.name.trim() || !newStaff.email.trim() || !newStaff.email.includes('@')}
                                        onClick={() => setStaffStep(2)}
                                        className="flex-1 py-3 bg-black text-white font-bold rounded-xl shadow-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        Next Step →
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleAddStaff} className="space-y-5 animate-fade-in">
                                <label className="block text-sm font-bold text-[var(--text-main)] mb-2">Select Administrative Role</label>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto pr-1">
                                    {(Object.keys(ROLE_DEFINITIONS) as AdminRole[]).map((roleKey) => {
                                        const role = ROLE_DEFINITIONS[roleKey];
                                        const isSelected = newStaff.role === roleKey;
                                        const icon = roleKey === 'SUPER_ADMIN' ? '👑' : roleKey === 'MODERATOR' ? '🛡️' : roleKey === 'SUPPORT' ? '🎧' : '🔍';
                                        return (
                                            <div
                                                key={roleKey}
                                                onClick={() => setNewStaff({ ...newStaff, role: roleKey })}
                                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:bg-gray-50/50 flex flex-col justify-between ${
                                                    isSelected 
                                                        ? 'border-[var(--brand-primary)] bg-blue-50/5 shadow-md shadow-blue-500/5' 
                                                        : 'border-[var(--glass-border)] bg-white'
                                                }`}
                                            >
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${role.color}`}>
                                                            {roleKey}
                                                        </span>
                                                        <span className="text-xl">{icon}</span>
                                                    </div>
                                                    <p className="text-xs font-semibold text-[var(--text-main)] mb-1">
                                                        {roleKey === 'SUPER_ADMIN' ? 'Super Admin' : roleKey === 'MODERATOR' ? 'Moderator' : roleKey === 'SUPPORT' ? 'Support' : 'Auditor'}
                                                    </p>
                                                    <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                                                        {role.description}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setStaffStep(1)}
                                        className="flex-1 py-3 font-bold text-[var(--text-muted)] hover:bg-gray-100 rounded-xl transition-colors"
                                    >
                                        ← Back
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-3 bg-[var(--brand-primary)] text-white font-bold rounded-xl shadow-lg hover:brightness-110 transition-all font-bold"
                                    >
                                        Authorize Access
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

        </div>
    );
};

export default UserManagement;
