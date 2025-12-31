import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, setDoc, updateDoc, where, deleteDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
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
    const { user: currentUser } = useAuth();
    const { addNotification } = useNotifications();
    const { confirm } = useConfirmation();
    const [activeTab, setActiveTab] = useState<'staff' | 'users'>('staff');
    const [staff, setStaff] = useState<AdminStaff[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [showStaffModal, setShowStaffModal] = useState(false);
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
            setNewStaff({ name: '', email: '', role: 'SUPPORT' });

            addNotification({
                type: 'system',
                title: 'Staff Added',
                message: `${newStaff.email} authorized as ${newStaff.role}`,
            });

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

    const [showCleanupModal, setShowCleanupModal] = useState(false);

    const handleCleanup = async () => {
        // Confirmation is now handled by the UI Modal
        setShowCleanupModal(false);

        try {
            setLoading(true);
            const functions = getFunctions();
            const cleanupFunction = httpsCallable(functions, 'cleanupOrphanedUsers');
            const result: any = await cleanupFunction();

            addNotification({
                type: 'system',
                title: 'Cleanup Complete',
                message: result.data.message || 'Orphaned users removed.'
            });

            setTimeout(() => window.location.reload(), 2000);
        } catch (e: any) {
            console.error(e);
            addNotification({
                type: 'alert',
                title: 'Cleanup Failed',
                message: e.message || 'An error occurred during cleanup.'
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
                {activeTab === 'staff' && (
                    <button
                        onClick={() => setShowStaffModal(true)}
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
                </div>


            </div>

            {/* Enhanced Filters for Platform Users */}
            {activeTab === 'users' && (
                <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-[var(--glass-border)] shadow-sm mb-6">
                    <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                        <input
                            type="text"
                            placeholder="Search by Email or User ID..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] bg-white"
                        value={userFilter}
                        onChange={(e) => setUserFilter(e.target.value as any)}
                    >
                        <option value="all">All Roles</option>
                        <option value="merchant">Merchants</option>
                        <option value="consumer">Consumers</option>
                    </select>
                    <select
                        className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] bg-white"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="banned">Banned/Suspended</option>
                    </select>
                    <button
                        onClick={() => setShowCleanupModal(true)}
                        title="Remove users that don't exist in Auth"
                        className="px-4 py-2 text-red-600 font-bold border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2 whitespace-nowrap"
                    >
                        <span>🧹 Cleanup Ghosts</span>
                    </button>
                </div>
            )}

            {activeTab === 'staff' ? (
                <div className="bg-white rounded-2xl border border-[var(--glass-border)] overflow-hidden shadow-sm">
                    <table className="w-full text-left">
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
                                                <div className="font-bold text-[var(--text-main)]">{member.name}</div>
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
                </div>
            ) : (
                /* Platform Users View */
                <div className="bg-white rounded-2xl border border-[var(--glass-border)] overflow-hidden shadow-sm">
                    <table className="w-full text-left">
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
                                        <div className="font-bold text-[var(--text-main)]">{user.email}</div>
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
                                    <td className="p-5 text-right">
                                        <button
                                            onClick={() => toggleUserBan(user.id, user.status)}
                                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${user.status === 'banned'
                                                ? 'text-green-600 bg-green-50 hover:bg-green-100 hover:text-green-700'
                                                : 'text-red-500 hover:bg-red-50 hover:text-red-700'
                                                }`}
                                        >
                                            {user.status === 'banned' ? 'Un-ban' : 'Suspend'}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteUser(user)}
                                            className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg ml-2 transition-all"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center text-[var(--text-muted)]">No users found for this filter.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Helper Section */}
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

            {/* Add Staff Modal */}
            {showStaffModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl relative border border-[var(--glass-border)]">
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-[var(--text-main)] mb-1">Authorize New Staff</h2>
                            <p className="text-sm text-[var(--text-muted)]">Grant administrative privileges to an account.</p>
                        </div>

                        <form onSubmit={handleAddStaff} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider ml-1">Staff Name</label>
                                <input
                                    required
                                    placeholder="e.g. John Doe"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-4 ring-[var(--brand-primary)]/10 focus:border-[var(--brand-primary)] outline-none transition-all"
                                    value={newStaff.name} onChange={e => setNewStaff({ ...newStaff, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider ml-1">Email Address (Auth ID)</label>
                                <input
                                    type="email" required
                                    placeholder="admin@spendigo.ca"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-4 ring-[var(--brand-primary)]/10 focus:border-[var(--brand-primary)] outline-none transition-all"
                                    value={newStaff.email} onChange={e => setNewStaff({ ...newStaff, email: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider ml-1">Access Level</label>
                                <select
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-4 ring-[var(--brand-primary)]/10 focus:border-[var(--brand-primary)] outline-none transition-all bg-white cursor-pointer"
                                    value={newStaff.role} onChange={e => setNewStaff({ ...newStaff, role: e.target.value as AdminRole })}
                                >
                                    {Object.keys(ROLE_DEFINITIONS).map(role => (
                                        <option key={role} value={role}>{role}</option>
                                    ))}
                                </select>
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
                                    type="submit"
                                    className="flex-1 py-3 bg-black text-white font-bold rounded-xl shadow-lg hover:bg-gray-800 transition-all font-bold"
                                >
                                    Authorize Access
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Cleanup Confirmation Modal */}
            {showCleanupModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl border border-[var(--glass-border)] text-center">
                        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                            🧹
                        </div>
                        <h2 className="text-xl font-bold text-[var(--text-main)] mb-2">Clean Up Orphaned Users?</h2>
                        <p className="text-sm text-[var(--text-muted)] mb-6 leading-relaxed">
                            This will scan all users and permanently delete any Firestore profiles that do not have a matching Firebase Auth account.
                            <br /><br />
                            <strong>This action cannot be undone.</strong>
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowCleanupModal(false)}
                                className="flex-1 py-2.5 font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCleanup}
                                className="flex-1 py-2.5 bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 hover:bg-red-600 transition-all"
                            >
                                Confirm Cleanup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
