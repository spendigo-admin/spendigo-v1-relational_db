import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { stripe } from '../config/stripe';
import { toHttpsError } from '../utils/errors';

const db = admin.firestore();

/**
 * Creates a Stripe Connect account for a merchant store
 * and returns an onboarding link.
 */
export const onboardStore = functions.https.onCall(async (data, context) => {
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
        // 2. Fetch Store & Verify Ownership/Permissions
        const storeSnap = await db.collection('stores').doc(storeId).get();
        if (!storeSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Store not found.');
        }

        const storeData = storeSnap.data();

        // 2b. Ownership check — only the store OWNER or an admin may attach a Stripe account.
        // Any authenticated user who knows a storeId could otherwise hijack a competitor's payments.
        const callerSnap = await db.collection('users').doc(context.auth.uid).get();
        if (!callerSnap.exists) {
            throw new functions.https.HttpsError('permission-denied', 'Only the store owner may initiate Stripe onboarding.');
        }
        const caller = callerSnap.data()!;
        const isAdmin = caller.role === 'admin';
        const isOwner = caller.storeId === storeId && caller.merchantRole === 'OWNER';
        if (!isAdmin && !isOwner) {
            throw new functions.https.HttpsError('permission-denied', 'Only the store owner may initiate Stripe onboarding.');
        }

        // 3. Create or Retrieve Stripe Account ID
        let stripeAccountId = storeData?.stripeAccountId;

        if (!stripeAccountId) {
            // Create a NEW Standard Connect account
            const account = await stripe.accounts.create({
                type: 'standard',
                country: 'CA', // Defaulting to Canada for Spendigo
                email: storeData?.email || context.auth.token.email,
                business_type: 'individual', // Or 'company' based on store data
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
                metadata: {
                    storeId: storeId,
                    userId: context.auth.uid
                }
            });

            stripeAccountId = account.id;

            // Save the ID to the store document immediately
            await db.collection('stores').doc(storeId).update({
                stripeAccountId: stripeAccountId,
                stripeOnboardingStatus: 'pending',
                stripeConnectedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            functions.logger.log(`Created Stripe Connect account ${stripeAccountId} for store ${storeId}`);
        }

        // 4. Create an Onboarding Account Link
        const accountLink = await stripe.accountLinks.create({
            account: stripeAccountId,
            refresh_url: `https://spendigo.ca/merchant/settings?tab=payments&stripe=refresh`,
            return_url: `https://spendigo.ca/merchant/settings?tab=payments&stripe=return`,
            type: 'account_onboarding',
        });

        return {
            url: accountLink.url,
            stripeAccountId: stripeAccountId
        };

    } catch (error: any) {
        toHttpsError(error, 'Failed to create Stripe onboarding link.');
    }
});
