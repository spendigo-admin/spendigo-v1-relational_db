import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Export all functions
export { checkEmailStatus } from './admin/checkEmailStatus';
export { sendTestEmail } from './admin/testEmail';
export { cleanupOrphanedUsers } from './admin/cleanupOrphanedUsers';
export { inviteTeamMember } from './auth/inviteTeamMember';
export { deleteUser } from './auth/deleteUser';
export { createCheckoutSession } from './payments/createCheckoutSession';
export { stripeWebhook } from './payments/stripeWebhook';
export { getPaymentHistory } from './payments/getPaymentHistory';
export { sendOrderConfirmation, sendOrderStatusUpdate } from './email/sendOrderEmails';
