# Merchant Billing & Subscription Operations

This document outlines the billing procedures, payment history tracking, and development protocols for the Spendigo Merchant platform.

## 1. Overview
Spendigo utilizes Stripe as its primary payment processor for Merchant Subscriptions (Starter, Core, and Growth tiers). All subscription-related events are synchronized in real-time between Stripe and our Firestore database.

## 2. Payment History Tracking
To ensure financial transparency and compliance with Canadian marketplace regulations:
- The system maintains a transparent log of the last **12 successful payments**.
- Merchants can access these records through their dashboard.
- Each entry includes:
    - **Transaction Date**: The timestamp of the successful charge.
    - **Subscription Tier**: The active plan (Starter, Core Store, or Growth).
    - **Amount & Currency**: Detailed breakdown of the total paid ($CAD).
    - **Status**: Verification of the payment outcome (e.g., "paid").
    - **Invoice PDF**: Direct access to the official Stripe-generated invoice for tax and accounting purposes.

## 3. Real-Time Synchronization (Webhooks)
Real-time updates are handled via Stripe Webhooks. This ensures that:
1. Subscription upgrades are applied immediately upon successful payment.
2. Expired or cancelled subscriptions trigger automatic feature restriction in the dashboard.
3. Billing failures are captured and displayed to the merchant promptly.

## 4. Operational Testing (Developer Guide)
*This section is intended for administrative and development purposes.*

To test the billing lifecycle in the development environment without processing real transactions:

### Invoking the Local Listener
The developer environment utilizes the Stripe CLI to bridge local functions with Stripe’s cloud sandbox.

**Execution Command:**
```bash
npm run stripe:listen
```

**Functionality:**
- Forwards `checkout.session.completed` and `invoice.paid` events to:
  `localhost:5001/spendigo-8540c/us-central1/stripeWebhook`
- Triggers the real-time `onSnapshot` listener in the frontend `AuthContext`.

### Configuration Security
The unique `whsec_...` (Webhook Signing Secret) generated during the listener session must be synchronized with the local environment variables in `services/api/.runtimeconfig.json` to ensure payload verification and security.

---
*Spendigo Legal & Operations - Confidential*
