import React from 'react';
import { Link } from 'react-router-dom';
import { useCookieConsent } from '../hooks/useCookieConsent';

const CookieConsentBanner: React.FC = () => {
    const { consent, accept, decline } = useCookieConsent();

    if (consent !== null) return null;

    return (
        <div className="fixed bottom-[calc(4rem+var(--safe-area-bottom))] md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-[120] animate-slide-up">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl p-5">
                <div className="flex items-start gap-3 mb-4">
                    <span className="text-xl shrink-0">🍪</span>
                    <div>
                        <p className="text-sm font-bold text-gray-900 mb-1">We use cookies</p>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            We use analytics cookies to improve your experience and measure app performance. No advertising tracking.{' '}
                            <Link to="/privacy" className="text-[var(--brand-primary)] font-semibold hover:underline">
                                Privacy Policy
                            </Link>
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={accept}
                        className="flex-1 py-2.5 bg-[var(--brand-primary)] text-white text-xs font-black rounded-xl hover:brightness-110 transition-all shadow-sm shadow-blue-500/20"
                    >
                        Accept
                    </button>
                    <button
                        onClick={decline}
                        className="flex-1 py-2.5 bg-gray-100 text-gray-600 text-xs font-black rounded-xl hover:bg-gray-200 transition-all"
                    >
                        Decline
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CookieConsentBanner;
