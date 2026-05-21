import Stripe from 'stripe';

// Lazy singleton — initialized on first use so Firebase CLI's local analysis
// phase (which runs without secrets) doesn't crash on import.
let _stripe: Stripe | null = null;
function getStripeClient(): Stripe {
    if (!_stripe) {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) throw new Error('[Spendigo] STRIPE_SECRET_KEY is not set. Add it to services/api/.env for the emulator or to Firebase environment variables for production.');
        _stripe = new Stripe(key, { apiVersion: '2026-02-25.clover' });
    }
    return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
    get(_: Stripe, prop: string | symbol) {
        return (getStripeClient() as never as Record<string | symbol, unknown>)[prop];
    },
});
