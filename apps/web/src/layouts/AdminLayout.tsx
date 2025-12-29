import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/design-system.css';

const AdminLayout: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

    // Close sidebar on navigation
    React.useEffect(() => {
        setIsSidebarOpen(false);
    }, [location]);

    // STRICT SECURITY CHECK
    React.useEffect(() => {
        if (!user) {
            window.location.href = '/login?returnUrl=' + encodeURIComponent(location.pathname);
            return;
        }

        if (user.role !== 'admin') {
            window.location.href = '/';
        }
    }, [user, location.pathname]);

    if (!user || user.role !== 'admin') {
        return null;
    }

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
        <div className="min-h-screen bg-[var(--surface-0)] flex flex-col md:flex-row">
            {/* Mobile Header */}
            <header className="md:hidden h-16 bg-white border-b border-[var(--glass-border)] flex items-center justify-between px-4 sticky top-0 z-20">
                <span className="font-bold text-[var(--brand-primary)]">Spendigo Admin</span>
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-2xl">
                    {isSidebarOpen ? '✕' : '☰'}
                </button>
            </header>

            {/* SIDEBAR */}
            <aside className={`
                fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-[var(--glass-border)] flex flex-col transition-transform duration-300 ease-in-out
                md:translate-x-0 md:static md:h-screen
                ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
            `}>
                {/* Logo */}
                <div className="p-6 border-b border-[var(--glass-border)] hidden md:block">
                    <h1 className="text-xl font-bold text-[var(--brand-primary)]">
                        Spendigo Admin
                    </h1>
                </div>

                {/* Mobile spacer */}
                <div className="md:hidden h-4"></div>

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

                    {/* 
                    <Link
                        to="/"
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-1)] hover:text-[var(--text-main)] transition-colors"
                    >
                        <span className="text-lg">🏠</span>
                        Back to Spendigo
                    </Link> 
                    */}
                </nav>

                {/* Footer User Profile */}
                <div className="p-4 border-t border-[var(--glass-border)] pb-safe">
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-[var(--surface-1)]">
                        <div className="w-8 h-8 rounded-full bg-[var(--brand-secondary)] flex items-center justify-center text-white text-xs font-bold">
                            {user?.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-bold text-[var(--text-main)] truncate">{user?.name || 'System Admin'}</p>
                            <p className="text-xs text-[var(--text-muted)] truncate">{user?.email}</p>
                        </div>
                        <button onClick={handleLogout} className="text-[var(--text-muted)] hover:text-red-500">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.36 6.64a9 9 0 11-12.73 0" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v10" />
                            </svg>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 md:hidden animate-fade-in"
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col h-[calc(100vh-64px)] md:h-screen overflow-hidden">
                {/* Content Scroll Area */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
