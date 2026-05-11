import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { multiFactor, PhoneAuthProvider, RecaptchaVerifier, PhoneMultiFactorGenerator } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import SEO from '../../components/SEO';

const MFAEnrollment = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [verificationId, setVerificationId] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    // We must persist the recaptcha verifier across re-renders
    const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);

    useEffect(() => {
        if (!auth.currentUser) {
            navigate('/login');
            return;
        }
        const userMfa = multiFactor(auth.currentUser);
        if (userMfa.enrolledFactors.length > 0) {
            navigate('/admin/dashboard');
            return;
        }

        // Initialize Recaptcha
        if (!recaptchaVerifier.current) {
            try {
                recaptchaVerifier.current = new RecaptchaVerifier(auth, 'mfa-recaptcha-enroll', {
                    size: 'invisible',
                });
            } catch (e) {
                console.error("Recaptcha Init Error:", e);
            }
        }

        return () => {
            if (recaptchaVerifier.current) {
                recaptchaVerifier.current.clear();
                recaptchaVerifier.current = null;
            }
        };
    }, [navigate]);

    const handleSendSms = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!auth.currentUser || !recaptchaVerifier.current) return;
        setError('');
        setLoading(true);

        try {
            const userMfa = multiFactor(auth.currentUser);
            const session = await userMfa.getSession();
            const phoneAuthProvider = new PhoneAuthProvider(auth);
            
            // Format phone if necessary (assuming user enters +1)
            let formattedPhone = phoneNumber.trim();
            if (!formattedPhone.startsWith('+')) {
                // Default to US/Canada +1 if they didn't provide country code
                const digits = formattedPhone.replace(/\D/g, '');
                formattedPhone = `+1${digits}`;
            }

            const phoneInfoOptions = {
                phoneNumber: formattedPhone,
                session,
            };

            const vid = await phoneAuthProvider.verifyPhoneNumber(phoneInfoOptions, recaptchaVerifier.current);
            setVerificationId(vid);
        } catch (err: any) {
            console.error("SMS Sending failed:", err);
            setError(err.message || 'Failed to send SMS code. Check your phone number.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!auth.currentUser || !verificationId) return;
        setLoading(true);
        setError('');

        try {
            const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
            const assertion = PhoneMultiFactorGenerator.assertion(credential);
            const userMfa = multiFactor(auth.currentUser);
            await userMfa.enroll(assertion, 'Primary Phone');
            
            // Success, reload window to force AuthContext to pick up new mfaEnrolled status
            window.location.href = '/admin/dashboard';
        } catch (err: any) {
            console.error(err);
            setError('Invalid code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--surface-0)]">
            <SEO title="Secure Your Account" description="Multi-Factor Authentication Enrollment" path="/admin/mfa-setup" />
            <div className="glass-panel w-full max-w-md p-8 animate-fade-in text-center shadow-lg border border-[var(--glass-border)]">
                <svg className="w-16 h-16 mx-auto mb-4 text-[var(--brand-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                <h1 className="text-2xl font-bold mb-2 text-[var(--text-main)]">SMS Authentication</h1>
                <p className="text-[var(--text-muted)] mb-6 text-sm">As an Admin, you are required to secure your account using Phone Number (SMS) verification.</p>

                {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm text-left">{error}</div>}

                {/* Recaptcha hidden container */}
                <div id="mfa-recaptcha-enroll"></div>

                {!verificationId ? (
                    <form onSubmit={handleSendSms} className="space-y-4 text-left">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-[var(--text-main)]">Mobile Phone Number</label>
                            <input
                                type="tel"
                                required
                                placeholder="+1 555-010-0000"
                                className="w-full text-lg p-3 rounded-[var(--radius-sm)] bg-[var(--surface-1)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none"
                                value={phoneNumber}
                                onChange={e => setPhoneNumber(e.target.value)}
                            />
                            <p className="text-xs mt-2 text-[var(--text-muted)]">Include the country code (e.g. +1 for US/CA)</p>
                        </div>
                        <button disabled={loading} type="submit" className="w-full py-4 rounded-[var(--radius-md)] bg-[var(--brand-primary)] text-white font-bold hover:brightness-110 shadow-lg shadow-[var(--brand-primary)]/20 transition-all uppercase tracking-wide text-sm">
                            {loading ? 'Sending SMS...' : 'Send Verification Code'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleVerify} className="space-y-4">
                        <p className="text-sm text-[var(--text-muted)] mb-4">Enter the 6-digit code sent to your phone.</p>
                        
                        <input
                            type="text"
                            required
                            maxLength={6}
                            placeholder="000 000"
                            className="w-full text-center text-2xl tracking-widest p-4 rounded-[var(--radius-sm)] bg-[var(--surface-1)] border border-[var(--glass-border)] text-[var(--text-main)] focus:border-[var(--brand-primary)] outline-none font-mono"
                            value={verificationCode}
                            onChange={e => setVerificationCode(e.target.value)}
                        />
                        <button disabled={loading} type="submit" className="w-full py-4 rounded-[var(--radius-md)] bg-[var(--brand-primary)] text-white font-bold hover:brightness-110 shadow-lg shadow-[var(--brand-primary)]/20 transition-all uppercase tracking-wide text-sm">
                            {loading ? 'Verifying...' : 'Verify and Enroll'}
                        </button>
                        <button type="button" onClick={() => { setVerificationId(''); setError(''); }} className="mt-4 text-xs text-[var(--text-muted)] font-medium hover:text-[var(--brand-primary)]">Change Phone Number</button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default MFAEnrollment;
