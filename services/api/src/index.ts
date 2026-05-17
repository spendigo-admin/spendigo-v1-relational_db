import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Export all functions
export { cleanupOrphanedStoreData } from './admin/cleanupOrphanedStoreData';
export { inviteTeamMember } from './auth/inviteTeamMember';
export { deleteUser } from './auth/deleteUser';
export { requestAccountDeletion } from './auth/requestAccountDeletion';
export { removeTeamMember } from './auth/removeTeamMember';
export { createCheckoutSession } from './payments/createCheckoutSession';
export { stripeWebhook } from './payments/stripeWebhook';
export { getPaymentHistory } from './payments/getPaymentHistory';
export { sendOrderConfirmation, sendOrderStatusUpdate } from './email/sendOrderEmails';
export { onJobApplicationCreated } from './email/sendJobApplicationEmail';
export { updateSubscriptionPlan } from './payments/updateSubscriptionPlan';
export { placeOrder } from './orders/placeOrder';
export { cancelOrder } from './orders/cancelOrder';
export { downloadReceipt } from './orders/downloadReceipt';
export { onUserUpdate } from './triggers/userTriggers';
export { onMasterProductWrite } from './triggers/productTriggers';
export { smartcartOptimize } from './smartcart/optimizeEndpoint';
export { cartOptimize } from './cart/optimizeCart';
export { syncMasterProductToAlgolia } from './triggers/algoliaTriggers';
export { syncTrafficStats } from './admin/syncTrafficStats';
export { getSystemHealth } from './admin/getSystemHealth';
export { scrapeFlyer } from './admin/scrapeFlyer';
export { processIngestionJobs } from './admin/processIngestionJobs';
export { searchPublicDeals } from './admin/searchPublicDeals';
export { recordAuditEvent } from './audit/recordAuditEvent';

export { syncMerchantProductToAlgolia } from './triggers/algoliaMerchantTriggers';
export { onboardStore } from './payments/onboardStore';
export { checkStripeAccountStatus } from './payments/checkStripeStatus';
export { createPaymentIntent } from './payments/createPaymentIntent';
export { refundOrder } from './payments/refundOrder';
export { onOrderStatusUpdated } from './triggers/orderTriggers';
export { onOrderCreated } from './triggers/orderCreationTrigger';
export { onMerchantProductPriceChange } from './triggers/priceHistoryTrigger';
export { onStoreDelete, onStoreCreate, onStoreUpdate, onBackupJobResult } from './triggers/storeTriggers';
export { onReviewCreated } from './triggers/reviewTrigger';
export { scheduledFirestoreExport, triggerManualExport } from './admin/scheduledFirestoreExport';
export { exportFirebaseAuth } from './admin/exportFirebaseAuth';
export { exportMerchantData } from './admin/exportMerchantData';
export { processPendingStoreDeletions } from './admin/processPendingStoreDeletions';
export { forceDeleteStore } from './admin/forceDeleteStore';
export { sendCampaign } from './marketing/sendCampaign';
export { aggregateFlyerAnalytics, triggerAnalyticsAggregation } from './admin/aggregateFlyerAnalytics';
export { revertExpiredDeals } from './triggers/revertExpiredDeals';
