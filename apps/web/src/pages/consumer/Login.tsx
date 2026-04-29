import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import '../../styles/design-system.css';

import { useAuth } from '../../context/AuthContext';
import { useAudit } from '../../context/AuditContext';
import { DEMO_USERS } from '../../data/demoUsers';
import { useTranslation } from 'react-i18next';
import SEO from '../../components/SEO';
import { auth } from '../../lib/firebase';

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, user, loginWithGoogle, loginWithFacebook } = useAuth();
    const { logEvent } = useAudit();
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [mfaResolver, setMfaResolver] = useState<any>(null);
    const [mfaCode, setMfaCode] = useState('');
    const [verificationId, setVerificationId] = useState('');
    const recaptchaVerifier = useRef<any>(null);

    useEffect(() => {
        return () => {
            if (recaptchaVerifier.current) {
                recaptchaVerifier.current.clear();
                recaptchaVerifier.current = null;
            }
        };
    }, []);

    // Redirect immediately when user is authenticated
    useEffect(() => {
        if (user && !isLoading) {
            console.log('[Login] User detected, initiating redirect...', user.role);
            
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
    }, [user, navigate, location, isLoading]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const success = await login(email, password);
            if (!success) {
                setError(t('loginFailed'));
            }
        } catch (err: any) {
            console.error(err);
            if (err?.code === 'auth/multi-factor-auth-required') {
                setIsLoading(true);
                import('firebase/auth').then(async ({ getMultiFactorResolver, RecaptchaVerifier }) => {
                    try {
                        const resolver = getMultiFactorResolver(auth, err);
                        setMfaResolver(resolver);
                        
                        if (!recaptchaVerifier.current) {
                            recaptchaVerifier.current = new RecaptchaVerifier(auth, 'mfa-recaptcha-login', { size: 'invisible' });
                        }
                    } catch (e) {
                         console.error("MFA Resolver setup error:", e);
                         setError('Failed to setup MFA. Please try again.');
                    } finally {
                        setIsLoading(false);
                    }
                });
                return;
            }
            setError(t('invalidCredentials'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleMfaSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mfaResolver) return;
        setError('');
        setIsLoading(true);
        try {
            const { PhoneAuthProvider, PhoneMultiFactorGenerator } = await import('firebase/auth');
            const credential = PhoneAuthProvider.credential(verificationId, mfaCode);
            const assertion = PhoneMultiFactorGenerator.assertion(credential);
            await mfaResolver.resolveSignIn(assertion);
            // Resolving the sign-in triggers onAuthStateChanged, navigating automatically
        } catch (err: any) {
            console.error(err);
            setError('Invalid SMS code.');
            setIsLoading(false);
        }
    };

    // if (isLoading) return <div className="p-10 text-center">{t('loading')}</div>;

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--surface-0)]">
            <SEO title="Sign In" description="Sign in to your Spendigo account to start shopping local and saving more." path="/login" />
            <div className="glass-panel w-full max-w-md p-8 animate-fade-in">
                <div className="flex items-center justify-center gap-3 mb-8">
                    <img src="/app-icon.png" alt="Spendigo Logo" style={{width: 56, height: 56, borderRadius: 12}} />
                    <span className="text-4xl font-black text-[var(--text-main)] italic tracking-tighter">Spendigo</span>
                </div>
                <h1 className="text-3xl font-bold mb-2 text-[var(--brand-primary)] text-center">{t('welcomeBack')}</h1>
                <p className="text-[var(--text-muted)] mb-8 text-center">{t('signInToAccess')}</p>

                {/* Recaptcha hidden container */}
                <div id="mfa-recaptcha-login"></div>

                {mfaResolver && !verificationId ? (
                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        if (!mfaResolver || !recaptchaVerifier.current) return;
                        setError('');
                        setIsLoading(true);
                        try {
                            const { PhoneAuthProvider } = await import('firebase/auth');
                            const hint = mfaResolver.hints[0];
                            const phoneProvider = new PhoneAuthProvider(auth);
                            const vid = await phoneProvider.verifyPhoneNumber({
                                multiFactorHint: hint,
                                session: mfaResolver.session
                            }, recaptchaVerifier.current);
                            setVerificationId(vid);
                        } catch (err: any) {
                            console.error(err);
                            setError(err.message || 'Failed to dispatch SMS.');
                        } finally {
                            setIsLoading(false);
                        }
                    }} className="space-y-4">
                        <p className="text-sm text-[var(--text-main)] mb-4">Your account requires two-factor authentication.</p>
                        <p className="text-xs text-[var(--text-muted)] mb-4">A text message will be sent to your number ending in {mfaResolver.hints[0]?.phoneNumber?.slice(-4)}</p>
                        {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</p>}
                        <button disabled={isLoading} type="submit" className="w-full py-4 rounded-[var(--radius-md)] bg-white border border-[var(--glass-border)] text-[var(--brand-primary)] font-bold shadow-sm transition-all text-sm">
                            {isLoading ? 'Sending SMS...' : 'Send SMS Code'}
                        </button>
                    </form>
                ) : mfaResolver && verificationId ? (
                    <form onSubmit={handleMfaSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-[var(--text-main)]">SMS Verification Code</label>
                            <input
                                type="text"
                                required
                                placeholder="000 000"
                                maxLength={6}
                                className="w-full text-center text-2xl tracking-widest p-4 rounded-[var(--radius-sm)] bg-[var(--surface-1)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none font-mono"
                                value={mfaCode}
                                onChange={e => setMfaCode(e.target.value)}
                            />
                            {mfaResolver.hints.length > 0 && (
                                <p className="text-xs mt-4 text-[var(--text-muted)] text-center">
                                    A verification code was sent to your phone ending in {mfaResolver.hints[0].phoneNumber?.slice(-4)}
                                </p>
                            )}
                        </div>
                        {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</p>}
                        <button disabled={isLoading || !verificationId} type="submit" className="w-full py-4 rounded-[var(--radius-md)] bg-[var(--brand-primary)] text-white font-bold hover:brightness-110 shadow-lg shadow-[var(--brand-primary)]/20 transition-all uppercase tracking-wide text-sm">
                            {isLoading || !verificationId ? 'Verifying...' : 'Verify Code'}
                        </button>
                    </form>
                ) : (
                    <>
                        <div className="space-y-3 mb-6 animate-fade-in">
                    <button
                        type="button"
                        disabled={isLoading}
                        onClick={async () => {
                            setIsLoading(true);
                            try {
                                const success = await loginWithGoogle();
                                if (!success) setIsLoading(false);
                                // Navigation handled by useEffect
                            } catch (e) {
                                console.error(e);
                                setIsLoading(false);
                            }
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-sm)] bg-white border border-[var(--glass-border)] text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 transition-all shadow-sm"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#EA4335" d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12z" />
                            <path fill="#FFF" d="M12.5 6.5c1.3 0 2.4.4 3.3 1.2l2.4-2.4C16.8 3.9 14.8 3 12.5 3 8.6 3 5.3 5.2 3.7 8.5l2.9 2.3c.7-2.3 2.9-3.9 5.4-3.9.1 0 .3 0 .5.1z" />
                            <path fill="#FFF" d="M21.5 10h-9v3.5h5.3c-.3 1.8-1.9 3.3-3.8 3.5v2.8h4.6c2.7-2.5 2.9-6.9 2.9-9.8 0-.3 0-.6 0-1z" />
                            <path fill="#FFF" d="M12.5 21.5c2.4 0 4.6-.8 6.2-2.2l-2.9-2.3c-.8.5-1.9.9-3.3.9-2.6 0-4.8-1.7-5.6-4.1l-2.9 2.3c1.6 3.1 4.9 5.4 8.5 5.4z" />
                            <path fill="#FFF" d="M6.9 13.8c-.4-1.2-.4-2.4 0-3.6l-2.9-2.3C2.8 9.6 2.8 14.4 4 16.1l2.9-2.3z" />
                            <path fill="none" d="M3 3h18v18H3z" />
                        </svg>
                        <span className="text-sm">{isLoading ? t('loading') : t('signInGoogle')}</span>
                    </button>

                    <button
                        type="button"
                        disabled={isLoading}
                        onClick={async () => {
                            setIsLoading(true);
                            try {
                                await loginWithFacebook();
                            } catch (e) {
                                console.error(e);
                                setIsLoading(false);
                            }
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-sm)] bg-[#1877F2] text-white font-medium hover:brightness-110 disabled:opacity-50 transition-all shadow-sm"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                        <span className="text-sm">{isLoading ? t('loading') : t('signInFacebook')}</span>
                    </button>

                    <div className="relative flex items-center py-2">
                        <div className="flex-grow border-t border-[var(--glass-border)]"></div>
                        <span className="flex-shrink-0 mx-4 text-xs text-[var(--text-muted)] uppercase">{t('orSignInEmail')}</span>
                        <div className="flex-grow border-t border-[var(--glass-border)]"></div>
                    </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-[var(--text-main)]">{t('email')}</label>
                        <input
                            type="email"
                            required
                            className="w-full p-3 rounded-[var(--radius-sm)] bg-[var(--surface-1)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none transition-colors"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-[var(--text-main)]">{t('password')}</label>
                            <Link to="/forgot-password" className="text-xs text-[var(--brand-primary)] hover:underline">{t('forgotPassword')}</Link>
                        </div>
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
                        {t('signIn')}
                    </button>
                </form>
                    </>
                )}



                <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
                    {t('noAccount')} <Link to="/register" className="text-[var(--brand-secondary)] hover:underline">{t('signUp')}</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
