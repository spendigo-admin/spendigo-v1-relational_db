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
            return;
        }

        if (!user.mfaEnrolled && location.pathname !== '/admin/mfa-setup') {
            navigate('/admin/mfa-setup');
        }
    }, [user, location.pathname, navigate]);

    if (!user || user.role !== 'admin') {
        return null;
    }

    const menuItems = [
        { icon: '📊', label: 'Dashboard', path: '/admin/dashboard' },
        { icon: '📦', label: 'Master Catalog', path: '/admin/catalog' },
        { icon: '👥', label: 'Users', path: '/admin/users' },

        { icon: '🏪', label: 'Stores', path: '/admin/stores' },
        { icon: '📢', label: 'Carousel Ads', path: '/admin/ads' },
        { icon: '📋', label: 'Survey Board', path: '/admin/surveys' },
        { icon: '🛡️', label: 'Audit Logs', path: '/admin/audit-logs' },
        { icon: '🛠️', label: 'System Tools', path: '/admin/tools' },
        { icon: '💼', label: 'Careers', path: '/admin/careers' },
        { icon: '⚙️', label: 'Settings', path: '/admin/settings' },
    ];

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-[var(--surface-0)] flex flex-col md:flex-row">
            {/* Mobile Header */}
            <header className="md:hidden h-16 bg-white border-b border-[var(--glass-border)] flex items-center justify-between px-4 sticky top-0 z-40 backdrop-blur-md bg-white/80">
                <div className="flex items-center gap-2">
                    <img src="/app-icon.png" alt="Spendigo Logo" style={{width: 32, height: 32, borderRadius: 8}} />
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-[var(--brand-primary)] leading-tight">Spendigo</span>
                        <span className="text-[8px] font-bold text-[var(--text-muted)] tracking-tighter uppercase">Admin Console</span>
                    </div>
                </div>
                <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--surface-1)] text-[var(--text-main)] active:scale-90 transition-transform"
                >
                    {isSidebarOpen ? (
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    ) : (
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                        </svg>
                    )}
                </button>
            </header>

            {/* SIDEBAR */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-[var(--glass-border)] flex flex-col transition-transform duration-300 ease-in-out
                md:translate-x-0 md:static md:h-screen md:w-64
                ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
            `}>
                {/* Logo */}
                <div className="p-6 border-b border-[var(--glass-border)] hidden md:block">
                    <div className="flex items-center gap-3 group">
                        <img src="/app-icon.png" alt="Spendigo Logo" style={{width: 36, height: 36, borderRadius: 8}} className="group-hover:scale-105 transition-transform" />
                        <div className="flex flex-col">
                            <span className="text-xl font-bold text-[var(--brand-primary)] leading-tight">Spendigo</span>
                            <span className="text-[10px] font-semibold text-[var(--text-muted)] tracking-wider uppercase">ADMIN</span>
                        </div>
                    </div>
                </div>

                {/* Mobile spacer */}
                <div className="md:hidden h-6"></div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-hide">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive
                                    ? 'bg-[var(--brand-primary)] text-white shadow-lg shadow-[var(--brand-primary)]/30'
                                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-1)] hover:text-[var(--text-main)]'
                                    }`}
                            >
                                <span className="text-lg">{item.icon}</span>
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer User Profile */}
                <div className="p-4 border-t border-[var(--glass-border)] pb-safe">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-1)]">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-dark)] flex items-center justify-center text-white text-xs font-bold shadow-sm">
                            {user?.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-bold text-[var(--text-main)] truncate">{user?.name || 'System Admin'}</p>
                            <p className="text-[10px] text-[var(--text-muted)] truncate">{user?.email}</p>
                        </div>
                        <button onClick={handleLogout} className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 transition-colors">
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
                    className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 md:hidden animate-fade-in"
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col h-[calc(100vh-64px)] md:h-screen overflow-hidden">
                {/* Content Scroll Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-safe">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
