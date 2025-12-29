import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import '../../styles/design-system.css';

import { useAuth } from '../../context/AuthContext';
import { useAudit } from '../../context/AuditContext';
import { DEMO_USERS } from '../../data/demoUsers';

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, user, loginWithGoogle, loginWithFacebook } = useAuth();
    const { logEvent } = useAudit();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Redirect immediately when user is authenticated
    useEffect(() => {
        if (user) {
            // Check for returnUrl to preserve navigation flow
            const searchParams = new URLSearchParams(location.search);
            const returnUrl = searchParams.get('returnUrl');

            if (returnUrl) {
                navigate(returnUrl, { replace: true });
                return;
            }

            // User is authenticated, redirect based on role
            if (user.role === 'admin') {
                navigate('/admin/dashboard', { replace: true });
            } else if (user.role === 'merchant') {
                navigate('/merchant/dashboard', { replace: true });
            } else {
                navigate('/', { replace: true });
            }
        }
    }, [user, navigate, location]);

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

                <div className="space-y-3 mb-6 animate-fade-in">
                    <button
                        type="button"
                        onClick={async () => {
                            await loginWithGoogle(); // Defaults to 'consumer' if new, but mostly just logs in existing
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-sm)] bg-white border border-[var(--glass-border)] text-gray-700 font-medium hover:bg-gray-50 transition-all shadow-sm"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#EA4335" d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12z" />
                            <path fill="#FFF" d="M12.5 6.5c1.3 0 2.4.4 3.3 1.2l2.4-2.4C16.8 3.9 14.8 3 12.5 3 8.6 3 5.3 5.2 3.7 8.5l2.9 2.3c.7-2.3 2.9-3.9 5.4-3.9.1 0 .3 0 .5.1z" />
                            <path fill="#FFF" d="M21.5 10h-9v3.5h5.3c-.3 1.8-1.9 3.3-3.8 3.5v2.8h4.6c2.7-2.5 2.9-6.9 2.9-9.8 0-.3 0-.6 0-1z" />
                            <path fill="#FFF" d="M12.5 21.5c2.4 0 4.6-.8 6.2-2.2l-2.9-2.3c-.8.5-1.9.9-3.3.9-2.6 0-4.8-1.7-5.6-4.1l-2.9 2.3c1.6 3.1 4.9 5.4 8.5 5.4z" />
                            <path fill="#FFF" d="M6.9 13.8c-.4-1.2-.4-2.4 0-3.6l-2.9-2.3C2.8 9.6 2.8 14.4 4 16.1l2.9-2.3z" />
                            <path fill="none" d="M3 3h18v18H3z" />
                        </svg>
                        <span className="text-sm">Sign in with Google</span>
                    </button>

                    <button
                        type="button"
                        onClick={async () => {
                            await loginWithFacebook();
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-sm)] bg-[#1877F2] text-white font-medium hover:brightness-110 transition-all shadow-sm"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                        <span className="text-sm">Sign in with Facebook</span>
                    </button>

                    <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-[var(--glass-border)]"></div>
                        <span className="flex-shrink-0 mx-4 text-xs text-[var(--text-muted)] uppercase">Or sign in with email</span>
                        <div className="flex-grow border-t border-[var(--glass-border)]"></div>
                    </div>
                </div>

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
                </form>



                <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
                    Don't have an account? <Link to="/register" className="text-[var(--brand-secondary)] hover:underline">Sign up</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
