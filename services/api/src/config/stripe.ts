import Stripe from 'stripe';

const stripeSecret = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';

export const stripe = new Stripe(stripeSecret, {
    apiVersion: '2025-12-15.clover', // Match the version expected by the installed Stripe SDK
});
