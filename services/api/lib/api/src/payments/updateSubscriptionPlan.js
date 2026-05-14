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
exports.updateSubscriptionPlan = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = require("../config/stripe");
const audit_1 = require("../utils/audit");
const errors_1 = require("../utils/errors");
const db = admin.firestore();
const PRICE_IDS = {
    core: ((_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.price_core) || 'price_123_test_core',
    growth: ((_b = functions.config().stripe) === null || _b === void 0 ? void 0 : _b.price_growth) || 'price_456_test_growth',
};
exports.updateSubscriptionPlan = functions.https.onCall(async (data, context) => {
    // 1. Security & Validation
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const { newTier } = data; // 'free', 'core', 'growth'
    const userId = context.auth.uid;
    if (!['free', 'core', 'growth'].includes(newTier)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid tier.');
    }
    try {
        // 2. Get User & Subscription Info
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        const stripeCustomerId = userData === null || userData === void 0 ? void 0 : userData.stripeCustomerId;
        if (!stripeCustomerId) {
            throw new functions.https.HttpsError('failed-precondition', 'No customer record found.');
        }
        // Find active subscription
        const subs = await stripe_1.stripe.subscriptions.list({
            customer: stripeCustomerId,
            status: 'active',
            limit: 1
        });
        if (subs.data.length === 0) {
            // No active subscription found. If trying to switch to paid, use Checkout instead.
            // If trying to switch to Free, it's already done effectively.
            if (newTier === 'free')
                return { success: true, message: 'Already free.' };
            throw new functions.https.HttpsError('failed-precondition', 'No active subscription to update. Please use checkout.');
        }
        const subscription = subs.data[0];
        // const currentPriceId = subscription.items.data[0].price.id; // Unused
        // 3. Handle Downgrade to Free (Cancellation)
        if (newTier === 'free') {
            await stripe_1.stripe.subscriptions.update(subscription.id, {
                cancel_at_period_end: true
            });
            return { success: true, message: 'Subscription set to cancel at period end.' };
        }
        // 4. Handle Paid Tier Change
        const newPriceId = PRICE_IDS[newTier];
        // Determine if Upgrade or Downgrade
        // We need a way to know price value or just compare tier logical order
        // Assuming logical order: free < core < growth
        const TIER_ORDER = { free: 0, core: 1, growth: 2 };
        const currentTier = (userData === null || userData === void 0 ? void 0 : userData.subscriptionTier) || 'free';
        const isUpgrade = TIER_ORDER[newTier] > TIER_ORDER[currentTier];
        // Per rules:
        // Upgrade: Charge difference (Default proration: always_invoice)
        // Downgrade: No refund (No proration: 'none')
        const prorationBehavior = isUpgrade ? 'always_invoice' : 'none';
        await stripe_1.stripe.subscriptions.update(subscription.id, {
            items: [{
                    id: subscription.items.data[0].id,
                    price: newPriceId,
                }],
            proration_behavior: prorationBehavior,
        });
        // Update Firestore immediately (Optimistic, webhook will confirm)
        await db.collection('users').doc(userId).update({
            subscriptionTier: newTier,
            subscriptionStatus: 'active' // Ensure it stays active
        });
        await (0, audit_1.logEvent)('SUBSCRIPTION_CHANGE', (0, audit_1.buildActorFromContext)(context), { fromTier: currentTier, toTier: newTier, changeType: isUpgrade ? 'upgrade' : 'downgrade' }, `users/${userId}`);
        return { success: true, message: isUpgrade ? 'Plan upgraded.' : 'Plan downgraded (effective next cycle).' };
    }
    catch (error) {
        (0, errors_1.toHttpsError)(error, 'Failed to update subscription plan.');
    }
});
//# sourceMappingURL=updateSubscriptionPlan.js.map