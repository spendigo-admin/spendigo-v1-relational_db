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

// --- MOCK DATA ---
const INITIAL_USERS: User[] = [
    { id: 'u1', email: 'alice@example.com', role: 'consumer', status: 'active', joinedAt: '2023-01-15' },
    { id: 'u2', email: 'freshmart@business.com', role: 'merchant', status: 'active', joinedAt: '2023-02-01' },
    { id: 'u3', email: 'spammer99@bot.net', role: 'consumer', status: 'banned', joinedAt: '2023-03-10' },
    { id: 'u4', email: 'bob.builder@gmail.com', role: 'consumer', status: 'active', joinedAt: '2024-05-12' },
];

const INITIAL_STAFF: AdminStaff[] = [
    { id: 'a1', name: 'Root Admin', email: 'admin@spendigo.com', role: 'SUPER_ADMIN', lastActive: 'Now' },
    { id: 'a2', name: 'Sarah Jenkins', email: 'sarah.j@spendigo.support', role: 'SUPPORT', lastActive: '12 mins ago' },
    { id: 'a3', name: 'Mike Ross', email: 'mike.audit@firm.com', role: 'AUDITOR', lastActive: '2 days ago' },
];

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
    const [activeTab, setActiveTab] = useState<'users' | 'staff'>('staff');
    const [users, setUsers] = useState<User[]>(INITIAL_USERS);
    const [staff, setStaff] = useState<AdminStaff[]>(INITIAL_STAFF);
    const [showInviteModal, setShowInviteModal] = useState(false);

    // Invite Form State
    const [newStaff, setNewStaff] = useState({ name: '', email: '', role: 'SUPPORT' as AdminRole });

    const toggleUserBan = (id: string) => {
        setUsers(users.map(u =>
            u.id === id ? { ...u, status: u.status === 'active' ? 'banned' : 'active' } : u
        ));
    };

    const handleInvite = (e: React.FormEvent) => {
        e.preventDefault();
        const newAdmin: AdminStaff = {
            id: `a${Date.now()}`,
            name: newStaff.name,
            email: newStaff.email,
            role: newStaff.role,
            lastActive: 'Pending'
        };
        setStaff([...staff, newAdmin]);
        setShowInviteModal(false);
        setNewStaff({ name: '', email: '', role: 'SUPPORT' });
        alert(`Invitation sent to ${newAdmin.email} with role ${newAdmin.role}`);
    };

    const removeStaff = (id: string) => {
        if (confirm('Revoke access for this admin user?')) {
            setStaff(staff.filter(s => s.id !== id));
        }
    };

    return (
        <div className="p-6 animate-fade-in pb-20">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-[var(--text-main)]">User & Access Management</h1>
                {activeTab === 'staff' && (
                    <button
                        onClick={() => setShowInviteModal(true)}
                        className="bg-[var(--brand-primary)] text-white px-4 py-2 rounded-lg font-bold shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <span>+</span> Invite Staff
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-[var(--surface-1)] p-1 rounded-xl mb-6 w-fit border border-[var(--glass-border)]">
                <button
                    onClick={() => setActiveTab('staff')}
                    className={`px-6 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === 'staff' ? 'bg-white shadow-sm text-[var(--brand-primary)]' : 'text-[var(--text-muted)] hover:bg-white/50'}`}
                >
                    Admin Staff (RBAC)
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
                    {/* Role Documentation */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {(Object.keys(ROLE_DEFINITIONS) as AdminRole[]).map(role => (
                            <div key={role} className="bg-white p-4 rounded-xl border border-[var(--glass-border)] shadow-sm">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${ROLE_DEFINITIONS[role].color}`}>
                                    {role}
                                </span>
                                <p className="text-xs text-[var(--text-muted)] mt-2 h-8 leading-snug">
                                    {ROLE_DEFINITIONS[role].description}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-1">
                                    {ROLE_DEFINITIONS[role].permissions.map(perm => (
                                        <span key={perm} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                                            {perm}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Staff List */}
                    <div className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                            <thead className="bg-[var(--surface-1)] text-[var(--text-muted)] text-xs uppercase font-bold border-b border-[var(--glass-border)]">
                                <tr>
                                    <th className="p-4">Staff Member</th>
                                    <th className="p-4">Assigned Role</th>
                                    <th className="p-4">Access Scope</th>
                                    <th className="p-4">Last Active</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--glass-border)]">
                                {staff.map(member => (
                                    <tr key={member.id} className="hover:bg-[var(--surface-1)] transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold text-[var(--text-main)] text-sm">{member.name}</div>
                                            <div className="text-xs text-[var(--text-muted)]">{member.email}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`text-xs font-bold px-2 py-1 rounded border uppercase ${ROLE_DEFINITIONS[member.role].color}`}>
                                                {member.role}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex gap-1 flex-wrap max-w-[200px]">
                                                {ROLE_DEFINITIONS[member.role].permissions.slice(0, 3).map(p => (
                                                    <span key={p} className="text-[10px] bg-gray-100 text-gray-500 px-1 rounded font-mono border border-gray-200">
                                                        {p}
                                                    </span>
                                                ))}
                                                {ROLE_DEFINITIONS[member.role].permissions.length > 3 && (
                                                    <span className="text-[10px] text-gray-400 self-center">...</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-xs text-[var(--text-muted)]">{member.lastActive}</td>
                                        <td className="p-4 text-right">
                                            {member.role !== 'SUPER_ADMIN' && (
                                                <button
                                                    onClick={() => removeStaff(member.id)}
                                                    className="text-xs font-bold text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                                                >
                                                    Revoke Access
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* EXISTING CUSTOMER TABLE */
                <div className="bg-white rounded-xl border border-[var(--glass-border)] overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                        <thead className="bg-[var(--surface-1)] text-[var(--text-muted)] text-xs uppercase font-bold border-b border-[var(--glass-border)]">
                            <tr>
                                <th className="p-4">Email</th>
                                <th className="p-4">Role</th>
                                <th className="p-4">Joined</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--glass-border)]">
                            {users.map(user => (
                                <tr key={user.id} className="hover:bg-[var(--surface-1)] transition-colors">
                                    <td className="p-4 text-[var(--text-main)] text-sm font-medium">{user.email}</td>
                                    <td className="p-4">
                                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${user.role === 'merchant' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="p-4 text-[var(--text-muted)] text-sm">{user.joinedAt}</td>
                                    <td className="p-4">
                                        <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {user.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => toggleUserBan(user.id)}
                                            className={`text-xs font-bold px-3 py-1.5 rounded transition-colors ${user.status === 'active' ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                                        >
                                            {user.status === 'active' ? 'Ban User' : 'Unban'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Invite Modal */}
            {showInviteModal && (
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
            )}
        </div>
    );
};

export default UserManagement;
