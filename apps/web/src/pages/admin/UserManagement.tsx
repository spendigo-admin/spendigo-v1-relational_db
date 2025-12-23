import React, { useState } from 'react';
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
    lastActive: string;
}

import { useEffect } from 'react';
import { collection, query, getDocs, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';

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
    const [activeTab, setActiveTab] = useState<'users' | 'staff'>('staff');
    const [users, setUsers] = useState<User[]>([]);
    const [staff, setStaff] = useState<AdminStaff[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);

    // Invite Form State
    const [newStaff, setNewStaff] = useState({ name: '', email: '', role: 'SUPPORT' as AdminRole });

    // Fetch Users
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const q = query(collection(db, 'users'));
                const snapshot = await getDocs(q);
                const allUsers = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

                const staffMembers = allUsers.filter(u => u.role === 'admin').map((u: any) => ({
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    role: u.adminRole || 'SUPPORT',
                    lastActive: 'Unknown' // We don't track this yet
                }));

                // Consumers & Merchants
                const normalUsers = allUsers.filter(u => u.role !== 'admin').map((u: any) => ({
                    id: u.id,
                    email: u.email,
                    role: u.role,
                    status: 'active' as 'active' | 'banned', // Default for now
                    joinedAt: '2025' // Placeholder
                }));

                setStaff(staffMembers);
                setUsers(normalUsers);
            } catch (err) {
                console.error("Error fetching users:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [activeTab]); // Refetch on tab switch to keep fresh

    const toggleUserBan = (id: string) => {
        // Implement Ban Logic later
        alert('Ban functionality coming soon.');
    };



    // ... (keep Invite Logic but update to create user in next step if needed)
    const handleInvite = (e: React.FormEvent) => {
        e.preventDefault();
        alert('Invite system requires SendGrid integration. Manually create the user for now.');
        setShowInviteModal(false);
    };

    const removeStaff = async (id: string) => {
        if (confirm('Demote this admin to consumer?')) {
            try {
                await updateDoc(doc(db, 'users', id), {
                    role: 'consumer',
                    adminRole: null
                });
                setActiveTab('users');
            } catch (e) { console.error(e); }
        }
    };

    if (loading) return <div className="p-10 text-center">Loading Users...</div>;

    return (
        <div className="p-6 animate-fade-in pb-20">
            {/* ... keeping header ... */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-[var(--text-main)]">User & Access Management</h1>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-[var(--surface-1)] p-1 rounded-xl mb-6 w-fit border border-[var(--glass-border)]">
                <button
                    onClick={() => setActiveTab('staff')}
                    className={`px-6 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === 'staff' ? 'bg-white shadow-sm text-[var(--brand-primary)]' : 'text-[var(--text-muted)] hover:bg-white/50'}`}
                >
                    Admin Staff
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-6 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === 'users' ? 'bg-white shadow-sm text-[var(--brand-primary)]' : 'text-[var(--text-muted)] hover:bg-white/50'}`}
                >
                    Platform Users
                </button>
            </div>

            {activeTab === 'staff' ? (
                <div className="space-y-6">
                    {/* Simplified Staff List */}
                    <div className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                            <thead className="bg-[var(--surface-1)] text-[var(--text-muted)] text-xs uppercase font-bold border-b border-[var(--glass-border)]">
                                <tr>
                                    <th className="p-4">Name</th>
                                    <th className="p-4">Role</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {staff.map(member => (
                                    <tr key={member.id} className="border-b">
                                        <td className="p-4">
                                            <div className="font-bold">{member.name}</div>
                                            <div className="text-xs text-gray-500">{member.email}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-xs font-bold px-2 py-1 bg-purple-100 text-purple-700 rounded uppercase">{member.role}</span>
                                        </td>
                                        <td className="p-4 text-right">
                                            {member.id !== currentUser?.id && (
                                                <button onClick={() => removeStaff(member.id)} className="text-xs text-red-600 font-bold hover:underline">Demote</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* ACTUAL CUSTOMER TABLE */
                <div className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                        <thead className="bg-[var(--surface-1)] text-[var(--text-muted)] text-xs uppercase font-bold border-b border-[var(--glass-border)]">
                            <tr>
                                <th className="p-4">Email</th>
                                <th className="p-4">Role</th>

                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id} className="border-b hover:bg-gray-50">
                                    <td className="p-4 font-medium">{user.email}</td>
                                    <td className="p-4">
                                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${user.role === 'merchant' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {user.role}
                                        </span>
                                    </td>

                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}


            {/* Invite Modal */}
            {
                showInviteModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center animate-fade-in p-4">
                        <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl relative">
                            <h2 className="text-xl font-bold mb-4">Invite New Administrator</h2>
                            <form onSubmit={handleInvite} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Full Name</label>
                                    <input
                                        required
                                        className="w-full p-2 border rounded-lg focus:ring-2 ring-[var(--brand-primary)] outline-none"
                                        value={newStaff.name} onChange={e => setNewStaff({ ...newStaff, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Email Address</label>
                                    <input
                                        type="email" required
                                        className="w-full p-2 border rounded-lg focus:ring-2 ring-[var(--brand-primary)] outline-none"
                                        value={newStaff.email} onChange={e => setNewStaff({ ...newStaff, email: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Assign Role</label>
                                    <select
                                        className="w-full p-2 border rounded-lg focus:ring-2 ring-[var(--brand-primary)] outline-none bg-white"
                                        value={newStaff.role} onChange={e => setNewStaff({ ...newStaff, role: e.target.value as AdminRole })}
                                    >
                                        {Object.keys(ROLE_DEFINITIONS).map(role => (
                                            <option key={role} value={role}>{role} - {ROLE_DEFINITIONS[role as AdminRole].description.substring(0, 30)}...</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="pt-2">
                                    <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Granted Permissions:</h4>
                                    <div className="flex flex-wrap gap-1 p-2 bg-[var(--surface-1)] rounded border border-[var(--glass-border)]">
                                        {ROLE_DEFINITIONS[newStaff.role].permissions.map(p => (
                                            <span key={p} className="text-[10px] bg-gray-200 text-gray-700 px-1 rounded font-mono">{p}</span>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button type="button" onClick={() => setShowInviteModal(false)} className="px-4 py-2 font-bold text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
                                    <button type="submit" className="px-4 py-2 bg-[var(--brand-primary)] text-white font-bold rounded-lg hover:brightness-110">Send Invite</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default UserManagement;
