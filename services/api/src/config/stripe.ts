import Stripe from 'stripe';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
    throw new Error('[Spendigo] STRIPE_SECRET_KEY is not set. Add it to services/api/.env for the emulator or to Firebase environment variables for production.');
}

export const stripe = new Stripe(stripeSecret, {
    apiVersion: '2025-12-15.clover',
});
