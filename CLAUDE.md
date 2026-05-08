# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Spendigo SmartCart is a Canada-first Marketplace Facilitator connecting independent convenience stores with local consumers. Status: Production-Ready (v1.0). Firebase serverless backend, React 18 SPA frontend, Capacitor mobile wrapper.

## Coding Philosophy

1. **Think Before Coding**: Always output a `Thinking` block first. Analyze the problem, map dependencies, and identify the surgical change needed before touching any file.
2. **Surgical Precision**: Do not perform drive-by refactoring. Only modify lines strictly necessary for the fix or feature.
3. **Kill Complexity**: Prefer the simplest, most readable solution over clever abstractions or extra dependencies.
4. **Measure First**: When optimizing, identify the metric first. Follow the Karpathy Loop — make a change, measure the result, discard if there is no improvement.
5. **No Vibe Coding**: Rely on documentation and test results, not assumptions. Use `ls`, `grep`, and `cat` (or their tool equivalents) to verify codebase state before editing.
6. **Explain the Why**: After every non-trivial fix, add a one-paragraph "Why this works" explanation covering the low-level mechanism — which data structure changed, which race condition was closed, which contract was violated and how. Surface-level "this fixes the bug" summaries are not enough.

## Commands

### Development
```bash
npm install          # Install all workspace dependencies (Node >=20, v22+ recommended; npm 11.7.0)
npm run dev          # Start all apps (Turbo) — web runs at https://spendigo.ca:443
npm run build        # Production build (all packages via Turbo)
npm run lint         # ESLint across entire monorepo
npm test             # Run Vitest unit tests (root)
npm run test:e2e     # Run Playwright E2E tests (requires dev server running)
npm run stripe:listen  # Forward Stripe webhooks to local Firebase Functions emulator
npm run format         # Prettier formatting across monorepo
npm run benchmark:smartcart  # Benchmark SmartCart optimizer
```

**Lint rules** (`.eslintrc.cjs`): `@typescript-eslint/no-explicit-any` is **warn** (not error) — `any` is tolerated. `no-unused-vars` is off; `@typescript-eslint/no-unused-vars` is **warn**.

### Web app only
```bash
cd apps/web && npx vite --host     # Dev server directly
cd apps/web && tsc && vite build   # Build web app
```

### Cloud Functions
```bash
cd services/api && npm run build   # Compile TypeScript → lib/
cd services/api && npm run serve   # Build + start Firebase emulator (functions only)
cd services/api && npm run shell   # Firebase functions REPL for local testing
cd services/api && npm run logs    # Fetch live function logs
firebase deploy --only functions   # Deploy functions to production
firebase deploy                    # Deploy hosting + functions + Firestore rules
```

### Mobile (Capacitor)

Capacitor config in `apps/web/capacitor.config.ts`: app ID `com.spendigo.smartcart`, web dir `dist`. Plugins: StatusBar (dark, overlays), SplashScreen (2 s, immersive), Keyboard (resize body, scroll to input). Android uses HTTPS scheme.

```bash
npx cap sync         # Sync web build to native projects
npx cap open ios     # Open Xcode
npx cap open android # Open Android Studio
```

### Single test file
```bash
npx vitest run tests/unit/<filename>.test.ts
```

## Architecture

This is a **Turbo monorepo** with npm workspaces:

- **`apps/web/`** — React 18 + TypeScript SPA (Vite 7). Single app serving Consumer, Merchant, and Admin portals via role-based routing.
- **`apps/mobile/`** — Capacitor wrapper (iOS/Android, app ID: `com.spendigo.smartcart`) — no logic of its own, wraps the web build.
- **`services/api/`** — Firebase Cloud Functions (Node >=20, TypeScript). Entry point: `src/index.ts`.
- **`packages/shared/`** — Shared utilities (currently empty).

### Frontend (`apps/web/src/`)

**Role-based routing** in [App.tsx](apps/web/src/App.tsx): Three layout wrappers (`ConsumerLayout`, `MerchantLayout`, `AdminLayout`) enforce authentication at the layout level. `MerchantLayout` and `AdminLayout` do hard redirects if the user lacks the correct role. `MaintenanceGuard` (inline in App.tsx) blocks all traffic except admins and `/login`/`/admin` paths when `settings/platform.maintenanceMode` is `true` in Firestore. React Router uses `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}` for concurrent rendering compatibility.

**Context providers** (wrap order in App.tsx matters):
```
AuthProvider → AuditProvider → MaintenanceGuard → MarketplaceProvider → NotificationProvider
  → CatalogProvider → ReviewProvider → CartProvider → WishlistProvider → ComparisonProvider
  → OrderProvider → LocationProvider → ConfirmationProvider
```
`AuditProvider` is global — wraps `MaintenanceGuard` and all inner providers. Audit logging is active for all roles, not just admins.
- `AuthContext` — Firebase Auth + Firestore user profiles, RBAC permissions via `can(permission)`. User roles: `consumer | merchant | admin`. Merchant sub-roles: `OWNER | MANAGER | STAFF | MARKETING`.
- `MarketplaceContext` — Real-time `onSnapshot` of all `stores` collection (filters to `status === 'active'`).
- `CatalogContext` — Master product catalog.
- `CartContext` — Hybrid: localStorage for guests, Firestore `carts/{userId}` for authenticated users; merges guest cart on login.
- `ComparisonContext` — Product comparison list for the PriceCompare page. Hybrid: `spendigo_comparison_guest` localStorage for guests, `comparison_wishlists/{userId}` Firestore for auth users.
- `LocationContext` — Geolocation with Haversine distance, Nominatim geocoding (OpenStreetMap), FSA (Forward Sortation Area / postal prefix) fallback. Default search radius: 10 km.
- `OrderContext`, `WishlistContext`, `NotificationContext`, `AuditContext`, `ReviewContext`, `ConfirmationContext`.

**Internationalization**: `i18next` + `react-i18next` with `i18next-browser-languagedetector`. Two locales: English (`en`) and French (`fr`), translations in `apps/web/src/locales/{lang}/translation.json`. Initialized before React renders in `main.tsx`. `LanguageSwitcher` component in layouts for manual toggle.

**Permission system** (`AuthContext.tsx`):
Merchant sub-roles grant specific permissions checked via `can(permission)` from `useAuth()`:
- **OWNER**: products:write, orders:read, orders:write, flyers:write, deals:write, settings:write, team:manage, delivery:manage, analytics:read
- **MANAGER**: same as OWNER except team:manage
- **STAFF**: orders:read, orders:write, delivery:manage
- **MARKETING**: flyers:write, deals:write, analytics:read

Admin sub-roles: SUPER_ADMIN (admin:all), MODERATOR (admin:users, admin:stores), SUPPORT (admin:users), AUDITOR (admin:audit). All permission gates are client-side; server-side enforcement is in `firestore.rules`.

**Staff gating** (`AuthContext.tsx`): `/staff/{email}` Firestore documents pre-stage admin accounts. If a matching doc has `status: 'active'`, the user's role is promoted to `admin` (using `staffData.role`) before store/subscription checks — allows admins to pre-register users before they sign up.

**Admin MFA**: Phone SMS MFA (Firebase Phone Auth) is required for all admin roles. `AuthContext` checks `multiFactor(currentUser).enrolledFactors.length`; enrollment is at `/admin/mfa-setup` using invisible reCAPTCHA.

**Admin portal pages**: See the [Page Routes](#page-routes) section for the full list. Note: `SeedUsers.tsx` exists under `pages/admin/` but has no route wired in App.tsx.

**Audit log integrity** (`AuditContext.tsx`): Audit entries are chained via SHA-256 — each record hashes its own payload concatenated with the previous record's hash (blockchain-lite). Tampering with any historical entry breaks the chain. Verified by the AUDITOR role in the admin portal.

**Barcode scanning**: `html5-qrcode` is the in-browser QR/barcode scanner used on product lookup flows. Barcode deduplication uses GTIN variant generation (8/12/13/14-digit) in `useCatalog.ts`.

**Key hooks:**
- [apps/web/src/hooks/useOptimizedWishlist.ts](apps/web/src/hooks/useOptimizedWishlist.ts) — Core SmartCart engine (730+ lines). Real-time deal sync from `stores/{storeId}/deals` subcollection, effective price calculation with deal hierarchy (flash sale → standard sale → flyer → regular price), fuzzy matching fallback, distance filtering via Haversine + FSA, and full optimizer pipeline. Persists store selections to localStorage (`smartcart_selections_v1`).
- [apps/web/src/hooks/useCatalog.ts](apps/web/src/hooks/useCatalog.ts) — Catalog management (1400+ lines). Master/merchant product CRUD, Algolia search with geo-filtering, barcode deduplication via GTIN variant generation (8/12/13/14-digit), Open Food Facts UPC lookup (tries multiple endpoints for CORS), `bulkAddMerchantProducts` for CSV import, pending product workflow for admin approval.
- [apps/web/src/hooks/usePushNotifications.ts](apps/web/src/hooks/usePushNotifications.ts) — Firebase Cloud Messaging. Registers SW at `/firebase-messaging-sw.js`, stores FCM tokens in user document `fcmTokens` array, uses VAPID key. **Notification preference storage by role**: consumer prefs → `users/{uid}.notificationPreferences`; merchant prefs → `stores/{storeId}.notificationPreferences`; admin prefs → `users/{uid}.adminNotificationPreferences`. Each role has a dedicated `/notifications` inbox page (`consumer/Notifications.tsx`, `merchant/MerchantNotifications.tsx`, `admin/AdminNotifications.tsx`).
- [apps/web/src/hooks/useFileUpload.ts](apps/web/src/hooks/useFileUpload.ts) — Firebase Storage uploads with 2 MB max, image-only validation, 30 s timeout.
- [apps/web/src/hooks/useTrafficStats.ts](apps/web/src/hooks/useTrafficStats.ts) — Admin analytics dashboard. Listens to `stats/traffic`, calculates day-over-day change, `refreshStats()` calls `syncTrafficStats` Cloud Function (GA4 integration).
- [apps/web/src/utils/imageOptimizer.ts](apps/web/src/utils/imageOptimizer.ts) — Client-side image compression via Canvas (max 1024 px, JPEG 0.7 quality).

**Key lib files:**
- [apps/web/src/lib/firebase.ts](apps/web/src/lib/firebase.ts) — Firebase SDK init; uses `VITE_` env vars; connects Functions emulator on `localhost:5001` in dev.
- [apps/web/src/lib/algolia.ts](apps/web/src/lib/algolia.ts) — Algolia search client (gracefully null if env vars missing). Index: `master_products`.
- [apps/web/src/utils/IntegrityUtils.ts](apps/web/src/utils/IntegrityUtils.ts) — Server-side price validation to detect order tampering.
- [apps/web/src/utils/fuzzy-search.ts](apps/web/src/utils/fuzzy-search.ts) — Levenshtein + token overlap + brand boost, 4 match tiers (exact/partial/fuzzy/typo), 1-min cache. Used in SmartCart wishlist matching (score ≥ 65 threshold).
- [apps/web/src/hooks/useSmartInsights.ts](apps/web/src/hooks/useSmartInsights.ts) — Gemini `gemini-2.5-flash` integration via `@google/generative-ai`. Debounces 1.5 s, generates 2–3 shopping insight strings from basket summary. Requires `VITE_GEMINI_API_KEY`.
- [apps/web/src/hooks/useStoreProducts.ts](apps/web/src/hooks/useStoreProducts.ts) — Fetches a store's merchant products, falling back to `pending_master_products` when the master product isn't published yet. Used in both consumer (StoreDetail) and merchant (Products, Deals, Flyers) pages.
- [apps/web/src/hooks/useInventorySync.ts](apps/web/src/hooks/useInventorySync.ts) — Detects out-of-sync merchant products vs. the master catalog and exposes sync stats for the merchant dashboard.
- [apps/web/src/lib/analytics.ts](apps/web/src/lib/analytics.ts) — `trackVisit()` called once on App mount.
- [apps/web/src/lib/sentry.ts](apps/web/src/lib/sentry.ts) — Sentry error tracking. Performance sampling: 20% in prod, 100% in dev. Session replay: 10% of sessions, 100% of error sessions. Gracefully no-ops if `VITE_SENTRY_DSN` not set.
- [apps/web/src/utils/auditBridge.ts](apps/web/src/utils/auditBridge.ts) — Global pub/sub singleton allowing code outside `AuditProvider` (e.g. utility functions, non-React modules) to emit audit events. `AuditProvider` subscribes to it; events are forwarded to the `recordAuditEvent` Cloud Function.

**`lazyWithRetry` pattern** (App.tsx): All non-auth page routes use this wrapper instead of bare `lazy()`. On a dynamic import failure (stale chunks after deploy), it forces a single page reload via `sessionStorage` guard before re-throwing. `ErrorFallback` component detects stale chunk errors specifically and prompts the user to reload.

**AppCheck**: ReCaptchaV3 enabled in production only (skipped in dev). Configured in `firebase.ts`.

### SmartCart Module (`apps/web/src/smartcart/`)

Cross-store price comparison and basket optimization (12 files). Pipeline: build price matrix → normalize unit prices → compare across stores → simulate single-store costs → analyze trip consolidation → select optimal allocation. Entry points: `optimizeCart.ts` (main) and `smartcart_optimizer.ts` (orchestrator).

The backend mirror lives in `services/api/src/smartcart/` (Cloud Function endpoint `/smartcartOptimize`). A separate `services/api/src/cart/optimizeCart.ts` exposes an additional `/cartOptimize` endpoint using the same service layer. **Backend caching**: optimizer results are stored in Firestore (`smartcart_optimizer_cache` collection) with a 10-minute TTL; cache key is SHA256 of the sorted shopping list + sorted store IDs (`services/api/src/smartcart/cache.ts`).

### Backend (`services/api/src/`)

Firebase Cloud Functions v4 (v1 API). Organized by domain:
- `payments/` — Stripe checkout session creation, webhook handler, subscription updates; also `createPaymentIntent`, `refundOrder`, `onboardStore` (Stripe Connect onboarding), `checkStripeAccountStatus`, `getPaymentHistory`
  - **Stripe Connect (Standard)**: Merchants onboard via `onboardStore` → creates connected account (country `CA`). Payments use destination charges: platform fee = 5% + $0.30, remainder auto-transfers to merchant.
  - **Promo code**: `FIRST100` hard-coded — if < 100 stores exist, new merchants get 90-day free trial.
  - **Subscription proration**: Upgrades use `always_invoice` (immediate charge); downgrades use `none` (effective next cycle). Tier order: `{free:0, core:1, growth:2}`.
  - **Webhook race condition**: Payment webhook can arrive before `placeOrder` finishes; temporary `payments` collection stores webhook data for later reconciliation.
- `orders/` — `placeOrder` (transactional: reads stock → verifies quantity → decrements → validates payment → creates order), `cancelOrder` (restores stock), `downloadReceipt` (PDF via PDFKit, stored with Firebase download token)
- `auth/` — Team member invite/delete/remove, `requestAccountDeletion`. Role-based rank: OWNER (3) > MANAGER (2) > STAFF/MARKETING (1) — prevents privilege escalation.
- `marketing/` — `sendCampaign` (callable, OWNER/MANAGER): sends FCM push to a merchant-defined user segment (`nearby` / `inactive` / `active` / `high_value`). Message must come from a pre-approved allowlist. Rate-limited to 5 sends per 24 h per merchant via `rateLimiter`.
- `email/` — `sendOrderConfirmation` (Firestore onCreate trigger), `sendOrderStatusUpdate` (onUpdate trigger). Emails are **not sent directly** — they write styled HTML to the `/mail` Firestore collection; a Firebase Extension handles SMTP delivery.
- `triggers/` — Firestore-triggered functions:
  - `onUserUpdate` — syncs subscriptionTier to store doc
  - `onMasterProductWrite` — downloads external images to Storage with 1-year cache
  - `onOrderStatusUpdated` — sends FCM push notifications with emoji-prefixed titles, auto-removes stale tokens
  - `onStoreCreate` / `onStoreUpdate` — auto-geocodes store address via Nominatim; re-geocodes on address field changes.
  - `onStoreDelete` — cascade cleanup: deletes merchant products, deals, flyers, de-links users (reverts to `consumer` role, removes merchant fields), cancels Stripe subscriptions. Always runs on any store deletion — no longer skips stores deleted via the grace-period flow, ensuring merchants are always correctly reverted even on early/manual deletion.
  - `onBackupJobResult` (`storeTriggers.ts`) — Firestore `onCreate` on `system_backups/{id}`; if `status === 'failed'`, sends alert email via `/mail` collection.
  - `onMerchantProductPriceChange` (`priceHistoryTrigger.ts`) — records daily price history snapshot; detects price drops and new sales, then queries users with active FCM tokens within their configured proximity radius (Haversine) and sends geo-targeted multicast FCM notifications respecting `notificationPreferences.promotions` / `priceDrop` / `maxDistance` user fields
  - `onReviewCreated` (`reviewTrigger.ts`) — when a `store`-type review is created, queries all merchant users for that `storeId` and writes a `type: 'review'` notification to each `users/{uid}/notifications/{id}` subcollection
  - `onOrderCreated` — post-order trigger (send confirmation, audit, analytics)
  - `syncMasterProductToAlgolia`, `syncMerchantProductToAlgolia` (includes `_geoloc` for location-based search)
- `admin/` — Cleanup utilities (`cleanupOrphanedUsers`, `cleanupOrphanedStoreData`, `syncTrafficStats`), `getSystemHealth` (powers `/admin/health` dashboard), `scrapeFlyer` (flyer content extraction for `/admin/flyer-ingestion`), `processIngestionJobs` (background flyer ingestion runner), `searchPublicDeals`. **Backup functions**: `scheduledFirestoreExport` (pubsub `0 2 * * *` Toronto — exports critical collections to GCS, skips if `settings/platform.scheduledExportsEnabled === false`), `triggerManualExport` (callable, admin-only — same export, always runs regardless of flag), `exportFirebaseAuth` (pubsub `0 3 * * *` — paginates Auth users to NDJSON in GCS), `exportMerchantData` (callable, OWNER-only, rate-limited 3/hr — returns store+products+orders JSON for download, redacts customer PII), `processPendingStoreDeletions` (pubsub `0 4 * * *` — runs cascade delete on stores with `status === 'pending_deletion'` AND `deletionApprovedAt` > 30 days ago). All backup jobs write a manifest doc to `system_backups` collection. **IAM required on `spendigo-8540c@appspot.gserviceaccount.com`**: `roles/datastore.importExportAdmin` (project-level) + `roles/storage.objectCreator` (bucket-level on `spendigo-8540c-firestore-backups`).
- `audit/` — `recordAuditEvent` (callable function; receives events from the client-side `auditBridge` and writes append-only entries to `audit_logs`)
- `smartcart/` — Cart optimization HTTP endpoint (`/smartcartOptimize`) mirroring frontend logic
- `cart/` — Additional `/cartOptimize` HTTP endpoint (delegates to smartcart service layer)
- `utils/rateLimiter.ts` — Firestore sliding-window rate limiter on `_rate_limits` collection. Applied per-user per-action (e.g., max 5 `placeOrder` calls/min) via Firestore transactions. Returns `resource-exhausted` HttpsError on breach.
- `models/` — Shared TypeScript interfaces: `MasterProductRecord`, `StoreRecord`, `MerchantProductRecord`

**Note:** `services/functions/` and `services/smartcart_optimizer/` are legacy/experimental — all active Cloud Functions are in `services/api/`.

Stripe webhook secret stored in Firebase Runtime Config: `stripe.webhook_secret`. Local testing uses `services/api/.runtimeconfig.json`.

### Firebase / Infrastructure

- **Firestore rules**: `firestore.rules` at repo root. RBAC enforced server-side: consumers, merchants (by `storeId`), and admins have separate access patterns.
- **Hosting**: `apps/web/dist/` deployed to Firebase Hosting with SPA rewrite.
- **Dev SSL**: Self-signed cert via `@vitejs/plugin-basic-ssl` stored in `apps/web/.certs/`. Dev server binds to `spendigo.ca:443` (requires `/etc/hosts` entry).
- **Hosting headers**: CSP allows scripts from Stripe, Google reCAPTCHA, Sentry; connects to Firebase, Algolia, Stripe, OpenStreetMap, Sentry, Open Food Facts, Generative Language API. HSTS (1 year), X-Frame-Options: DENY, nosniff. HTML is no-cache/no-store.
- **Terraform**: Infrastructure config in `infra/` (`main.tf`, `variables.tf`). GCS backup bucket (`spendigo-8540c-firestore-backups`) must be in `northamerica-northeast1` — the Firestore Admin export API rejects buckets not co-located with the database (dual/multi-region buckets like `NAM4` that don't span the DB region will fail with `INVALID_ARGUMENT`).

### Firestore Collections

`/users`, `/stores`, `/orders`, `/master_products`, `/pending_master_products`, `/merchant_products`, `/product_creation_requests`, `/categories`, `/substitution_groups`, `/reviews`, `/audit_logs`, `/carts`, `/wishlists`, `/comparison_wishlists` (ComparisonContext, mirrors wishlists pattern), `/notifications`, `/settings` (platform config), `/staff` (admin pre-staging), `/mail`, `/ads`, `/surveys`, `/stats`, `/_rate_limits` (rate limiter sliding windows), `/smartcart_optimizer_cache` (10-min TTL optimizer results), `/payments` (webhook reconciliation buffer), `/system_backups` (backup job manifests — admin read-only, written by backup Cloud Functions; fields: `type`, `date`, `status`, `outputUriPrefix`, `collections`, `triggeredBy`). Subcollections: `merchant_products/{id}/price_history/{date}` (daily price snapshots written by `onMerchantProductPriceChange`); `stores/{storeId}/analytics/{YYYY-MM-DD}` (daily view counts written by `StoreDetail.tsx` on each store page load — read by the merchant Analytics page; public writes restricted to `views` and `date` fields only). Legacy/seed-only: `/catalog` (populated by `scripts/seedCatalog.ts`, not used by app or API code).

**Key Firestore write restrictions** (enforced in rules):
- **Orders**: Created server-side only via Admin SDK (Cloud Functions). Clients cannot create orders directly. Updates use `diff().affectedKeys()` for field-level control — merchants can only change `status`, `rejectionReason`, `estimatedTime`, `paymentStatus`; customers can only set status to `cancelled`.
- **Users**: `role`, `adminRole`, `merchantRole`, `storeId` are admin-only fields. Self-registration only sets `consumer` or `merchant` role.
- **Stores**: Merchants cannot change `subscriptionTier`, `status`, Stripe config, or `ownerId`. Deals live in `stores/{storeId}/deals` subcollection (flash sales, standard sales, flyer items). **Soft-delete**: admin approval sets `status: 'pending_deletion'` + `deletionApprovedAt: serverTimestamp()` instead of calling `deleteDoc` — `processPendingStoreDeletions` runs the cascade after 30 days. `cancelStoreDeletion` reverts to `status: 'suspended'`.
- **Merchant products**: Must reference an existing `master_products` or `pending_master_products` document (enforced by `exists()` in rules). Merchants cannot change `merchant_id` or `master_product_id` after creation (admin can).
- **Audit logs**: Append-only. Users create; nobody updates/deletes.

### Firestore Composite Indexes

Defined in `firestore.indexes.json`:
- `orders`: `storeId` (ASC) + `date` (DESC) — merchant order queries.
- `orders`: `customerId` (ASC) + `date` (DESC) — customer order history.
- `reviews`: `targetId` (ASC) + `timestamp` (DESC) — store/product review listing.
- Field overrides: `master_products.barcode` and `pending_master_products.original_barcode` indexed for barcode lookups.

### Cloud Storage Paths

Defined in `storage.rules`:
- `merchant-assets/{storeId}/**` — Merchant store content (read: all auth, write: owning merchant).
- `user-avatars/{userId}/**` — Profile pictures (read/write: owner only).
- `admin-assets/**` — Platform content (read: all auth, write: admin only).
- `products/**` — Product images downloaded by `onMasterProductWrite` trigger (read: public/unauthenticated, write: none — server-only).
- Default `/**` — Deny all.

### Merchant Subscription Tiers

Three tiers — **Free**, **Core**, **Growth** — managed via Stripe. `updateSubscriptionPlan` Cloud Function updates Firestore on webhook receipt. Tier determines feature access in `MerchantLayout`.

### Vite Code Splitting

`vite.config.ts` splits vendor chunks: `vendor-react`, `vendor-firebase`, `vendor-algolia`, `vendor-stripe`, `vendor-ai`, `vendor-sentry`. All page routes are lazy-loaded (except auth pages). Production build strips `debugger` via esbuild (console statements preserved for Sentry breadcrumbs).

### Theming & CSS Architecture

Tailwind CSS configured in `apps/web/tailwind.config.js` maps CSS custom properties to utility classes: `brand-primary`, `brand-secondary`, `surface-0/1/2`. Base variables defined in `apps/web/src/styles/design-system.css` (`:root`). Three switchable theme overlays in `apps/web/src/styles/themes.css`: `theme-night` (dark), `theme-eco` (organic), `theme-deal` (vibrant). Components use Tailwind classes like `bg-brand-primary`, `text-surface-1`.

## Environment Variables

Create `apps/web/.env.local` with:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_ALGOLIA_APP_ID=
VITE_ALGOLIA_SEARCH_KEY=
VITE_ALGOLIA_INDEX_NAME=   # optional, defaults to 'master_products'
VITE_FIREBASE_VAPID_KEY=   # FCM VAPID key for push notifications (Web Push Certificates in Firebase Console)
VITE_GEMINI_API_KEY=       # Gemini API key for SmartInsights feature
VITE_STRIPE_PUBLISHABLE_KEY=  # Stripe publishable key for Checkout + Elements
VITE_FIREBASE_APP_CHECK_KEY=  # ReCaptchaV3 site key (production only — skipped in dev)
VITE_SENTRY_DSN=           # Sentry DSN for error tracking (optional, no-ops if missing)
```

## Testing

Tests live in `tests/unit/` and use **Vitest**. Run from repo root with `npm test`. Tests currently cover the **SmartCart module** (11 test files): optimizer, comparison engine, price matrix, unit price normalizer, trip consolidation, single-store simulator, price normalization, and simulation.

E2E tests use **Playwright** (`npm run test:e2e`):
- Config in `playwright.config.ts`. Base URL: `https://localhost`. 60 s test timeout, 15 s expect timeout. Retries: 2 on CI, 0 locally. Screenshots on failure, video on first retry.
- Auth setup in `tests/e2e/auth.setup.ts` — saves browser state to `.auth/user.json`. Requires env vars `SPENDIGO_TEST_EMAIL` and `SPENDIGO_TEST_PASSWORD`.
- Does **not** auto-start the dev server — run `npm run dev` first.
- 4 spec files: `checkout-flow`, `legal-pages`, `shopper-login`, `store-browse`.

## CI/CD

GitHub Actions (`.github/workflows/main.yml`) runs on push to `main` or manual dispatch:
1. Install (`npm ci`) → Build (with env secrets) → Test (`npm test`)
2. Deploy hosting via `FirebaseExtended/action-hosting-deploy` to live channel
3. Deploy functions + Firestore rules + storage rules via `w9jds/firebase-action`

Firebase project: `spendigo-8540c`. Service account secret: `FIREBASE_SERVICE_ACCOUNT_SPENDIGO_8540C`.

## Data Seeding

Seed scripts in `scripts/`: `seedFirebase.ts` (full database — 11 test users + 5 stores, password: `Spendigo123!`), `seedMasterCatalog.ts` (product catalog), `seedCatalog.ts` (categories). Run with `tsx scripts/<file>.ts`. Requires `service-account.json` in `scripts/`. Other scripts: `cleanup-duplicates.ts`, `linkAuthUsers.ts`, `benchmark-smartcart.mjs` (100 stores / 10k products / 25 items, target < 100 ms, 10 measured runs). See `scripts/README.md` for Firebase migration setup.

Seeded QA account emails and role-by-role test workflows are documented in `docs/DEMO_CREDENTIALS.md`. Stripe test card: `4242 4242 4242 4242`, expiry any future date, CVC `123`, postal `M5V 2H1`.

## Documentation

Architecture docs in `docs/` (27 files): `ARCHITECTURE.md`, `SCHEMA.md` (Firestore schema), `SITEMAP.md` (full route map), `OPENAPI.yaml` (REST API spec), `AUDIT_IMPLEMENTATION.md` (SHA-256 ledger), `SEARCH_IMPLEMENTATION.md`, `SMARTCART_INTERFACE_DESIGN.md`, `SMARTCART_ALGORITHM_FLOW.md`, `MERCHANT_BILLING.md`, `SECURITY_VERIFICATION.md`, `EMAIL_SETUP_GUIDE.md`, `MASTER_CATALOG_PLAN.md`, `MOBILE_DEPLOYMENT.md`, `GAP_ANALYSIS.md`, `DEPLOYMENT_GUIDE.md`, and more. Terraform infra config in `infra/` (`main.tf`, `variables.tf`).

## Page Routes

### Consumer (public unless noted)
| Path | Component | Auth required |
|---|---|---|
| `/` | StoreList | No |
| `/store/:id` | StoreDetail | No |
| `/product/:id` | ProductDetail | No |
| `/cart` | Cart | No (guest-capable) |
| `/search` | Search | No |
| `/compare` | PriceCompare | No |
| `/smartcart` | SmartCartWishlist | Yes + email verified |
| `/checkout` | Checkout | Yes + email verified |
| `/profile` | Profile | Yes |
| `/order/:id` | OrderTracking | Yes |
| `/notifications` | Notifications | Yes |
| `/flyers`, `/deals` | Flyers, Deals | No |
| `/how-it-works`, `/partner` | HowItWorks, PartnerWithUs | No |
| `/privacy`, `/terms` | Legal pages | No |
| `/careers`, `/careers/:id` | Careers, CareerDetail | No |
| `/surveys` | Surveys | No |
| `/smartcart/prototype` | SmartCartPrototype | No |
| `*` | NotFound (404) | No |

**Utility pages** (not in the route table above): `Maintenance.tsx` — rendered by `MaintenanceGuard` when `settings/platform.maintenanceMode` is `true`.

### Merchant (`/merchant/*` — requires role `merchant`)
`/dashboard`, `/onboarding`, `/products`, `/orders`, `/flyers`, `/deals`, `/analytics`, `/marketing`, `/settings`, `/subscription`, `/notifications`

### Admin (`/admin/*` — requires role `admin` + MFA enrolled)
`/dashboard`, `/users`, `/stores`, `/catalog`, `/ads`, `/surveys`, `/careers`, `/audit-logs`, `/tools`, `/insights`, `/health`, `/flyer-ingestion`, `/settings`, `/mfa-setup`, `/notifications`

## LocalStorage Keys

Non-obvious keys used across the app:
| Key | Purpose |
|---|---|
| `page-has-been-force-refreshed` | `lazyWithRetry` guard — prevents reload loop on stale chunk error |
| `last_tracked_visit` | Date string (YYYY-MM-DD) — deduplicates daily visit analytics |
| `spendigo_cart_guest` | Guest cart (JSON) — merged into Firestore on login |
| `spendigo_comparison_guest` | Guest comparison list (JSON) — merged into Firestore on login |
| `smartcart_selections_v1` | SmartCart store selections — persists across logout |
| `spendigo_theme` | Active theme ID (`default` \| `theme-night` \| `theme-eco` \| `theme-deal`) — read by `initTheme()` in `main.tsx` before React mounts to prevent FOUC |

## Troubleshooting

**Port 443 in use**: `sudo lsof -ti:443 | xargs sudo kill -9` then restart `npm run dev`.

**SSL cert not trusted**: Dev server uses self-signed cert via `@vitejs/plugin-basic-ssl`. On macOS, trust it: `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain apps/web/.certs/cert.pem`.

**"Cannot find module" errors**: `rm -rf node_modules package-lock.json && npm install`.
