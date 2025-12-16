import { StripeService } from './stripe';
import { LedgerService } from './ledger';

// Mock types for webhook event
interface StripeEvent {
    type: string;
    data: {
        object: any;
    }
}

export class WebhookHandler {
    private stripeService: StripeService;
    private ledger: LedgerService;

    constructor() {
        this.stripeService = new StripeService();
        this.ledger = new LedgerService();
    }

    async handleEvent(event: StripeEvent) {
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

    private async handlePaymentSucceeded(paymentIntent: any) {
        const cartId = paymentIntent.metadata.cartId;
        const chargeId = paymentIntent.latest_charge;

        if (!cartId) return; // Should log error

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

    private async handleRefund(charge: any) {
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
