"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCheckoutSession = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = require("../config/stripe");
const rateLimiter_1 = require("../utils/rateLimiter");
const errors_1 = require("../utils/errors");
const db = admin.firestore();
exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
    // 1. Security Check
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    // Rate Limit Check: Max 3 checkout sessions initialized per minute
    await (0, rateLimiter_1.checkRateLimit)(context.auth.uid, 'createCheckoutSession', 3, 60 * 1000);
    const { tier, promoCode } = data; // 'core' or 'growth'
    const userId = context.auth.uid;
    const userEmail = context.auth.token.email;
    if (!tier || !['core', 'growth'].includes(tier)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid subscription tier.');
    }
    const PRICE_IDS = {
        core: process.env.STRIPE_PRICE_CORE,
        growth: process.env.STRIPE_PRICE_GROWTH,
    };
    if (!PRICE_IDS.core || !PRICE_IDS.growth) {
        throw new functions.https.HttpsError('internal', 'Stripe price IDs not configured. Set STRIPE_PRICE_CORE and STRIPE_PRICE_GROWTH.');
    }
    try {
        // 2. Get or Create Stripe Customer
        // We check if the user already has a stripeCustomerId in Firestore
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        let customerId = userData === null || userData === void 0 ? void 0 : userData.stripeCustomerId;
        if (!customerId) {
            // Create new customer in Stripe
            const customer = await stripe_1.stripe.customers.create({
                email: userEmail,
                metadata: {
                    firebaseUID: userId
                }
            });
            customerId = customer.id;
            // Save ID for future
            await db.collection('users').doc(userId).set({ stripeCustomerId: customerId }, { merge: true });
        }
        // --- PROMO CODE LOGIC ---
        let subscriptionData = {};
        if (promoCode === 'FIRST100') {
            // Check if we are within the first 100 merchants
            const storesSnapshot = await db.collection('stores').count().get();
            const storeCount = storesSnapshot.data().count;
            if (storeCount < 100) {
                // Apply 3 Months Free Trial
                subscriptionData = {
                    trial_period_days: 90
                };
            }
        }
        // 3. Create Checkout Session
        const appUrl = process.env.APP_URL || 'https://spendigo.ca';
        const session = await stripe_1.stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription',
            customer: customerId,
            line_items: [
                {
                    price: PRICE_IDS[tier],
                    quantity: 1,
                },
            ],
            subscription_data: subscriptionData,
            success_url: `${appUrl}/merchant/subscription?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${appUrl}/merchant/subscription`,
            metadata: {
                firebaseUID: userId,
                targetTier: tier,
                appliedPromo: promoCode || 'none'
            }
        });
        return { url: session.url };
    }
    catch (error) {
        (0, errors_1.toHttpsError)(error, 'Failed to create checkout session.');
    }
});
//# sourceMappingURL=createCheckoutSession.js.map