import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

function cookieConsentAccepted(): boolean {
    try {
        return localStorage.getItem('spendigo_cookie_consent') === 'accepted';
    } catch {
        return false;
    }
}

/**
 * Initialize Sentry for error tracking and performance monitoring.
 * Gracefully no-ops if VITE_SENTRY_DSN is not set (local dev).
 * Session replay is only enabled when the user has accepted cookie consent —
 * error tracking (stack traces) runs regardless as it's operational data.
 */
export function initSentry() {
    if (!SENTRY_DSN) {
        console.info('[Sentry] No DSN configured — running without error tracking.');
        return;
    }

    const replayConsented = cookieConsentAccepted();

    Sentry.init({
        dsn: SENTRY_DSN,
        environment: import.meta.env.MODE,

        integrations: [
            Sentry.browserTracingIntegration(),
            ...(replayConsented ? [Sentry.replayIntegration({
                maskAllText: false,
                blockAllMedia: false,
            })] : []),
        ],

        tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,

        // Session replay only when cookie consent is granted
        replaysSessionSampleRate: replayConsented ? 0.1 : 0,
        replaysOnErrorSampleRate: replayConsented ? 1.0 : 0,

        beforeSend(event) {
            if (import.meta.env.DEV) {
                console.warn('[Sentry] Would have sent event:', event);
                return null;
            }
            return event;
        },
    });

    console.info('[Sentry] Initialized for', import.meta.env.MODE, '| replay:', replayConsented);
}

export { Sentry };
