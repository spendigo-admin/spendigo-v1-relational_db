"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeService = void 0;
const stripe_1 = __importDefault(require("stripe"));
// NOTE: in production use process.env.STRIPE_SECRET_KEY
const stripe = new stripe_1.default('sk_test_placeholder', {
    apiVersion: '2023-10-16',
});
class StripeService {
    /**
     * Creates a PaymentIntent for the TOTAL cart amount.
     * Logic: "Separate Charges and Transfers"
     * 1. Charge the customer on the Platform.
     * 2. Tag with transfer_group (e.g., Cart ID).
     * 3. Later (webhooks), we create transfers to each store.
     */
    async createPaymentIntent(cartId, totalAmountCents, customerId) {
        return await stripe.paymentIntents.create({
            amount: totalAmountCents,
            currency: 'cad',
            customer: customerId,
            transfer_group: cartId, // CRITICAL: Links the charge to future transfers
            metadata: { cartId },
            automatic_payment_methods: { enabled: true },
        });
    }
    /**
     * Creates a Transfer to a connected Store account.
     * Called after payment_intent.succeeded.
     */
    async distributeFunds(cartId, sourceChargeId, splits) {
        const results = [];
        for (const split of splits) {
            // Amount to transfer = Store Sudo Total - Commission
            // OR if we already calculated the net, we just use that.
            // Usually strategy is: Transfer the GROSS, take application_fee?
            // With Separate Transfers, we just transfer the NET amount we owe the store.
            const netToStore = split.amountCents - split.commissionCents;
            // Safety check
            if (netToStore <= 0)
                continue;
            try {
                const transfer = await stripe.transfers.create({
                    amount: netToStore,
                    currency: 'cad',
                    destination: split.storeStripeAccountId,
                    transfer_group: cartId, // Links back to the source charge
                    source_transaction: sourceChargeId, // Ensures funds come from that specific charge (availability)
                    metadata: {
                        orderId: split.orderId,
                        commission: split.commissionCents
                    }
                });
                results.push({ orderId: split.orderId, status: 'success', transferId: transfer.id });
            }
            catch (error) {
                console.error(`Transfer failed for order ${split.orderId}:`, error);
                results.push({ orderId: split.orderId, status: 'failed', error: error.message });
            }
        }
        return results;
    }
    /**
     * Refunds a specific portion (one store's order) back to the consumer.
     * Platform must reverse the transfer from the store first (if valid), then refund to card.
     */
    async issuePartialRefund(paymentIntentId, amountCents, reason) {
        return await stripe.refunds.create({
            payment_intent: paymentIntentId,
            amount: amountCents,
            reason: 'requested_by_customer', // or generic
            metadata: { internalReason: reason }
        });
    }
}
exports.StripeService = StripeService;
//# sourceMappingURL=stripe.js.map