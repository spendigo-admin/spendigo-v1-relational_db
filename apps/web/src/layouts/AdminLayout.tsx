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
    const { user, logout, can } = useAuth();
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
            return;
        }

        // Sub-role permission check — blocks direct URL access to restricted routes
        const ROUTE_PERMISSIONS: Record<string, string> = {
            '/admin/stores':          'admin:stores',
            '/admin/insights':        'admin:stores',
            '/admin/billing-ledger':  'admin:billing',
            '/admin/catalog':         'admin:catalog',
            '/admin/ads':             'admin:marketing',
            '/admin/surveys':         'admin:marketing',
            '/admin/flyer-ingestion': 'admin:marketing',
            '/admin/careers':         'admin:marketing',
            '/admin/users':           'admin:users',
            '/admin/audit-logs':      'admin:audit',
            '/admin/tools':           'admin:system',
            '/admin/settings':        'admin:system',
        };
        const requiredPerm = Object.entries(ROUTE_PERMISSIONS)
            .find(([path]) => location.pathname.startsWith(path))?.[1];
        if (requiredPerm && !can(requiredPerm as any)) {
            navigate('/admin/dashboard');
        }
    }, [user, location.pathname, navigate, can]);

    if (!user || user.role !== 'admin') {
        return null;
    }

    const menuGroups = [
        {
            title: 'Overview',
            items: [
                { 
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <rect x="3" y="3" width="7" height="9" rx="1.5" fill="currentColor" fillOpacity="0.12" />
                            <rect x="14" y="3" width="7" height="5" rx="1.5" />
                            <rect x="14" y="12" width="7" height="9" rx="1.5" />
                            <rect x="3" y="16" width="7" height="5" rx="1.5" />
                        </svg>
                    ), 
                    label: 'Dashboard', 
                    path: '/admin/dashboard' 
                },
                {
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 3v18h18" />
                            <path d="m19 9-5 5-4-4-3 3" fill="none" />
                            <circle cx="19" cy="9" r="2.5" fill="currentColor" fillOpacity="0.12" />
                        </svg>
                    ),
                    label: 'Store Insights',
                    path: '/admin/insights',
                    visible: can('admin:stores')
                },
                { 
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" fill="currentColor" fillOpacity="0.12" />
                            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
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
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" fill="currentColor" fillOpacity="0.12" />
                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                            <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
                            <path d="M2 7h20" />
                        </svg>
                    ),
                    label: 'Stores',
                    path: '/admin/stores',
                    visible: can('admin:stores')
                },
                {
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="5" width="20" height="14" rx="2.5" fill="currentColor" fillOpacity="0.12" />
                            <line x1="2" x2="22" y1="10" y2="10" />
                            <path d="M12 14v2m-2-2h4" />
                        </svg>
                    ),
                    label: 'Billing Ledger',
                    path: '/admin/billing-ledger',
                    visible: can('admin:billing')
                },
                {
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" fill="currentColor" fillOpacity="0.12" />
                            <path d="M6 6h10M6 10h10" />
                        </svg>
                    ),
                    label: 'Master Catalog',
                    path: '/admin/catalog',
                    visible: can('admin:catalog')
                },
            ]
        },
        {
            title: 'Management',
            items: [
                {
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="3" width="20" height="14" rx="2.5" fill="currentColor" fillOpacity="0.12" />
                            <line x1="8" y1="21" x2="16" y2="21" />
                            <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                    ),
                    label: 'Carousel Ads',
                    path: '/admin/ads',
                    visible: can('admin:marketing')
                },
                {
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="16" rx="2.5" fill="currentColor" fillOpacity="0.12" />
                            <path d="m9 11 2 2 4-4" />
                            <line x1="8" x2="16" y1="7" y2="7" />
                        </svg>
                    ),
                    label: 'Survey Board',
                    path: '/admin/surveys',
                    visible: can('admin:marketing')
                },
                { 
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" fill="currentColor" fillOpacity="0.12" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    ), 
                    label: 'Users',
                    path: '/admin/users',
                    visible: can('admin:users')
                },
                {
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" fill="currentColor" fillOpacity="0.12" />
                            <line x1="12" x2="12" y1="15" y2="3" />
                        </svg>
                    ),
                    label: 'Flyer Ingestion',
                    path: '/admin/flyer-ingestion',
                    visible: can('admin:marketing')
                },
                {
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="7" width="20" height="14" rx="2.5" fill="currentColor" fillOpacity="0.12" />
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                        </svg>
                    ),
                    label: 'Careers',
                    path: '/admin/careers',
                    visible: can('admin:marketing')
                },
            ]
        },
        {
            title: 'System',
            items: [
                {
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                            <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.05" stroke="none" />
                        </svg>
                    ),
                    label: 'System Health',
                    path: '/admin/health'
                },
                { 
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 13c0 5-3.5 7.5-7.66 9.7a1 1 0 0 1-.68 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 .76-.97l8-2a1 1 0 0 1 .48 0l8 2A1 1 0 0 1 20 6v7z" fill="currentColor" fillOpacity="0.12" />
                            <path d="m9 12 2 2 4-4" />
                        </svg>
                    ), 
                    label: 'Audit Logs',
                    path: '/admin/audit-logs',
                    visible: can('admin:audit')
                },
                {
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2.5" fill="currentColor" fillOpacity="0.12" />
                            <path d="m7 8 3 3-3 3" />
                            <line x1="12" x2="16" y1="14" y2="14" />
                        </svg>
                    ),
                    label: 'System Tools',
                    path: '/admin/tools',
                    visible: can('admin:system')
                },
                {
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.12" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    ),
                    label: 'Settings',
                    path: '/admin/settings',
                    visible: can('admin:system')
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
                <div className="h-20 px-6 border-b border-[var(--glass-border)] hidden md:flex items-center shrink-0">
                    <Link to="/admin/dashboard" className="flex items-center gap-3 group">
                        <div className="relative">
                            <img src="/logo-app.png" alt="Spendigo Logo" style={{width: 38, height: 38, borderRadius: 10}} className="group-hover:scale-105 transition-transform duration-300 shadow-md border border-[var(--glass-border)]" />
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white animate-pulse"></span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xl font-black text-gray-900 leading-tight group-hover:text-[var(--brand-primary)] transition-colors italic tracking-tighter">Spendigo</span>
                            <span className="text-[9px] font-bold text-[var(--text-muted)] tracking-[0.15em] uppercase opacity-80">Admin Console</span>
                        </div>
                    </Link>
                </div>

                {/* Mobile spacer */}
                <div className="md:hidden h-6"></div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-6 overflow-y-auto scrollbar-hide pb-24">
                    {menuGroups.map((group, idx) => (
                        <div key={idx}>
                            <h3 className="px-4 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]/70 mb-3 flex items-center justify-between">
                                <span>{group.title}</span>
                                <span className="h-[1px] flex-1 bg-[var(--glass-border)] ml-3 opacity-40"></span>
                            </h3>
                            <div className="space-y-1">
                                {group.items.filter(item => (item as any).visible !== false).map((item) => {
                                    const isActive = location.pathname === item.path;
                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            className={`group flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] ${isActive
                                                ? 'bg-gradient-to-r from-[var(--brand-navy)] to-[#1E3A70] text-white shadow-[0_8px_20px_-6px_rgba(17,34,68,0.35)]'
                                                : 'text-[var(--text-muted)] hover:bg-[var(--surface-1)] hover:text-[var(--brand-navy)]'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg transition-all duration-300 ${isActive ? 'bg-[var(--brand-primary)] text-white scale-110 shadow-[0_2px_8px_rgba(0,122,255,0.4)]' : 'bg-gray-50 text-[var(--text-muted)] group-hover:bg-[var(--brand-primary-light)] group-hover:text-[var(--brand-primary)] group-hover:scale-105'}`}>
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
                <div className="p-4 border-t border-[var(--glass-border)] pb-safe bg-gradient-to-b from-transparent to-[var(--surface-1)]/40">
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-[var(--glass-border)] shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md transition-all duration-300">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[var(--brand-primary)] to-[var(--brand-primary-dark)] flex items-center justify-center text-white text-xs font-black shadow-[0_4px_10px_rgba(0,122,255,0.25)]">
                            {user?.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-xs font-black text-[var(--text-main)] truncate leading-none mb-1">{user?.name || 'System Admin'}</p>
                            <span className="inline-block text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-wider scale-90 -translate-x-1.5 leading-none">
                                {user?.adminRole || 'Super Admin'}
                            </span>
                        </div>
                        <button onClick={handleLogout} className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" x2="9" y1="12" y2="12" />
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
                                    className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--surface-2)] transition-colors"
                                >
                                    <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                                        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                                    </svg>
                                    <span>Notifications</span>
                                </Link>
                                <Link
                                    to="/admin/audit-logs"
                                    className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--surface-2)] transition-colors"
                                >
                                    <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 13c0 5-3.5 7.5-7.66 9.7a1 1 0 0 1-.68 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 .76-.97l8-2a1 1 0 0 1 .48 0l8 2A1 1 0 0 1 20 6v7z" />
                                        <polyline points="9 11 11 13 15 9" />
                                    </svg>
                                    <span>Audit Logs</span>
                                </Link>
                                <Link
                                    to="/admin/settings"
                                    className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--surface-2)] transition-colors"
                                >
                                    <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="3" />
                                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                    </svg>
                                    <span>Settings</span>
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors border-t border-[var(--glass-border)]"
                                >
                                    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                        <polyline points="16 17 21 12 16 7" />
                                        <line x1="21" x2="9" y1="12" y2="12" />
                                    </svg>
                                    <span>Sign Out</span>
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
