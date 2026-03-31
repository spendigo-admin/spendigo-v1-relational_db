import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { stripe } from '../config/stripe';

const db = admin.firestore();

/**
 * Stripe Webhook Handler (HTTPS Endpoint)
 * Listens for events from Stripe and updates Firestore accordingly.
 */
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    // In production, set this using: firebase functions:config:set stripe.webhook_secret="..."
    const webhookSecret = functions.config().stripe?.webhook_secret || '';

    let event;

    try {
        if (!sig || !webhookSecret) {
            throw new Error('Missing Stripe signature or webhook secret.');
        }
        
        // Verify the event came from Stripe
        event = stripe.webhooks.constructEvent(
            req.rawBody, 
            sig, 
            webhookSecret
        );

    } catch (err: any) {
        functions.logger.error('Webhook Error:', err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    // Handle the event
    try {
        switch (event.type) {
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object as any;
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
                    } else {
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

            case 'charge.refunded': {
                const charge = event.data.object as any;
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

    } catch (error: any) {
        functions.logger.error('Error handling Stripe event:', error);
        res.status(500).send('Internal Server Error');
    }
});
