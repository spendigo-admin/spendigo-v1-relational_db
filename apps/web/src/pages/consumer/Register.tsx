import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../../styles/design-system.css';
import { useAuth } from '../../context/AuthContext';

const Register: React.FC = () => {
    const navigate = useNavigate();
    const { register } = useAuth();
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
