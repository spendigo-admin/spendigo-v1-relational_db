import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth, ConsentData } from '../context/AuthContext';

const ReConsentModal: React.FC = () => {
    const { user, consentRequired, acceptConsent, logout } = useAuth();
    const [accepted, setAccepted] = useState(false);
    const [marketingConsent, setMarketingConsent] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [termsVersion, setTermsVersion] = useState('v1.0');
    const [privacyVersion, setPrivacyVersion] = useState('v1.0');

    useEffect(() => {
        if (!consentRequired) return;
        getDoc(doc(db, 'settings', 'platform')).then((snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.currentTermsVersion) setTermsVersion(data.currentTermsVersion);
                if (data.currentPrivacyVersion) setPrivacyVersion(data.currentPrivacyVersion);
            }
        });
    }, [consentRequired]);

    if (!consentRequired || !user) return null;

    const handleAccept = async () => {
        if (!accepted) return;
        setIsSubmitting(true);
        try {
            const consent: ConsentData = { termsVersion, privacyVersion, marketingConsent };
            await acceptConsent(consent);
        } catch (e) {
            console.error('[ReConsentModal] Failed to record consent:', e);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-fade-in">
                <div className="text-center mb-6">
                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">📋</span>
                    </div>
                    <h2 className="text-xl font-extrabold text-[var(--text-main)] mb-2">Updated Terms & Privacy</h2>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                        Our Terms of Service and Privacy Policy have been updated. Please review and accept to continue using Spendigo.
                    </p>
                </div>

                <div className="bg-[var(--surface-1)] rounded-xl p-4 mb-6 text-xs text-[var(--text-muted)] space-y-1">
                    <div className="flex justify-between">
                        <span>Terms of Service</span>
                        <span className="font-bold text-[var(--brand-primary)]">{termsVersion}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Privacy Policy</span>
                        <span className="font-bold text-[var(--brand-primary)]">{privacyVersion}</span>
                    </div>
                </div>

                <div className="space-y-3 mb-6">
                    <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            className="mt-0.5 w-5 h-5 rounded border-gray-300 text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                            checked={accepted}
                            onChange={e => setAccepted(e.target.checked)}
                        />
                        <span className="text-xs text-[var(--text-muted)] leading-relaxed group-hover:text-[var(--text-main)] transition-colors">
                            I agree to the updated{' '}
                            <Link to="/terms" target="_blank" className="text-[var(--brand-primary)] font-bold hover:underline">Terms of Service</Link>{' '}
                            and{' '}
                            <Link to="/privacy" target="_blank" className="text-[var(--brand-primary)] font-bold hover:underline">Privacy Policy</Link>.
                        </span>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            className="mt-0.5 w-5 h-5 rounded border-gray-300 text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                            checked={marketingConsent}
                            onChange={e => setMarketingConsent(e.target.checked)}
                        />
                        <span className="text-xs text-[var(--text-muted)] leading-relaxed group-hover:text-[var(--text-main)] transition-colors">
                            Receive promotions and deals from Spendigo and partner stores. (Optional)
                        </span>
                    </label>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleAccept}
                        disabled={!accepted || isSubmitting}
                        className="w-full py-3.5 bg-[var(--brand-primary)] text-white font-black rounded-xl hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                    >
                        {isSubmitting ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                Saving...
                            </span>
                        ) : 'Accept & Continue'}
                    </button>
                    <button
                        onClick={logout}
                        className="w-full py-2.5 text-sm font-bold text-[var(--text-muted)] hover:text-red-500 transition-colors"
                    >
                        Sign out instead
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReConsentModal;
