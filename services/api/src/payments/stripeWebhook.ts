import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { stripe } from '../config/stripe';

const db = admin.firestore();

function getTierByPriceId(priceId: string): string {
    const PRICE_IDS = {
        core: process.env.STRIPE_PRICE_CORE || 'price_123_test_core',
        growth: process.env.STRIPE_PRICE_GROWTH || 'price_456_test_growth',
        pro: process.env.STRIPE_PRICE_PRO || 'price_789_test_pro',
    };
    if (priceId === PRICE_IDS.core) return 'core';
    if (priceId === PRICE_IDS.growth) return 'growth';
    if (priceId === PRICE_IDS.pro) return 'pro';
    return 'free';
}

/**
 * Stripe Webhook Handler (HTTPS Endpoint)
 * Listens for events from Stripe and updates Firestore accordingly.
 */
export const stripeWebhook = functions
    .runWith({ secrets: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_CORE', 'STRIPE_PRICE_GROWTH', 'STRIPE_PRICE_PRO'] })
    .https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;

    try {
        if (!sig) {
            throw new Error('Missing Stripe signature.');
        }

        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret) {
            throw new Error('[Spendigo] STRIPE_WEBHOOK_SECRET is not set.');
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
                            orderId: orderId, // Set actual pre-generated ID
                            metadata: paymentIntent.metadata,
                            createdAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                        functions.logger.log(`⚠️ Payment received for order ${orderId}, but order record is missing. Saved payment record.`);
                    }
                }
                break;
            }

            case 'checkout.session.completed': {
                const session = event.data.object as any;

                if (session.mode === 'subscription') {
                    const { firebaseUID, targetTier } = session.metadata;

                    if (firebaseUID && targetTier) {
                        const userRef = db.collection('users').doc(firebaseUID);
                        const userDoc = await userRef.get();

                        if (userDoc.exists) {
                            const userData = userDoc.data();
                            const storeId = userData?.storeId;

                            let expirationDate = '';
                            if (session.subscription) {
                                try {
                                    const sub = (await stripe.subscriptions.retrieve(session.subscription as string)) as any;
                                    if (sub && sub.current_period_end) {
                                        expirationDate = new Date(sub.current_period_end * 1000).toISOString().split('T')[0];
                                    }
                                } catch (subErr) {
                                    functions.logger.error('Failed to retrieve subscription in checkout.completed:', subErr);
                                }
                            }

                            // Update user record
                            await userRef.update({
                                subscriptionTier: targetTier,
                                subscriptionStatus: 'active',
                                stripeSubscriptionId: session.subscription,
                                subscriptionEnd: expirationDate
                            });

                            // Update store record
                            if (storeId) {
                                await db.collection('stores').doc(storeId).update({
                                    subscriptionTier: targetTier,
                                    subscriptionStatus: 'active'
                                });
                            }

                            functions.logger.log(`✅ Subscription ${targetTier} activated for user ${firebaseUID} & store ${storeId}. Expiring on ${expirationDate}`);
                        }
                    }
                }
                break;
            }

            case 'invoice.payment_succeeded': {
                const invoice = event.data.object as any;
                const customerId = invoice.customer;
                const subscriptionId = invoice.subscription;
                
                if (!subscriptionId) {
                    // Not a subscription invoice
                    break;
                }

                functions.logger.log(`📄 Invoice paid for subscription ${subscriptionId}`);

                // Find user by stripeCustomerId
                const userQuery = await db.collection('users')
                    .where('stripeCustomerId', '==', customerId)
                    .limit(1)
                    .get();

                if (!userQuery.empty) {
                    const userDoc = userQuery.docs[0];
                    const userData = userDoc.data();
                    const userId = userDoc.id;
                    const storeId = userData.storeId;
                    const userEmail = userData.email || userDoc.id;
                    
                    let storeName = 'Unknown Store';
                    if (storeId) {
                        const storeDoc = await db.collection('stores').doc(storeId).get();
                        if (storeDoc.exists) {
                            storeName = storeDoc.data()?.name || 'Unknown Store';
                        }
                    }

                    let expirationDate = '';
                    try {
                        const sub = (await stripe.subscriptions.retrieve(subscriptionId as string)) as any;
                        if (sub && sub.current_period_end) {
                            expirationDate = new Date(sub.current_period_end * 1000).toISOString().split('T')[0];
                        }
                    } catch (subErr) {
                        functions.logger.error('Failed to retrieve subscription in invoice.payment_succeeded:', subErr);
                    }

                    // Update user's subscription end date in database
                    await userDoc.ref.update({
                        subscriptionEnd: expirationDate
                    });

                    // Log payment to ledger
                    const ledgerId = `ch_${invoice.charge || invoice.id}`;
                    const ledgerRef = db.collection('billing_ledger').doc(ledgerId);
                    
                    const amountPaid = invoice.amount_paid / 100; // convert cents to dollars
                    const tier = userData.subscriptionTier || 'core'; // fallback to core if not set yet

                    await ledgerRef.set({
                        id: ledgerId,
                        storeId: storeId || 'unknown',
                        storeName,
                        userId,
                        userEmail,
                        type: 'charge',
                        amount: amountPaid,
                        tier,
                        stripeChargeId: invoice.charge || 'none',
                        stripeInvoiceId: invoice.id,
                        billingReason: invoice.billing_reason || 'subscription_cycle',
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        status: 'succeeded',
                        description: `Subscription payment - ${tier.toUpperCase()} Plan (${invoice.billing_reason || 'cycle'})`
                    });

                    functions.logger.log(`✅ Recorded subscription payment in ledger for store ${storeId} (${storeName}): $${amountPaid}. Next expiration: ${expirationDate}`);
                }
                break;
            }

            case 'charge.refunded': {
                const charge = event.data.object as any;
                const paymentIntentId = charge.payment_intent;
                const customerId = charge.customer;
                
                functions.logger.log(`🔄 Refund detected for charge ${charge.id}`);

                // Find the order by paymentIntentId
                const orderQuery = await db.collection('orders')
                    .where('paymentIntentId', '==', paymentIntentId)
                    .limit(1)
                    .get();

                if (!orderQuery.empty) {
                    const orderDoc = orderQuery.docs[0];
                    const orderRef = orderDoc.ref;
                    
                    const amountRefunded = charge.amount_refunded / 100; // convert cents to dollars
                    const isFullyRefunded = charge.refunded === true || charge.amount_refunded === charge.amount;
                    const paymentStatus = isFullyRefunded ? 'refunded' : 'partially_refunded';
                    
                    await orderRef.update({
                        paymentStatus,
                        refundedAmount: amountRefunded,
                        refundedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    functions.logger.log(`✅ Order ${orderDoc.id} marked as ${paymentStatus.toUpperCase()} via Webhook. Refunded: $${amountRefunded}`);
                } else {
                    // Check if it's a subscription refund
                    const userQuery = await db.collection('users')
                        .where('stripeCustomerId', '==', customerId)
                        .limit(1)
                        .get();

                    if (!userQuery.empty) {
                        const userDoc = userQuery.docs[0];
                        const userData = userDoc.data();
                        const userId = userDoc.id;
                        const storeId = userData.storeId;
                        const userEmail = userData.email || userDoc.id;
                        
                        let storeName = 'Unknown Store';
                        if (storeId) {
                            const storeDoc = await db.collection('stores').doc(storeId).get();
                            if (storeDoc.exists) {
                                storeName = storeDoc.data()?.name || 'Unknown Store';
                            }
                        }

                        const ledgerId = `ref_${charge.id}`;
                        const ledgerRef = db.collection('billing_ledger').doc(ledgerId);
                        const amountRefunded = charge.amount_refunded / 100;
                        const tier = userData.subscriptionTier || 'free';

                        await ledgerRef.set({
                            id: ledgerId,
                            storeId: storeId || 'unknown',
                            storeName,
                            userId,
                            userEmail,
                            type: 'refund',
                            amount: amountRefunded,
                            tier,
                            stripeChargeId: charge.id,
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            status: 'succeeded',
                            description: `Subscription refund - Downgrade or cancellation proration`
                        });

                        functions.logger.log(`✅ Recorded subscription refund in ledger for store ${storeId} (${storeName}): -$${amountRefunded}`);
                    }
                }
                break;
            }

            case 'customer.subscription.updated': {
                const sub = event.data.object as any;
                const customerId = sub.customer;
                const priceId = sub.items?.data?.[0]?.price?.id;
                const newTier = getTierByPriceId(priceId);
                const status = sub.status === 'active' || sub.status === 'trialing' ? 'active' : sub.status;
                
                let expirationDate = '';
                if (sub.current_period_end) {
                    expirationDate = new Date(sub.current_period_end * 1000).toISOString().split('T')[0];
                }

                // Find user by stripeCustomerId
                const userQuery = await db.collection('users')
                    .where('stripeCustomerId', '==', customerId)
                    .limit(1)
                    .get();

                if (!userQuery.empty) {
                    const userDoc = userQuery.docs[0];
                    const userData = userDoc.data();
                    const userId = userDoc.id;
                    const storeId = userData.storeId;

                    // Update user record
                    await userDoc.ref.update({
                        subscriptionTier: newTier,
                        subscriptionStatus: status,
                        subscriptionEnd: expirationDate
                    });

                    // Update store record
                    if (storeId) {
                        await db.collection('stores').doc(storeId).update({
                            subscriptionTier: newTier,
                            subscriptionStatus: status
                        });
                    }

                    functions.logger.log(`🔄 Sync: Subscription updated for user ${userId} / store ${storeId}. Tier: ${newTier}, Status: ${status}, Expiration: ${expirationDate}`);
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const sub = event.data.object as any;
                const customerId = sub.customer;

                // Find user by stripeCustomerId
                const userQuery = await db.collection('users')
                    .where('stripeCustomerId', '==', customerId)
                    .limit(1)
                    .get();

                if (!userQuery.empty) {
                    const userDoc = userQuery.docs[0];
                    const userData = userDoc.data();
                    const userId = userDoc.id;
                    const storeId = userData.storeId;

                    // Reset to free
                    await userDoc.ref.update({
                        subscriptionTier: 'free',
                        subscriptionStatus: 'inactive',
                        subscriptionEnd: ''
                    });

                    // Reset store record
                    if (storeId) {
                        await db.collection('stores').doc(storeId).update({
                            subscriptionTier: 'free',
                            subscriptionStatus: 'inactive'
                        });
                    }

                    functions.logger.log(`💀 Sync: Subscription deleted for user ${userId} / store ${storeId}. Reset to Free.`);
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
