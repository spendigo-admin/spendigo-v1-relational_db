import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../../styles/design-system.css';
import { useAuth } from '../../context/AuthContext';
import { useAudit } from '../../context/AuditContext';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const Register: React.FC = () => {
    const navigate = useNavigate();
    const { register, loginWithGoogle, loginWithFacebook } = useAuth();
    const { logEvent } = useAudit();
    const { t } = useTranslation();
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        phoneNumber: '',
        street: '',
        city: '',
        province: 'ON',
        postalCode: '',
        agreedToTerms: false
    });
    const [allowRegistrations, setAllowRegistrations] = useState<boolean | null>(null);

    useEffect(() => {
        const docRef = doc(db, 'settings', 'platform');
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setAllowRegistrations(data.allowShopperRegistrations !== false);
            } else {
                setAllowRegistrations(true);
            }
        });
        return () => unsubscribe();
    }, []);

    const nextStep = () => {
        if (step === 1) {
            if (!formData.name || !formData.email || !formData.password) {
                setError('Please fill in your name, email, and password.');
                return;
            }
            if (formData.password.length < 6) {
                setError(t('passwordLength'));
                return;
            }
        }
        setError(null);
        setStep(prev => prev + 1);
    };

    const prevStep = () => {
        setError(null);
        setStep(prev => prev - 1);
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        // Validation for final step
        if (!formData.agreedToTerms) {
            setError('You must agree to the Terms of Service to register.');
            setIsLoading(false);
            return;
        }

        try {
            const success = await register({
                ...formData,
                role: 'consumer'
            });

            if (success) {
                await logEvent('AUTH_REGISTER_SUCCESS', {
                    email: formData.email.toLowerCase(),
                    name: formData.name,
                    role: 'consumer'
                }, 'auth/register');
                navigate('/'); // Redirect to home
            } else {
                setError('Registration failed. Please try again.');
            }
        } catch (err: any) {
            console.error('Registration error:', err);
            setError(err.message || 'Registration failed');
        } finally {
            setIsLoading(false);
        }
    };

    const steps = [
        { id: 1, name: 'Account', icon: '👤' },
        { id: 2, name: 'Delivery', icon: '📍' }
    ];

    return (
        <div className="min-h-screen bg-[var(--surface-1)] py-12 px-4 flex flex-col items-center">
            <SEO title="Shopper Registration" description="Create your Spendigo shopper account and start saving." path="/register" />
            
            {/* Header */}
            <div className="w-full max-w-2xl text-center mb-8">
                <Link to="/" className="inline-block mb-6">
                    <div className="flex flex-col items-center">
                        <span className="text-4xl font-black text-[#112244] tracking-tighter leading-none italic">Spendigo</span>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#007AFF] mt-1">AI SmartCart</span>
                    </div>
                </Link>
                
                <h1 className="text-3xl font-extrabold text-[var(--text-main)] mb-2">{t('joinSpendigo')}</h1>
                <p className="text-[var(--text-muted)] max-w-lg mx-auto">{t('shopperSubtitle')}</p>
            </div>

            <div className="w-full max-w-2xl bg-white rounded-3xl border border-[var(--glass-border)] shadow-2xl shadow-[var(--brand-primary)]/5 overflow-hidden animate-fade-in">
                {/* Progress Bar */}
                <div className="bg-gray-100 h-1.5 w-full">
                    <div
                        className="bg-[#007AFF] h-full transition-all duration-500 ease-out"
                        style={{ width: `${(step / steps.length) * 100}%` }}
                    ></div>
                </div>

                <div className="p-8 md:p-12">
                    {/* Step Indicators */}
                    <div className="flex justify-between mb-12">
                        {steps.map((s) => (
                            <div key={s.id} className="flex flex-col items-center gap-2 flex-1 relative">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black transition-all ${step >= s.id
                                        ? 'bg-[#112244] text-white scale-110 shadow-lg shadow-blue-500/10'
                                        : 'bg-gray-100 text-gray-400'
                                    }`}>
                                    {step > s.id ? '✓' : s.icon}
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${step >= s.id ? 'text-[#112244]' : 'text-gray-400'
                                    }`}>{s.name}</span>
                                {s.id < steps.length && (
                                    <div className={`absolute top-5 -right-1/2 w-full h-[1px] -z-10 ${step > s.id ? 'bg-[#007AFF]' : 'bg-gray-100'}`}></div>
                                )}
                            </div>
                        ))}
                    </div>

                    {allowRegistrations === false && (
                        <div className="mb-6 p-6 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 animate-fade-in shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-2xl">🛑</span>
                                <h3 className="font-bold text-lg">Registrations on Hold</h3>
                            </div>
                            <p className="text-sm opacity-90">
                                We are currently not accepting new shopper registrations. Please check back later or contact our support team if you have any questions.
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-3 animate-fade-in">
                            <span>⚠️</span> {error}
                        </div>
                    )}

                    <form onSubmit={handleRegister} className="space-y-6">
                        {/* STEP 1: ACCOUNT INFO & SOCIAL */}
                        {step === 1 && (
                            <div className="animate-fade-in space-y-6">
                                {/* Social Login (Only show on step 1) */}
                                <div className="space-y-3 mb-6 bg-[var(--surface-0)] p-4 rounded-2xl border border-[var(--glass-border)]">
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (allowRegistrations === false) return;
                                            const success = await loginWithGoogle('consumer');
                                            if (success) navigate('/');
                                        }}
                                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white border border-[var(--glass-border)] text-gray-700 font-bold transition-all shadow-sm ${allowRegistrations === false ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:bg-gray-50'}`}
                                        disabled={allowRegistrations === false}
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
                                            if (allowRegistrations === false) return;
                                            await loginWithFacebook();
                                            navigate('/');
                                        }}
                                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1877F2] text-white font-bold transition-all shadow-sm ${allowRegistrations === false ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:brightness-110'}`}
                                        disabled={allowRegistrations === false}
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

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-[var(--text-main)] ml-1">{t('fullName')}</label>
                                        <input
                                            type="text"
                                            placeholder="First & Last Name"
                                            className="w-full p-3.5 rounded-xl bg-[var(--surface-1)] border border-[var(--glass-border)] focus:border-[var(--brand-primary)] outline-none transition-all focus:ring-4 focus:ring-[var(--brand-primary)]/5"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            disabled={isLoading}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-[var(--text-main)] ml-1">{t('phoneNumber')}</label>
                                        <input
                                            type="tel"
                                            placeholder="+1 (555) 000-0000"
                                            className="w-full p-3.5 rounded-xl bg-[var(--surface-1)] border border-[var(--glass-border)] focus:border-[var(--brand-primary)] outline-none transition-all focus:ring-4 focus:ring-[var(--brand-primary)]/5"
                                            value={formData.phoneNumber}
                                            onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                                            disabled={isLoading}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-[var(--text-main)] ml-1">{t('email')}</label>
                                    <input
                                        type="email"
                                        placeholder="shopper@example.com"
                                        className="w-full p-3.5 rounded-xl bg-[var(--surface-1)] border border-[var(--glass-border)] focus:border-[var(--brand-primary)] outline-none transition-all focus:ring-4 focus:ring-[var(--brand-primary)]/5"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        disabled={isLoading}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-[var(--text-main)] ml-1">{t('password')}</label>
                                    <input
                                        type="password"
                                        placeholder="Minimum 6 characters"
                                        className="w-full p-3.5 rounded-xl bg-[var(--surface-1)] border border-[var(--glass-border)] focus:border-[var(--brand-primary)] outline-none transition-all focus:ring-4 focus:ring-[var(--brand-primary)]/5"
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>
                        )}

                        {/* STEP 2: LOCATION */}
                        {step === 2 && (
                            <div className="animate-fade-in space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-[var(--text-main)] ml-1">{t('deliveryAddress')}</label>
                                    <input
                                        type="text"
                                        placeholder="123 Smart St"
                                        className="w-full p-3.5 rounded-xl bg-[var(--surface-1)] border border-[var(--glass-border)] focus:border-[var(--brand-primary)] outline-none transition-all focus:ring-4 focus:ring-[var(--brand-primary)]/5"
                                        value={formData.street}
                                        onChange={e => setFormData({ ...formData, street: e.target.value })}
                                        disabled={isLoading}
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-[var(--text-main)] ml-1">{t('city')}</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Toronto"
                                            className="w-full p-3.5 rounded-xl bg-[var(--surface-1)] border border-[var(--glass-border)] focus:border-[var(--brand-primary)] outline-none transition-all focus:ring-4 focus:ring-[var(--brand-primary)]/5"
                                            value={formData.city}
                                            onChange={e => setFormData({ ...formData, city: e.target.value })}
                                            disabled={isLoading}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-[var(--text-main)] ml-1">Province</label>
                                        <select
                                            className="w-full p-3.5 rounded-xl bg-[var(--surface-1)] border border-[var(--glass-border)] focus:border-[var(--brand-primary)] outline-none transition-all focus:ring-4 focus:ring-[var(--brand-primary)]/5"
                                            value={formData.province}
                                            onChange={e => setFormData({ ...formData, province: e.target.value })}
                                            disabled={isLoading}
                                        >
                                            <option value="ON">ON</option>
                                            <option value="BC">BC</option>
                                            <option value="AB">AB</option>
                                            <option value="QC">QC</option>
                                            <option value="MB">MB</option>
                                            <option value="NS">NS</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-[var(--text-main)] ml-1">{t('postalCode')}</label>
                                    <input
                                        type="text"
                                        placeholder="M5V 1J2"
                                        className="w-full p-3.5 rounded-xl bg-[var(--surface-1)] border border-[var(--glass-border)] focus:border-[var(--brand-primary)] outline-none transition-all focus:ring-4 focus:ring-[var(--brand-primary)]/5"
                                        value={formData.postalCode}
                                        onChange={e => setFormData({ ...formData, postalCode: e.target.value.toUpperCase() })}
                                        disabled={isLoading}
                                    />
                                </div>

                                <div className="pt-4 border-t border-[var(--glass-border)]">
                                    <label className="flex items-start gap-3 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            className="mt-1 w-5 h-5 rounded border-[var(--glass-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                                            checked={formData.agreedToTerms}
                                            onChange={e => setFormData({ ...formData, agreedToTerms: e.target.checked })}
                                        />
                                        <span className="text-xs text-[var(--text-muted)] leading-relaxed group-hover:text-[var(--text-main)] transition-colors">
                                            I agree to the <Link to="/terms" className="text-[var(--brand-primary)] font-bold">Terms of Service</Link> and <Link to="/privacy" className="text-[var(--brand-primary)] font-bold">Privacy Policy</Link>.
                                        </span>
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* ACTIONS */}
                        <div className="flex gap-4 pt-4">
                            {step > 1 && (
                                <button
                                    type="button"
                                    onClick={prevStep}
                                    className="flex-1 py-4 px-6 rounded-2xl bg-[var(--surface-2)] text-[var(--text-main)] font-bold hover:bg-[var(--surface-3)] transition-all flex items-center justify-center gap-2"
                                    disabled={isLoading}
                                >
                                    ← {t('back', 'Back')}
                                </button>
                            )}
                            
                            {step < 2 ? (
                                <button
                                    type="button"
                                    onClick={nextStep}
                                    disabled={allowRegistrations === false}
                                    className={`flex-[2] py-4 px-6 rounded-2xl bg-[#112244] text-white font-black shadow-xl shadow-blue-500/10 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs ${allowRegistrations === false ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:bg-black'}`}
                                >
                                    Continue →
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={isLoading || !formData.agreedToTerms || allowRegistrations === false}
                                    className="flex-[2] py-4 px-6 rounded-2xl bg-[#007AFF] text-white font-black hover:brightness-110 shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale uppercase tracking-widest text-xs"
                                >
                                    {isLoading ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                            Processing...
                                        </>
                                    ) : (
                                        <>🚀 {t('createAccount')}</>
                                    )}
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                <div className="bg-[var(--surface-1)] p-6 text-center border-t border-[var(--glass-border)] flex flex-col items-center gap-2">
                    <p className="text-sm text-[var(--text-muted)]">
                        {t('alreadyHaveAccount')} <Link to="/login" className="text-[var(--brand-primary)] font-bold hover:underline">{t('logIn')}</Link>
                    </p>
                    <div className="mt-4 pt-4 border-t border-[var(--glass-border)] w-full">
                        <p className="text-xs text-[var(--text-muted)] mb-1">Are you a local business owner?</p>
                        <Link to="/partner" className="text-sm font-bold text-[var(--brand-primary)] hover:underline">
                            Partner with Spendigo →
                        </Link>
                    </div>
                </div>
            </div>
            
            {/* Trust Badges */}
            <div className="mt-12 flex flex-wrap justify-center gap-8 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                <div className="flex items-center gap-2 text-sm font-bold">🛡️ Secure Data Encoding</div>
                <div className="flex items-center gap-2 text-sm font-bold">🚚 Fast App Delivery</div>
                <div className="flex items-center gap-2 text-sm font-bold">🇨🇦 Proudly Canadian</div>
            </div>
        </div>
    );
};

export default Register;
