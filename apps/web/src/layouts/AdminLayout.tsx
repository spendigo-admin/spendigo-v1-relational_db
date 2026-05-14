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
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
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
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                        </svg>
                    ),
                    label: 'Stores',
                    path: '/admin/stores'
                },
                {
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
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
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                    ),
                    label: 'Carousel Ads',
                    path: '/admin/ads'
                },
                {
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
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
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
                        </svg>
                    ),
                    label: 'Flyer Ingestion',
                    path: '/admin/flyer-ingestion'
                },
                {
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
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
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
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
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                        </svg>
                    ),
                    label: 'System Tools',
                    path: '/admin/tools'
                },
                {
                    icon: (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
