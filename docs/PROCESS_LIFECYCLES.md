# Spendigo — End-to-End Process Lifecycles

This document maps every major process lifecycle in the platform. Each entry traces the complete path from trigger to terminal state — including error paths, async gaps, and race conditions — to support reliability, resilience, and availability testing across the multi-merchant / multi-user / multi-location stack.

**Layer notation used in step sequences**

| Label | System |
|---|---|
| `[FE]` | React frontend (`apps/web/`) |
| `[CF]` | Firebase Cloud Function (`services/api/`) |
| `[DB]` | Firestore |
| `[EXT]` | External service (Stripe, FCM, Algolia, Nominatim, Storage) |

---

## Quick Reference

| # | Lifecycle | Actor | Critical External Systems | Source Files |
|---|-----------|-------|--------------------------|--------------|
| 1 | Order Placement | Consumer | Stripe, Firestore txn | `orders/placeOrder.ts` |
| 2 | Order Status Transitions | Merchant | FCM | `triggers/orderTriggers.ts` |
| 3 | Order Cancellation | Consumer / Merchant / Admin | Firestore txn | `orders/cancelOrder.ts` |
| 4 | Receipt Download (PDF) | Consumer / Merchant | Storage, PDFKit | `orders/downloadReceipt.ts` |
| 5 | Payment Intent + Webhook Reconciliation | System | Stripe | `payments/stripeWebhook.ts` |
| 6 | Order Refund | Merchant | Stripe | `payments/refundOrder.ts` |
| 7 | Merchant Stripe Onboarding | Merchant | Stripe Connect | `payments/onboardStore.ts` |
| 8 | Subscription Purchase | Merchant | Stripe Checkout | `payments/createCheckoutSession.ts` |
| 9 | Subscription Plan Change | Merchant | Stripe | `payments/updateSubscriptionPlan.ts` |
| 10 | User Registration & Role Assignment | Any | Firebase Auth | `context/AuthContext.tsx` |
| 11 | Team Member Invite & Remove | Merchant | Firebase Auth, Mail | `auth/inviteTeamMember.ts` |
| 12 | Store Soft-Delete + Grace-Period Cascade | Admin / Cron | Stripe | `admin/processPendingStoreDeletions.ts` |
| 13 | Product Price Change + Geo-Targeted Alert | Merchant | FCM | `triggers/priceHistoryTrigger.ts` |
| 14 | SmartCart Optimization | Consumer | Firestore cache | `smartcart/optimizeSmartCart.ts` |
| 15 | Guest → Authenticated Cart Merge | Consumer | Firestore, localStorage | `context/CartContext.tsx` |
| 16 | Audit Log Chain *(cross-cutting)* | All | — | `utils/audit.ts`, `audit/recordAuditEvent.ts` |
| 17 | Scheduled Backup / Export *(cross-cutting)* | Cron | GCS | `admin/scheduledFirestoreExport.ts` |

---

## 1. Order Placement

**Actor:** Consumer (authenticated, email verified)  
**Trigger:** User submits checkout form

### Steps

1. `[FE]` Validate cart: group items by store, verify store hours, check delivery radius (max 5 km), confirm store has Stripe account (`stripeAccountId` present).
2. `[FE]` → `[CF]` Call `createPaymentIntent` — returns `clientSecret` + `paymentIntentId`. Fee: 5% + $0.30 platform cut via Stripe destination charge.
3. `[FE]` → `[EXT Stripe]` Confirm card payment using CardElement + `clientSecret`.
4. `[FE]` → `[CF]` Call `placeOrder` (rate limit: 10/min per user) with `orders[]` array + `paymentIntentId`.
5. `[CF]` App Check verified + auth check.
6. `[CF]` → `[DB]` Start Firestore transaction:
   - **Phase 0 (audit pre-fetch):** Read last `audit_logs` entry to get `prevHash` for chain integrity.
   - **Phase 1 (reads):** Fetch all `merchant_products` snapshots for every line item.
   - **Phase 2 (stock writes):** For each item, assert `available_quantity >= requested`; decrement with `FieldValue.increment(-quantity)`.
   - **Phase 3 (create orders):** Verify `paymentIntentId` status directly with Stripe API (`intent.status === 'succeeded'`); create `orders/{id}` doc with `status: 'placed'`, `paymentStatus: 'paid'` (card) or `'pending'` (in-store). Write audit log entry with chained hash.
7. `[DB]` Order document created → triggers `onOrderCreated` (post-order async: consumer in-app notification, merchant push, analytics increment).
8. `[CF]` Returns `{ orderIds, success: true }`.

### Error Paths

| Condition | Error Code | Behaviour |
|-----------|-----------|-----------|
| Not authenticated | `unauthenticated` | Function rejects before any DB reads |
| App Check invalid (prod) | `failed-precondition` | Function rejects before any DB reads |
| Rate limit exceeded | `resource-exhausted` | Rejects; client should back off |
| Missing `storeId` on order | `invalid-argument` | Transaction aborted immediately |
| Product no longer exists (system product) | `failed-precondition` | Transaction aborted; stock unchanged |
| Insufficient stock | `failed-precondition` | Message names the product + remaining qty; transaction aborted; stock unchanged |
| Payment intent not `succeeded` | `failed-precondition` | Transaction aborted; stock NOT decremented |
| Stripe API unreachable | `internal` | Transaction aborted |
| Firestore transaction conflict (contention) | `aborted` | Automatic retry by Firestore SDK |

### Async / Eventual-Consistency Gaps

- **Race condition — webhook before order:** Stripe's `payment_intent.succeeded` webhook may fire before `placeOrder` completes. The webhook writes an orphan record to `payments/{intentId}` with `orderId: null`. `placeOrder` independently verifies the intent via direct Stripe API call so the order is still created correctly. **The orphan `payments` record is never auto-reconciled** — it sits with `orderId: null` as an audit artefact.
- **Post-order trigger is async:** `onOrderCreated` (notifications, analytics) runs after the transaction returns. Merchant may not receive push immediately; in-app notification is the durable fallback.
- **Multi-order batching:** `placeOrder` accepts an array of orders (one per store). All run in a single transaction — if stock fails on order 2, order 1's stock deduction is also rolled back.

### Terminal States

| State | Description |
|-------|-------------|
| ✅ `placed` | Order created, stock decremented, payment verified |
| ❌ Aborted | No order created, no stock decremented (all errors above) |

### Test Scenarios

- Submit two concurrent `placeOrder` calls for the same product with `quantity = last_unit` — only one should succeed; assert stock reaches `0` not negative.
- Delay the `placeOrder` call by 5 s after payment confirmation to simulate webhook-first arrival; assert order is still created and `paymentStatus: 'paid'`.
- Kill Firestore mid-transaction (network partition); assert stock is unchanged and no order document exists.
- Submit order with `paymentIntentId` for a `requires_action` (3DS incomplete) intent; assert `failed-precondition` and no stock change.
- Flood `placeOrder` 11× in one minute; assert the 11th call returns `resource-exhausted`.

---

## 2. Order Status Transitions

**Actor:** Merchant (updates order status)  
**Trigger:** Merchant writes `status` change to `orders/{id}` via the merchant dashboard

### Steps

1. `[FE]` Merchant selects new status (`placed → preparing → out_for_delivery → delivered`).
2. `[DB]` Firestore write to `orders/{id}.status` (field-level rules allow merchants to change `status`, `rejectionReason`, `estimatedTime`, `paymentStatus`).
3. `[DB]` → `[CF]` `onOrderStatusUpdated` Firestore trigger fires (detects `before.status !== after.status`).
4. `[CF]` Determine notification title/body based on new status.
5. `[CF]` → `[DB]` Write persistent in-app notification to `users/{customerId}/notifications/{id}`.
6. `[CF]` → `[DB]` Fetch customer's `fcmTokens` array.
7. `[CF]` → `[EXT FCM]` `sendEachForMulticast` to all tokens with `data.tag: 'order-{orderId}'` (deduplicates on device).
8. `[CF]` On FCM failures: call `removeStaleTokens()` to strip invalid tokens from `users/{id}.fcmTokens`.

### Error Paths

| Condition | Behaviour |
|-----------|-----------|
| FCM multicast partial failure | Stale tokens removed; in-app notification already written (durable) |
| Customer has no FCM tokens | FCM step skipped; in-app notification is the only channel |
| Trigger fires on non-status field change | Guard `before.status !== after.status` prevents spurious notifications |
| Customer document missing | In-app write succeeds; FCM step skipped |

### Async / Eventual-Consistency Gaps

- Trigger is fire-and-forget from the merchant write. The in-app notification and FCM push are not transactional with the status update — they may arrive slightly after.
- `removeStaleTokens` runs inside the trigger; concurrent writes to `fcmTokens` from other devices could cause a lost-update on the token array.

### Terminal States

| State | Description |
|-------|-------------|
| ✅ Notified | In-app notification + FCM push both delivered |
| ⚠️ Partial | In-app written, FCM failed or no tokens |
| ❌ Silent | Trigger failed (logged; no recovery) |

### Test Scenarios

- Update an order status while the customer's device is offline; verify the in-app notification persists in Firestore and is readable on reconnect.
- Force all FCM tokens to be invalid; assert `removeStaleTokens` runs and `fcmTokens` is empty after the trigger.
- Perform two rapid status transitions in succession (e.g. `placed → preparing → out_for_delivery`); assert two separate notifications are written.
- Simulate trigger execution timeout at the in-app write step; assert order status was still changed (write is separate from trigger).

---

## 3. Order Cancellation

**Actor:** Consumer (order owner), Merchant (store owner), or Admin  
**Trigger:** Call to `cancelOrder` Cloud Function

### Steps

1. `[CF]` Auth check + rate limit (5/min per user).
2. `[CF]` → `[DB]` Fetch caller's user doc to read `role` and `storeId`.
3. `[CF]` → `[DB]` Start Firestore transaction:
   - **Read:** Fetch `orders/{id}`.
   - **Auth check (inside txn):** Verify caller is order owner, store merchant, or admin. Throw `permission-denied` if not.
   - **Idempotency check:** If `status === 'cancelled'` already, throw `failed-precondition`.
   - **Read:** Fetch all `merchant_products` for line items that still exist.
   - **Write:** Set `status: 'cancelled'`, `rejectionReason`, `cancelledAt`.
   - **Write:** Restore stock: `FieldValue.increment(+quantity)` for each existing product.
   - **Audit:** Write `ORDER_CANCELLED` audit event with chained hash.

### Error Paths

| Condition | Error Code | Behaviour |
|-----------|-----------|-----------|
| Not authenticated | `unauthenticated` | Rejected |
| Rate limit | `resource-exhausted` | Rejected |
| Order not found | `not-found` | Rejected |
| Insufficient permission | `permission-denied` | Rejected |
| Already cancelled | `failed-precondition` | Idempotent rejection (no stock double-restore) |
| Product deleted since order | Stock restore skipped for that item (guarded by `productSnap.exists`) |

### Async / Eventual-Consistency Gaps

- Stock restore is inside the transaction so it is atomic.
- No notification is sent to the other party on cancellation. If a merchant cancels, the consumer receives no automated push.

### Terminal States

| State | Description |
|-------|-------------|
| ✅ `cancelled` | Order cancelled, stock restored |
| ❌ Rejected | No change (any error above) |

### Test Scenarios

- Call `cancelOrder` twice for the same order; assert second call returns `failed-precondition` and stock is not double-incremented.
- Cancel an order where one line item's product has been deleted since order time; assert the other items' stock is still restored.
- Consumer attempts to cancel a different user's order; assert `permission-denied`.
- Merchant cancels order for a different store; assert `permission-denied`.

---

## 4. Receipt Download (PDF)

**Actor:** Consumer (order owner), Merchant (store), or Admin  
**Trigger:** Call to `downloadReceipt` Cloud Function

### Steps

1. `[CF]` Auth check.
2. `[CF]` → `[DB]` Fetch `orders/{id}`; verify existence.
3. `[CF]` Authorization: caller must be `customerId`, store's merchant, or admin.
4. `[CF]` Build PDF using PDFKit: header branding, "Sold By" / "Billed To" blocks, line items table (Description, Qty, Price, Total), Subtotal / Tax / Delivery Fee / Grand Total footer.
5. `[CF]` → `[EXT Storage]` Upload PDF to `receipts/{orderId}_{timestamp}.pdf` with metadata `firebaseStorageDownloadTokens: crypto.randomUUID()`.
6. `[CF]` Construct Firebase download URL with token and return to caller.

### Error Paths

| Condition | Error Code | Behaviour |
|-----------|-----------|-----------|
| Not authenticated | `unauthenticated` | Rejected |
| Order not found | `not-found` | Rejected |
| Insufficient permission | `permission-denied` | Rejected |
| Storage upload failure | `internal` | Function throws; no URL returned |

### Async / Eventual-Consistency Gaps

- Each call generates a new UUID token and overwrites the file if `orderId` + timestamp collide (unlikely). No deduplication — multiple downloads create multiple Storage objects.

### Terminal States

| State | Description |
|-------|-------------|
| ✅ URL returned | Download URL valid; PDF in Storage |
| ❌ Rejected | No file created |

### Test Scenarios

- Request receipt for a non-existent order; assert `not-found`.
- Simulate Storage bucket unavailable; assert `internal` and no URL leak.
- Download receipt as admin for a third-party order; assert succeeds.

---

## 5. Payment Intent + Webhook Reconciliation

**Actor:** System (Stripe event delivery)  
**Trigger:** Stripe fires an event to the `stripeWebhook` HTTPS endpoint

### Steps

**`payment_intent.succeeded`**
1. `[EXT Stripe]` → `[CF]` `stripeWebhook` receives POST with `stripe-signature` header.
2. `[CF]` Verify signature with `stripe.webhooks.constructEvent`. Reject with `400` on failure.
3. `[CF]` Extract `orderId` from `paymentIntent.metadata`.
4. `[CF]` → `[DB]` Check if `orders/{orderId}` exists.
   - **Exists:** Update `paymentStatus: 'paid'`, `paidAt: serverTimestamp()`.
   - **Does not exist (race condition):** Write orphan record to `payments/{intentId}` with `{ status: 'succeeded', orderId: null, metadata }`.
5. Return `200 { received: true }`.

**`checkout.session.completed`** (subscription mode)
1. Extract `firebaseUID` + `targetTier` from session metadata.
2. → `[DB]` Update `users/{firebaseUID}`: `subscriptionTier`, `subscriptionStatus: 'active'`, `stripeSubscriptionId`.
3. → `[DB]` Update `stores/{storeId}`: same tier/status.

**`charge.refunded`**
1. Find order by `paymentIntentId` query.
2. → `[DB]` Update `paymentStatus: 'refunded'`, `refundedAt`.

### Error Paths

| Condition | Behaviour |
|-----------|-----------|
| Invalid Stripe signature | `400` returned; event discarded |
| Order missing at webhook time | Orphan `payments` record written; **no auto-reconciliation** |
| `firebaseUID` missing from session metadata | Tier update skipped; logged |
| Firestore write fails | `500` returned; Stripe retries webhook (up to 72 h, exponential backoff) |

### Async / Eventual-Consistency Gaps

- **Core race:** `payment_intent.succeeded` webhook and `placeOrder` function run in parallel. `placeOrder` calls `stripe.paymentIntents.retrieve()` directly — this is the authoritative payment verification path regardless of webhook timing.
- Stripe retries webhooks on `5xx` responses. Duplicate events must be handled idempotently (current code does `update` on existing order — safe; `set` on `payments` collection — idempotent).

### Terminal States

| State | Description |
|-------|-------------|
| ✅ Reconciled | Order `paymentStatus: 'paid'` (either path) |
| ⚠️ Orphan | `payments/{intentId}` exists with `orderId: null`; requires manual or automated reconciliation |
| ❌ Bad signature | Event dropped; no Firestore change |

### Test Scenarios

- Replay a `payment_intent.succeeded` webhook twice for the same order; assert idempotent (`paymentStatus` remains `'paid'`).
- Fire webhook before `placeOrder` completes (simulate 1 s delay); assert orphan record created and order is still placed correctly afterward.
- Send webhook with tampered signature; assert `400` and no Firestore write.
- Send `checkout.session.completed` with missing `firebaseUID`; assert no panic (gracefully logged).

---

## 6. Order Refund

**Actor:** Merchant or Admin  
**Trigger:** Call to `refundOrder` Cloud Function

### Steps

1. `[CF]` Auth check; verify caller is merchant of the order's store or admin.
2. `[CF]` → `[DB]` Fetch `orders/{id}`; verify `paymentStatus === 'paid'`.
3. `[CF]` → `[EXT Stripe]` `stripe.refunds.create({ payment_intent })`.
4. `[CF]` → `[DB]` Update order: `paymentStatus: 'refunding'`, `refundId`, `refundReason`, `refundedAt`.
5. `[EXT Stripe]` → `[CF]` (async) Stripe fires `charge.refunded` webhook when refund settles.
6. `[CF]` (webhook) → `[DB]` Update `paymentStatus: 'refunded'`.

### Error Paths

| Condition | Error Code | Behaviour |
|-----------|-----------|-----------|
| Not paid | `failed-precondition` | Rejected |
| Insufficient permission | `permission-denied` | Rejected |
| Stripe API error | `internal` | Firestore not updated |

### Async / Eventual-Consistency Gaps

- `'refunding'` is an intermediate state. If the `charge.refunded` webhook is lost or delayed, the order stays `'refunding'` indefinitely. No polling or timeout recovery exists.

### Terminal States

| State | Description |
|-------|-------------|
| `refunding` | Stripe call succeeded; awaiting webhook |
| ✅ `refunded` | Webhook confirmed settlement |
| ❌ Failed | Stripe rejected refund; order unchanged |

### Test Scenarios

- Initiate refund and deliberately drop the `charge.refunded` webhook; assert order stays `'refunding'` and alert admin tooling.
- Attempt refund on an `'unpaid'` order; assert `failed-precondition`.
- Call `refundOrder` twice; assert Stripe returns error on second call and Firestore not updated again.

---

## 7. Merchant Stripe Onboarding

**Actor:** Merchant (OWNER)  
**Trigger:** Call to `onboardStore` Cloud Function from `/merchant/settings`

### Steps

1. `[CF]` Auth check; validate `storeId`.
2. `[CF]` → `[DB]` Fetch `stores/{storeId}`; verify existence.
3. `[CF]` → `[EXT Stripe]` If no `stripeAccountId` on store:
   - `stripe.accounts.create({ type: 'standard', country: 'CA', capabilities: { card_payments, transfers } })`.
4. `[CF]` → `[DB]` Save `stripeAccountId`, `stripeOnboardingStatus: 'pending'`, `stripeConnectedAt`.
5. `[CF]` → `[EXT Stripe]` `stripe.accountLinks.create({ type: 'account_onboarding', refresh_url, return_url })`.
6. `[CF]` Return `{ url, stripeAccountId }`.
7. `[FE]` Redirect merchant to Stripe onboarding UI (external).
8. `[EXT Stripe]` Merchant completes bank verification.
9. `[EXT Stripe]` Stripe sets `charges_enabled: true` on the account (no automatic Firestore update — must be polled or checked via `checkStripeAccountStatus`).

### Error Paths

| Condition | Error Code | Behaviour |
|-----------|-----------|-----------|
| Not authenticated | `unauthenticated` | Rejected |
| Store not found | `not-found` | Rejected |
| Stripe account creation fails | `internal` | `stripeAccountId` not saved |
| Account link creation fails | `internal` | `stripeAccountId` saved but no redirect URL |

### Async / Eventual-Consistency Gaps

- Onboarding completion on Stripe's side does not automatically update Firestore. The frontend must call `checkStripeAccountStatus` (or admin must manually verify) to flip the store to `active` for payments.
- If the merchant abandons the flow mid-way, a Stripe account exists but `charges_enabled` remains `false`.

### Terminal States

| State | Description |
|-------|-------------|
| `pending` | Stripe account created; onboarding not completed |
| ✅ Active (manual step) | `charges_enabled: true`; store can accept payments |
| ❌ Abandoned | Stripe account exists; `stripeOnboardingStatus: 'pending'`; no charges possible |

### Test Scenarios

- Call `onboardStore` twice for the same store; assert second call reuses `stripeAccountId` and does not create a duplicate Stripe account.
- Simulate Stripe account creation failure; assert `stripeAccountId` not saved to Firestore.
- Merchant abandons onboarding (never completes bank verification); assert `placeOrder` fails with `failed-precondition` ("store not onboarded").

---

## 8. Subscription Purchase

**Actor:** Merchant  
**Trigger:** Call to `createCheckoutSession` from `/merchant/subscription`

### Steps

1. `[CF]` App Check + auth check; rate limit (3/min per user).
2. `[CF]` Validate tier: must be `'core'` or `'growth'`.
3. `[CF]` → `[DB]` Fetch `users/{uid}`; check for existing `stripeCustomerId`.
4. `[CF]` → `[EXT Stripe]` If no customer: `stripe.customers.create({ email, metadata.firebaseUID })`; save `stripeCustomerId` to `users/{uid}`.
5. `[CF]` → `[DB]` Promo check: if `promoCode === 'FIRST100'`, count `stores` collection; if `< 100`, apply `trial_period_days: 90`.
6. `[CF]` → `[EXT Stripe]` `stripe.checkout.sessions.create({ mode: 'subscription', customer, price, metadata: { firebaseUID, targetTier } })`.
7. `[CF]` Return `{ url }`.
8. `[FE]` Redirect to Stripe Checkout.
9. `[EXT Stripe]` User pays → Stripe fires `checkout.session.completed`.
10. `[CF]` (webhook) → `[DB]` Update `users/{firebaseUID}`: `subscriptionTier`, `subscriptionStatus: 'active'`, `stripeSubscriptionId`. Update `stores/{storeId}` same fields.

### Error Paths

| Condition | Error Code | Behaviour |
|-----------|-----------|-----------|
| Invalid tier | `invalid-argument` | Rejected |
| Rate limit | `resource-exhausted` | Rejected |
| Stripe session creation fails | `internal` | No URL returned |
| Webhook `firebaseUID` missing | Silent skip | User/store NOT updated — manual fix needed |

### Async / Eventual-Consistency Gaps

- Firestore is only updated via the `checkout.session.completed` webhook. If the webhook is lost, the merchant's Firestore tier stays `'free'` despite payment.
- Two users applying `FIRST100` concurrently could both see `storeCount < 100` — race on the count check (no transaction). Minor: worst case two merchants both get a trial.

### Terminal States

| State | Description |
|-------|-------------|
| ✅ `active` | Subscription active; tier updated in Firestore |
| ⚠️ Paid / not updated | Stripe subscription created; webhook lost; Firestore still `'free'` |
| ❌ Abandoned | Checkout session created but user did not complete payment |

### Test Scenarios

- Drop `checkout.session.completed` webhook after payment; assert merchant tier stays `'free'` — measure the window for manual remediation.
- Apply `FIRST100` promo with `storeCount = 99`; assert 90-day trial applied.
- Apply `FIRST100` with `storeCount = 100`; assert no trial.
- Trigger `createCheckoutSession` 4× in 1 minute; assert 4th call returns `resource-exhausted`.

---

## 9. Subscription Plan Change (Upgrade / Downgrade)

**Actor:** Merchant  
**Trigger:** Call to `updateSubscriptionPlan` (from `/merchant/subscription`)

### Steps

1. `[CF]` Auth check; validate `newTier` in `['free', 'core', 'growth']`.
2. `[CF]` → `[DB]` Fetch user's `stripeSubscriptionId`.
3. `[CF]` → `[EXT Stripe]` List active subscriptions for customer.
4. `[CF]` Determine direction:
   - **Downgrade to free:** `stripe.subscriptions.update({ cancel_at_period_end: true })`. Firestore updated immediately or on `customer.subscription.deleted` webhook.
   - **Upgrade between paid:** `stripe.subscriptionItems.update` with new price, `proration_behavior: 'always_invoice'` (charges difference immediately).
   - **No existing sub + paid tier:** Throw `failed-precondition` (must use checkout flow instead).
5. `[EXT Stripe]` Fires subscription webhook → Firestore tier updated.

### Error Paths

| Condition | Error Code | Behaviour |
|-----------|-----------|-----------|
| No active subscription + paid upgrade | `failed-precondition` | Must use `createCheckoutSession` first |
| Invalid tier | `invalid-argument` | Rejected |
| Stripe API error | `internal` | Firestore not updated |

### Terminal States

| State | Description |
|-------|-------------|
| ✅ Updated | Stripe subscription updated; Firestore tier synced via webhook |
| `cancel_at_period_end` | Downgraded to free at next billing cycle |
| ❌ Failed | No Stripe or Firestore change |

### Test Scenarios

- Downgrade from `growth` to `free`; assert `cancel_at_period_end: true` is set; assert merchant retains `growth` access until period end.
- Upgrade from `core` to `growth` mid-cycle; assert proration invoice generated immediately.
- Attempt upgrade with no active subscription; assert `failed-precondition`.

---

## 10. User Registration & Role Assignment

**Actor:** New user (self-registration or admin pre-staging)  
**Trigger:** Sign-up form submission or admin creates a `staff/{email}` document

### Steps

1. `[FE]` → `[EXT Firebase Auth]` `createUserWithEmailAndPassword()` or `signInWithPopup(GoogleAuthProvider)`.
2. `[FE]` Firebase emits `onAuthStateChanged` with the new user.
3. `[FE]` → `[DB]` `AuthContext` listener: check if `users/{uid}` exists.
   - **Does not exist:** Create `users/{uid}` with `email`, `name`, `role` ('consumer' or 'merchant'), `createdAt`.
4. `[FE]` → `[DB]` Staff check: query `staff/{email.toLowerCase()}`.
   - If doc exists with `status: 'active'`: override `role = 'admin'`, set `adminRole` from staff doc.
5. `[FE]` If `finalRole === 'admin'`: check `multiFactor(currentUser).enrolledFactors.length`; redirect to `/admin/mfa-setup` if MFA not enrolled.

### Error Paths

| Condition | Behaviour |
|-----------|-----------|
| Email already registered | Firebase Auth throws `auth/email-already-in-use` |
| `users/{uid}` doc missing at first `onAuthStateChanged` fire | `setLoading(false)` called; listener fires again when `setDoc` completes (eventual) |
| Staff doc missing or `status !== 'active'` | Role stays as registered (`consumer`/`merchant`) |
| Admin MFA not enrolled | Blocked by `AdminLayout` — hard redirect to `/admin/mfa-setup` |

### Async / Eventual-Consistency Gaps

- **Profile listener fires before `setDoc` completes:** `onAuthStateChanged` can fire before the `users/{uid}` document is created. `AuthContext` guards with `if (userDoc.exists())` — user sees loading state until the second snapshot fires with the complete doc.
- Staff role promotion is client-side — relies on accurate `staff/{email}` Firestore read at login time.

### Terminal States

| State | Description |
|-------|-------------|
| ✅ Consumer | Default self-registered role |
| ✅ Merchant | Registered with `role: 'merchant'` |
| ✅ Admin | Staff doc matched; MFA enrolled |
| ⚠️ Admin — MFA pending | Staff doc matched; MFA not yet enrolled; blocked from admin pages |
| ❌ Auth error | User not created |

### Test Scenarios

- Register a user whose email matches a `status: 'active'` staff doc; assert role is promoted to admin.
- Register with an existing email; assert `auth/email-already-in-use` and no duplicate Firestore doc.
- Log in immediately after registration before `setDoc` completes (simulate slow write); assert no crash and profile loads on second snapshot.
- Admin logs in without enrolled MFA; assert redirect to `/admin/mfa-setup` and all admin routes blocked.

---

## 11. Team Member Invite & Remove

### Phase A: Invite

**Actor:** Merchant OWNER or MANAGER  
**Trigger:** Call to `inviteTeamMember`

### Steps

1. `[CF]` App Check + auth check; rate limit (10 invites / 15 min per user).
2. `[CF]` Validate all fields present.
3. `[CF]` → `[DB]` Fetch caller's user doc; assert `role === 'merchant'`, `storeId === targetStoreId`, `merchantRole` in `['OWNER', 'MANAGER']`.
4. `[CF]` **Role-rank guard:** `ROLE_RANK = { OWNER:3, MANAGER:2, STAFF:1, MARKETING:1 }`. Reject if `assignedRank >= callerRank` (prevents MANAGER inviting OWNER).
5. `[CF]` → `[EXT Firebase Auth]` `admin.auth().createUser({ email, password: tempPassword, emailVerified: false })`.
6. `[CF]` → `[DB]` Create `users/{uid}` with `role: 'merchant'`, `merchantRole`, `storeId`, `status: 'pending_invite'`.
7. `[CF]` → `[EXT Firebase Auth]` `generateEmailVerificationLink(email)`.
8. `[CF]` → `[DB]` Queue HTML email in `/mail` collection (Firebase Extension delivers via SMTP). Email contains temp password (plain text in email body — consider this a known security trade-off in the current implementation).
9. `[CF]` → `[DB]` Write `TEAM_MEMBER_INVITE` audit event.
10. `[CF]` Return `{ success: true, uid }`.

### Error Paths

| Condition | Error Code | Behaviour |
|-----------|-----------|-----------|
| Not authenticated | `unauthenticated` | Rejected |
| Not a merchant / wrong store | `permission-denied` | Rejected |
| Not OWNER/MANAGER | `permission-denied` | Rejected |
| Role rank violation | `permission-denied` | Rejected |
| Email already exists in Firebase Auth | `already-exists` | Rejected; no Firestore doc created |
| Rate limit | `resource-exhausted` | Rejected |

### Async / Eventual-Consistency Gaps

- Firebase Auth user is created before the Firestore doc. If the Firestore write fails, an orphan Auth user exists with no profile.
- Email delivery is async via Firebase Extension (SMTP). The invite mail may arrive after the temp password has already been used if there is a delay.

---

### Phase B: Remove

**Actor:** Merchant OWNER or MANAGER  
**Trigger:** Call to `removeTeamMember`

### Steps

1. `[CF]` Auth check; verify caller is merchant of same store with OWNER or MANAGER role.
2. `[CF]` Role-rank guard: MANAGER cannot remove OWNER.
3. `[CF]` → `[DB]` Update target user: `role: 'consumer'`; delete `storeId`, `merchantRole`, `storeName`, `businessRegistrationNumber`, `manualOverride`; set `subscriptionStatus: 'inactive'`.
4. `[CF]` → `[DB]` Write audit event.

### Terminal States (Invite)

| State | Description |
|-------|-------------|
| ✅ `pending_invite` | Auth + Firestore created; invite email queued |
| ❌ Rejected | Various permission/validation errors |
| ⚠️ Orphan Auth | Auth user created; Firestore write failed |

### Test Scenarios

- MANAGER attempts to invite with `merchantRole: 'OWNER'`; assert `permission-denied` (role-rank guard).
- Invite a user whose email already exists; assert `already-exists` and no duplicate Firestore doc.
- Simulate Firestore failure after `createUser`; assert orphan Auth user exists — manually verify.
- Remove the last OWNER; assert they can no longer access merchant pages (role reverted to consumer).

---

## 12. Store Soft-Delete + Grace-Period Cascade

**Path A — Admin-initiated (30-day grace period)**

### Steps

1. `[FE]` Admin navigates to `/admin/stores`, selects store, clicks "Approve Deletion".
2. `[DB]` Admin writes `status: 'pending_deletion'`, `deletionApprovedAt: serverTimestamp()` to `stores/{id}`.
3. `[CF Cron]` `processPendingStoreDeletions` runs daily at 04:00 America/Toronto (Pub/Sub schedule `0 4 * * *`).
4. `[CF]` Query stores where `status === 'pending_deletion'` AND `deletionApprovedAt <= now - 30 days`.
5. `[CF]` For each eligible store → `cascadeDeleteStore(db, storeId)`:
   - `[DB]` Batch delete all `merchant_products` where `merchant_id === storeId`.
   - `[DB]` Batch delete subcollections: `stores/{id}/deals`, `/flyers`, `/analytics`.
   - `[DB]` Query all `users` where `storeId === storeId`; for each:
     - Update: `role: 'consumer'`, delete `storeId / merchantRole / storeName / businessRegistrationNumber / manualOverride / lastAdminEdit`, set `subscriptionStatus: 'inactive'`, `subscriptionTier: 'free'`, `subscriptionEnd: null`.
     - `[EXT Stripe]` Cancel all active Stripe subscriptions for `stripeCustomerId`.
6. `[DB]` Delete `stores/{id}` document.

**On cascade error:**  
`[DB]` Update `stores/{id}`: `status: 'deletion_failed'`, `deletionError: <message>`. Data left intact for admin investigation.

---

**Path B — Direct deletion (safety-net trigger)**

1. Store document is hard-deleted via Firebase console / Admin SDK (bypassing grace period).
2. `[CF]` `onStoreDelete` Firestore `onDelete` trigger fires.
3. Same cascade as above, executed immediately with no grace period.
4. No `deletion_failed` state available (trigger cannot update a deleted doc) — errors are only logged.

---

### Error Paths

| Condition | Behaviour |
|-----------|-----------|
| Stripe cancellation fails per-user | Logged; user's Firestore fields still updated (Stripe sub stays active — requires manual cleanup) |
| Any Firestore batch fails (Path A) | Store marked `deletion_failed`; data intact |
| Any error (Path B) | Logged only; partial cascade may occur |

### Async / Eventual-Consistency Gaps

- User updates and Stripe cancellations run in `Promise.all` (parallel) per user. A Stripe failure for one user does not block others.
- The 9-minute function timeout (`timeoutSeconds: 540`) could be hit for stores with very large product catalogs or many users.

### Terminal States

| State | Description |
|-------|-------------|
| `pending_deletion` | Waiting for 30-day grace period |
| ✅ Deleted | All data removed; users reverted to consumer |
| `deletion_failed` | Cascade error; data intact; admin must retry |
| ⚠️ Partial (Path B) | Trigger may leave orphaned data on internal error |

### Test Scenarios

- Set `deletionApprovedAt` to 31 days ago; run cron manually; assert store document deleted and all linked users have `role: 'consumer'`.
- Simulate Stripe API failure during cascade; assert Firestore user fields are still updated and store is marked `deletion_failed`.
- Hard-delete a store document directly; assert `onStoreDelete` trigger runs and linked users are reverted.
- Attempt to cancel a store deletion (call `cancelStoreDeletion`); assert `status` reverts to `'suspended'`.
- Place an order for a store that has `status: 'pending_deletion'` (frontend guard should block, but test the API directly).

---

## 13. Product Price Change + Geo-Targeted Alert

**Actor:** Merchant updates product price  
**Trigger:** Firestore `onWrite` on `merchant_products/{productId}` (any write, filtered by price change logic)

### Steps

1. `[DB]` Merchant writes new `price` to `merchant_products/{id}`.
2. `[CF]` `onMerchantProductPriceChange` trigger fires; check `isPriceDrop = newPrice < oldPrice` or `isSale = on_sale || sale_price || original_price > price`.
3. `[CF]` → `[DB]` If price changed: write daily snapshot to `merchant_products/{id}/price_history/{YYYY-MM-DD}` (merge).
4. If `isPriceDrop` or `(isNew && isSale)`:
5. `[CF]` → `[DB]` Fetch `stores/{merchant_id}` to get `coordinates.lat/lng`. Abort if missing.
6. `[CF]` → `[DB]` Paginate all `users` in batches of 500.
   - For each user: check `notificationPreferences.priceDrop` (for drops) or `.promotions` (for sales); default opt-in is `true`.
   - Calculate Haversine distance from store to user's default address (falls back to `user.coordinates`).
   - If `distance <= user.notificationPreferences.maxDistance` (default 10 km): add to `matchedUsers`.
7. `[CF]` → `[EXT FCM]` `sendEachForMulticast` to each matched user's `fcmTokens`.
8. `[CF]` On FCM partial failures: `removeStaleTokens(userId, tokenList, responses)`.
9. `[CF]` → `[DB]` Batch write in-app notifications to `users/{uid}/notifications/{id}` for all `matchedUsers` (500/batch).

### Error Paths

| Condition | Behaviour |
|-----------|-----------|
| Store missing coordinates | Trigger exits silently — no notifications sent |
| User missing address / coordinates | User skipped in proximity check |
| FCM multicast fails | Stale tokens removed; in-app notification still written |
| `Promise.all` FCM timeout | Later users in batch may not receive push |

### Async / Eventual-Consistency Gaps

- Full user table scan in batches of 500 — for large user bases, the trigger may take several seconds. The function may hit the 60 s default timeout for platforms with 100k+ users.
- In-app notifications are written in a second Firestore batch pass **after** FCM — a function failure between these two steps could mean FCM was sent but no in-app notification exists.
- Trigger fires on **any** `merchant_products` write (not just price fields) — price comparison is the guard. Non-price writes (quantity update, etc.) are cheaply discarded.

### Terminal States

| State | Description |
|-------|-------------|
| ✅ Notified | Price history written + FCM + in-app for all proximity-matched users |
| ⚠️ Partial | FCM failed for some; in-app written |
| ⚠️ No matches | Store has no users within radius |
| ❌ Silent | Store coordinates missing; nothing sent |

### Test Scenarios

- Update price on a product with no nearby users; assert no notifications written.
- Update product quantity (not price); assert trigger exits without writing notifications.
- Create a product with `on_sale: true` (new item); assert notification is sent even though there is no previous price.
- Simulate 10,000 users; measure trigger execution time; assert completion within 60 s.
- Opt out a user (`notificationPreferences.priceDrop: false`); update price; assert that user receives no notification.

---

## 14. SmartCart Optimization

**Actor:** Consumer  
**Trigger:** Frontend calls optimization (via `useOptimizedWishlist` or `POST /smartcartOptimize`)

### Steps

1. `[FE]` Build shopping list: product IDs, quantities, selected nearby store IDs.
2. `[FE]` or `[CF]` Compute cache key: `SHA256(sorted shopping list + sorted store IDs)`.
3. `[CF]` → `[DB]` Check `smartcart_optimizer_cache/{cacheKey}`: if exists and `expiresAt > now` (10-min TTL), return cached response immediately.
4. If cache miss:
5. `[CF]` → `[DB]` Fetch all merchant products for selected stores.
6. `[CF]` Build price matrix: normalize unit prices (weight/volume variants), compare prices across stores.
7. `[CF]` Run optimizer: allocate each item to cheapest store; simulate single-store costs; calculate trip consolidation savings.
8. `[CF]` → `[DB]` Write result to `smartcart_optimizer_cache/{cacheKey}` with `expiresAt = now + 10 min`.
9. `[CF]` Return `{ optimizedCart, bestSingleStore, savingsAmount }`.

### Error Paths

| Condition | Behaviour |
|-----------|-----------|
| No stores available | Returns empty allocation |
| Products not found in any store | Items listed as unavailable |
| Cache write fails | Result still returned (non-fatal) |

### Async / Eventual-Consistency Gaps

- Cache key is based on shopping list + store IDs — a price change between cache write and cache read means stale prices are shown for up to 10 minutes.
- Frontend mirror in `apps/web/src/smartcart/` runs the same algorithm client-side; results may differ slightly from the backend if data is stale.

### Terminal States

| State | Description |
|-------|-------------|
| ✅ Optimized (fresh) | New computation; result cached |
| ✅ Optimized (cached) | Returned from cache; up to 10 min stale |
| ⚠️ Partial | Some items unmatched; returned as-is |

### Test Scenarios

- Submit identical shopping list twice; assert second call returns cached result (measure latency difference).
- Change a product price between two calls within the 10-min TTL; assert old price is returned from cache.
- Request optimization with all stores unavailable; assert graceful empty result.

---

## 15. Guest → Authenticated Cart Merge

**Actor:** Consumer (logs in while holding a guest cart)  
**Trigger:** `CartContext` detects `user` state changes from `null` to authenticated

### Steps

1. `[FE]` Guest adds items; `CartContext` writes to `localStorage['spendigo_cart_guest']` (JSON).
2. `[FE]` User logs in → `AuthContext` updates `user`; `CartContext` `useEffect([user])` fires.
3. `[FE]` → `[DB]` Fetch existing cloud cart from `carts/{uid}`.
4. `[FE]` Merge: for each guest item, if `productId` already in cloud cart → `cloudQuantity += guestQuantity`; else append.
5. `[FE]` → `[DB]` `setDoc(cartRef, { items: mergedItems }, { merge: true })`.
6. `[FE]` `localStorage.removeItem(GUEST_KEY)`.
7. `[FE]` → `[DB]` `onSnapshot(cartRef)` listener established — all future changes real-time and multi-device.

### Error Paths

| Condition | Behaviour |
|-----------|-----------|
| `localStorage` JSON parse fails | `guestItems` defaults to `[]`; cloud cart used as-is |
| `setDoc` merge fails | Guest items lost (no retry) |
| User logs out during merge | `setDoc` may succeed but listener is cleaned up; items persist in Firestore |

### Async / Eventual-Consistency Gaps

- `setDoc` is called with `{ merge: true }` — concurrent writes from multiple devices during the merge window could cause the last-write-wins behaviour to drop items.
- Guest cart is cleared from localStorage optimistically before confirming Firestore write. If `setDoc` fails silently, cart items are permanently lost.

### Terminal States

| State | Description |
|-------|-------------|
| ✅ Merged | Guest + cloud items combined in Firestore; localStorage cleared |
| ✅ Cloud only | No guest items; cloud cart used as-is |
| ❌ Lost | `setDoc` failed; localStorage cleared; items gone |

### Test Scenarios

- Log in with a guest cart containing items already in the cloud cart; assert quantities are summed, not duplicated.
- Simulate `setDoc` failure (network off); assert localStorage is NOT cleared — items recoverable.
- Log in simultaneously on two devices with different guest carts; assert merged result contains items from both (last-write-wins edge case).

---

## 16. Audit Log Chain *(cross-cutting)*

**Trigger:** Any write lifecycle that calls `logEvent()` or the client-side `auditBridge`

### Steps

1. `[CF]` `logEvent()` starts a Firestore transaction.
2. `[DB]` Read `audit_logs_meta/latest` to get `prevHash`.
3. `[CF]` Canonicalize log entry (deterministic JSON key sort); compute `SHA256(canonicalized + prevHash)` = `hash`.
4. `[DB]` Write `audit_logs/{id}` with full entry + `prevHash` + `hash`.
5. `[DB]` Update `audit_logs_meta/latest.latestHash = hash`.

**Client path:** Components call `auditBridge.emit()` → `AuditProvider` listener → `recordAuditEvent` Cloud Function → same `logEvent()`.

### Async / Eventual-Consistency Gaps

- Hash chain is maintained inside a Firestore transaction, but **concurrent writes contend** on `audit_logs_meta/latest` — high write frequency could cause retries and slight latency.
- `recordAuditEvent` is rate-limited (30/min auth, 5/min unauth). Bursts during checkout may drop events.

### Terminal States

| State | Description |
|-------|-------------|
| ✅ Chained | Entry written with unbroken hash |
| ❌ Dropped | Rate limit or write failure; chain gap |

---

## 17. Scheduled Backup / Export *(cross-cutting)*

**Trigger:** Pub/Sub cron `0 2 * * *` (02:00 America/Toronto)

### Steps

1. `[CF]` Check `settings/platform.scheduledExportsEnabled`; skip entire job if `false`.
2. `[CF]` → `[EXT GCS]` Export critical collections (`orders`, `audit_logs`, `audit_logs_meta`, `payments`, `users`, `stores`) to `gs://spendigo-8540c-firestore-backups/daily/{YYYY-MM-DD}/critical/`.
3. `[CF]` → `[EXT GCS]` Export high-value collections (`merchant_products`, `master_products`) to `.../high-value/`.
4. `[CF]` → `[DB]` Write manifest to `system_backups/{id}`: `{ type, date, status, outputUriPrefix, collections, triggeredBy }`.
5. `[DB]` → `[CF]` `onBackupJobResult` trigger fires on new `system_backups` doc.
   - If `status === 'failed'`: send alert email via `/mail` collection to `admin.alert_email` (or `ops@spendigo.ca`).

### Error Paths

| Condition | Behaviour |
|-----------|-----------|
| `scheduledExportsEnabled: false` | Job skipped; no manifest written |
| GCS export fails | Manifest written with `status: 'failed'`; alert email queued |
| Alert email fails to send | Logged only; backup failure may go unnoticed |

### Terminal States

| State | Description |
|-------|-------------|
| ✅ Completed | All collections exported; manifest in Firestore |
| ⚠️ Skipped | Feature flag disabled |
| ❌ Failed | Manifest with `status: 'failed'`; alert email sent |

### Test Scenarios

- Set `scheduledExportsEnabled: false`; trigger job manually; assert no GCS files created and no manifest written.
- Simulate GCS bucket unreachable; assert manifest written with `status: 'failed'` and alert email queued.
- Trigger backup and verify GCS bucket region is `northamerica-northeast1` (export fails on cross-region mismatch).

---

## Appendix A — Race Conditions & Async Gaps Summary

| Lifecycle | Gap | Risk | Mitigation in Code |
|-----------|-----|------|-------------------|
| Order Placement | Stripe webhook before `placeOrder` | Orphan `payments` record with `orderId: null` | `placeOrder` verifies intent directly with Stripe API; orphan left as artefact |
| Order Placement | Concurrent stock deductions | Oversell | Firestore transaction with read-all-then-write-all; auto-retry on `aborted` |
| User Registration | Profile listener before `setDoc` | Flash of unauthenticated state | `exists()` guard in `onAuthStateChanged`; retries on next snapshot |
| Price Alert | Full user table scan > timeout | Late/missing notifications | Pagination (500/batch); Cloud Function 60 s default timeout could be hit |
| Price Alert | FCM sent before in-app written | FCM delivered but no inbox record | Separate `await` steps; no atomic guarantee |
| Guest Cart Merge | `setDoc` fail then `localStorage` clear | Permanent cart item loss | No retry; `localStorage` cleared optimistically |
| Subscription Purchase | Webhook delivery failure | Merchant pays but tier not updated | No compensating transaction; manual admin fix required |
| Refund | `charge.refunded` webhook lost | Order stuck in `'refunding'` | No polling/timeout; manual admin fix required |
| Store Deletion | Stripe cancel per-user fails | Stripe sub stays active | Logged; Firestore user fields still updated |
| Audit Log | High-frequency concurrent writes | Chain contention / retries | Firestore transaction serializes writes; rate limit on client events |

---

## Appendix B — Partial-Failure States

These are persisted Firestore states that indicate an interrupted lifecycle requiring manual or automated recovery.

| State | Collection | Meaning | Recovery Action |
|-------|-----------|---------|----------------|
| `deletion_failed` | `stores` | Cascade delete failed mid-way | Admin investigates error in Cloud Logs; retry deletion |
| `refunding` | `orders.paymentStatus` | Refund initiated; webhook not yet received | Wait for webhook; manually check Stripe; admin can force-update |
| `pending_invite` | `users.status` | Team member Auth created; email not yet verified | Resend invite or delete Auth user if abandoned |
| `pending_deletion` | `stores.status` | Store approved for deletion; grace period not elapsed | Cron processes at 04:00 after 30-day cutoff |
| `stripeOnboardingStatus: 'pending'` | `stores` | Merchant started Stripe onboarding; not completed | Merchant must complete; admin can check via `checkStripeAccountStatus` |
| `payments/{intentId}` with `orderId: null` | `payments` | Webhook arrived before order created | Verify order exists; manually link or clean up |
| `subscription: inactive` + `subscriptionTier: 'free'` | `users` | User de-linked from store | Expected end state after team removal or store deletion |

---

## Appendix C — Test Scenario Matrix by Test Type

### Reliability (correct outcomes under normal load)

- Concurrent `placeOrder` for the same last unit
- Simultaneous team member invite from two MANAGER accounts
- `FIRST100` promo applied by two merchants at storeCount = 99
- Order cancellation + concurrent re-order of the same item
- Cart merge with identical items from guest and cloud

### Resilience (correct outcomes under failure injection)

- Kill Firestore mid-`placeOrder` transaction
- Drop Stripe webhook after payment
- Drop `charge.refunded` webhook after refund
- Stripe Connect API unavailable during onboarding
- FCM service unavailable during order status notification
- GCS unavailable during scheduled backup
- Simulate store cascade with 1,000 products and 50 linked users (verify < 540 s timeout)

### Availability (service continuity under load)

- 100 concurrent `placeOrder` calls across 10 stores
- Price update triggering notifications to 50,000 users (measure trigger duration)
- SmartCart optimization for 25 items × 100 stores without cache
- Admin audit log chain under 100 concurrent events (measure hash contention retries)
- Backup job running while high write traffic hits `orders` collection

### Data Consistency

- Verify stock quantity = `initial − sum(placed orders) + sum(cancelled orders)` after 1,000 mixed operations
- Verify audit log `prevHash` chain is unbroken after 10,000 entries
- Verify all users linked to a deleted store have `role: 'consumer'` after cascade
- Verify `payments/{intentId}` orphan records are either linked or manually acknowledged
