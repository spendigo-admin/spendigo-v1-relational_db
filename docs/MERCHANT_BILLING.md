# Merchant Billing, Subscriptions, & Stripe Connect Operations

**Last Updated**: 2026-05-23  
**Status**: Production-Ready (v1.5)  
**System Architecture**: Distributed Cloud Functions + Firestore Gating + Stripe Checkout/Billing  

---

## 1. Overview

Spendigo utilizes **Stripe** as the primary financial ledger and payment infrastructure for merchant subscriptions (Stripe Billing) and shopper-to-merchant payouts (Stripe Connect). 

This document outlines the merchant subscription tiers, feature gating parameters, the dynamic promo code creation architecture, the proration billing protocols, and how Stripe is configured across the platform's codebase.

---

## 2. Subscription Plan Tiers & Gating Logic

Spendigo enforces a multi-tier feature gating system mapped directly to the merchant user's `subscriptionTier` field in their Firestore user profile (`users/{userId}`).

### 2.1 Pricing and Feature Matrix

| Tier | Price (CAD) | Product Limit | Live Orders Scope | Marketing / Push Campaigns | Catalog & Flyers Ingestion | Commission |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Starter** | $0/mo | **Strict 10-Product Cap** | **Pickup-Only** (Delivery filtered) | Locked | Locked | 10% |
| **Core** | $49/mo | Unlimited | Pickup + Delivery | Locked | Locked | 5% |
| **Growth** | $99/mo | Unlimited | Pickup + Delivery | Locked | **Unlocked** (Ingestions + Highlights) | 2% |
| **Pro** | $149/mo | Unlimited | Pickup + Delivery | **Unlocked** (Push Blasts, 200/24h) | **Unlocked** + Custom Deals & BOGOs | 1% |

---

## 3. Gating Implementation & Front-End Rules

The platform secures feature boundaries on both the client (React routing/state checks) and server (Cloud Functions validation) layers.

### 3.1 10-Product Cap (Starter Plan)
- **File:** [Products.tsx](file:///Users/I501801/Documents/Projects/Spendigo-v1/apps/web/src/pages/merchant/Products.tsx)
- **Gating mechanism:** If `products.length >= 10`, single product addition (`+ Add Product`) and `Bulk Upload` buttons render with low opacity (`opacity-50`) and trigger a descriptive notification directing them to upgrade.
- **Server Guard:** Backend writes check the product inventory size before committing to Firestore to prevent API exploitation.

### 3.2 Pickup-Only Live Orders (Starter Plan)
- **File:** [Orders.tsx](file:///Users/I501801/Documents/Projects/Spendigo-v1/apps/web/src/pages/merchant/Orders.tsx)
- **Gating mechanism:** The Kanban board, orders table, and transaction history are automatically filtered to show only pickup orders. Delivery orders (indicated by a non-null `deliveryAddress` field) are omitted. A premium notice banner is displayed at the top prompting them to upgrade to access delivery.

### 3.3 Digital Marketing & Catalog Gates
- **Weekly Flyers Ingestion ([Flyers.tsx](file:///Users/I501801/Documents/Projects/Spendigo-v1/apps/web/src/pages/merchant/Flyers.tsx)):** Gated behind a glassmorphic block for Starter and Core tiers. Growth and Pro plans are required to upload digital flyers or use automated catalog ingestions.
- **Custom Deals & Offers ([Deals.tsx](file:///Users/I501801/Documents/Projects/Spendigo-v1/apps/web/src/pages/merchant/Deals.tsx)):** Locked out for Starter, Core, and Growth tiers. Pro plans are required to launch custom flash sales, BOGO offers, and custom discount vouchers.
- **Push Marketing Campaign Access ([Marketing.tsx](file:///Users/I501801/Documents/Projects/Spendigo-v1/apps/web/src/pages/merchant/Marketing.tsx)):** Push marketing is restricted to the Pro tier. Non-Pro plans render a lock screen indicating their limits.

---

## 4. Stripe Subscription Configuration

Spendigo subscription transactions are processed using Stripe Billing. Prices and checkout redirection are orchestrated using Firestore configurations and environment variables.

### 4.1 Price Identifiers (Vite/Node Environment Config)
Prices are configured through the following environment variables on the hosting environment or Cloud Functions runner:
- `STRIPE_PRICE_CORE`: Price ID for Core Store subscription.
- `STRIPE_PRICE_GROWTH`: Price ID for Growth subscription.
- `STRIPE_PRICE_PRO`: Price ID for Pro subscription.

### 4.2 Billing Alignment Protocol (1st of Each Month)
To keep accounting synchronous, Spendigo aligns all monthly subscription renewals to the **1st of the next month**. 
- **Proration Charge Prevention:** During initial checkout session creation inside [createCheckoutSession.ts](file:///Users/I501801/Documents/Projects/Spendigo-v1/services/api/src/payments/createCheckoutSession.ts), we calculate the remaining days of the current month and set:
  ```typescript
  subscriptionData.billing_cycle_anchor = Math.floor(nextMonth.getTime() / 1000);
  subscriptionData.proration_behavior = 'none';
  ```
  This setting prevents Stripe from generating complex and confusing partial month proration charges today. The checkout invoice registers **CA$0.00** due today, granting the merchant the remaining days of the current month free, with their first regular billing occurring cleanly on the 1st of the next month.

- **Mid-Month Tier Changes:** Upgrades and downgrades processed via [updateSubscriptionPlan.ts](file:///Users/I501801/Documents/Projects/Spendigo-v1/services/api/src/payments/updateSubscriptionPlan.ts) are executed immediately. 
  - **Immediate Upgrades:** Stripe calculates the prorated difference for the current month and invoices it immediately.
  - **Immediate Downgrades & Cancellations:** Downgrades calculate the credit value remaining on the higher tier and instantly trigger a card refund through Stripe's `refunds.create` API, avoiding confusing system billing credits on the client's invoice.

---

## 5. Dynamic Promo Codes & Discount Architecture

Platform administrators can dynamically generate coupons and customer-facing promotion codes that integrate with Stripe Billing and undergo real-time validation in the merchant dashboard checkout session.

```
+-----------------------------------------------------------------------------------+
|                            Dynamic Promo Code Flow                                |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [Admin Dashboard UI] ----> HTTPS Callable Cloud Function [createPromoCode]        |
|                                     |                                             |
|                                     v                                             |
|                        1. Creates Stripe Coupon                                   |
|                        2. Creates Stripe Promotion Code                           |
|                        3. Commits Metadata to Firestore [promo_codes/{CODE}]      |
|                                                                                   |
|                                                                                   |
|  [Merchant Checkout] ----> Reads promo_codes/{CODE} (Validated by rules)          |
|                                     |                                             |
|                                     v                                             |
|                     1. Updates UI pricing dynamic displays                        |
|                     2. Requests Checkout Session [createCheckoutSession]          |
|                     3. Applies Stripe coupon ID to Checkout Session Discounts     |
+-----------------------------------------------------------------------------------+
```

### 5.1 Admin Promo Code Creation API
- **Trigger:** `httpsCallable(functions, 'createPromoCode')`
- **File Location:** [createPromoCode.ts](file:///Users/I501801/Documents/Projects/Spendigo-v1/services/api/src/admin/createPromoCode.ts)
- **Parameters:**
  ```typescript
  interface CreatePromoParams {
      code: string;               // Unique alphanumeric coupon identifier (e.g., MERCHANT50)
      percentOff?: number;        // Percentage off (1 to 100)
      amountOff?: number;         // Fixed CAD value off (in dollars)
      duration: 'once' | 'repeating' | 'forever';
      durationInMonths?: number;  // Required only if duration is 'repeating'
      maxRedemptions?: number;    // Optional. Global redemption cap
      expiresAt?: string;         // Optional. Future ISO Expiration Date
  }
  ```
- **Stripe SDK Mapping:**
  - Creates a Coupon: `stripe.coupons.create({ ... })`
  - Creates a Promotion Code pointing to that Coupon:
    ```typescript
    const promoParams = {
        promotion: { type: 'coupon', coupon: stripeCouponId },
        code: normalizedCode,
        max_redemptions: maxRedemptions,
        expires_at: expiresTimestamp
    };
    await stripe.promotionCodes.create(promoParams);
    ```

### 5.2 Firestore Security Gating
To permit dynamic validations at checkout while preventing data scraping of active codes, the following rules are active in [firestore.rules](file:///Users/I501801/Documents/Projects/Spendigo-v1/firestore.rules):
```rules
    // PROMO CODES — dynamic discounts register
    match /promo_codes/{code} {
      allow get: if isAuthenticated(); // Allow logged-in merchants to verify/fetch properties of a specific code by ID
      allow list: if isAdmin(); // Only platform administrators can list all promo codes
      allow write: if isAdmin(); // Only platform administrators can create, update, or delete coupons
    }
```

### 5.3 Checkout Application & Dynamic Pricing Card Updates
- **File:** [Subscription.tsx](file:///Users/I501801/Documents/Projects/Spendigo-v1/apps/web/src/pages/merchant/Subscription.tsx)
- **Checkout Injection:** When a code is applied, the merchant UI makes a direct `getDoc` call for `/promo_codes/{code}` to Firestore to load discount specifications. If valid and active, it adjusts the `activePromo` and `customPromoData` states.
- **Dynamic Pricing Calculations:** Pricing cards compute and display the *actual discounted monthly prices* in green alongside the crossed-out standard pricing based on custom specifications:
  - **Percent Off:** `priceVal * (1 - percentOff / 100)`
  - **Fixed Amount Off:** `Math.max(0, priceVal - amountOff)`
- **Dynamic Session Call:** When checkout starts, it sends the validated code to the backend callable which hooks it into the checkout discounts array:
  ```typescript
  discounts = [{ coupon: promoData.stripeCouponId }];
  ```

---

## 6. Stripe Connect Onboarding & Payouts (Reconciliation)

Spendigo orchestrates merchant payouts at the individual order transaction layer.

### 6.1 Connect Configuration
- **File:** [onboardStore.ts](file:///Users/I501801/Documents/Projects/Spendigo-v1/services/api/src/payments/onboardStore.ts)
- **Account Type:** Stripe **Standard Express Account**.
- **Onboarding Link:** Generates a custom `stripe.accountLinks.create` redirection session allowing merchants to fill in bank details on Stripe's native dashboard.

### 6.2 Commission Deductions (Sourcelinked Payouts)
Commission rates are dynamically set based on the store's current `subscriptionTier` record (ranging from 10% on Starter down to 1% on Pro). Payouts are handled at order fulfillment:
- **Calculation:** Commission = `OrderSubtotal * CommissionPercentage`.
- **Payout:** Payouts are settled automatically. Stripe maps the customer transaction charge to the merchant's Connect Account, minus Spendigo's application fee (commission).
- **File Triggers:** Managed in [orderTriggers.ts](file:///Users/I501801/Documents/Projects/Spendigo-v1/services/api/src/triggers/orderTriggers.ts) listening to order status transitions to `delivered`.

---

## 7. Webhook Infrastructure & Event Routing

The centralized webhook handler routes payment states directly to appropriate services to update merchant tiers.

### 7.1 Webhook Router (`payments/stripeWebhook.ts`)
Standard handlers for billing events:
1. **`checkout.session.completed`**: Resolves the Stripe customer and links the first-time subscription to the `users/{userId}` database registry.
2. **`invoice.payment_succeeded`**:
   - Updates the store's `subscriptionStatus` to `active`.
   - Records the transactional log inside `billing_ledger` Firestore collection for MRR reporting.
3. **`customer.subscription.deleted`**: Triggers grace downgrade processes, reverting the merchant user to `subscriptionTier: 'free'` and blocking advanced dashboards.
4. **`charge.refunded`**: Reverts the matching shopper transaction, updates order status, and logs a forensic `STRIPE_REFUND_ISSUED` audit log.
