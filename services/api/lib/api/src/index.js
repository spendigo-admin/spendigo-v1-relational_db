"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onStoreDelete = exports.onMerchantProductPriceChange = exports.onOrderCreated = exports.onOrderStatusUpdated = exports.refundOrder = exports.createPaymentIntent = exports.checkStripeAccountStatus = exports.onboardStore = exports.syncMerchantProductToAlgolia = exports.recordAuditEvent = exports.searchPublicDeals = exports.processScheduledJobs = exports.scrapeFlyer = exports.getSystemHealth = exports.syncTrafficStats = exports.syncMasterProductToAlgolia = exports.cartOptimize = exports.smartcartOptimize = exports.onMasterProductWrite = exports.onUserUpdate = exports.downloadReceipt = exports.cancelOrder = exports.placeOrder = exports.updateSubscriptionPlan = exports.sendOrderStatusUpdate = exports.sendOrderConfirmation = exports.getPaymentHistory = exports.stripeWebhook = exports.createCheckoutSession = exports.removeTeamMember = exports.requestAccountDeletion = exports.deleteUser = exports.inviteTeamMember = exports.cleanupOrphanedStoreData = void 0;
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin
admin.initializeApp();
// Export all functions
var cleanupOrphanedStoreData_1 = require("./admin/cleanupOrphanedStoreData");
Object.defineProperty(exports, "cleanupOrphanedStoreData", { enumerable: true, get: function () { return cleanupOrphanedStoreData_1.cleanupOrphanedStoreData; } });
var inviteTeamMember_1 = require("./auth/inviteTeamMember");
Object.defineProperty(exports, "inviteTeamMember", { enumerable: true, get: function () { return inviteTeamMember_1.inviteTeamMember; } });
var deleteUser_1 = require("./auth/deleteUser");
Object.defineProperty(exports, "deleteUser", { enumerable: true, get: function () { return deleteUser_1.deleteUser; } });
var requestAccountDeletion_1 = require("./auth/requestAccountDeletion");
Object.defineProperty(exports, "requestAccountDeletion", { enumerable: true, get: function () { return requestAccountDeletion_1.requestAccountDeletion; } });
var removeTeamMember_1 = require("./auth/removeTeamMember");
Object.defineProperty(exports, "removeTeamMember", { enumerable: true, get: function () { return removeTeamMember_1.removeTeamMember; } });
var createCheckoutSession_1 = require("./payments/createCheckoutSession");
Object.defineProperty(exports, "createCheckoutSession", { enumerable: true, get: function () { return createCheckoutSession_1.createCheckoutSession; } });
var stripeWebhook_1 = require("./payments/stripeWebhook");
Object.defineProperty(exports, "stripeWebhook", { enumerable: true, get: function () { return stripeWebhook_1.stripeWebhook; } });
var getPaymentHistory_1 = require("./payments/getPaymentHistory");
Object.defineProperty(exports, "getPaymentHistory", { enumerable: true, get: function () { return getPaymentHistory_1.getPaymentHistory; } });
var sendOrderEmails_1 = require("./email/sendOrderEmails");
Object.defineProperty(exports, "sendOrderConfirmation", { enumerable: true, get: function () { return sendOrderEmails_1.sendOrderConfirmation; } });
Object.defineProperty(exports, "sendOrderStatusUpdate", { enumerable: true, get: function () { return sendOrderEmails_1.sendOrderStatusUpdate; } });
var updateSubscriptionPlan_1 = require("./payments/updateSubscriptionPlan");
Object.defineProperty(exports, "updateSubscriptionPlan", { enumerable: true, get: function () { return updateSubscriptionPlan_1.updateSubscriptionPlan; } });
var placeOrder_1 = require("./orders/placeOrder");
Object.defineProperty(exports, "placeOrder", { enumerable: true, get: function () { return placeOrder_1.placeOrder; } });
var cancelOrder_1 = require("./orders/cancelOrder");
Object.defineProperty(exports, "cancelOrder", { enumerable: true, get: function () { return cancelOrder_1.cancelOrder; } });
var downloadReceipt_1 = require("./orders/downloadReceipt");
Object.defineProperty(exports, "downloadReceipt", { enumerable: true, get: function () { return downloadReceipt_1.downloadReceipt; } });
var userTriggers_1 = require("./triggers/userTriggers");
Object.defineProperty(exports, "onUserUpdate", { enumerable: true, get: function () { return userTriggers_1.onUserUpdate; } });
var productTriggers_1 = require("./triggers/productTriggers");
Object.defineProperty(exports, "onMasterProductWrite", { enumerable: true, get: function () { return productTriggers_1.onMasterProductWrite; } });
var optimizeEndpoint_1 = require("./smartcart/optimizeEndpoint");
Object.defineProperty(exports, "smartcartOptimize", { enumerable: true, get: function () { return optimizeEndpoint_1.smartcartOptimize; } });
var optimizeCart_1 = require("./cart/optimizeCart");
Object.defineProperty(exports, "cartOptimize", { enumerable: true, get: function () { return optimizeCart_1.cartOptimize; } });
var algoliaTriggers_1 = require("./triggers/algoliaTriggers");
Object.defineProperty(exports, "syncMasterProductToAlgolia", { enumerable: true, get: function () { return algoliaTriggers_1.syncMasterProductToAlgolia; } });
var syncTrafficStats_1 = require("./admin/syncTrafficStats");
Object.defineProperty(exports, "syncTrafficStats", { enumerable: true, get: function () { return syncTrafficStats_1.syncTrafficStats; } });
var getSystemHealth_1 = require("./admin/getSystemHealth");
Object.defineProperty(exports, "getSystemHealth", { enumerable: true, get: function () { return getSystemHealth_1.getSystemHealth; } });
var scrapeFlyer_1 = require("./admin/scrapeFlyer");
Object.defineProperty(exports, "scrapeFlyer", { enumerable: true, get: function () { return scrapeFlyer_1.scrapeFlyer; } });
var processScheduledJobs_1 = require("./admin/processScheduledJobs");
Object.defineProperty(exports, "processScheduledJobs", { enumerable: true, get: function () { return processScheduledJobs_1.processScheduledJobs; } });
var searchPublicDeals_1 = require("./admin/searchPublicDeals");
Object.defineProperty(exports, "searchPublicDeals", { enumerable: true, get: function () { return searchPublicDeals_1.searchPublicDeals; } });
var recordAuditEvent_1 = require("./audit/recordAuditEvent");
Object.defineProperty(exports, "recordAuditEvent", { enumerable: true, get: function () { return recordAuditEvent_1.recordAuditEvent; } });
var algoliaMerchantTriggers_1 = require("./triggers/algoliaMerchantTriggers");
Object.defineProperty(exports, "syncMerchantProductToAlgolia", { enumerable: true, get: function () { return algoliaMerchantTriggers_1.syncMerchantProductToAlgolia; } });
var onboardStore_1 = require("./payments/onboardStore");
Object.defineProperty(exports, "onboardStore", { enumerable: true, get: function () { return onboardStore_1.onboardStore; } });
var checkStripeStatus_1 = require("./payments/checkStripeStatus");
Object.defineProperty(exports, "checkStripeAccountStatus", { enumerable: true, get: function () { return checkStripeStatus_1.checkStripeAccountStatus; } });
var createPaymentIntent_1 = require("./payments/createPaymentIntent");
Object.defineProperty(exports, "createPaymentIntent", { enumerable: true, get: function () { return createPaymentIntent_1.createPaymentIntent; } });
var refundOrder_1 = require("./payments/refundOrder");
Object.defineProperty(exports, "refundOrder", { enumerable: true, get: function () { return refundOrder_1.refundOrder; } });
var orderTriggers_1 = require("./triggers/orderTriggers");
Object.defineProperty(exports, "onOrderStatusUpdated", { enumerable: true, get: function () { return orderTriggers_1.onOrderStatusUpdated; } });
var orderCreationTrigger_1 = require("./triggers/orderCreationTrigger");
Object.defineProperty(exports, "onOrderCreated", { enumerable: true, get: function () { return orderCreationTrigger_1.onOrderCreated; } });
var priceHistoryTrigger_1 = require("./triggers/priceHistoryTrigger");
Object.defineProperty(exports, "onMerchantProductPriceChange", { enumerable: true, get: function () { return priceHistoryTrigger_1.onMerchantProductPriceChange; } });
var storeTriggers_1 = require("./triggers/storeTriggers");
Object.defineProperty(exports, "onStoreDelete", { enumerable: true, get: function () { return storeTriggers_1.onStoreDelete; } });
//# sourceMappingURL=index.js.map