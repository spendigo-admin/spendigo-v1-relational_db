# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm install          # Install all workspace dependencies (Node 20+, npm 11.7.0)
npm run dev          # Start all apps (Turbo) — web runs at https://spendigo.ca:443
npm run build        # Production build (all packages via Turbo)
npm run lint         # ESLint across entire monorepo
npm test             # Run Vitest unit tests (root)
npm run stripe:listen  # Forward Stripe webhooks to local Firebase Functions emulator
```

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
- **`apps/mobile/`** — Capacitor wrapper (iOS/Android) — no logic of its own, wraps the web build.
- **`services/api/`** — Firebase Cloud Functions (Node 20, TypeScript). Entry point: `src/index.ts`.
- **`packages/shared/`** — Shared utilities (currently empty).

### Frontend (`apps/web/src/`)

**Role-based routing** in [App.tsx](apps/web/src/App.tsx): Three layout wrappers (`ConsumerLayout`, `MerchantLayout`, `AdminLayout`) enforce authentication at the layout level. `MerchantLayout` and `AdminLayout` do hard redirects if the user lacks the correct role. `MaintenanceGuard` (inline in App.tsx) blocks all traffic except admins and `/login`/`/admin` paths when `settings/platform.maintenanceMode` is `true` in Firestore.

**Context providers** (wrap order in App.tsx matters):
- `AuthContext` — Firebase Auth + Firestore user profiles, RBAC permissions via `can(permission)`. User roles: `consumer | merchant | admin`. Merchant sub-roles: `OWNER | MANAGER | STAFF | MARKETING`.
- `MarketplaceContext` — Real-time `onSnapshot` of all `stores` collection (filters to `status === 'active'`).
- `CatalogContext` — Master product catalog.
- `CartContext` — Hybrid: localStorage for guests, Firestore `carts/{userId}` for authenticated users; merges guest cart on login.
- `OrderContext`, `WishlistContext`, `NotificationContext`, `AuditContext`, `ReviewContext`, `ConfirmationContext`.

**Key lib files:**
- [apps/web/src/lib/firebase.ts](apps/web/src/lib/firebase.ts) — Firebase SDK init; uses `VITE_` env vars; connects Functions emulator on `localhost:5001` in dev.
- [apps/web/src/lib/algolia.ts](apps/web/src/lib/algolia.ts) — Algolia search client (gracefully null if env vars missing). Index: `master_products`.
- [apps/web/src/utils/IntegrityUtils.ts](apps/web/src/utils/IntegrityUtils.ts) — Server-side price validation to detect order tampering.

### Backend (`services/api/src/`)

Firebase Cloud Functions v4 (v1 API). Organized by domain:
- `payments/` — Stripe checkout session creation, webhook handler, subscription updates
- `orders/` — `placeOrder`, `cancelOrder`
- `auth/` — Team member invite/delete/remove
- `admin/` — Cleanup utilities
- `email/` — Order confirmation emails
- `triggers/` — Firestore-triggered functions (`userTriggers`)

Stripe webhook secret stored in Firebase Runtime Config: `stripe.webhook_secret`. Local testing uses `services/api/.runtimeconfig.json`.

### Firebase / Infrastructure

- **Firestore rules**: `firestore.rules` at repo root. RBAC enforced server-side: consumers, merchants (by `storeId`), and admins have separate access patterns.
- **Hosting**: `apps/web/dist/` deployed to Firebase Hosting with SPA rewrite.
- **Dev SSL**: Self-signed cert via `@vitejs/plugin-basic-ssl` stored in `apps/web/.certs/`. Dev server binds to `spendigo.ca:443` (requires `/etc/hosts` entry).

### Firestore Collections

`/users`, `/stores`, `/orders`, `/catalog`, `/master_products`, `/audit_logs`, `/carts`, `/notifications`, `/settings` (platform config).

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
```

## Testing

Tests live in `tests/unit/` and use **Vitest**. Current tests cover `FraudEngine` (in `services/api/src/risk/`) and fuzzy search utilities (`apps/web/src/utils/fuzzy-search.ts`). Run from repo root with `npm test`.
