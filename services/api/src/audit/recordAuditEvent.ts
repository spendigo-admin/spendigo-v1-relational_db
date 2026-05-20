import * as functions from 'firebase-functions/v1';
import { logEvent } from '../utils/audit';
import { checkRateLimit } from '../utils/rateLimiter';

/**
 * Cloud Function to record audit events from the client-side.
 * This acts as a bridge for shoppers and other users to contribute
 * to the forensic ledger securely.
 */
export const recordAuditEvent = functions.https.onCall(async (data, context) => {
    const { action, resource, metadata } = data;

    // 1. Security Check (App Check & Auth)
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        console.warn(`[recordAuditEvent] Blocked: Missing App Check token for action ${action}. IP: ${context.rawRequest.ip}`);
        throw new functions.https.HttpsError(
            'failed-precondition',
            'The function must be called from an App Check verified app.'
        );
    }

    // Allow unauthenticated logs ONLY for critical security events (login/reg failures)
    // or if the user is already authenticated.
    const allowUnauthenticatedActions = [
        'AUTH_LOGIN_FAILURE',
        'AUTH_REGISTER_FAILURE',
        'AUTH_MFA_REQUIRED',
        'AUTH_SOCIAL_LOGIN_FAILURE',
        'AUTH_REGISTER_SUCCESS',
    ];

    if (!context.auth && !allowUnauthenticatedActions.includes(action)) {
        console.warn(`[recordAuditEvent] Blocked: Unauthenticated request for action ${action}. IP: ${context.rawRequest.ip}`);
        throw new functions.https.HttpsError(
            'unauthenticated',
            'Audit events generally require authenticated sessions.'
        );
    }

    if (!action) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Missing required field: action'
        );
    }

    // 2. Rate Limiting — prevents audit log flooding
    // Authenticated: 30 events/min per user. Unauthenticated: 5 events/min per IP.
    const rateLimitKey = context.auth ? context.auth.uid : `ip_${context.rawRequest.ip}`;
    const rateLimit = context.auth ? 30 : 5;
    await checkRateLimit(rateLimitKey, 'recordAuditEvent', rateLimit, 60 * 1000);

    try {
        const actor = context.auth 
            ? {
                id: context.auth.uid,
                email: context.auth.token.email || 'unauthenticated',
                ip: context.rawRequest.ip || 'unknown'
              }
            : {
                id: 'unauthenticated',
                email: 'anonymous',
                ip: context.rawRequest.ip || 'unknown'
              };

        await logEvent(
            action,
            actor,
            metadata || {},
            resource || ''
        );

        return { success: true };
    } catch (e) {
        console.error("Failed to record audit event via logEvent utility:", e);
        throw new functions.https.HttpsError('internal', 'Failed to write to audit ledger');
    }
});
