import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

const STALE_TOKEN_ERRORS = new Set([
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered',
]);

/**
 * Removes FCM tokens that failed with permanent errors from the user's document.
 * Call after sendEachForMulticast to keep the token list clean.
 */
export const removeStaleTokens = async (
    userId: string,
    tokens: string[],
    responses: admin.messaging.SendResponse[]
): Promise<void> => {
    const staleTokens = responses
        .map((res, i) => (!res.success && res.error && STALE_TOKEN_ERRORS.has(res.error.code)) ? tokens[i] : null)
        .filter((t): t is string => t !== null);

    if (staleTokens.length > 0) {
        await admin.firestore().collection('users').doc(userId).update({
            fcmTokens: admin.firestore.FieldValue.arrayRemove(...staleTokens)
        });
        functions.logger.info(`Removed ${staleTokens.length} stale FCM tokens for user ${userId}`);
    }
};
