import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../../styles/design-system.css';
import { useAuth } from '../../context/AuthContext';

const Register: React.FC = () => {
    const navigate = useNavigate();
    const { register, loginWithGoogle, loginWithFacebook } = useAuth();
    const [role, setRole] = useState<'consumer' | 'merchant'>('consumer');
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        address: '',
        storeName: '',
        businessType: 'Retail'
    });

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.password.length < 6) {
            alert('Password must be at least 6 characters long.');
            return;
        }

        await register({
            ...formData,
            role
        });

        if (role === 'merchant') {
            navigate('/merchant/onboarding'); // Redirect to merchant setup
        } else {
            navigate('/'); // Redirect to home
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--surface-0)]">
            <div className="glass-panel w-full max-w-md p-8 animate-fade-in">
                <h1 className="text-3xl font-bold mb-2 text-[var(--brand-primary)]">Join Spendigo</h1>
                <p className="text-[var(--text-muted)] mb-8">Smart savings for everyone.</p>

                {/* Role Switcher */}
                <div className="flex p-1 bg-[var(--surface-2)] rounded-lg mb-6">
                    <button
                        type="button"
                        onClick={() => setRole('consumer')}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${role === 'consumer'
                            ? 'bg-white text-[var(--brand-primary)] shadow-sm'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                            }`}
                    >
                        🛒 Shopper
                    </button>
                    <button
                        type="button"
                        onClick={() => setRole('merchant')}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${role === 'merchant'
                            ? 'bg-white text-[var(--brand-primary)] shadow-sm'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                            }`}
                    >
                        🏪 Merchant
                    </button>
                </div>

                {/* Social Login for Both Roles */}
                <div className="space-y-3 mb-6 animate-fade-in">
                    <button
                        type="button"
                        onClick={async () => {
                            const success = await loginWithGoogle(role);
                            if (success) {
                                if (role === 'merchant') navigate('/merchant/dashboard'); // Or onboarding
                                else navigate('/');
                            }
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
                        <span className="text-sm">Sign up with Google</span>
                    </button>

                    <button
                        type="button"
                        onClick={async () => {
                            await loginWithFacebook();
                            navigate('/');
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-sm)] bg-[#1877F2] text-white font-medium hover:brightness-110 transition-all shadow-sm"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                        <span className="text-sm">Sign up with Facebook</span>
                    </button>

                    <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-[var(--glass-border)]"></div>
                        <span className="flex-shrink-0 mx-4 text-xs text-[var(--text-muted)] uppercase">Or continue with email</span>
                        <div className="flex-grow border-t border-[var(--glass-border)]"></div>
                    </div>
                </div>

                {role === 'consumer' && (
                    <div className="space-y-3 mb-6 animate-fade-in">
                    </div>
                )}

                <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-[var(--text-main)]">Full Name</label>
                        <input
                            type="text"
                            required
                            className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-1)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none transition-colors"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 text-[var(--text-main)]">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-1)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none transition-colors"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>

                    {/* Merchant Specific Fields */}
                    {role === 'merchant' && (
                        <>
                            <div className="animate-fade-in">
                                <label className="block text-sm font-medium mb-1 text-[var(--text-main)]">Store Name</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. FreshMart Queen St"
                                    className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-1)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none transition-colors"
                                    value={formData.storeName}
                                    onChange={e => setFormData({ ...formData, storeName: e.target.value })}
                                />
                            </div>
                            <div className="animate-fade-in">
                                <label className="block text-sm font-medium mb-1 text-[var(--text-main)]">Business Type</label>
                                <select
                                    className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-1)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none transition-colors"
                                    value={formData.businessType}
                                    onChange={e => setFormData({ ...formData, businessType: e.target.value })}
                                >
                                    <option>Grocery</option>
                                    <option>Convenience</option>
                                    <option>Farmers Market</option>
                                    <option>Artisan Bakery</option>
                                    <option>Local Café</option>
                                    <option>Butcher Shop</option>
                                    <option>Fishmonger</option>
                                    <option>Craft Shop</option>
                                    <option>Florist</option>
                                    <option>Bookstore</option>
                                    <option>Home & Garden</option>
                                    <option>Restaurant</option>
                                    <option>Retail</option>
                                    <option>Other</option>
                                </select>
                            </div>
                        </>
                    )}

                    {/* Consumer Specific Fields */}
                    {role === 'consumer' && (
                        <div className="animate-fade-in">
                            <label className="block text-sm font-medium mb-1 text-[var(--text-main)]">Delivery Address</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. 123 Queen St W"
                                className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-1)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none transition-colors"
                                value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium mb-1 text-[var(--text-main)]">Password</label>
                        <input
                            type="password"
                            required
                            className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-1)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none transition-colors"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                        />
                    </div>

                    <button type="submit" className="w-full py-3 rounded-[var(--radius-md)] bg-[var(--brand-primary)] text-white font-bold hover:brightness-110 transition-all shadow-lg shadow-[var(--brand-primary)]/20">
                        {role === 'merchant' ? 'Start Selling' : 'Create Account'}
                    </button>
                </form>

                <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
                    Already have an account? <Link to="/login" className="text-[var(--brand-secondary)] hover:underline">Log in</Link>
                </p>
            </div>
        </div>
    );
};

export default Register;
