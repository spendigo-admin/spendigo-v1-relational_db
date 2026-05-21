# Project TODOs & Backlog

## 1. Pre-Launch Blockers (v1.0 GA Target)

### Infrastructure & Config
- [ ] **Deploy Secrets to Production**: Code-side `runWith` declarations are complete for all 14 functions. Before running `firebase deploy --only functions`, provision each secret once:
  ```bash
  firebase functions:secrets:set STRIPE_SECRET_KEY
  firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
  firebase functions:secrets:set ALGOLIA_API_KEY
  firebase functions:secrets:set STRIPE_PRICE_CORE
  firebase functions:secrets:set STRIPE_PRICE_GROWTH
  firebase functions:secrets:set STRIPE_PRICE_PRO
  ```
  Then set the non-sensitive config vars in Firebase Console → Functions → Configuration → Environment variables: `ALGOLIA_APP_ID`, `ALGOLIA_INDEX_NAME` (`master_products`), `ALGOLIA_MERCHANT_INDEX_NAME` (`merchant_products`), `APP_URL` (`https://spendigo.ca`), `ADMIN_ALERT_EMAIL`. See `services/api/.env.example` for the full variable list and which category each belongs to.
- [ ] **Staging Environment**: Provision an isolated `spendigo-staging` Firebase project (or Preview Channels) for QA.

### Careers & Compliance
- [ ] **Careers Portal: Missing Storage Rules for Resumes**: Resume files are uploaded to `resumes/{jobId}/{filename}` in `CareerDetail.tsx` (lines 94–95), but `storage.rules` does not have a match block for this path, defaulting to a complete block. This prevents candidate CV submissions. Add a storage match block allowing public/unauthenticated writes and strictly restricting reads to authenticated admins.
- [ ] **Careers Portal: Missing Admin UI for Job Applications**: Although the candidate application flow writes to the `job_applications` Firestore collection, the admin dashboard at `/admin/careers` (`CareerManagement.tsx`) only manages job postings. There is no administrative UI to view candidate profiles, download uploaded CVs, or transition application statuses (`status: 'new' | 'reviewed' | 'interviewing' | 'rejected' | 'hired'`). Build a candidate management section inside the Admin panel.
- [ ] **Verify KYB Storage Rules Deployment**: Confirm the active deployment and automated security verification of the path-restricted Firestore storage rules `/stores/{storeId}/documents/{allPaths=**}` to ensure merchant business licenses and registration certificates can only be uploaded by the verified merchant `OWNER` role, and read only by authenticated admins.

### Operations & Mobile Release
- [ ] **Master Catalog Baseline Expansion**: The pilot catalog contains only ~50 SKUs. Expand the master catalog baseline to 500+ items to ensure a viable consumer launch. Use the "Pending Review" workflow to approve pilot merchant inventory submissions.
- [ ] **Mobile Release Wrapper Sync**: Prior to native mobile store submissions, establish a strict checklist execution of `npm run build && npx cap sync` to synchronize the Capacitor 7 iOS and Android shells with the latest bundle assets.

---

## 2. High Priority (Post-Launch v1.0.x)

### Reliability
- [ ] **Stripe `payments` Collection Never Reconciled**: `stripeWebhook.ts:59` writes a payment record with `orderId: null` when the webhook arrives before `placeOrder` commits (documented race condition). No background job ever reconciles these orphaned records against completed orders. Revenue gaps won't surface until a manual audit. Implement a reconciliation pass (scheduled function or on-demand) that matches orphaned `payments` docs to orders by `paymentIntentId`.
- [ ] **Stripe Subscription Cancellation Silently Skipped on Error**: `storeCleanupUtils.ts:46–58` logs and continues when Stripe cancellation fails — the store is deleted from Firestore but billing continues. Collect failed cancellations and either retry or mark the cleanup incomplete so ops can act.
- [ ] **`priceHistoryTrigger` Full User Collection Scan**: `priceHistoryTrigger.ts:89` paginates through the entire `users` collection in 500-doc batches on every merchant product price change. At scale (100k+ users) this is 200+ Firestore reads per price event and risks trigger timeouts. Add a composite index on `(fcmTokens array-contains-any, coordinates)` or move proximity filtering upstream with a geohash query to limit reads to users near the store.
- [ ] **No Timeout on External HTTP Calls in Cloud Functions**: `storeTriggers.ts:103,136` (Nominatim geocoding) and `stripeWebhook.ts:142,150` (Stripe retrieve + FCM multicast) make outbound calls with no timeout — a slow third-party response hangs the function until the 60 s limit kills it, causing retries and duplicate side-effects. Wrap each call with `AbortController` / `Promise.race` at 5 s.
- [ ] **Nominatim Geocoding missing Custom User-Agent**: `storeTriggers.ts:105,139` calls OpenStreetMap's Nominatim search API without setting a custom `User-Agent` header as strictly required by OSM's Nominatim Usage Policy. In production, this can result in the entire application's geocoding IP range being blacklisted by OpenStreetMap. Set a distinct, descriptive `User-Agent` header identifying the Spendigo platform.
- [ ] **Nominatim Geocoding trigger bulk-write rate limiting**: Concurrently updating multiple store addresses will fire the Nominatim trigger simultaneously, violating OpenStreetMap's strict 1 request/second policy. This leads to geocoding failures or complete IP blacklisting. Move geocoding out of high-frequency triggers into a throttled background job queue, or integrate a commercial provider (e.g. Google Maps API).
- [ ] **Audit Log ID Collision on High Write Volume**: `audit.ts:107` uses `Date.now()` as the Firestore document ID — two writes in the same millisecond produce the same ID, silently overwriting one entry and breaking the hash chain. Use Firestore's auto-generated IDs (`.add()`) and store the timestamp as a field.
- [ ] **`cancelOrder` Duplicate Audit Entries on Transaction Retry**: `cancelOrder.ts` calls `logEvent(...)` inside `db.runTransaction()`'s callback without passing the outer `transaction` object. If Firestore retries the outer transaction due to a contention conflict, `logEvent` runs its own separate inner transaction on each retry, writing a duplicate audit chain entry for the same cancellation. Pass the outer transaction to `logEvent` (the function supports `providedTransaction` + `preFetchedPrevHash` parameters) to make the audit write atomic with the cancellation.
- [ ] **Fire-and-Forget Audit Write in `placeOrder` Swallows Failures**: `placeOrder.ts:186–193` catches `logEvent` errors with a console log and continues — orders can complete with no audit record and no alert. Emit a Sentry event on failure; ideally write to a dead-letter subcollection for retry.
- [ ] **Cloud Functions Unhandled Rejection Handler**: No global `process.on('unhandledRejection')` handler exists in the functions runtime. Silent failures in fire-and-forget async calls (FCM multicast in `priceHistoryTrigger.ts`, audit writes) go undetected.
- [ ] **Context-Level Error Boundaries**: `App.tsx` has a single top-level `ErrorBoundary`. A crash in any context provider (CartProvider, OrderProvider, etc.) takes down the entire app. Wrap individual providers with isolated error boundaries.
- [ ] **Firestore Rules getUserData() Cost**: `getUserData()` is called in every rule evaluation that calls `isAdmin()` or `isMerchant()`, resulting in a Firestore read per rule check. Cache the result in a local variable or restructure rules to use custom claims to reduce reads and cost.
- [ ] **Team Invite Not Idempotent on Retry**: `inviteTeamMember.ts:101–106` throws if the email already exists in Firebase Auth — retrying a failed invite (e.g. after a Firestore write failure) errors out and leaves the user half-invited. Check for an existing Auth user by email first and reuse the UID if found.
- [ ] **Null `customerId` Not Guarded in Order Trigger**: `orderTriggers.ts:26` uses `order.customerId` without a null check — if the field is missing, the FCM notification silently fails. Add an early return with a logged warning.
- [ ] **Audit Logging IP Masked as `0.0.0.0` Behind Proxy**: `placeOrder.ts:174` and `cancelOrder.ts` fall back to `'0.0.0.0'` when `context.rawRequest.ip` is null — behind Cloud Load Balancer all attacker IPs look the same in audit logs. Read `x-forwarded-for` header with proper parsing as the primary source.

### Mobile
- [ ] **App Check: Register Android and iOS Attestation Providers**: Web App is registered; Android (`com.spendigo.smartcart`) and iOS (`com.spendigo.smartcart`) show "Not registered" in the Firebase App Check console. Register Android with **Play Integrity** (preferred) or SafetyNet, and iOS with **App Attest** (preferred, iOS 14+) or DeviceCheck. Both require adding the respective SDK to the Capacitor native project and initializing App Check before any Firebase service call in the native layer. Enforce mode should mirror web — debug tokens needed for CI/emulator builds.
- [ ] **Android `allowBackup` Disabled**: `apps/web/android/app/src/main/AndroidManifest.xml` line 4 sets `android:allowBackup="true"`. This allows Android backup services to export app data (including cached tokens and localStorage) to uncontrolled locations. Set to `false` or configure `android:fullBackupContent` rules.

### Operational
- [ ] **Staff Email Lookup Case-Sensitive**: `AuthContext.tsx:140` queries the `staff` collection using the raw email from Firebase Auth — if the stored doc key uses different casing (e.g. `Admin@example.com` vs `admin@example.com`), the lookup fails and the user never receives their admin role. Normalize to lowercase on both write and read.
- [ ] **Unauthenticated Analytics View Inflation**: `firestore.rules` allows unauthenticated writes to `stores/{storeId}/analytics` view counters — a bot can inflate any store's traffic metrics to millions at zero cost. Require authentication for analytics writes, or enforce server-side increment via a Cloud Function.
- [ ] **Algolia Sync Has No Timeout**: `algoliaTriggers.ts:26–28,58–61` calls Algolia's API with no timeout — a slow response blocks the Firestore trigger indefinitely. Wrap with `Promise.race` at 5 s and surface failures to Sentry.
- [ ] **`sendCampaign` FCM Payload Not Length-Validated**: `sendCampaign.ts:196–202` writes `dealId` and custom metadata directly to the FCM data dict without length checks — a large value can exceed FCM's 4 KB payload limit and silently drop the notification. Validate each field length before building the payload.
- [ ] **Subscription Tier Parity on Verified Badge**: In `StoreDetail.tsx:648`, the verified badge checks for `store.subscriptionTier === 'growth'` instead of checking for `pro` or general active tiers, which is inconsistent with other features (like deals/promotions gating which are restricted to `pro`). Update the check to align with the correct tiered SaaS model (e.g., active subscription tiers or `pro`).
- [ ] **Merchant KYB Automation Notification Trigger**: Hook document storage uploads to automatically trigger email notifications (via Cloud Functions/SendGrid) to the admin review queue when a merchant submits business credentials for review.

### Security & Access Control
- [ ] **Firestore Rules: Review helpfulCount & voters validation**: `firestore.rules` allows any authenticated user to update `helpfulCount` and `voters` on any review without verifying that the user only increments/decrements by exactly 1 and that their matching user ID is added/removed from the `voters` array. This allows arbitrary review score manipulation. Enforce delta and array membership validation in update rules.
- [ ] **Firestore Rules: Survey Response Schema Validation**: The `/surveys/{surveyId}/responses/{userId}` collection allows writes if `userId == request.auth.uid`, but lacks validation of the response fields. A user can write arbitrary or malicious data fields. Enforce proper schema keys and types.
- [ ] **Firestore Rules: Self-Assignment of storeId**: In `firestore.rules` for `/users/{userId}`, users can self-assign a `storeId` value matching `'store-' + userId` on update. Enforce that all `storeId` modifications are restricted to administrators.

---

## 3. Future Enhancements (v1.1+)

### Internationalization
- [ ] **i18n — Merchant Portal**: All 11 merchant pages (`/merchant/*`) are untranslated. Consumer pages are fully covered as of v1.0. Merchant portal is the next highest-traffic surface for bilingual users.
- [ ] **i18n — Admin Portal**: All 16 admin pages (`/admin/*`) are untranslated. Lower priority than merchant portal but needed for completeness.

### Developer Experience & Quality
- [ ] **Cloud Functions Test Coverage**: No unit or integration tests exist for Cloud Functions (payments, orders, auth). Add tests for `placeOrder`, `createCheckoutSession`, `stripeWebhook`, and `cancelOrder` — these are the highest-value paths.
- [ ] **E2E Test Coverage Gaps**: Current Playwright specs cover basic auth, store browsing, checkout, and legal pages. Merchant flows (product CRUD, order management) and admin flows (user management, flyer ingestion) are unverified.
- [ ] **TypeScript Strictness**: Clean up the 532 lint problems (530 `@typescript-eslint/no-explicit-any` warnings + 2 errors) to improve code safety. Run `npm run lint` to see current state.

### Observability
- [ ] **Sentry Context Enrichment**: `AuthContext.tsx:217` already calls `Sentry.setUser({ id, email, role })` — role is set. Still missing: `storeId` and `subscriptionTier`. Add these two fields to the `Sentry.setUser()` call so merchant errors are filterable by store and plan.

### AI & Personalization
- [ ] **AI Auto-Moderation**: Implement Gemini-powered initial moderation for "Pending Products" submissions to reduce Admin manual workload.
- [ ] **Historical Personalization**: Develop Algolia search boosting logic based on localized user purchase history.

### Social Login
- [ ] **Facebook Login**: Button exists in `Login.tsx:230` but is hardcoded `disabled={true}`. Requires Meta App Review approval and a valid `loginWithFacebook` OAuth flow in `AuthContext`. Apple Sign-In is also absent — would be required for App Store distribution (`apps/mobile/`).

---

## 4. Backlog & Technical Investigations

*No active backlog items.*
