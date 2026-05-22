import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { stripe } from '../config/stripe';
import { toHttpsError } from '../utils/errors';

const db = admin.firestore();

export const getPaymentHistory = functions
    .runWith({ secrets: ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_CORE', 'STRIPE_PRICE_GROWTH', 'STRIPE_PRICE_PRO'] })
    .https.onCall(async (data, context) => {
    // 1. Security Check
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const userId = context.auth.uid;

    const getTierByPriceId = (priceId: string): string => {
        const PRICE_IDS = {
            core: process.env.STRIPE_PRICE_CORE || 'price_123_test_core',
            growth: process.env.STRIPE_PRICE_GROWTH || 'price_456_test_growth',
            pro: process.env.STRIPE_PRICE_PRO || 'price_789_test_pro',
        };
        if (priceId === PRICE_IDS.core) return 'core';
        if (priceId === PRICE_IDS.growth) return 'growth';
        if (priceId === PRICE_IDS.pro) return 'pro';
        return 'free';
    };

    try {
        // 2. Get Stripe Customer ID
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        const customerId = userData?.stripeCustomerId;

        if (!customerId) {
            return { payments: [] };
        }

        // 3. Fetch Charges from Stripe to capture both payments and refunds dynamically
        const charges = await stripe.charges.list({
            customer: customerId,
            limit: 20
        });

        // 4. Format for UI, capturing both charges and their refunds
        const payments: any[] = [];

        for (const chargeItem of charges.data) {
            const charge = chargeItem as any;
            let tierName = 'Subscription';
            let invoiceNumber = '';
            let pdfUrl = '';

            if (charge.invoice) {
                try {
                    const invoice = await stripe.invoices.retrieve(charge.invoice as string) as any;
                    invoiceNumber = invoice.number || '';
                    pdfUrl = invoice.invoice_pdf || '';
                    
                    const priceId = invoice.lines?.data?.[0]?.price?.id;
                    const resolvedTier = priceId ? getTierByPriceId(priceId) : '';
                    
                    const tierTitles: Record<string, string> = {
                        core: 'Core Subscription',
                        growth: 'Growth Subscription',
                        pro: 'Pro Subscription',
                        free: 'Starter Plan'
                    };
                    
                    tierName = invoice.lines?.data?.[0]?.metadata?.targetTier
                        ? (tierTitles[invoice.lines.data[0].metadata.targetTier] || invoice.lines.data[0].metadata.targetTier)
                        : resolvedTier
                        ? (tierTitles[resolvedTier] || resolvedTier)
                        : invoice.lines?.data?.[0]?.description || 'Subscription';
                } catch (err) {
                    // Fallback if invoice retrieval fails
                }
            }

            // Add the main payment charge if it succeeded
            if (charge.status === 'succeeded') {
                payments.push({
                    id: charge.id,
                    type: 'charge',
                    amount: charge.amount / 100,
                    currency: charge.currency.toUpperCase(),
                    status: charge.refunded ? 'refunded' : charge.amount_refunded > 0 ? 'partially refunded' : 'paid',
                    date: new Date(charge.created * 1000).toISOString(),
                    number: invoiceNumber || charge.receipt_number || '',
                    pdf: pdfUrl || charge.receipt_url || '',
                    tier: tierName
                });
            }

            // Add any associated card refunds as distinct items in the history
            if (charge.amount_refunded > 0 && charge.refunds?.data) {
                for (const refundItem of charge.refunds.data) {
                    const refund = refundItem as any;
                    payments.push({
                        id: refund.id,
                        type: 'refund',
                        amount: -(refund.amount / 100), // Negative amount for refunds
                        currency: refund.currency.toUpperCase(),
                        status: 'refunded',
                        date: new Date(refund.created * 1000).toISOString(),
                        number: invoiceNumber ? `REF-${invoiceNumber}` : `REF-${charge.receipt_number || charge.id}`,
                        pdf: charge.receipt_url || '', // receipt link shows refund updates
                        tier: `${tierName} (Prorated Refund)`
                    });
                }
            }
        }

        // Sort by date descending
        payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return { payments };

    } catch (error: any) {
        toHttpsError(error, 'Failed to get payment history.');
    }
});
