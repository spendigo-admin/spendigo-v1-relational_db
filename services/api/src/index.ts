import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Export all functions
export { inviteTeamMember } from './auth/inviteTeamMember';
export { createCheckoutSession } from './payments/createCheckoutSession';
export { stripeWebhook } from './payments/stripeWebhook';
