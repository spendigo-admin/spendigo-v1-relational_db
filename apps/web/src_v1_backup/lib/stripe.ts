import { loadStripe } from '@stripe/stripe-js';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

if (!STRIPE_PUBLISHABLE_KEY) {
    console.warn('[Stripe] Publishable key is missing. Online payments will not work.');
}

export const stripePromise = STRIPE_PUBLISHABLE_KEY 
    ? loadStripe(STRIPE_PUBLISHABLE_KEY) 
    : null;
