# Merchant Billing & Subscription Operations

**Last Updated**: 2026-04-20
**Status**: Production-Ready (v1.0)

---

## 1. Overview
Spendigo utilizes **Stripe** as the primary financial engine for merchant subscriptions and marketplace payouts. The platform operates on a **Marketplace Facilitator** model, managing automated commissions and tiered service access.

---

## 2. Subscription Tiers (v1.0)

| Tier | Price (CAD) | Core Features | Marketplace Logic |
| :--- | :--- | :--- | :--- |
| **Starter** | $0/mo | • Up to 50 Products<br>• Pickup Only<br>• Basic Profile | 10% Platform Commission |
| **Core Store** | $49/mo | • Unlimited Products<br>• Delivery Toggle<br>• Order Management | 5% Platform Commission |
| **Growth** | $99/mo | • Featured Placement<br>• Flyer Highlighting<br>• Advanced Analytics | 2% Platform Commission |

### Specialized Promotional Rates
- **Code: `WELCOME2026`**:
  - **Core Plan**: 100% OFF for 1 Year ($0/mo).
  - **Growth Plan**: 90% OFF for 1 Year ($9.90/mo).

---

## 3. Financial Reconciliation

### 3.1 Payouts (Stripe Connect)
- Merchants must complete **Standard Connect Onboarding** before receiving payouts.
- Payouts are triggered automatically upon order delivery confirmation.
- The platform commission is deducted at the source using Stripe's `transfer_group` and `application_fee_amount`.

### 3.2 Payment History
- The system retains a record of the last **12 successful payments** within `Settings > Subscription`.
- Each ledger entry includes:
  - **Transaction Date**: Verification timestamp.
  - **Amount**: Total CAD (inclusive of regional taxes).
  - **Plan**: Tier identification at the time of charge.
  - **Status**: Transaction outcome (e.g., "paid").

---

## 4. Operational Architecture

### 4.1 Lifecycle Hooks (`subscriptionTriggers.ts`)
- **Upgrade/Downgrade**: Handled via `updateSubscriptionPlan` Cloud Function. Upgrades to higher tiers (e.g., Core -> Growth) are processed immediately with proration.
- **Cancellation**: Downgrades to the "Starter" tier take effect at the end of the current billing cycle to preserve paid access.

### 4.2 Webhook Governance
The `stripeWebhook` manages critical state transitions:
- `checkout.session.completed`: Initializes the initial customer object and first-time subscription.
- `invoice.payment_succeeded`: Logs the transaction to the Firestore `payments` subcollection.
- `customer.subscription.deleted`: Gracefully transitions the store to the "Starter" tier.

---

## 5. Developer Validation (Stripe CLI)
To test billing webhooks in the local environment:

1. **Start Listener**:
   ```bash
   npm run stripe:listen
   ```
2. **Simulate Event**:
   ```bash
   stripe trigger invoice.payment_succeeded
   ```
3. **Verify**: Check the `AuditLogs` in the Admin Dashboard for `STRIPE_WEBHOOK_RECEIVED` signals.
