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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCheckoutSession = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = require("../config/stripe");
const db = admin.firestore();
// MAP YOUR STRIPE PRICE IDs HERE (From your Stripe Dashboard)
// Run `firebase functions:config:set stripe.price_core="price_..." stripe.price_growth="price_..."`
const PRICE_IDS = {
    core: ((_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.price_core) || 'price_123_test_core',
    growth: ((_b = functions.config().stripe) === null || _b === void 0 ? void 0 : _b.price_growth) || 'price_456_test_growth',
};
exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
    // 1. Security Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const { tier } = data; // 'core' or 'growth'
    const userId = context.auth.uid;
    const userEmail = context.auth.token.email;
    if (!tier || !['core', 'growth'].includes(tier)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid subscription tier.');
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
        // 3. Create Checkout Session
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
            // Replace with your actual deployed URL
            success_url: `https://spendigo.ca/merchant/subscription?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `https://spendigo.ca/merchant/subscription`,
            metadata: {
                firebaseUID: userId,
                targetTier: tier
            }
        });
        return { url: session.url };
    }
    catch (error) {
        console.error('Stripe Checkout Error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
//# sourceMappingURL=createCheckoutSession.js.map