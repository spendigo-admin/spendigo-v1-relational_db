import Stripe from 'stripe';
import * as functions from 'firebase-functions';

// Initialize Stripe with the Secret Key from Firebase Config
// To set this run: firebase functions:config:set stripe.secret_key="sk_live_..."
const stripeSecret = functions.config().stripe?.secret_key || 'sk_test_placeholder';

export const stripe = new Stripe(stripeSecret, {
    apiVersion: '2025-01-27.acacia', // Use latest API version available or match your dashboard
});
