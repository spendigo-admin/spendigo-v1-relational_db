import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import '../../styles/design-system.css';

import { useAuth } from '../../context/AuthContext';
import { useAudit } from '../../context/AuditContext';

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();
    const { logEvent } = useAudit();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login(email, password);
            await logEvent('AUTH_LOGIN_SUCCESS', { email: email }, 'auth/login');

            // We need to wait for the user state to update or use the return value if it returned the user
            // Since login is async and sets state, we might not have 'user' immediately available here if we used useAuth().user
            // However, for this fix, let's rely on the email logic BUT make it stricter, 
            // OR better: check MOCK_USERS directly here or assume the login function handles it?
            // Actually, best practice is to redirect within a useEffect in Login that listens to `user`.
            // But let's fix the fragile logic first.

            // Check known roles based on email patterns defined in AuthContext
            if (email.includes('owner') || email.includes('manager') || email.includes('staff')) {
                navigate('/merchant/dashboard');
            } else if (email.includes('admin')) {
                navigate('/admin/dashboard');
            } else {
                navigate('/');
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

                    <div className="mt-4 p-3 bg-blue-50 text-xs text-blue-800 rounded-lg">
                        <p className="font-bold mb-2">Demo Credentials (Password: Spendigo123!):</p>

                        <div className="mb-3">
                            <p className="font-semibold">Format:</p>
                            <code className="bg-blue-100 px-1 py-0.5 rounded text-[10px] w-full block mt-1">
                                [store].owner@spendigo.ca
                            </code>
                            <code className="bg-blue-100 px-1 py-0.5 rounded text-[10px] w-full block mt-1">
                                [store].manager@spendigo.ca
                            </code>
                            <code className="bg-blue-100 px-1 py-0.5 rounded text-[10px] w-full block mt-1">
                                [store].staff@spendigo.ca
                            </code>
                        </div>

                        <p className="font-bold mt-2 pt-1 border-t border-blue-200">Available Stores (slugs):</p>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1 font-mono text-[10px]">
                            <p>freshmart</p>
                            <p>quickpick</p>
                            <p>metro</p>
                            <p>costco</p>
                            <p>macs</p>
                            <p>hasty</p>
                            <p>bodega</p>
                            <p>greenvalley</p>
                            <p>bakery</p>
                            <p>butcher</p>
                            <p>books</p>
                        </div>

                        <p className="font-bold mt-2 pt-1 border-t border-blue-200">Other:</p>
                        <p>admin@spendigo.ca</p>
                        <div className="mt-2">
                            <p className="font-semibold text-[10px] mb-1">Shoppers:</p>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                <p>shopper@example.com</p>
                                <p>family@spendigo.ca</p>
                                <p>student@spendigo.ca</p>
                                <p>chef@spendigo.ca</p>
                            </div>
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
