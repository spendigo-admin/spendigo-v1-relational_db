import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { stripe } from '../config/stripe';
import { checkRateLimit } from '../utils/rateLimiter';

const db = admin.firestore();

export const deletePromoCode = functions
    .runWith({ secrets: ['STRIPE_SECRET_KEY'] })
    .https.onCall(async (data, context) => {
    // 1. Security check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const userId = context.auth.uid;

    // Verify user is an admin in Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    if (!userData || userData.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only platform administrators can delete promo codes.');
    }

    // Rate limiting check: Max 10 promo code deletions per minute
    await checkRateLimit(userId, 'deletePromoCode', 10, 60 * 1000);

    const { code } = data;
    if (!code || typeof code !== 'string' || !code.trim()) {
        throw new functions.https.HttpsError('invalid-argument', 'Promo code is required.');
    }

    const normalizedCode = code.trim().toUpperCase();

    try {
        const promoRef = db.collection('promo_codes').doc(normalizedCode);
        const promoSnap = await promoRef.get();

        if (!promoSnap.exists) {
            throw new functions.https.HttpsError('not-found', `Promo code '${normalizedCode}' not found.`);
        }

        const promoData = promoSnap.data();

        if (promoData) {
            // Deactivate Stripe Promotion Code (setting active to false)
            if (promoData.stripePromoCodeId) {
                try {
                    await stripe.promotionCodes.update(promoData.stripePromoCodeId, { active: false });
                } catch (stripeErr: any) {
                    console.warn(`[deletePromoCode] Failed to deactivate Stripe promo code ${promoData.stripePromoCodeId}:`, stripeErr.message);
                }
            }

            // Delete Stripe Coupon (which permanently disables any promo code using it)
            if (promoData.stripeCouponId) {
                try {
                    await stripe.coupons.del(promoData.stripeCouponId);
                } catch (stripeErr: any) {
                    console.warn(`[deletePromoCode] Failed to delete Stripe coupon ${promoData.stripeCouponId}:`, stripeErr.message);
                }
            }
        }

        // Delete from Firestore promo_codes collection
        await promoRef.delete();

        return { success: true, code: normalizedCode };
    } catch (err: any) {
        console.error('[deletePromoCode] Error:', err);
        throw new functions.https.HttpsError('internal', err.message || 'Stripe/Firestore promo code deletion failed.');
    }
});
