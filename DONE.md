# Completed Work Log

Chronological record of shipped fixes, features, and cleanup tasks. Newest at the top.

---

## May 2026

### App Check: ReCaptchaEnterpriseProvider Restored
`apps/web/src/lib/firebase.ts`
The site key `VITE_FIREBASE_APP_CHECK_KEY` is a ReCAPTCHA **Enterprise** key. Switching to `ReCaptchaV3Provider` caused App Check to silently block every outgoing Firebase request (Storage writes, Firestore reads) with `appCheck/recaptcha-error` before Security Rules were evaluated — including the KYB document upload. Reverted to `ReCaptchaEnterpriseProvider`. See memory file for full diagnosis notes.

### KYB Merchant Compliance Documents
`apps/web/src/pages/merchant/Settings.tsx`, `storage.rules`, `services/api/src/triggers/storeTriggers.ts`
Merchants (OWNER role only) can upload business verification documents (PDF, JPEG, PNG, max 5 MB) from the Settings page. Files stored at `stores/{storeId}/documents/`. `getDownloadURL` intentionally omitted post-upload — storage read rules are admin-only for KYB paths. Admin portal receives an email notification on submission. Admin can approve or reject via `StoreManagement.tsx` with an optional review note.

### Expired Deal Price Reversion
`services/api/src/triggers/revertExpiredDeals.ts`
Added pubsub trigger firing every 30 min (Toronto timezone). Queries `merchant_products` where `discount_valid_until` is in the past and reverts `price` back to `original_price`, clearing `sale_price`, `on_sale`, `discount_label`, and `discount_valid_until`. Prevents stale deal prices from causing `placeOrder` server-side validation failures when the client already shows the original price.

### Lowest Active Price Guarantee on Cart Add
`apps/web/src/hooks/useStoreActivePrices.ts`
New hook that subscribes to a store's live `deals` and `flyers` subcollections and maintains a `getMinPrice(productId, candidatePrice)` map. Called when adding to cart from `StoreDetail.tsx` to ensure the UI sends the true lowest current price, preventing client/server price mismatch errors at checkout.

### GDPR Cookie Consent Banner
`apps/web/src/hooks/useCookieConsent.ts`
Added consent banner (accept/decline). Sentry session replay and Google Analytics now only initialise after acceptance. Consent state persisted in localStorage.

### Legal Re-Consent Flow
Re-consent gate added for updated Terms of Service / Privacy Policy. Users must re-accept before accessing protected routes when a new policy version is published.

### HTML Injection in Team Invite Email
`services/api/src/auth/inviteTeamMember.ts:130–135`
Added `escapeHtml()` helper. All three caller-supplied fields (`name`, `email`, `merchantRole`) are now HTML-escaped before template interpolation.

### `cancelOrder` Reason Field Unsanitized
`services/api/src/orders/cancelOrder.ts:21`
Type-guarded to string, trimmed, and hard-capped at 500 chars before being written to Firestore or the audit log.

---

## April–May 2026

### Firebase Functions SDK Upgrade
`services/api/`
Upgraded `firebase-functions` from v4.9.0 to v6.6.0. All 50 source files migrated to `firebase-functions/v1` import path.

### Migrate `functions.config()` → `process.env`
`services/api/src/config/stripe.ts`, `payments/stripeWebhook.ts`, `payments/createCheckoutSession.ts`, `payments/updateSubscriptionPlan.ts`, `triggers/storeTriggers.ts`
All 6 `functions.config()` usages replaced with `process.env`. Values migrated to `services/api/.env` for the emulator.

### Cleanup: Legacy Service Directories
Deleted `services/functions/` (superseded `onUserUpdate` trigger; live version in `services/api/src/triggers/`). Deleted `services/smartcart_optimizer/index.ts` (experimental greedy optimizer; production logic in `services/api/src/smartcart/`). Deleted `tests/unit/services-smartcart-optimizer.test.ts` (only tested deleted dead code). 38 tests still pass after removal.
