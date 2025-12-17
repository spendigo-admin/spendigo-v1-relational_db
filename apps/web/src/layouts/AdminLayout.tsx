import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/design-system.css';

const AdminLayout: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const menuItems = [
        { icon: '📊', label: 'Dashboard', path: '/admin/dashboard' },
        { icon: '👥', label: 'Users', path: '/admin/users' },
        { icon: '🏪', label: 'Stores', path: '/admin/stores' },
        { icon: '🛡️', label: 'Audit Logs', path: '/admin/audit-logs' },
        { icon: '⚙️', label: 'Settings', path: '/admin/settings' },
    ];

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-[var(--surface-0)] flex">
            {/* SIDEBAR */}
            <aside className="w-64 bg-white border-r border-[var(--glass-border)] hidden md:flex flex-col">
                {/* Logo */}
                <div className="p-6 border-b border-[var(--glass-border)]">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-secondary)] bg-clip-text text-transparent">
                        Spendigo Admin
                    </h1>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive
                                        ? 'bg-[var(--brand-primary)] text-white shadow-lg shadow-[var(--brand-primary)]/30'
                                        : 'text-[var(--text-muted)] hover:bg-[var(--surface-1)] hover:text-[var(--text-main)]'
                                    }`}
                            >
                                <span className="text-lg">{item.icon}</span>
                                {item.label}
                            </Link>
                        );
                    })}

                    <div className="border-t border-[var(--glass-border)] my-2 mx-4"></div>

                    <Link
                        to="/"
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-1)] hover:text-[var(--text-main)] transition-colors"
                    >
                        <span className="text-lg">🏠</span>
                        Back to Spendigo
                    </Link>
                </nav>

                {/* Footer User Profile */}
                <div className="p-4 border-t border-[var(--glass-border)]">
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-[var(--surface-1)]">
                        <div className="w-8 h-8 rounded-full bg-[var(--brand-secondary)] flex items-center justify-center text-white text-xs font-bold">
                            {user?.avatar || 'SA'}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-bold text-[var(--text-main)] truncate">{user?.name || 'System Admin'}</p>
                            <p className="text-xs text-[var(--text-muted)] truncate">{user?.email}</p>
                        </div>
                        <button onClick={handleLogout} className="text-[var(--text-muted)] hover:text-red-500">
                            🚪
                        </button>
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Mobile Header */}
                <header className="md:hidden h-16 bg-white border-b border-[var(--glass-border)] flex items-center justify-between px-4">
                    <span className="font-bold text-[var(--brand-primary)]">Spendigo Admin</span>
                    <button className="p-2 text-2xl">☰</button>
                </header>

                {/* Content Scroll Area */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
