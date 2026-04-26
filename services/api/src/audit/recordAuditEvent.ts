import * as functions from 'firebase-functions';
import { logEvent } from '../utils/audit';

/**
 * Cloud Function to record audit events from the client-side.
 * This acts as a bridge for shoppers and other users to contribute 
 * to the forensic ledger securely.
 */
export const recordAuditEvent = functions.https.onCall(async (data, context) => {
    const { action, resource, metadata } = data;

    // 1. Security Check (App Check & Auth)
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
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
        'AUTH_SOCIAL_LOGIN_FAILURE'
    ];

    if (!context.auth && !allowUnauthenticatedActions.includes(action)) {
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

    try {
        const actor = context.auth 
            ? {
                id: context.auth.uid,
                email: context.auth.token.email || 'unauthenticated',
                ip: context.rawRequest.ip || 'unknown'
              }
            : {
                id: 'unauthenticated',
                email: metadata?.email || 'unauthenticated',
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
