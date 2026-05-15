import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

/**
 * Enforces a rate limit for a specific user and action using a Firestore Sliding Window.
 * Throws a 'resource-exhausted' HttpsError if the limit is exceeded.
 *
 * @param uid The authenticated user ID performing the action
 * @param action The specific action identifier (e.g., 'placeOrder', 'createCheckout')
 * @param maxRequests The maximum number of requests allowed in the window
 * @param windowMs The time window in milliseconds (e.g., 60 * 1000 for 1 minute)
 */
export const checkRateLimit = async (
    uid: string,
    action: string,
    maxRequests: number,
    windowMs: number
): Promise<void> => {
    const db = admin.firestore();
    const docRef = db.collection('_rate_limits').doc(`${uid}_${action}`);

    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            const now = Date.now();

            if (!doc.exists) {
                // First request ever or TTL cleaned it up
                // Creating it with resetAt initialized at the end of the window
                transaction.set(docRef, {
                    count: 1,
                    resetAt: now + windowMs
                });
                return;
            }

            const data = doc.data();
            const resetAt = data?.resetAt || 0;

            if (now > resetAt) {
                // The time window has expired, reset the count for the next window
                transaction.set(docRef, {
                    count: 1,
                    resetAt: now + windowMs
                });
                return;
            }

            // We are within the active time window
            if (data?.count >= maxRequests) {
                // Rate limit exclusively exceeded
                throw new functions.https.HttpsError(
                    'resource-exhausted', 
                    `Rate limit exceeded for ${action}. Please wait before trying again.`
                );
            }

            // Valid request within limits, increment the counter natively
            transaction.update(docRef, {
                count: admin.firestore.FieldValue.increment(1)
            });
        });
    } catch (error: any) {
        if (error.code === 'resource-exhausted') {
            throw error; // Pass through the explicit logic
        }
        
        // If it's a generic Firestore contention error due to someone firing 100 concurrent
        // requests against a singular document locking it up, we explicitly drop them here too.
        functions.logger.warn(`Rate Limit Contention Error for ${uid}_${action}:`, error);
        throw new functions.https.HttpsError(
            'resource-exhausted', 
            `Server busy or too many concurrent requests. Please slow down.`
        );
    }
};
