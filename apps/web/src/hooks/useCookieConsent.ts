import { useState, useCallback } from 'react';

const KEY = 'spendigo_cookie_consent';

export type CookieConsentValue = 'accepted' | 'declined' | null;

export function getCookieConsent(): CookieConsentValue {
    try {
        const stored = localStorage.getItem(KEY);
        if (stored === 'accepted' || stored === 'declined') return stored;
    } catch {
        // localStorage unavailable (private browsing on some browsers)
    }
    return null;
}

export function useCookieConsent() {
    const [consent, setConsent] = useState<CookieConsentValue>(getCookieConsent);

    const accept = useCallback(() => {
        try { localStorage.setItem(KEY, 'accepted'); } catch { /* ignore */ }
        setConsent('accepted');
    }, []);

    const decline = useCallback(() => {
        try { localStorage.setItem(KEY, 'declined'); } catch { /* ignore */ }
        setConsent('declined');
    }, []);

    return { consent, accept, decline };
}
