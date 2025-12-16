import React, { useState } from 'react';
import '../../styles/design-system.css';

interface User {
    id: string;
    email: string;
    role: 'consumer' | 'merchant';
    status: 'active' | 'banned';
    joinedAt: string;
}

const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<User[]>([
        { id: 'u1', email: 'alice@example.com', role: 'consumer', status: 'active', joinedAt: '2023-01-15' },
        { id: 'u2', email: 'merchant@store.com', role: 'merchant', status: 'active', joinedAt: '2023-02-01' },
        { id: 'u3', email: 'bad_actor@spam.com', role: 'consumer', status: 'banned', joinedAt: '2023-03-10' },
    ]);

    const toggleBan = (id: string) => {
        setUsers(users.map(u =>
            u.id === id ? { ...u, status: u.status === 'active' ? 'banned' : 'active' } : u
        ));
        // In prod: call API to update user status
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-[var(--text-main)]">User Management</h1>

            <div className="glass-panel overflow-hidden">
                <table className="w-full text-left bg-[var(--surface-1)]">
                    <thead className="bg-[var(--surface-2)] text-[var(--text-muted)] text-xs uppercase">
                        <tr>
                            <th className="p-4">Email</th>
                            <th className="p-4">Role</th>
                            <th className="p-4">Joined</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--glass-border)]">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-[var(--surface-2)] transition-colors">
                                <td className="p-4 text-[var(--text-main)] font-medium">{user.email}</td>
                                <td className="p-4">
                                    <span className={`text-xs px-2 py-1 rounded-full ${user.role === 'merchant' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="p-4 text-[var(--text-muted)]">{user.joinedAt}</td>
                                <td className="p-4">
                                    <span className={`text-xs px-2 py-1 rounded-full ${user.status === 'active' ? 'bg-[var(--status-success)]/20 text-[var(--status-success)]' : 'bg-[var(--status-error)]/20 text-[var(--status-error)]'}`}>
                                        {user.status}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <button
                                        onClick={() => toggleBan(user.id)}
                                        className={`text-sm font-bold ${user.status === 'active' ? 'text-[var(--status-error)] hover:underline' : 'text-[var(--status-success)] hover:underline'}`}
                                    >
                                        {user.status === 'active' ? 'Ban User' : 'Unban User'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UserManagement;
