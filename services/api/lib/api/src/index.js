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
exports.cartOptimize = exports.smartcartOptimize = exports.onMasterProductWrite = exports.onUserUpdate = exports.cancelOrder = exports.placeOrder = exports.updateSubscriptionPlan = exports.sendOrderStatusUpdate = exports.sendOrderConfirmation = exports.getPaymentHistory = exports.stripeWebhook = exports.createCheckoutSession = exports.removeTeamMember = exports.deleteUser = exports.inviteTeamMember = exports.cleanupOrphanedUsers = void 0;
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin
admin.initializeApp();
// Export all functions
var cleanupOrphanedUsers_1 = require("./admin/cleanupOrphanedUsers");
Object.defineProperty(exports, "cleanupOrphanedUsers", { enumerable: true, get: function () { return cleanupOrphanedUsers_1.cleanupOrphanedUsers; } });
var inviteTeamMember_1 = require("./auth/inviteTeamMember");
Object.defineProperty(exports, "inviteTeamMember", { enumerable: true, get: function () { return inviteTeamMember_1.inviteTeamMember; } });
var deleteUser_1 = require("./auth/deleteUser");
Object.defineProperty(exports, "deleteUser", { enumerable: true, get: function () { return deleteUser_1.deleteUser; } });
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
var userTriggers_1 = require("./triggers/userTriggers");
Object.defineProperty(exports, "onUserUpdate", { enumerable: true, get: function () { return userTriggers_1.onUserUpdate; } });
var productTriggers_1 = require("./triggers/productTriggers");
Object.defineProperty(exports, "onMasterProductWrite", { enumerable: true, get: function () { return productTriggers_1.onMasterProductWrite; } });
var optimizeEndpoint_1 = require("./smartcart/optimizeEndpoint");
Object.defineProperty(exports, "smartcartOptimize", { enumerable: true, get: function () { return optimizeEndpoint_1.smartcartOptimize; } });
var optimizeCart_1 = require("./cart/optimizeCart");
Object.defineProperty(exports, "cartOptimize", { enumerable: true, get: function () { return optimizeCart_1.cartOptimize; } });
//# sourceMappingURL=index.js.map