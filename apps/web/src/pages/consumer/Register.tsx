import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../../styles/design-system.css';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';

const Register: React.FC = () => {
    const navigate = useNavigate();
    const { register, loginWithGoogle, loginWithFacebook } = useAuth();
    const { t } = useTranslation();
    const [error, setError] = useState<string | null>(null);
    const [role, setRole] = useState<'consumer' | 'merchant'>('consumer');
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        phoneNumber: '',
        storeName: '',
        businessRegistrationNumber: '',
        businessType: 'Grocery Store',
        street: '',
        city: '',
        province: 'ON',
        postalCode: ''
    });

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (formData.password.length < 6) {
            setError(t('passwordLength'));
            return;
        }

        try {
            const success = await register({
                ...formData,
                role
            });

            if (success) {
                if (role === 'merchant') {
                    navigate('/merchant/onboarding'); // Redirect to merchant setup
                } else {
                    navigate('/'); // Redirect to home
                }
            } else {
                setError('Registration failed. Please try again.');
            }
        } catch (err: any) {
            console.error('Registration error:', err);
            setError(err.message || 'Registration failed');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--surface-0)]">
            <SEO title="Create Account" description="Join Spendigo and start saving on groceries. Sign up as a shopper or a local merchant." path="/register" />
            <div className="glass-panel w-full max-w-md p-8 animate-fade-in">
                <h1 className="text-3xl font-bold mb-2 text-[var(--brand-primary)]">{t('joinSpendigo')}</h1>
                <p className="text-[var(--text-muted)] mb-8">{t('smartSavings')}</p>

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
                        🛒 {t('shopper')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setRole('merchant')}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${role === 'merchant'
                            ? 'bg-white text-[var(--brand-primary)] shadow-sm'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                            }`}
                    >
                        🏪 {t('merchant')}
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
                        <span className="text-sm">{t('signUpGoogle')}</span>
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
                        <span className="text-sm">{t('signUpFacebook')}</span>
                    </button>

                    <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-[var(--glass-border)]"></div>
                        <span className="flex-shrink-0 mx-4 text-xs text-[var(--text-muted)] uppercase">{t('orContinueEmail')}</span>
                        <div className="flex-grow border-t border-[var(--glass-border)]"></div>
                    </div>
                </div>


                <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-[var(--text-main)]">{t('fullName')}</label>
                        <input
                            type="text"
                            required
                            className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-1)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none transition-colors"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 text-[var(--text-main)]">{t('email')}</label>
                        <input
                            type="email"
                            required
                            className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-1)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none transition-colors"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 text-[var(--text-main)]">{t('phoneNumber')}</label>
                        <input
                            type="tel"
                            required
                            placeholder="+1 (555) 000-0000"
                            className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-1)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none transition-colors"
                            value={formData.phoneNumber}
                            onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                        />
                    </div>

                    {/* Merchant Specific Fields */}
                    {role === 'merchant' && (
                        <>
                            <div className="animate-fade-in">
                                <label className="block text-sm font-medium mb-1 text-[var(--text-main)]">{t('storeName')}</label>
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
                                <label className="block text-sm font-medium mb-1 text-[var(--text-main)]">{t('businessRegNum')}</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. 12345 6789 RT0001"
                                    className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-1)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none transition-colors"
                                    value={formData.businessRegistrationNumber}
                                    onChange={e => setFormData({ ...formData, businessRegistrationNumber: e.target.value })}
                                />
                                <p className="text-xs text-[var(--text-muted)] mt-1">{t('verifyBusinessHelp')}</p>
                            </div>
                            <div className="animate-fade-in">
                                <label className="block text-sm font-medium mb-1 text-[var(--text-main)]">{t('businessType')}</label>
                                <select
                                    className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-1)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none transition-colors"
                                    value={formData.businessType}
                                    onChange={e => setFormData({ ...formData, businessType: e.target.value })}
                                >
                                    <option>Grocery Store</option>
                                    <option>Convenience Store</option>
                                    <option>Discount / Dollar Store</option>
                                    <option>Ethnic / Specialty Grocery</option>
                                    <option>Farmers Market Vendor</option>
                                    <option>Organic / Health Food Store</option>
                                    <option>Artisan Bakery</option>
                                    <option>Butcher Shop</option>
                                    <option>Fishmonger / Seafood Shop</option>
                                    <option>Deli / Prepared Foods</option>
                                    <option>Restaurant</option>
                                    <option>Local Café / Coffee Shop</option>
                                    <option>Dessert & Sweets Shop</option>
                                    <option>Meal Prep / Tiffin Service</option>
                                    <option>Pharmacy / Health Store</option>
                                    <option>Pet Store</option>
                                    <option>Florist</option>
                                    <option>Home & Garden Store</option>
                                    <option>Hardware Store</option>
                                    <option>Bookstore / Stationery</option>
                                    <option>Craft / Handmade Goods Store</option>
                                    <option>Clothing / Boutique</option>
                                    <option>Toy & Gift Store</option>
                                    <option>Electronics / Mobile Accessories</option>
                                    <option>Thrift / Second-Hand Store</option>
                                    <option>General Retail</option>
                                    <option>Specialty Retail</option>
                                </select>
                            </div>
                        </>
                    )}

                    {/* Address Fields (Common) */}
                    <div className="space-y-3 animate-fade-in">
                        <label className="block text-sm font-medium text-[var(--text-main)]">
                            {role === 'merchant' ? t('storeLocation') : t('deliveryAddress')}
                        </label>

                        <input
                            type="text"
                            required
                            placeholder="Street Address"
                            className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-1)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none transition-colors"
                            value={formData.street}
                            onChange={e => setFormData({ ...formData, street: e.target.value })}
                        />

                        <div className="flex gap-2">
                            <input
                                type="text"
                                required
                                placeholder={t('city')}
                                className="flex-[2] p-3 rounded-[var(--radius-sm)] bg-[var(--surface-1)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none transition-colors"
                                value={formData.city}
                                onChange={e => setFormData({ ...formData, city: e.target.value })}
                            />
                            <select
                                className="flex-1 p-3 rounded-[var(--radius-sm)] bg-[var(--surface-1)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none transition-colors"
                                value={formData.province}
                                onChange={e => setFormData({ ...formData, province: e.target.value })}
                            >
                                <option value="ON">ON</option>
                                <option value="BC">BC</option>
                                <option value="AB">AB</option>
                                <option value="QC">QC</option>
                                <option value="MB">MB</option>
                                <option value="NS">NS</option>
                                <option value="NB">NB</option>
                                <option value="SK">SK</option>
                                <option value="NL">NL</option>
                                <option value="PE">PE</option>
                            </select>
                        </div>

                        <input
                            type="text"
                            required
                            placeholder={t('postalCode')}
                            className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-1)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none transition-colors"
                            value={formData.postalCode}
                            onChange={e => setFormData({ ...formData, postalCode: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 text-[var(--text-main)]">{t('password')}</label>
                        <input
                            type="password"
                            required
                            className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-1)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none transition-colors"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                        />
                    </div>

                    <button type="submit" className="w-full py-3 rounded-[var(--radius-md)] bg-[var(--brand-primary)] text-white font-bold hover:brightness-110 transition-all shadow-lg shadow-[var(--brand-primary)]/20">
                        {role === 'merchant' ? t('startSelling') : t('createAccount')}
                    </button>
                </form>

                <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
                    {t('alreadyHaveAccount')} <Link to="/login" className="text-[var(--brand-secondary)] hover:underline">{t('logIn')}</Link>
                </p>
            </div>
        </div>
    );
};

export default Register;
