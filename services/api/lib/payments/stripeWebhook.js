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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = require("../config/stripe");
const db = admin.firestore();
// Endpoint secret from Stripe Dashboard (Webhooks section)
// firebase functions:config:set stripe.webhook_secret="whsec_..."
const endpointSecret = (_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.webhook_secret;
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    const signature = req.headers['stripe-signature'];
    let event;
    try {
        if (!signature || !endpointSecret) {
            throw new Error("Missing signature or secret");
        }
        // Verify the event came consistently from Stripe
        event = stripe_1.stripe.webhooks.constructEvent(req.rawBody, signature, endpointSecret);
    }
    catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    // Handle the event
    // We primarily care about successful payments or subscription updates
    try {
        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object;
                await handleCheckoutCompleted(session);
                break;
            case 'invoice.payment_succeeded':
                // Could be used to extend subscription duration
                break;
            // Handle cancellations, etc.
            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;
            default:
                console.log(`Unhandled event type ${event.type}`);
        }
        res.json({ received: true });
    }
    catch (e) {
        console.error(e);
        res.status(500).send("Internal Server Error processing webhook");
    }
});
async function handleCheckoutCompleted(session) {
    var _a, _b;
    const userId = (_a = session.metadata) === null || _a === void 0 ? void 0 : _a.firebaseUID;
    const tier = (_b = session.metadata) === null || _b === void 0 ? void 0 : _b.targetTier;
    if (userId && tier) {
        console.log(`Upgrading user ${userId} to ${tier}`);
        await db.collection('users').doc(userId).set({
            subscriptionTier: tier,
            subscriptionStatus: 'active',
            subscriptionId: session.subscription,
            subscriptionUpdatedAt: new Date().toISOString()
        }, { merge: true });
    }
}
async function handleSubscriptionDeleted(subscription) {
    // Find user by subscription ID and downgrade them
    const snapshot = await db.collection('users').where('subscriptionId', '==', subscription.id).get();
    if (!snapshot.empty) {
        const userDoc = snapshot.docs[0];
        console.log(`Downgrading user ${userDoc.id} due to subscription cancellation`);
        await userDoc.ref.update({
            subscriptionTier: 'free',
            subscriptionStatus: 'canceled',
            subscriptionUpdatedAt: new Date().toISOString()
        });
    }
}
//# sourceMappingURL=stripeWebhook.js.map