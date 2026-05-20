import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { stripe } from '../config/stripe';
import { toHttpsError } from '../utils/errors';

const db = admin.firestore();

/**
 * Checks the status of a Stripe Connect account.
 * Updates the 'stripeOnboardingStatus' in Firestore if it has changed.
 */
export const checkStripeAccountStatus = functions
    .runWith({ secrets: ['STRIPE_SECRET_KEY'] })
    .https.onCall(async (data, context) => {
    // 1. Authentication Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'App Check verification required.');
    }

    const { storeId } = data;
    if (!storeId) {
        throw new functions.https.HttpsError('invalid-argument', 'Store ID is required.');
    }

    try {
        // 2. Fetch Store Data
        const storeSnap = await db.collection('stores').doc(storeId).get();
        if (!storeSnap.exists) {
             throw new functions.https.HttpsError('not-found', 'Store not found.');
        }
        
        const storeData = storeSnap.data();
        const stripeAccountId = storeData?.stripeAccountId;

        if (!stripeAccountId) {
            return { status: 'not_started' };
        }

        // 3. Retrieve the Stripe Account object
        const account = await stripe.accounts.retrieve(stripeAccountId);

        // 4. Determine status based on capabilities and requirements
        let status: 'pending' | 'complete' | 'restricted' = 'pending';

        if (account.details_submitted && account.charges_enabled) {
            status = 'complete';
        } else if (account.requirements?.disabled_reason) {
            status = 'restricted';
        }

        // 5. Update Firestore if changed
        if (storeData?.stripeOnboardingStatus !== status) {
            await db.collection('stores').doc(storeId).update({
                stripeOnboardingStatus: status,
                stripeLastCheckedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            functions.logger.log(`Updated Stripe Onboarding status for store ${storeId} to ${status}`);
        }

        return {
            status,
            chargesEnabled: account.charges_enabled,
            detailsSubmitted: account.details_submitted,
            payoutsEnabled: account.payouts_enabled,
            stripeAccountId: stripeAccountId
        };

    } catch (error: any) {
        toHttpsError(error, 'Failed to check Stripe account status.');
    }
});
