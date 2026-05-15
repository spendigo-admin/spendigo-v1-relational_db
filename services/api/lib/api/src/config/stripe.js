"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripe = void 0;
const stripe_1 = __importDefault(require("stripe"));
const stripeSecret = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
exports.stripe = new stripe_1.default(stripeSecret, {
    apiVersion: '2025-12-15.clover', // Match the version expected by the installed Stripe SDK
});
//# sourceMappingURL=stripe.js.map