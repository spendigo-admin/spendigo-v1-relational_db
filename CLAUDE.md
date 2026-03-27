# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Spendigo SmartCart is a Canada-first Marketplace Facilitator connecting independent convenience stores with local consumers. Status: Beta (Feature Complete). Firebase serverless backend, React 18 SPA frontend, Capacitor mobile wrapper.

## Commands

### Development
```bash
npm install          # Install all workspace dependencies (Node 20+, npm 11.7.0)
npm run dev          # Start all apps (Turbo) — web runs at https://spendigo.ca:443
npm run build        # Production build (all packages via Turbo)
npm run lint         # ESLint across entire monorepo
npm test             # Run Vitest unit tests (root)
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
firebase deploy --only functions   # Deploy functions to production
firebase deploy                    # Deploy hosting + functions + Firestore rules
```

### Mobile (Capacitor)
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
- **`services/api/`** — Firebase Cloud Functions (Node 20, TypeScript). Entry point: `src/index.ts`.
- **`packages/shared/`** — Shared utilities (currently empty).

### Frontend (`apps/web/src/`)

**Role-based routing** in [App.tsx](apps/web/src/App.tsx): Three layout wrappers (`ConsumerLayout`, `MerchantLayout`, `AdminLayout`) enforce authentication at the layout level. `MerchantLayout` and `AdminLayout` do hard redirects if the user lacks the correct role. `MaintenanceGuard` (inline in App.tsx) blocks all traffic except admins and `/login`/`/admin` paths when `settings/platform.maintenanceMode` is `true` in Firestore.

**Context providers** (wrap order in App.tsx matters):
```
AuthProvider → MaintenanceGuard → NotificationProvider → MarketplaceProvider
  → CatalogProvider → ReviewProvider → CartProvider → WishlistProvider
  → OrderProvider → LocationProvider → ConfirmationProvider
```
- `AuthContext` — Firebase Auth + Firestore user profiles, RBAC permissions via `can(permission)`. User roles: `consumer | merchant | admin`. Merchant sub-roles: `OWNER | MANAGER | STAFF | MARKETING`.
- `MarketplaceContext` — Real-time `onSnapshot` of all `stores` collection (filters to `status === 'active'`).
- `CatalogContext` — Master product catalog.
- `CartContext` — Hybrid: localStorage for guests, Firestore `carts/{userId}` for authenticated users; merges guest cart on login.
- `LocationContext` — User location and FSA (Forward Sortation Area / postal prefix) management.
- `OrderContext`, `WishlistContext`, `NotificationContext`, `AuditContext`, `ReviewContext`, `ConfirmationContext`.

**Permission system** (`AuthContext.tsx`):
Merchant sub-roles grant specific permissions checked via `can(permission)` from `useAuth()`:
- **OWNER**: products:write, orders:read, orders:write, flyers:write, deals:write, settings:write, team:manage, delivery:manage, analytics:read
- **MANAGER**: same as OWNER except team:manage
- **STAFF**: orders:read, orders:write, delivery:manage
- **MARKETING**: flyers:write, deals:write, analytics:read

Admin sub-roles: SUPER_ADMIN (admin:all), MODERATOR (admin:users, admin:stores), SUPPORT (admin:users), AUDITOR (admin:audit). All permission gates are client-side; server-side enforcement is in `firestore.rules`.

**Key lib files:**
- [apps/web/src/lib/firebase.ts](apps/web/src/lib/firebase.ts) — Firebase SDK init; uses `VITE_` env vars; connects Functions emulator on `localhost:5001` in dev.
- [apps/web/src/lib/algolia.ts](apps/web/src/lib/algolia.ts) — Algolia search client (gracefully null if env vars missing). Index: `master_products`.
- [apps/web/src/utils/IntegrityUtils.ts](apps/web/src/utils/IntegrityUtils.ts) — Server-side price validation to detect order tampering.
- [apps/web/src/utils/fuzzy-search.ts](apps/web/src/utils/fuzzy-search.ts) — Levenshtein + token overlap + brand boost, 4 match tiers (exact/partial/fuzzy/typo), 1-min cache. Used in SmartCart wishlist matching (score ≥ 65 threshold).
- [apps/web/src/hooks/useSmartInsights.ts](apps/web/src/hooks/useSmartInsights.ts) — Gemini `gemini-2.5-flash` integration via `@google/generative-ai`. Debounces 1.5 s, generates 2–3 shopping insight strings from basket summary. Requires `VITE_GEMINI_API_KEY`.

### SmartCart Module (`apps/web/src/smartcart/`)

Cross-store price comparison and basket optimization (12 files). Pipeline: build price matrix → normalize unit prices → compare across stores → simulate single-store costs → analyze trip consolidation → select optimal allocation. Entry points: `optimizeCart.ts` (main) and `smartcart_optimizer.ts` (orchestrator).

The backend mirror lives in `services/api/src/smartcart/` (Cloud Function endpoint `/smartcartOptimize`). A separate `services/api/src/cart/optimizeCart.ts` exposes an additional `/cartOptimize` endpoint using the same service layer.

### Backend (`services/api/src/`)

Firebase Cloud Functions v4 (v1 API). Organized by domain:
- `payments/` — Stripe checkout session creation, webhook handler, subscription updates
- `orders/` — `placeOrder`, `cancelOrder`
- `auth/` — Team member invite/delete/remove
- `admin/` — Cleanup utilities
- `email/` — Order confirmation emails
- `triggers/` — Firestore-triggered functions (`userTriggers`)
- `smartcart/` — Cart optimization HTTP endpoint (`/smartcartOptimize`) mirroring frontend logic
- `cart/` — Additional `/cartOptimize` HTTP endpoint (delegates to smartcart service layer)
- `models/` — Shared TypeScript interfaces: `MasterProductRecord`, `StoreRecord`, `MerchantProductRecord`

**Note:** `services/functions/` and `services/smartcart_optimizer/` are legacy/experimental — all active Cloud Functions are in `services/api/`.

Stripe webhook secret stored in Firebase Runtime Config: `stripe.webhook_secret`. Local testing uses `services/api/.runtimeconfig.json`.

### Firebase / Infrastructure

- **Firestore rules**: `firestore.rules` at repo root. RBAC enforced server-side: consumers, merchants (by `storeId`), and admins have separate access patterns.
- **Hosting**: `apps/web/dist/` deployed to Firebase Hosting with SPA rewrite.
- **Dev SSL**: Self-signed cert via `@vitejs/plugin-basic-ssl` stored in `apps/web/.certs/`. Dev server binds to `spendigo.ca:443` (requires `/etc/hosts` entry).

### Firestore Collections

`/users`, `/stores`, `/orders`, `/catalog`, `/master_products`, `/pending_master_products`, `/merchant_products`, `/product_creation_requests`, `/categories`, `/substitution_groups`, `/reviews`, `/audit_logs`, `/carts`, `/notifications`, `/settings` (platform config).

**Key Firestore write restrictions** (enforced in rules):
- **Orders**: Created server-side only via Admin SDK (Cloud Functions). Clients cannot create orders directly.
- **Users**: `role`, `adminRole`, `merchantRole`, `storeId` are admin-only fields. Self-registration only sets `consumer` or `merchant` role.
- **Stores**: Merchants cannot change `subscriptionTier`, `status`, Stripe config, or `ownerId`.
- **Master products**: Merchants can create; admins approve and can modify. Merchants submit via `pending_master_products/` + `product_creation_requests/`.
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
- Default `/**` — Deny all.

### Merchant Subscription Tiers

Three tiers — **Free**, **Core**, **Growth** — managed via Stripe. `updateSubscriptionPlan` Cloud Function updates Firestore on webhook receipt. Tier determines feature access in `MerchantLayout`.

### Vite Code Splitting

`vite.config.ts` splits vendor chunks: `vendor-react`, `vendor-firebase`, `vendor-algolia`, `vendor-stripe`, `vendor-ai`. All page routes are lazy-loaded (except auth pages). Production build strips `console` and `debugger` via esbuild.

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
VITE_GEMINI_API_KEY=       # Gemini API key for SmartInsights feature
```

## Testing

Tests live in `tests/unit/` and use **Vitest**. Run from repo root with `npm test`. Tests currently focus on:
- **SmartCart module** (11 test files): optimizer, comparison engine, price matrix, unit price normalizer, trip consolidation, single-store simulator, price normalization.
- **FraudEngine**: `fraud.test.ts`
- **Tax calculations**: `tax.test.ts`
- **Fuzzy search**: `fuzzy-search.test.ts`

## CI/CD

GitHub Actions (`.github/workflows/main.yml`) runs on push to `main` or manual dispatch:
1. Install (`npm ci`) → Build (with env secrets) → Test (`npm test`)
2. Deploy hosting via `FirebaseExtended/action-hosting-deploy` to live channel
3. Deploy functions + Firestore rules + storage rules via `w9jds/firebase-action`

Firebase project: `spendigo-8540c`. Service account secret: `FIREBASE_SERVICE_ACCOUNT_SPENDIGO_8540C`.

## Data Seeding

Seed scripts in `scripts/`: `seedFirebase.ts` (full database), `seedMasterCatalog.ts` (product catalog), `seedCatalog.ts` (categories). Run with `tsx scripts/<file>.ts`. Requires `service-account.json` in `scripts/`. See `scripts/README.md` for Firebase migration setup.

## Troubleshooting

**Port 443 in use**: `sudo lsof -ti:443 | xargs sudo kill -9` then restart `npm run dev`.

**SSL cert not trusted**: Dev server uses self-signed cert via `@vitejs/plugin-basic-ssl`. On macOS, trust it: `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain apps/web/.certs/cert.pem`.

**"Cannot find module" errors**: `rm -rf node_modules package-lock.json && npm install`.
