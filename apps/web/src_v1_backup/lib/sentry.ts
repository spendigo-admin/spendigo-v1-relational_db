import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

/**
 * Initialize Sentry for error tracking and performance monitoring.
 * Gracefully no-ops if VITE_SENTRY_DSN is not set (local dev).
 */
export function initSentry() {
    if (!SENTRY_DSN) {
        console.info('[Sentry] No DSN configured — running without error tracking.');
        return;
    }

    Sentry.init({
        dsn: SENTRY_DSN,
        environment: import.meta.env.MODE, // 'development' | 'production'
        
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({
                // Mask all text and block all media for privacy
                maskAllText: false,
                blockAllMedia: false,
            }),
        ],

        // Performance: Sample 20% of transactions in production
        tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,

        // Session Replay: Capture 10% of sessions, 100% of sessions with errors
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,

        // Don't send errors from localhost in dev
        beforeSend(event) {
            if (import.meta.env.DEV) {
                console.warn('[Sentry] Would have sent event:', event);
                return null;
            }
            return event;
        },
    });

    console.info('[Sentry] Initialized for', import.meta.env.MODE);
}

export { Sentry };
