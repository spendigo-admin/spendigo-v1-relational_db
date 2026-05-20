# Completed Work Log

Chronological record of shipped fixes, features, and cleanup tasks. Newest at the top.

---

## May 2026

### GCP Secret Manager Migration: All Cloud Functions Wired
`services/api/src/payments/createCheckoutSession.ts`, `stripeWebhook.ts`, `onboardStore.ts`, `createPaymentIntent.ts`, `refundOrder.ts`, `checkStripeStatus.ts`, `getPaymentHistory.ts`, `updateSubscriptionPlan.ts`, `services/api/src/orders/placeOrder.ts`, `services/api/src/admin/forceDeleteStore.ts`, `services/api/src/admin/processPendingStoreDeletions.ts`, `services/api/src/triggers/storeTriggers.ts`, `services/api/src/triggers/algoliaTriggers.ts`, `services/api/src/triggers/algoliaMerchantTriggers.ts`, `services/api/.env.example`

Migrated all platform secrets from plain-text Firebase environment variables to GCP Secret Manager. Every Cloud Function that reads `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ALGOLIA_API_KEY`, or the three Stripe price IDs now declares them via `runWith({ secrets: [...] })`, causing Firebase to inject the decrypted values into `process.env` at cold-start.

- **14 functions wired**: all 9 payment/order functions, `onStoreDelete`, `processPendingStoreDeletions`, `forceDeleteStore`, and both Algolia sync triggers.
- **Startup validation hardened**: `stripe.ts` throws at module load if `STRIPE_SECRET_KEY` is unset; `stripeWebhook.ts` same for `STRIPE_WEBHOOK_SECRET` — misconfigured deploys fail fast instead of silently accepting requests.
- **`.env.example` added**: committed template documenting all 11 variables with placeholders, separating secrets (→ GCP Secret Manager) from config values (→ Firebase Console). `.env` remains gitignored.
- **Local emulator unchanged**: `services/api/.env` still supplies all values to the emulator; development workflow unchanged.

Next step: run `firebase functions:secrets:set` for each secret + `firebase deploy --only functions`.

---

### Security: Pre-Launch Blocker Batch (8 fixes)
`services/api/src/config/stripe.ts`, `services/api/src/payments/stripeWebhook.ts`, `services/api/src/payments/onboardStore.ts`, `services/api/src/auth/removeTeamMember.ts`, `services/api/src/audit/recordAuditEvent.ts`, `services/api/src/utils/rateLimiter.ts`, `firestore.rules`, `apps/web/src/lib/firebase.ts`

Eight pre-launch security blockers resolved in a single pass:

1. **Stripe secret fails at startup** — removed `|| 'sk_test_placeholder'` fallback in `stripe.ts`; module now throws at cold-start if `STRIPE_SECRET_KEY` is unset instead of silently accepting all payment calls and failing cryptically at runtime.
2. **Stripe webhook secret fails at startup** — moved `webhookSecret` to module level in `stripeWebhook.ts`; throws at cold-start if `STRIPE_WEBHOOK_SECRET` is unset; removed the now-redundant in-handler `!webhookSecret` check.
3. **`onboardStore` permission bypass** — added `!callerSnap.exists` guard and replaced the unsafe negative-equality check (`caller?.storeId !== storeId`) with explicit positive equality (`isAdmin || isOwner`), eliminating the undefined-chaining bypass path.
4. **`removeTeamMember` permission bypass** — added `!callerDoc.exists` guard before accessing `callerData`, making document non-existence an explicit hard deny rather than relying on `!callerData` catching the downstream `undefined`.
5. **Audit email spoofing** — replaced `metadata?.email || 'unauthenticated'` with the literal `'anonymous'` in the unauthenticated actor branch of `recordAuditEvent.ts`; client-supplied identity fields are never written into the append-only audit ledger.
6. **Rate limiter concurrent bypass** — replaced `FieldValue.increment(1)` (a server-side transform that bypasses Firestore optimistic locking) with an explicit `newCount = count + 1` computed before the transaction commits; the limit check now runs against `newCount`, ensuring concurrent transactions at the boundary are correctly serialised.
7. **Firestore rules: unauthenticated store rating writes** — removed the `isAuthenticated() && affectedKeys().hasOnly(['rating', 'reviewCount'])` allow clause from **both** the `stores` and `users` match blocks; ratings are written server-side via Admin SDK by `onReviewCreated` and require no client-side write permission.
8. **App Check silent no-op in production** — replaced `console.warn` with a thrown `Error` in `firebase.ts` when `VITE_FIREBASE_APP_CHECK_KEY` is missing in a production, non-native build; the error is caught by the global `ErrorBoundary` and surfaces immediately at page load.

**Deferred**: CSP `unsafe-inline` removal remains in TODO — requires a dedicated audit of inline `style={{}}` usage across React components.

---

### Product Image Gallery: Persistence Bug Fix + Arrow Navigation
`apps/web/src/hooks/useCatalog.ts`, `apps/web/src/pages/consumer/ProductDetail.tsx`

Two bugs fixed in the multi-image pipeline:

1. **Images disappeared on re-open (admin)** — `useMasterCatalog`'s `onSnapshot` deserializer explicitly mapped every field on `MasterProduct` but omitted `secondary_image_urls`. After saving, Firestore held the correct array, but the next snapshot rebuilt the in-memory object without it, so `editForm` was always initialised with `secondary_image_urls: undefined` on re-open. Fixed by adding `secondary_image_urls: data.secondary_image_urls` to the deserializer.

2. **Gallery never showed on shopper page (consumer)** — `useProductDetail`, the Algolia search path, and the Firestore global-catalog path all built the `images` array as `[primary_image_url]` only, ignoring `secondary_image_urls`. The thumbnail strip in `ProductDetail.tsx` is hidden when `images.length <= 1`, so the gallery never appeared. All three paths now use the same pattern as `useStoreProducts`: `[primary, ...(secondary ?? [])].filter(Boolean)`.

Arrow key navigation added to `ProductDetail.tsx`: `useEffect` listens for `ArrowLeft`/`ArrowRight` on `window` (attached only when `images.length > 1`, cleaned up on unmount). On-screen `‹` / `›` chevron buttons are overlaid on the left/right edges of the main image for touch/mouse users. Both methods share `prevImage`/`nextImage` callbacks and wrap around.

---

### Cloud Storage Image Mirroring for Flyer Deals + Active Deals Static JSON
`services/api/src/triggers/flyerImageMirror.ts`, `services/api/src/admin/rebuildActiveDealsJson.ts`, `services/api/src/utils/exportActiveDeals.ts`, `services/api/src/utils/flippScraper.ts`

Implemented the full image mirroring pipeline described in the backlog. After flyer ingestion, a Firestore `onCreate` trigger (`flyerImageMirror.ts`) downloads each deal image from the Flipp CDN to `products/flyer-images/{md5Hash}.jpg` in Firebase Storage. URL deduplication via MD5 hash prevents re-downloading the same image across weekly flyer cycles. The deal document is updated with the new `firebasestorage.app` URL once mirrored. A separate `rebuildActiveDealsJson` Cloud Function (pub/sub cron) exports all non-expired deals to a static JSON file in GCS via `exportActiveDeals.ts`, enabling fast client-side deal browsing without live Firestore reads. Image download logic extracted from `flippScraper.ts` into the shared trigger to remove duplication.

### KYB Document Signed URLs and Access Token Revocation
`services/api/src/admin/getKybDocUrl.ts`, `services/api/src/triggers/kybDocTrigger.ts`, `apps/web/src/pages/admin/StoreManagement.tsx`, `scripts/revokeKybTokens.ts`

Closed a security gap where KYB compliance documents were accessible to anyone with the Firebase download token embedded in the stored URL. Three-part fix: (1) `kybDocTrigger.ts` — Firestore `onCreate` trigger on `stores/{storeId}/documents/{docId}` immediately revokes the Firebase Storage download token after upload, making the raw `firebasestorage.app` URL non-functional. (2) `getKybDocUrl.ts` — new callable Cloud Function (admin-role only) that generates a short-lived signed URL (15-minute TTL) via the Storage Admin SDK; `StoreManagement.tsx` now fetches via this function instead of storing the URL directly. (3) `scripts/revokeKybTokens.ts` — one-time migration script to revoke download tokens on all existing KYB documents already in Storage.

### Master Product Multi-Image Support
`apps/web/src/hooks/useCatalog.ts`, `apps/web/src/pages/admin/MasterCatalog.tsx`, `services/api/src/models/catalog.ts`, `services/api/src/triggers/productTriggers.ts`

Extended master products from a single `primary_image_url` to an `images: string[]` array in `MasterProductRecord`. The admin catalog editor (`MasterCatalog.tsx`) now supports uploading, previewing, and reordering multiple images per product. The `onMasterProductWrite` Cloud Function trigger was updated to download and mirror all images in the array to Firebase Storage (same pattern as the existing single-image download), not just the first. Existing products with only `primary_image_url` continue to work — `images` defaults to an empty array for backwards compatibility.

### Pro Merchant Subscription Tier with Digital Marketing Access
`apps/web/src/context/AuthContext.tsx`, `apps/web/src/pages/merchant/Subscription.tsx`, `apps/web/src/pages/merchant/Marketing.tsx`, `apps/web/src/context/MarketplaceContext.tsx`, `apps/web/src/pages/consumer/StoreList.tsx`, `services/api/src/payments/updateSubscriptionPlan.ts`, `services/api/src/payments/createCheckoutSession.ts`, `services/api/src/marketing/sendCampaign.ts`

Added a fourth subscription tier — **Pro ($149/mo CAD, 1% commission)** — as the digital marketing tier above Growth. Key changes:

- **Type system**: Added `'pro'` to the `subscriptionTier` union in `AuthContext.tsx`.
- **Subscription UI**: Fourth tier card with "Marketing Suite" badge. Grid changed to 4-column (2-col on md, 4-col on lg). `WELCOME2026` promo extended to Pro at $14.90/mo (90% off). `isUpgrade` confirmation logic now uses `TIER_ORDER` map instead of the hardcoded `growth && core` check.
- **Push campaigns gated behind Pro**: `Marketing.tsx` renders a blur overlay with "Upgrade to Pro →" CTA for non-Pro merchants. `sendCampaign` Cloud Function rejects with `permission-denied` if `store.subscriptionTier !== 'pro'`. Rate limit raised from 50 to 200 campaigns per 24h for Pro merchants.
- **Tier access matrix clarified**:
  - *Flyers*: Growth and Pro only (was: all non-Free).
  - *Deals (saleItems + oneDayOffers)*: Pro only (was: all non-Free).
  - *Featured/Verified badge*: Pro only with KYB approved (was: Growth).
  - *Sponsored placement sort*: Pro stores with `sponsoredPlacement: true` float to top of `allStores` in `MarketplaceContext`.
- **Core promo price corrected**: `WELCOME2026` now shows `$4.99/mo` for Core (consistent 90%-off pattern across all paid tiers — Growth: $9.90, Pro: $14.90).
- **Removed phantom feature**: "Custom Promo Codes" was listed under Growth but had no implementation. Removed from the feature list. `STRIPE_PRICE_PRO` env var added to the pre-deploy checklist in TODO.md.

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
