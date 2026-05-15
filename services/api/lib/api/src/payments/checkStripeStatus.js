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
exports.checkStripeAccountStatus = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = require("../config/stripe");
const errors_1 = require("../utils/errors");
const db = admin.firestore();
/**
 * Checks the status of a Stripe Connect account.
 * Updates the 'stripeOnboardingStatus' in Firestore if it has changed.
 */
exports.checkStripeAccountStatus = functions.https.onCall(async (data, context) => {
    var _a;
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
        const stripeAccountId = storeData === null || storeData === void 0 ? void 0 : storeData.stripeAccountId;
        if (!stripeAccountId) {
            return { status: 'not_started' };
        }
        // 3. Retrieve the Stripe Account object
        const account = await stripe_1.stripe.accounts.retrieve(stripeAccountId);
        // 4. Determine status based on capabilities and requirements
        let status = 'pending';
        if (account.details_submitted && account.charges_enabled) {
            status = 'complete';
        }
        else if ((_a = account.requirements) === null || _a === void 0 ? void 0 : _a.disabled_reason) {
            status = 'restricted';
        }
        // 5. Update Firestore if changed
        if ((storeData === null || storeData === void 0 ? void 0 : storeData.stripeOnboardingStatus) !== status) {
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
    }
    catch (error) {
        (0, errors_1.toHttpsError)(error, 'Failed to check Stripe account status.');
    }
});
//# sourceMappingURL=checkStripeStatus.js.map