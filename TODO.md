# Project TODOs & Backlog

## 1. Pre-Launch Blockers (v1.0 GA Target)

### Infrastructure & Config
- [ ] **Staging Environment**: Provision an isolated `spendigo-staging` Firebase project (or Preview Channels) for QA.
- [ ] **Firebase Functions Upgrade**: Upgrade `firebase-functions` SDK from v4.9.0 to >=5.1.0 to support newest Firebase Extensions.
- [ ] **Migrate functions.config()**: Convert deprecated Cloud Runtime Config (`functions.config()`) to the new `params` package before March 2027. Affects: `stripe.ts`, `createCheckoutSession.ts`, `updateSubscriptionPlan.ts`, `stripeWebhook.ts`, and 3+ other files.

### Security
- [ ] **App Check Enforcement**: Enforce Firebase App Check at the Firestore and Cloud Functions level to prevent unverified API requests. Currently inconsistent — `placeOrder` and `refundOrder` check it, but `sendCampaign` and admin functions do not. **Also covers**: `firestore.rules` line 178 allows unauthenticated writes to `stores/{storeId}/analytics/{dateId}` (intentional — guest store views are real traffic). App Check is the chosen guard against bot inflation; do not require `isAuthenticated()` as that would drop guest view counts.
- [ ] **CSP `unsafe-inline` Removal**: `firebase.json` CSP includes `'unsafe-inline'` in both `script-src` and `style-src`, weakening XSS protection. Migrate inline styles/scripts or introduce per-request nonces.

### Data & Features
- [ ] **Merchant KYB Storage Rules**: Deploy path-restricted Firebase Storage rules (`/stores/{storeId}/`) for secure business license uploads.
- [x] **Careers Application Email Notification**: CV upload and Firestore write are working. `onJobApplicationCreated` trigger added in `services/api/src/email/sendJobApplicationEmail.ts` — fires on `job_applications/{id}` onCreate, writes to `/mail` collection with resume download link and `replyTo` set to the candidate's email.
- [x] **Master Catalog Seeding**: 754 real Canadian SKUs written to `master_products` via `scripts/bulkSeedMasterCatalog.ts` (queries Open Food Facts across 8 category tags with retry/dedup). Re-running is safe — deduplicates by barcode automatically.

---

## 2. High Priority (Post-Launch v1.0.x)

### Reliability
- [ ] **Context-Level Error Boundaries**: `App.tsx` has a single top-level `ErrorBoundary`. A crash in any context provider (CartProvider, OrderProvider, etc.) takes down the entire app. Wrap individual providers with isolated error boundaries.
- [ ] **Cloud Functions Unhandled Rejection Handler**: No global `process.on('unhandledRejection')` handler exists in the functions runtime. Silent failures in fire-and-forget async calls (FCM multicast in `priceHistoryTrigger.ts`, audit writes) go undetected.
- [ ] **Firestore Rules getUserData() Cost**: `getUserData()` is called in every rule evaluation that calls `isAdmin()` or `isMerchant()`, resulting in a Firestore read per rule check. Cache the result in a local variable or restructure rules to use custom claims to reduce reads and cost.

### Mobile
- [ ] **Android `allowBackup` Disabled**: `apps/web/android/app/src/main/AndroidManifest.xml` line 4 sets `android:allowBackup="true"`. This allows Android backup services to export app data (including cached tokens and localStorage) to uncontrolled locations. Set to `false` or configure `android:fullBackupContent` rules.

---

## 3. Future Enhancements (v1.1+)

### Developer Experience & Quality
- [ ] **TypeScript Strictness**: Clean up the 500+ `npm run lint` warnings (primarily `@typescript-eslint/no-explicit-any`) to improve code safety.
- [ ] **Cloud Functions Test Coverage**: No unit or integration tests exist for Cloud Functions (payments, orders, auth). Add tests for `placeOrder`, `createCheckoutSession`, `stripeWebhook`, and `cancelOrder` — these are the highest-value paths.
- [ ] **E2E Test Coverage Gaps**: Current Playwright specs cover basic auth, store browsing, checkout, and legal pages. Merchant flows (product CRUD, order management) and admin flows (user management, flyer ingestion) are unverified.

### Internationalization
- [ ] **i18n — Merchant Portal**: All 11 merchant pages (`/merchant/*`) are untranslated. Consumer pages are fully covered as of v1.0. Merchant portal is the next highest-traffic surface for bilingual users.
- [ ] **i18n — Admin Portal**: All 16 admin pages (`/admin/*`) are untranslated. Lower priority than merchant portal but needed for completeness.

### Observability
- [ ] **Sentry Context Enrichment**: `sentry.ts` initializes Sentry but does not attach user role, store ID, or subscription tier to error events. Enrich `Sentry.setUser()` with role metadata in `AuthContext` after login so errors are filterable by actor type.

### AI & Personalization
- [ ] **AI Auto-Moderation**: Implement Gemini-powered initial moderation for "Pending Products" submissions to reduce Admin manual workload.
- [ ] **Historical Personalization**: Develop Algolia search boosting logic based on localized user purchase history.

### Social Login
- [ ] **Facebook Login**: Button exists in `Login.tsx:230` but is hardcoded `disabled={true}`. Requires Meta App Review approval and a valid `loginWithFacebook` OAuth flow in `AuthContext`. Apple Sign-In is also absent — would be required for App Store distribution (`apps/mobile/`).

---

## 4. Backlog & Technical Investigations

### Feature: Cloud Storage Image Mirroring for Public Flyers

**Status**: Proposed / Backlog
**Description**: 
Currently, the public flyer ingestion relies on hotlinking images directly from the Flipp CDN. This carries a risk of broken images if Flipp changes URLs, blocks hotlinking, or deletes old assets. This feature proposes downloading these images to our own Firebase Storage bucket during/after ingestion.

**Proposed Architecture**:
1. **Asynchronous Processing**: Do not block the main `runIngestion` Cloud Function, as downloading 1,500+ images will cause a function timeout (60s+ limit). Instead, save the deals with the original Flipp URLs first.
2. **Background Queue**: After ingestion, trigger a background worker (e.g., via Google Cloud Tasks or Pub/Sub) to process the images asynchronously.
3. **Image Deduplication**: Because grocery flyers repeat the exact same products week over week, we must deduplicate to save Firebase Storage and egress costs. 
   - Hash the original Flipp Image URL (e.g., `md5(flippUrl).jpg`).
   - Check if `bucket.file(hash).exists()` before downloading.
   - If it exists, skip the download. If not, download and upload it.
4. **Data Update**: Once the image is uploaded to Firebase Storage, update the corresponding deal document in Firestore with the new `spendigo-8540c.firebasestorage.app` URL.

**Pros**: 100% control over images, fast CDN delivery, prevents UI breaking if third-party links die.
**Cons**: Increases Firebase Storage costs, requires handling background workers and download failure states.

---

### Feature: Master Product Multi-Image Support

**Status**: Proposed / Backlog
**Source**: Inline TODO in `apps/web/src/hooks/useCatalog.ts:283`
**Description**: Master products currently support a single `primary_image_url`. The schema and upload flow need to be extended to support an ordered array of images (gallery view) for richer product pages.

**Proposed Architecture**:
1. Add an `images: string[]` field to the `MasterProductRecord` model alongside the existing `primary_image_url`.
2. Update `onMasterProductWrite` Cloud Function trigger to download and mirror all images in the array to Firebase Storage (same pattern as the existing single-image download).
3. Update `ProductDetail.tsx` to render a swipeable image gallery when multiple images are present.
4. Update the admin catalog editor to allow uploading/reordering multiple images per product.

**Cons**: Small schema migration; all existing products have only `primary_image_url` and would show a single-image gallery until backfilled.

---

### Cleanup: Legacy Service Directories

**Status**: Identified / Low Priority
**Description**:
Two directories contain legacy/experimental code not connected to any active deployment:
- `services/functions/src/` — superseded by `services/api/`; all active Cloud Functions live in `services/api/`
- `services/smartcart_optimizer/index.ts` — early experimental optimizer; production logic is in `apps/web/src/smartcart/` and mirrored in `services/api/src/smartcart/`

**Action**: Confirm nothing imports from these paths (`grep -r "services/functions\|services/smartcart_optimizer"`) and delete them to avoid confusion for new contributors.
