import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import '../../styles/design-system.css';

import { useAuth } from '../../context/AuthContext';
import { useAudit } from '../../context/AuditContext';
import { DEMO_USERS } from '../../data/demoUsers';

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, user } = useAuth();
    const { logEvent } = useAudit();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Redirect immediately when user is authenticated
    useEffect(() => {
        if (user) {
            // User is authenticated, redirect based on role
            if (user.role === 'admin') {
                navigate('/admin/dashboard', { replace: true });
            } else if (user.role === 'merchant') {
                navigate('/merchant/dashboard', { replace: true });
            } else {
                navigate('/', { replace: true });
            }
        }
    }, [user, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const success = await login(email, password);
            if (success) {
                await logEvent('AUTH_LOGIN_SUCCESS', { email: email }, 'auth/login');
                // useEffect will handle redirect when user state updates
            } else {
                setError('Login failed. Please try again.');
            }
        } catch (err) {
            console.error(err);
            setError('Invalid credentials');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <div className="p-10 text-center">Loading...</div>;

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--surface-0)]">
            <div className="glass-panel w-full max-w-md p-8 animate-fade-in">
                <h1 className="text-3xl font-bold mb-2 text-[var(--brand-primary)]">Welcome Back</h1>
                <p className="text-[var(--text-muted)] mb-8">Sign in to access your dashboard.</p>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-[var(--text-main)]">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-1)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none transition-colors"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-[var(--text-main)]">Password</label>
                        <input
                            type="password"
                            required
                            className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-1)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none transition-colors"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>

                    {error && <p className="text-red-500 text-sm">{error}</p>}

                    <button type="submit" className="w-full py-3 rounded-[var(--radius-md)] bg-[var(--brand-primary)] text-white font-bold hover:brightness-110 shadow-lg shadow-[var(--brand-primary)]/20 transition-all">
                        Sign In
                    </button>

                    <div className="mt-4 p-3 bg-blue-50 text-xs text-blue-800 rounded-lg max-h-80 overflow-y-auto border border-blue-100 shadow-inner">
                        <p className="font-bold mb-3 sticky top-0 bg-blue-50 py-1 z-10 border-b border-blue-100">Demo Credentials (Password: Spendigo123!)</p>

                        <div className="space-y-4">
                            {[
                                { title: '🛡️ System Admins', filter: (u: any) => u.label === 'ADMIN' },
                                { title: '🏪 Merchant Owners', filter: (u: any) => u.label === 'OWNER' },
                                { title: '💼 Store Managers', filter: (u: any) => u.label === 'MNGR' },
                                { title: '👥 Store Staff', filter: (u: any) => u.label === 'STAFF' },
                                { title: '🛒 Shoppers', filter: (u: any) => u.label === 'USER' || u.label === 'MERCH' }
                            ].map(group => {
                                const groupUsers = DEMO_USERS.filter(group.filter);
                                if (groupUsers.length === 0) return null;

                                return (
                                    <div key={group.title} className="space-y-1">
                                        <h4 className="text-[9px] font-bold uppercase tracking-widest text-blue-900/60 mb-1 ml-1">{group.title}</h4>
                                        {groupUsers.map((u, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => { setEmail(u.email); setPassword('Spendigo123!'); }}
                                                className="w-full text-left bg-white/60 hover:bg-white p-2 rounded flex justify-between items-center transition-all border border-blue-50 hover:border-blue-200"
                                            >
                                                <span className="font-mono text-[10px] truncate pr-2">{u.email}</span>
                                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter ${u.label === 'ADMIN' ? 'bg-red-100 text-red-700' :
                                                    u.label === 'OWNER' ? 'bg-purple-100 text-purple-700' :
                                                        u.label === 'MNGR' ? 'bg-indigo-100 text-indigo-700' :
                                                            'bg-green-100 text-green-700'
                                                    }`}>
                                                    {u.label}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </form>



                <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
                    Don't have an account? <Link to="/register" className="text-[var(--brand-secondary)] hover:underline">Sign up</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
