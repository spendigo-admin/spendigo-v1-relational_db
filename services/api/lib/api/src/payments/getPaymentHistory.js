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
exports.getPaymentHistory = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = require("../config/stripe");
const db = admin.firestore();
exports.getPaymentHistory = functions.https.onCall(async (data, context) => {
    // 1. Security Check
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const userId = context.auth.uid;
    try {
        // 2. Get Stripe Customer ID
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        const customerId = userData === null || userData === void 0 ? void 0 : userData.stripeCustomerId;
        if (!customerId) {
            return { payments: [] };
        }
        // 3. Fetch Invoices from Stripe
        // We fetch the last 12 successful invoices
        const invoices = await stripe_1.stripe.invoices.list({
            customer: customerId,
            limit: 12,
            status: 'paid'
        });
        // 4. Format for UI
        const payments = invoices.data.map(invoice => {
            var _a, _b, _c;
            return ({
                id: invoice.id,
                amount: invoice.amount_paid / 100, // Convert from cents
                currency: invoice.currency.toUpperCase(),
                status: invoice.status,
                date: new Date(invoice.created * 1000).toISOString(),
                pdf: invoice.invoice_pdf,
                number: invoice.number,
                tier: ((_b = (_a = invoice.lines.data[0]) === null || _a === void 0 ? void 0 : _a.metadata) === null || _b === void 0 ? void 0 : _b.targetTier) || ((_c = invoice.lines.data[0]) === null || _c === void 0 ? void 0 : _c.description) || 'Subscription'
            });
        });
        return { payments };
    }
    catch (error) {
        console.error('Stripe History Error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
//# sourceMappingURL=getPaymentHistory.js.map