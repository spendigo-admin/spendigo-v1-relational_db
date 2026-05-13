import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import NotificationPopover from '../components/NotificationPopover';
import NotificationToast from '../components/NotificationToast';
import '../styles/design-system.css';
const AdminLayout: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { unreadCount } = useNotifications();
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

    const menuGroups = [
        {
            title: 'Overview',
            items: [
                { 
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H18a2.25 2.25 0 01-2.25-2.25v-2.25z" />
                        </svg>
                    ), 
                    label: 'Dashboard', 
                    path: '/admin/dashboard' 
                },
                { 
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a.5.5 0 00.71 0l7.144-7.144a.5.5 0 01.854.353V18a2.25 2.25 0 01-2.25 2.25H4.5A2.25 2.25 0 012.25 18z" />
                        </svg>
                    ), 
                    label: 'Store Insights', 
                    path: '/admin/insights' 
                },
                { 
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                        </svg>
                    ), 
                    label: 'Notifications', 
                    path: '/admin/notifications' 
                },
            ]
        },
        {
            title: 'Marketplace',
            items: [
                { 
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21V10.5m0 10.5h-9A1.5 1.5 0 013 19.5V10.5m10.5 10.5h9a1.5 1.5 0 001.5-1.5V10.5m-12 0V3.75c0-.414.336-.75.75-.75h4.5c.414 0 .75.336.75.75V10.5m-6 0h6" />
                        </svg>
                    ), 
                    label: 'Stores', 
                    path: '/admin/stores' 
                },
                { 
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-10.5v10.5" />
                        </svg>
                    ), 
                    label: 'Master Catalog', 
                    path: '/admin/catalog' 
                },
            ]
        },
        {
            title: 'Management',
            items: [
                { 
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 015.454-1.31M12.74 4.51c.253-.962.584-1.892.985-2.783.247-.55.06-1.21-.463-1.511l-.657-.38c-.551-.318-1.26-.117-1.527-.461a20.845 20.845 0 00-1.44 4.282m3.102-.069a18.03 18.03 0 01.59 4.59c0 1.586-.205 3.124-.59 4.59m0-9.18A23.848 23.848 0 0118.194 6.31M18.194 6.31a6.002 6.002 0 011.506 11.382m0 0a6.002 6.002 0 01-1.506-11.382" />
                        </svg>
                    ), 
                    label: 'Carousel Ads', 
                    path: '/admin/ads' 
                },
                { 
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0018 4.5h-2.25a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 0015.75 18.75zm-3.15 0H6a2.25 2.25 0 01-2.25-2.25V6.75A2.25 2.25 0 016 4.5h.75a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25z" />
                        </svg>
                    ), 
                    label: 'Survey Board', 
                    path: '/admin/surveys' 
                },
                { 
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                        </svg>
                    ), 
                    label: 'Users', 
                    path: '/admin/users' 
                },
                { 
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75v6.75m0 0l-3-3m3 3l3-3m-8.25 6a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                        </svg>
                    ), 
                    label: 'Flyer Ingestion', 
                    path: '/admin/flyer-ingestion' 
                },
                { 
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 .414-.336.75-.75.75H4.5a.75.75 0 01-.75-.75v-4.25m16.5 0a3 3 0 00-3-3H6.25a3 3 0 00-3 3m16.5 0V10a3 3 0 00-3-3H6.25a3 3 0 00-3 3v4.15m16.5 0h-16.5M12 11.25v3.75m0 0l-1.5-1.5m1.5 1.5l1.5-1.5" />
                        </svg>
                    ), 
                    label: 'Careers', 
                    path: '/admin/careers' 
                },
            ]
        },
        {
            title: 'System',
            items: [
                { 
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                        </svg>
                    ), 
                    label: 'System Health', 
                    path: '/admin/health' 
                },
                { 
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751A11.959 11.959 0 0112 2.714z" />
                        </svg>
                    ), 
                    label: 'Audit Logs', 
                    path: '/admin/audit-logs' 
                },
                { 
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.423 3.007a.75.75 0 01.362.453l1.137 4.55a.75.75 0 01-.453.918L7.92 10.065a.75.75 0 01-.918-.453L5.865 5.062a.75.75 0 01.453-.918L10.865 2.96a.75.75 0 01.558.047zM6.75 21a.75.75 0 01-.75-.75V16.5a.75.75 0 01.75-.75h4.5a.75.75 0 01.75.75v3.75a.75.75 0 01-.75.75h-4.5zM15 15.75a.75.75 0 01.75-.75h3.75a.75.75 0 01.75.75v4.5a.75.75 0 01-.75.75h-3.75a.75.75 0 01-.75-.75v-4.5zM15.75 3a.75.75 0 01.75.75v4.5a.75.75 0 01-.75.75h-3.75a.75.75 0 01-.75-.75V3.75a.75.75 0 01.75-.75h3.75z" />
                        </svg>
                    ), 
                    label: 'System Tools', 
                    path: '/admin/tools' 
                },
                { 
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 1115 0 7.5 7.5 0 01-15 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9" />
                        </svg>
                    ), 
                    label: 'Settings', 
                    path: '/admin/settings' 
                },
            ]
        }
    ];

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-[var(--surface-0)] flex flex-col md:flex-row">
            <NotificationToast />
            {/* Mobile Header */}
            <header className="md:hidden h-16 bg-white border-b border-[var(--glass-border)] flex items-center justify-between px-4 sticky top-0 z-40 backdrop-blur-md bg-white/80">
                <div className="flex items-center gap-2 group cursor-pointer" onClick={() => navigate('/admin/dashboard')}>
                    <img src="/logo-app.png" alt="Spendigo Logo" style={{width: 32, height: 32, borderRadius: 8}} className="group-hover:scale-105 transition-transform" />
                    <div className="flex flex-col">
                        <span className="text-2xl font-black text-gray-900 leading-tight group-hover:text-blue-600 transition-colors italic tracking-tighter">Spendigo</span>
                        <span className="text-[8px] font-bold text-[var(--text-muted)] tracking-tighter uppercase">Admin Console</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <NotificationPopover />
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
                </div>
            </header>

            {/* SIDEBAR */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-[var(--glass-border)] flex flex-col transition-transform duration-300 ease-in-out
                md:translate-x-0 md:static md:h-screen md:w-64
                ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
            `}>
                {/* Logo */}
                <div className="h-16 px-6 border-b border-[var(--glass-border)] hidden md:flex items-center shrink-0">
                    <Link to="/admin/dashboard" className="flex items-center gap-3 group">
                        <img src="/logo-app.png" alt="Spendigo Logo" style={{width: 36, height: 36, borderRadius: 8}} className="group-hover:scale-105 transition-transform" />
                        <div className="flex flex-col">
                            <span className="text-2xl font-black text-gray-900 leading-tight group-hover:text-blue-600 transition-colors italic tracking-tighter">Spendigo</span>
                            <span className="text-[10px] font-semibold text-[var(--text-muted)] tracking-wider uppercase">ADMIN</span>
                        </div>
                    </Link>
                </div>

                {/* Mobile spacer */}
                <div className="md:hidden h-6"></div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-6 overflow-y-auto scrollbar-hide pb-24">
                    {menuGroups.map((group, idx) => (
                        <div key={idx}>
                            <h3 className="px-4 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] mb-2 opacity-50">
                                {group.title}
                            </h3>
                            <div className="space-y-1">
                                {group.items.map((item) => {
                                    const isActive = location.pathname === item.path;
                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            className={`group flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${isActive
                                                ? 'bg-[#112244] text-white shadow-xl shadow-slate-200'
                                                : 'text-[var(--text-muted)] hover:bg-[var(--surface-1)] hover:text-[var(--brand-primary)]'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg transition-all duration-300 ${isActive ? 'bg-white/10 text-white scale-110' : 'bg-gray-50 text-[var(--text-muted)] group-hover:bg-[var(--brand-primary-light)] group-hover:text-[var(--brand-primary)]'}`}>
                                                    {item.icon}
                                                </div>
                                                <span className={`transition-all duration-200 ${isActive ? 'translate-x-0' : 'group-hover:translate-x-1'}`}>{item.label}</span>
                                            </div>
                                            {isActive ? (
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                                            ) : (item.path === '/admin/notifications' && unreadCount > 0) ? (
                                                <span className="text-[9px] font-black bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                                                    {unreadCount > 9 ? '9+' : unreadCount}
                                                </span>
                                            ) : null}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
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
                {/* Desktop Top Bar */}
                <header className="hidden md:flex h-16 bg-white border-b border-[var(--glass-border)] items-center justify-end px-8 shrink-0">
                    <div className="flex items-center gap-4">
                        <NotificationPopover />

                        {/* Profile Dropdown */}
                        <div className="relative group">
                            <button className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-dark)] text-white flex items-center justify-center text-sm font-bold ring-2 ring-white shadow-md">
                                    {user?.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <span className="text-sm font-medium text-[var(--text-main)] max-w-[120px] truncate">
                                    {user?.name.split(' ')[0]}
                                </span>
                            </button>

                            {/* Dropdown Menu */}
                            <div className="absolute right-0 top-12 w-48 glass-panel opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl">
                                <div className="p-3 border-b border-[var(--glass-border)]">
                                    <p className="text-sm font-bold text-[var(--text-main)] truncate">{user?.adminRole || 'Admin'}</p>
                                    <p className="text-xs text-[var(--text-muted)] truncate">{user?.email}</p>
                                </div>
                                <Link
                                    to="/admin/notifications"
                                    className="block px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--surface-2)] transition-colors"
                                >
                                    🔔 Notifications
                                </Link>
                                <Link
                                    to="/admin/audit-logs"
                                    className="block px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--surface-2)] transition-colors"
                                >
                                    🛡️ Audit Logs
                                </Link>
                                <Link
                                    to="/admin/settings"
                                    className="block px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--surface-2)] transition-colors"
                                >
                                    ⚙️ Settings
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors border-t border-[var(--glass-border)]"
                                >
                                    🚪 Sign Out
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

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
