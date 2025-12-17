import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../../styles/design-system.css';

import { useAuth } from '../../context/AuthContext';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const { login, loading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        await login(email, password);

        // Redirect logic is handled inside login or effect, 
        // but for this mock we can check the user role manually after login logic
        // For simplicity in this mock flow, let's assume the context updates
        // and we can redirect based on email domain or just default to home

        if (email.includes('merchant')) {
            navigate('/merchant/dashboard');
        } else if (email.includes('admin')) {
            navigate('/admin/dashboard');
        } else {
            navigate('/');
        }
    };

    if (loading) return <div className="p-10 text-center">Loading...</div>;

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
                        <p className="font-bold mb-1">Demo Credentials (Password: any):</p>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                            <p>consumer: shopper@example.com</p>
                            <p>admin: admin@spendigo.ca</p>
                            <p className="col-span-2 font-bold mt-1 border-t border-blue-200 pt-1">Store Owners:</p>
                            <p>FreshMart: freshmart@store.com</p>
                            <p>QuickPick: quick@pick.com</p>
                            <p>Metro: metro@express.com</p>
                            <p>Costco: costco@biz.com</p>
                            <p>Mac's: macs@corner.com</p>
                            <p>Hasty: hasty@mart.com</p>
                            <p>Bodega: bodega@corner.com</p>
                            <p>Farmers: green@valley.com</p>
                            <p>Bakery: daily@loaf.com</p>
                            <p>Butcher: butcher@block.com</p>
                            <p>Books: book@nook.com</p>
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
