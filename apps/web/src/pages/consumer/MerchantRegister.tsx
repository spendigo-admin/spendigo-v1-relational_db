import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../../styles/design-system.css';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import { BUSINESS_TYPES } from '../merchant/Settings';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const MerchantRegister: React.FC = () => {
    const navigate = useNavigate();
    const { register } = useAuth();
    const { t } = useTranslation();
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
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
        postalCode: '',
        agreedToTerms: false
    });
    const [allowRegistrations, setAllowRegistrations] = useState<boolean | null>(null);
    const [currentTermsVersion, setCurrentTermsVersion] = useState('v1.0');
    const [currentPrivacyVersion, setCurrentPrivacyVersion] = useState('v1.0');

    useEffect(() => {
        const docRef = doc(db, 'settings', 'platform');
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setAllowRegistrations(data.allowPartnerRegistrations !== false);
                if (data.currentTermsVersion) setCurrentTermsVersion(data.currentTermsVersion);
                if (data.currentPrivacyVersion) setCurrentPrivacyVersion(data.currentPrivacyVersion);
            } else {
                setAllowRegistrations(true);
            }
        });
        return () => unsubscribe();
    }, []);

    const nextStep = () => {
        // Simple client-side validation per step
        if (step === 1) {
            if (!formData.name || !formData.email || !formData.password || !formData.phoneNumber) {
                setError('Please fill in all personal details.');
                return;
            }
            if (formData.password.length < 6) {
                setError(t('passwordLength'));
                return;
            }
        } else if (step === 2) {
            if (!formData.storeName || !formData.businessRegistrationNumber) {
                setError('Please fill in your business details.');
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

        try {
            const success = await register({
                ...formData,
                role: 'merchant'
            }, {
                termsVersion: currentTermsVersion,
                privacyVersion: currentPrivacyVersion,
            });

            if (success) {
                navigate('/merchant/onboarding');
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
        { id: 1, name: t('registerStepAccount'), icon: '👤' },
        { id: 2, name: t('registerStepBusiness'), icon: '🏪' },
        { id: 3, name: t('registerStepLocation'), icon: '📍' }
    ];

    return (
        <div className="min-h-screen bg-[var(--surface-1)] py-12 px-4 flex flex-col items-center">
            <SEO title="Merchant Registration" description="Register your business on Spendigo and grow your store." path="/register/business" />

            {/* Header */}
            <div className="w-full max-w-2xl text-center mb-8">
                <Link to="/" className="inline-block mb-6">
                    <div className="flex flex-col items-center">
                        <span className="text-3xl font-black text-[#112244] tracking-tighter leading-none">Spendigo</span>
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[#007AFF] mt-1">AI SmartCart</span>
                    </div>
                </Link>
                
                {/* PROMO BADGE */}
                <div className="mb-6 inline-flex items-center gap-2 bg-blue-50 border border-blue-100 px-5 py-2.5 rounded-2xl">
                    <span className="text-xl">🎁</span>
                    <div className="text-left">
                        <p className="text-[10px] font-black text-[#007AFF] uppercase tracking-widest leading-none">Founder Promo</p>
                        <p className="text-xs font-bold text-[#112244]">First 100 Stores: 90-Day Free Trial</p>
                    </div>
                </div>

                <h1 className="text-3xl font-black text-[#112244] tracking-tight mb-2 italic">Partner Registration</h1>
                <p className="text-[var(--text-muted)] max-w-lg mx-auto">Join the Spendigo marketplace and start reaching thousands of nearby shoppers.</p>
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
                                <span className="text-2xl">🤝</span>
                                <h3 className="font-bold text-lg">{t('registerPartnerIntakeOnHold')}</h3>
                            </div>
                            <p className="text-sm opacity-90">
                                We are currently not accepting new partner registrations as we scale our current merchants. Please contact our business relations team at partners@spendigo.ca to be added to the waitlist.
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-3 animate-fade-in">
                            <span>⚠️</span> {error}
                        </div>
                    )}

                    <form onSubmit={handleRegister} className="space-y-6">
                        {/* STEP 1: ACCOUNT INFO */}
                        {step === 1 && (
                            <div className="animate-fade-in space-y-4">
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
                                    <label className="text-sm font-bold text-[var(--text-main)] ml-1">{t('authEmailAddress')}</label>
                                    <input
                                        type="email"
                                        placeholder="business@example.com"
                                        className="w-full p-3.5 rounded-xl bg-[var(--surface-1)] border border-[var(--glass-border)] focus:border-[var(--brand-primary)] outline-none transition-all focus:ring-4 focus:ring-[var(--brand-primary)]/5"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        disabled={isLoading}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-[var(--text-main)] ml-1">{t('registerCreatePassword')}</label>
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

                        {/* STEP 2: BUSINESS DETAILS */}
                        {step === 2 && (
                            <div className="animate-fade-in space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-[var(--text-main)] ml-1">{t('storeName')}</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. FreshMart Queen St"
                                        className="w-full p-3.5 rounded-xl bg-[var(--surface-1)] border border-[var(--glass-border)] focus:border-[var(--brand-primary)] outline-none transition-all focus:ring-4 focus:ring-[var(--brand-primary)]/5"
                                        value={formData.storeName}
                                        onChange={e => setFormData({ ...formData, storeName: e.target.value })}
                                        disabled={isLoading}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-[var(--text-main)] ml-1">{t('businessRegNum')}</label>
                                    <input
                                        type="text"
                                        placeholder="12345 6789 RT0001"
                                        className="w-full p-3.5 rounded-xl bg-[var(--surface-1)] border border-[var(--glass-border)] focus:border-[var(--brand-primary)] outline-none transition-all focus:ring-4 focus:ring-[var(--brand-primary)]/5"
                                        value={formData.businessRegistrationNumber}
                                        onChange={e => setFormData({ ...formData, businessRegistrationNumber: e.target.value })}
                                        disabled={isLoading}
                                    />
                                    <p className="text-[11px] text-[var(--text-muted)] italic ml-1">Your 9-digit registration number prefix is required for verification.</p>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-[var(--text-main)] ml-1">{t('businessType')}</label>
                                    <select
                                        className="w-full p-3.5 rounded-xl bg-[var(--surface-1)] border border-[var(--glass-border)] focus:border-[var(--brand-primary)] outline-none transition-all focus:ring-4 focus:ring-[var(--brand-primary)]/5 appearance-none cursor-pointer"
                                        value={formData.businessType}
                                        onChange={e => setFormData({ ...formData, businessType: e.target.value })}
                                        disabled={isLoading}
                                    >
                                        {Object.keys(BUSINESS_TYPES).map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: LOCATION */}
                        {step === 3 && (
                            <div className="animate-fade-in space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-[var(--text-main)] ml-1">{t('profileStreetAddress')}</label>
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
                                        <label className="text-sm font-bold text-[var(--text-main)] ml-1">{t('registerProvince')}</label>
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
                                            {t('registerAgreeTerms')} <Link to="/terms" className="text-[var(--brand-primary)] font-bold">{t('registerTermsOfService')}</Link>, <Link to="/privacy" className="text-[var(--brand-primary)] font-bold">{t('registerPrivacyPolicy')}</Link>, {t('registerAnd')} <Link to="/merchant-terms" className="text-[var(--brand-primary)] font-bold">{t('registerMarketplaceAgreement')}</Link>.
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
                            
                            {step < 3 ? (
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
                                    className="flex-[2] py-4 px-6 rounded-2xl bg-[#007AFF] text-white font-black hover:brightness-110 shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale transition-all uppercase tracking-widest text-xs"
                                >
                                    {isLoading ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                            Processing...
                                        </>
                                    ) : (
                                        <>🚀 Create Profile</>
                                    )}
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                <div className="bg-[var(--surface-1)] p-6 text-center border-t border-[var(--glass-border)] flex flex-col items-center gap-2">
                    <p className="text-sm text-[var(--text-muted)]">
                        Already have a partner account? <Link to="/login" className="text-[var(--brand-primary)] font-bold hover:underline">Log in here</Link>
                    </p>
                    <Link to="/register" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
                        Register as a Shopper instead
                    </Link>
                </div>
            </div>

            {/* Trust Badges */}
            <div className="mt-12 flex flex-wrap justify-center gap-8 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                <div className="flex items-center gap-2 text-sm font-bold">🛡️ Secure Data Encoding</div>
                <div className="flex items-center gap-2 text-sm font-bold">💳 Stripe Verified</div>
                <div className="flex items-center gap-2 text-sm font-bold">🇨🇦 Canadian Owned</div>
            </div>
        </div>
    );
};

export default MerchantRegister;
