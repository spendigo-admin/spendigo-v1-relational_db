import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { stripe } from '../config/stripe';

const db = admin.firestore();

export const getPaymentHistory = functions.https.onCall(async (data, context) => {
    // 1. Security Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const userId = context.auth.uid;

    try {
        // 2. Get Stripe Customer ID
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        const customerId = userData?.stripeCustomerId;

        if (!customerId) {
            return { payments: [] };
        }

        // 3. Fetch Invoices from Stripe
        // We fetch the last 12 successful invoices
        const invoices = await stripe.invoices.list({
            customer: customerId,
            limit: 12,
            status: 'paid'
        });

        // 4. Format for UI
        const payments = invoices.data.map(invoice => ({
            id: invoice.id,
            amount: invoice.amount_paid / 100, // Convert from cents
            currency: invoice.currency.toUpperCase(),
            status: invoice.status,
            date: new Date(invoice.created * 1000).toISOString(),
            pdf: invoice.invoice_pdf,
            number: invoice.number,
            tier: invoice.lines.data[0]?.metadata?.targetTier || invoice.lines.data[0]?.description || 'Subscription'
        }));

        return { payments };

    } catch (error: any) {
        console.error('Stripe History Error:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
