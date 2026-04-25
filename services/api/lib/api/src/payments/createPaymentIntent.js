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
exports.createPaymentIntent = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = require("../config/stripe");
const rateLimiter_1 = require("../utils/rateLimiter");
const db = admin.firestore();
/**
 * Creates a Stripe PaymentIntent for a specific order (or batch of orders).
 * Supports Split Payments (Direct Charges to the Merchant with Application Fee).
 */
exports.createPaymentIntent = functions.https.onCall(async (data, context) => {
    // 1. Security Check
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    // Rate Limit: Max 10 intents per minute per user (Increased for testing)
    await (0, rateLimiter_1.checkRateLimit)(context.auth.uid, 'createPaymentIntent', 10, 60 * 1000);
    const { amount, currency = 'cad', storeId, metadata } = data;
    if (!amount || amount <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Valid amount is required.');
    }
    if (!storeId) {
        throw new functions.https.HttpsError('invalid-argument', 'Store ID is required for split payments.');
    }
    try {
        // 2. Fetch Store's Stripe Account ID
        const storeSnap = await db.collection('stores').doc(storeId).get();
        const storeData = storeSnap.data();
        const stripeAccountId = storeData === null || storeData === void 0 ? void 0 : storeData.stripeAccountId;
        if (!stripeAccountId) {
            throw new functions.https.HttpsError('failed-precondition', 'Store is not set up for online payments yet.');
        }
        // 3. Calculate Application Fee (Spendigo's Cut)
        // Example: 5% + $0.30 fixed
        // amount is in cents
        const variableFee = Math.round(amount * 0.05); // 5%
        const fixedFee = 30; // $0.30
        const applicationFeeAmount = variableFee + fixedFee;
        // 4. Create the PaymentIntent using the 'On Behalf Of' / 'Direct Charges' approach
        // We use Destination Charges here: Charge the customer on Spendigo's platform, 
        // then transfer funds to the merchant MINUS the fee.
        const paymentIntent = await stripe_1.stripe.paymentIntents.create({
            amount: Math.round(amount),
            currency: currency.toLowerCase(),
            payment_method_types: ['card'],
            application_fee_amount: applicationFeeAmount,
            transfer_data: {
                destination: stripeAccountId,
            },
            metadata: Object.assign(Object.assign({}, metadata), { storeId, customerId: context.auth.uid, platformFee: applicationFeeAmount }),
            // Specify capturing mode (automatic by default)
            capture_method: 'automatic',
        });
        functions.logger.log(`Created PaymentIntent ${paymentIntent.id} for store ${storeId} (Amount: ${amount}, Fee: ${applicationFeeAmount})`);
        return {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        };
    }
    catch (error) {
        functions.logger.error('Create PaymentIntent Error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to create payment intent.');
    }
});
//# sourceMappingURL=createPaymentIntent.js.map