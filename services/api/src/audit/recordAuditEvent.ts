import * as functions from 'firebase-functions';
import { logEvent } from '../utils/audit';

/**
 * Cloud Function to record audit events from the client-side.
 * This acts as a bridge for shoppers and other users to contribute 
 * to the forensic ledger securely.
 */
export const recordAuditEvent = functions.https.onCall(async (data, context) => {
    // 1. Security Check (App Check & Auth)
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError(
            'failed-precondition', 
            'The function must be called from an App Check verified app.'
        );
    }

    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated', 
            'Audit events can only be recorded for authenticated sessions.'
        );
    }

    const { action, resource, metadata } = data;

    if (!action) {
        throw new functions.https.HttpsError(
            'invalid-argument', 
            'Missing required field: action'
        );
    }

    try {
        await logEvent(
            action,
            {
                id: context.auth.uid,
                email: context.auth.token.email || 'unauthenticated',
                ip: context.rawRequest.ip || 'unknown'
            },
            metadata || {},
            resource || ''
        );

        return { success: true };
    } catch (e) {
        console.error("Failed to record audit event via logEvent utility:", e);
        throw new functions.https.HttpsError('internal', 'Failed to write to audit ledger');
    }
});
