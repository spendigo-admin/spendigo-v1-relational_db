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
exports.stripeWebhook = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = require("../config/stripe");
const db = admin.firestore();
/**
 * Stripe Webhook Handler (HTTPS Endpoint)
 * Listens for events from Stripe and updates Firestore accordingly.
 */
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    var _a;
    const sig = req.headers['stripe-signature'];
    // In production, set this using: firebase functions:config:set stripe.webhook_secret="..."
    const webhookSecret = ((_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.webhook_secret) || '';
    let event;
    try {
        if (!sig || !webhookSecret) {
            throw new Error('Missing Stripe signature or webhook secret.');
        }
        // Verify the event came from Stripe
        event = stripe_1.stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    }
    catch (err) {
        functions.logger.error('Webhook Error:', err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    // Handle the event
    try {
        switch (event.type) {
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object;
                const { orderId } = paymentIntent.metadata;
                functions.logger.log(`💰 Payment succeeded for intent ${paymentIntent.id}`);
                // Update Order Status in Firestore if it exists
                if (orderId) {
                    const orderRef = db.collection('orders').doc(orderId);
                    const orderSnap = await orderRef.get();
                    if (orderSnap.exists) {
                        await orderRef.update({
                            paymentStatus: 'paid',
                            paymentIntentId: paymentIntent.id,
                            paidAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                        functions.logger.log(`✅ Order ${orderId} marked as PAID via Webhook.`);
                    }
                    else {
                        // Order doesn't exist yet (The "Race Condition": Webhook arrived before the frontend call)
                        // We can store the payment record to be picked up by the placeOrder function
                        await db.collection('payments').doc(paymentIntent.id).set({
                            status: 'succeeded',
                            orderId: null, // Placeholder
                            metadata: paymentIntent.metadata,
                            createdAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                        functions.logger.log(`⚠️ Payment received for order ${orderId}, but order record is missing. Saved payment record.`);
                    }
                }
                break;
            }
            case 'checkout.session.completed': {
                const session = event.data.object;
                if (session.mode === 'subscription') {
                    const { firebaseUID, targetTier } = session.metadata;
                    if (firebaseUID && targetTier) {
                        const userRef = db.collection('users').doc(firebaseUID);
                        const userDoc = await userRef.get();
                        if (userDoc.exists) {
                            const userData = userDoc.data();
                            const storeId = userData === null || userData === void 0 ? void 0 : userData.storeId;
                            // Update user record
                            await userRef.update({
                                subscriptionTier: targetTier,
                                subscriptionStatus: 'active',
                                stripeSubscriptionId: session.subscription
                            });
                            // Update store record
                            if (storeId) {
                                await db.collection('stores').doc(storeId).update({
                                    subscriptionTier: targetTier,
                                    subscriptionStatus: 'active'
                                });
                            }
                            functions.logger.log(`✅ Subscription ${targetTier} activated for user ${firebaseUID} & store ${storeId}`);
                        }
                    }
                }
                break;
            }
            case 'charge.refunded': {
                const charge = event.data.object;
                const paymentIntentId = charge.payment_intent;
                functions.logger.log(`🔄 Refund detected for charge ${charge.id}`);
                // Find the order by paymentIntentId
                const orderQuery = await db.collection('orders')
                    .where('paymentIntentId', '==', paymentIntentId)
                    .limit(1)
                    .get();
                if (!orderQuery.empty) {
                    const orderDoc = orderQuery.docs[0];
                    await orderDoc.ref.update({
                        paymentStatus: 'refunded',
                        refundedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    functions.logger.log(`✅ Order ${orderDoc.id} marked as REFUNDED via Webhook.`);
                }
                break;
            }
            default:
                functions.logger.log(`Unhandled event type ${event.type}`);
        }
        // Return a 200 response to acknowledge receipt of the event
        res.json({ received: true });
    }
    catch (error) {
        functions.logger.error('Error handling Stripe event:', error);
        res.status(500).send('Internal Server Error');
    }
});
//# sourceMappingURL=stripeWebhook.js.map