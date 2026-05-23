import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { stripe } from '../config/stripe';
import { checkRateLimit } from '../utils/rateLimiter';

const db = admin.firestore();

export const createPromoCode = functions
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
        throw new functions.https.HttpsError('permission-denied', 'Only platform administrators can create promo codes.');
    }

    // Rate limiting check: Max 10 promo code creations per minute
    await checkRateLimit(userId, 'createPromoCode', 10, 60 * 1000);

    const { code, percentOff, amountOff, duration, durationInMonths, maxRedemptions, expiresAt } = data;

    // Validate params
    if (!code || typeof code !== 'string' || !code.trim()) {
        throw new functions.https.HttpsError('invalid-argument', 'Code is required.');
    }

    const normalizedCode = code.trim().toUpperCase();

    // Check if code already exists in Firestore to avoid conflicts
    const promoDoc = await db.collection('promo_codes').doc(normalizedCode).get();
    if (promoDoc.exists) {
        throw new functions.https.HttpsError('already-exists', `Promo code '${normalizedCode}' already exists.`);
    }

    if (!percentOff && !amountOff) {
        throw new functions.https.HttpsError('invalid-argument', 'Either percentOff or amountOff must be specified.');
    }

    if (percentOff && (percentOff <= 0 || percentOff > 100)) {
        throw new functions.https.HttpsError('invalid-argument', 'percentOff must be between 1 and 100.');
    }

    if (amountOff && amountOff <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'amountOff must be a positive number.');
    }

    if (!duration || !['once', 'repeating', 'forever'].includes(duration)) {
        throw new functions.https.HttpsError('invalid-argument', 'Duration must be once, repeating, or forever.');
    }

    if (duration === 'repeating' && (!durationInMonths || durationInMonths <= 0)) {
        throw new functions.https.HttpsError('invalid-argument', 'durationInMonths is required and must be positive when duration is repeating.');
    }

    if (maxRedemptions !== undefined && maxRedemptions !== null) {
        if (!Number.isInteger(maxRedemptions) || maxRedemptions <= 0) {
            throw new functions.https.HttpsError('invalid-argument', 'maxRedemptions must be a positive integer.');
        }
    }

    let expiresTimestamp: number | undefined = undefined;
    if (expiresAt) {
        expiresTimestamp = Math.floor(new Date(expiresAt).getTime() / 1000);
        if (isNaN(expiresTimestamp) || expiresTimestamp <= Math.floor(Date.now() / 1000)) {
            throw new functions.https.HttpsError('invalid-argument', 'expiresAt must be a valid future date.');
        }
    }

    try {
        // 2. Create Coupon in Stripe
        const stripeParams: any = {
            id: normalizedCode,
            duration: duration,
        };

        if (percentOff) {
            stripeParams.percent_off = percentOff;
        } else if (amountOff) {
            stripeParams.amount_off = Math.round(amountOff * 100); // Convert CAD to cents
            stripeParams.currency = 'cad';
        }

        if (duration === 'repeating') {
            stripeParams.duration_in_months = durationInMonths;
        }

        const coupon = await stripe.coupons.create(stripeParams);

        // 3. Create Promotion Code in Stripe
        const promoParams: any = {
            promotion: {
                type: 'coupon',
                coupon: coupon.id
            },
            code: normalizedCode
        };

        if (maxRedemptions) {
            promoParams.max_redemptions = Number(maxRedemptions);
        }

        if (expiresTimestamp) {
            promoParams.expires_at = expiresTimestamp;
        }

        const promoCodeObj = await stripe.promotionCodes.create(promoParams);

        // 4. Save to Firestore promo_codes collection
        await db.collection('promo_codes').doc(normalizedCode).set({
            code: normalizedCode,
            percentOff: percentOff ? Number(percentOff) : null,
            amountOff: amountOff ? Number(amountOff) : null,
            duration: duration,
            durationInMonths: durationInMonths ? Number(durationInMonths) : null,
            maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
            expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
            active: true,
            stripeCouponId: coupon.id,
            stripePromoCodeId: promoCodeObj.id,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
            success: true,
            code: normalizedCode,
            stripeCouponId: coupon.id,
            stripePromoCodeId: promoCodeObj.id
        };
    } catch (err: any) {
        console.error('[createPromoCode] Error:', err);
        throw new functions.https.HttpsError('internal', err.message || 'Stripe coupon creation failed.');
    }
});
