import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Export all functions
export { cleanupOrphanedUsers } from './admin/cleanupOrphanedUsers';
export { inviteTeamMember } from './auth/inviteTeamMember';
export { deleteUser } from './auth/deleteUser';
export { requestAccountDeletion } from './auth/requestAccountDeletion';
export { removeTeamMember } from './auth/removeTeamMember';
export { createCheckoutSession } from './payments/createCheckoutSession';
export { stripeWebhook } from './payments/stripeWebhook';
export { getPaymentHistory } from './payments/getPaymentHistory';
export { sendOrderConfirmation, sendOrderStatusUpdate } from './email/sendOrderEmails';
export { updateSubscriptionPlan } from './payments/updateSubscriptionPlan';
export { placeOrder } from './orders/placeOrder';
export { cancelOrder } from './orders/cancelOrder';
export { onUserUpdate } from './triggers/userTriggers';
export { onMasterProductWrite } from './triggers/productTriggers';
export { smartcartOptimize } from './smartcart/optimizeEndpoint';
export { cartOptimize } from './cart/optimizeCart';
export { syncMasterProductToAlgolia } from './triggers/algoliaTriggers';
