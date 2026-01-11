# Merchant Billing & Subscription Operations

**Last Updated**: 2026-01-11  
**Status**: Beta (Stripe Test Mode Active)

This document outlines the billing procedures, subscription tiers, and development protocols for the Spendigo Merchant platform.

---

## 1. Overview

Spendigo utilizes **Stripe** as its payment processor for Merchant Subscriptions. The system uses a **Hybrid approach**:
- **Frontend**: Stripe Checkout (Hosted Page) for secure card entry.
- **Backend**: Firebase Cloud Functions + Stripe Webhooks for secure status synchronization.

---

## 2. Subscription Tiers

| Tier | Price (CAD) | Features | Stripe Product ID (Test) |
| :--- | :--- | :--- | :--- |
| **Free / Starter** | $0/mo | • Up to 50 Products<br>• Basic Analytics<br>• No Flyers | `prod_Ran...` (Auto-assigned) |
| **Core Store** | $29/mo | • Up to 500 Products<br>• Weekly Flyers<br>• Priority Support | `prod_Q...` |
| **Growth** | $79/mo | • Unlimited Products<br>• Daily Deals<br>• Advanced Analytics | `prod_R...` |

---

## 3. Payment History & Invoicing

To ensure financial transparency and compliance with Canadian marketplace regulations:
- The system maintains a transparent log of the last **12 successful payments**.
- Merchants can access these records through `Settings > Subscription`.
- Each entry includes:
    - **Transaction Date**: The timestamp of the successful charge.
    - **Amount**: Total paid ($CAD) + HST.
    - **Status**: Verification of the payment outcome (e.g., "paid").
    - **Invoice PDF**: Direct link to the official Stripe-generated invoice.

---

## 4. Technical Architecture

### 4.1 Data Flow
1.  **Subscription Start**: Merchant clicks "Subscribe" -> Redirects to Stripe Checkout.
2.  **Payment Success**: Stripe redirects back to `/merchant/subscription?success=true`.
3.  **Webhook Event**: Stripe sends `checkout.session.completed` to Cloud Function.
4.  **Database Update**: Cloud Function updates `users/{uid}` with:
    - `subscriptionStatus: 'active'`
    - `subscriptionTier: 'core'`
    - `stripeCustomerId: 'cus_...'`

### 4.2 Webhook Handling
Real-time updates are handled via the `stripeWebhook` Cloud Function:
- **`checkout.session.completed`**: Activates new subscriptions.
- **`invoice.payment_succeeded`**: Logs payment history to `users/{uid}/payments`.
- **`customer.subscription.deleted`**: Downgrades user to 'Free' tier automatically.

---

## 5. Developer Guide (Local Testing)

To test the billing lifecycle in the development environment:

### 5.1 Prerequisites
- Stripe CLI installed (`brew install stripe/stripe-cli/stripe`)
- Local Firebase Emulators running (`npm run dev`)

### 5.2 Invoking the Listener
Forward webhooks to your local function:

```bash
npm run stripe:listen
# Output: Ready! Your webhook signing secret is whsec_...
```

**Important**: You must update the `stripe.webhook_secret` config variable in your local `.runtimeconfig.json` or `.env` file if the secret changes.

### 5.3 Triggering Events
You can trigger mock events via CLI to test UI responses:

```bash
stripe trigger invoice.payment_succeeded
```

---

**For integration details, see**: `services/api/src/stripe/webhook.ts`
