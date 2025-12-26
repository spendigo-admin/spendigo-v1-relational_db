"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookHandler = void 0;
const stripe_1 = require("./stripe");
const ledger_1 = require("./ledger");
class WebhookHandler {
    constructor() {
        this.stripeService = new stripe_1.StripeService();
        this.ledger = new ledger_1.LedgerService();
    }
    async handleEvent(event) {
        switch (event.type) {
            case 'payment_intent.succeeded':
                await this.handlePaymentSucceeded(event.data.object);
                break;
            case 'charge.refunded':
                await this.handleRefund(event.data.object);
                break;
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }
    }
    async handlePaymentSucceeded(paymentIntent) {
        const cartId = paymentIntent.metadata.cartId;
        const chargeId = paymentIntent.latest_charge;
        if (!cartId)
            return; // Should log error
        // Record the incoming charge
        await this.ledger.record({
            transactionType: 'CHARGE',
            amountCents: paymentIntent.amount,
            currency: 'CAD',
            sourceReference: paymentIntent.id,
            destinationReference: 'PLATFORM_HOLDING',
            cartId: cartId,
            timestamp: new Date()
        });
        // TRIGGER FUND DISTRIBUTION
        // In production, we would fetch the 'splits' calculated at checkout from the DB orders table
        // For now, we assume we fetch them:
        const mockSplits = [
        // { storeStripeAccountId: 'acct_123', amountCents: 5000, commissionCents: 250, orderId: 'ord_1' }
        ];
        if (mockSplits.length > 0) {
            await this.stripeService.distributeFunds(cartId, chargeId, mockSplits);
        }
    }
    async handleRefund(charge) {
        await this.ledger.record({
            transactionType: 'REFUND',
            amountCents: charge.amount_refunded,
            currency: 'CAD',
            sourceReference: charge.id,
            destinationReference: 'CONSUMER',
            timestamp: new Date()
        });
    }
}
exports.WebhookHandler = WebhookHandler;
//# sourceMappingURL=webhooks.js.map