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
exports.onboardStore = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = require("../config/stripe");
const errors_1 = require("../utils/errors");
const db = admin.firestore();
/**
 * Creates a Stripe Connect account for a merchant store
 * and returns an onboarding link.
 */
exports.onboardStore = functions.https.onCall(async (data, context) => {
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
        const caller = callerSnap.data();
        if ((caller === null || caller === void 0 ? void 0 : caller.role) !== 'admin' && ((caller === null || caller === void 0 ? void 0 : caller.storeId) !== storeId || (caller === null || caller === void 0 ? void 0 : caller.merchantRole) !== 'OWNER')) {
            throw new functions.https.HttpsError('permission-denied', 'Only the store owner may initiate Stripe onboarding.');
        }
        // 3. Create or Retrieve Stripe Account ID
        let stripeAccountId = storeData === null || storeData === void 0 ? void 0 : storeData.stripeAccountId;
        if (!stripeAccountId) {
            // Create a NEW Standard Connect account
            const account = await stripe_1.stripe.accounts.create({
                type: 'standard',
                country: 'CA', // Defaulting to Canada for Spendigo
                email: (storeData === null || storeData === void 0 ? void 0 : storeData.email) || context.auth.token.email,
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
        const accountLink = await stripe_1.stripe.accountLinks.create({
            account: stripeAccountId,
            refresh_url: `https://spendigo.ca/merchant/settings?tab=payments&stripe=refresh`,
            return_url: `https://spendigo.ca/merchant/settings?tab=payments&stripe=return`,
            type: 'account_onboarding',
        });
        return {
            url: accountLink.url,
            stripeAccountId: stripeAccountId
        };
    }
    catch (error) {
        (0, errors_1.toHttpsError)(error, 'Failed to create Stripe onboarding link.');
    }
});
//# sourceMappingURL=onboardStore.js.map