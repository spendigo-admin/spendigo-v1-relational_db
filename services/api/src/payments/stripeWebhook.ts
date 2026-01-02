import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { stripe } from '../config/stripe';

const db = admin.firestore();

// Endpoint secret from Stripe Dashboard (Webhooks section)
// firebase functions:config:set stripe.webhook_secret="whsec_..."
const endpointSecret = functions.config().stripe?.webhook_secret;

export const stripeWebhook = functions.https.onRequest(async (req, res) => {
    const signature = req.headers['stripe-signature'];

    let event;

    try {
        if (!signature || !endpointSecret) {
            throw new Error("Missing signature or secret");
        }
        // Verify the event came consistently from Stripe
        event = stripe.webhooks.constructEvent(req.rawBody, signature, endpointSecret);
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    // Handle the event
    // We primarily care about successful payments or subscription updates
    try {
        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object as any;
                await handleCheckoutCompleted(session);
                break;

            case 'invoice.payment_succeeded':
                const invoice = event.data.object as any;
                await handleInvoicePaymentSucceeded(invoice);
                break;

            // Handle cancellations, etc.
            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object as any);
                break;

            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        res.json({ received: true });
    } catch (e) {
        console.error(e);
        res.status(500).send("Internal Server Error processing webhook");
    }
});

async function handleCheckoutCompleted(session: any) {
    const userId = session.metadata?.firebaseUID;
    const tier = session.metadata?.targetTier;

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

async function handleInvoicePaymentSucceeded(invoice: any) {
    const customerId = invoice.customer;
    if (!customerId) return;

    // Find user by stripeCustomerId
    const snapshot = await db.collection('users').where('stripeCustomerId', '==', customerId).get();
    if (!snapshot.empty) {
        const userDoc = snapshot.docs[0];
        const subscriptionEnd = invoice.lines?.data?.[0]?.period?.end; // Unix timestamp

        if (subscriptionEnd) {
            const endDate = new Date(subscriptionEnd * 1000).toISOString();
            console.log(`Updating subscription end for ${userDoc.id} to ${endDate}`);
            await userDoc.ref.set({
                subscriptionStatus: 'active',
                subscriptionEnd: endDate
            }, { merge: true });
        }
    }
}

async function handleSubscriptionDeleted(subscription: any) {
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
