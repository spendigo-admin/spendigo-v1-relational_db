# Production Readiness — Remaining Tasks

These items require external accounts, assets, or infrastructure decisions that can't be automated.

---

## 1. Favicon & App Icons

**Files needed in `apps/web/public/`:**

| File | Size | Used by |
|------|------|---------|
| `favicon-32x32.png` | 32×32 | Browser tab |
| `favicon-16x16.png` | 16×16 | Browser tab (small) |
| `apple-touch-icon.png` | 180×180 | iOS home screen |
| `icon-192x192.png` | 192×192 | PWA / Android |
| `icon-512x512.png` | 512×512 | PWA splash screen |
| `og-image.png` | 1200×630 | Social share preview (Twitter, Facebook, iMessage) |

**Steps:**
1. Go to https://realfavicongenerator.net
2. Upload your logo
3. Download the package and copy the PNG files into `apps/web/public/`
4. The `index.html` and `manifest.webmanifest` already reference these exact filenames — no code changes needed

---

## 2. Error Tracking — Sentry

**Steps:**
1. Create a free account at https://sentry.io
2. Create a new project → select **React**
3. Copy the DSN (looks like `https://abc123@o456.ingest.sentry.io/789`)
4. Add to `apps/web/.env.local`:
   ```
   VITE_SENTRY_DSN=https://...@....ingest.sentry.io/...
   ```
5. Add the secret to GitHub → repo Settings → Secrets → `VITE_SENTRY_DSN`
6. Add to `.github/workflows/main.yml` build env block:
   ```yaml
   VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}
   ```
7. Install the SDK:
   ```bash
   cd apps/web && npm install @sentry/react
   ```
8. Ask Claude to wire up the integration in `apps/web/src/main.tsx` — ~5 lines

---

## 3. Per-page SEO Meta Tags — `react-helmet-async`

**Steps:**
1. Install:
   ```bash
   cd apps/web && npm install react-helmet-async
   ```
2. Wrap the app in `apps/web/src/main.tsx`:
   ```tsx
   import { HelmetProvider } from 'react-helmet-async';
   // wrap <App /> with <HelmetProvider>
   ```
3. Add per-page meta to these priority pages:

   ```tsx
   import { Helmet } from 'react-helmet-async';

   // Inside the component JSX:
   <Helmet>
     <title>Page Title — Spendigo</title>
     <meta name="description" content="..." />
   </Helmet>
   ```

   **Priority pages:**
   - `apps/web/src/pages/consumer/StoreList.tsx`
   - `apps/web/src/pages/consumer/StoreDetail.tsx`
   - `apps/web/src/pages/consumer/SmartCartWishlist.tsx`
   - `apps/web/src/pages/consumer/ProductDetail.tsx` (if it exists)

4. Ask Claude to implement all pages once the package is installed

---

## 4. Staging Environment

### Option A — Firebase Preview Channels (recommended, no new project)
- Deploys to a temporary URL like `spendigo-8540c--staging-abc123.web.app`
- Uses the same Firebase project (same Firestore/Auth)
- Good for UI/UX review before going live

**Steps:**
1. Create a `staging` branch in git:
   ```bash
   git checkout -b staging
   git push -u origin staging
   ```
2. Ask Claude to create `.github/workflows/staging.yml` — it will auto-deploy on push to `staging` branch

### Option B — Separate Firebase Project (full isolation)
- Completely separate Firestore, Auth, Functions, Storage
- Better for testing data migrations or destructive changes

**Steps:**
1. Create a new Firebase project (e.g. `spendigo-staging`) at https://console.firebase.google.com
2. Run `firebase use --add` to link it locally
3. Add all the same GitHub Secrets with a `_STAGING` suffix
4. Ask Claude to create a `staging.yml` workflow using those secrets

---

## 5. `users-export.json` — Verify & Clean

This file is in `.gitignore` so it won't be committed, but it exists on disk.

**Check if it contains real user data:**
```bash
head -20 /Users/I501801/Documents/Projects/Spendigo-Stable-v1/users-export.json
```

If it contains real emails, names, or UIDs of actual users:
```bash
rm /Users/I501801/Documents/Projects/Spendigo-Stable-v1/users-export.json
```

---

## 6. GitHub Secrets Checklist

Make sure all these secrets exist in your repo:
**GitHub → repo Settings → Secrets and variables → Actions**

| Secret | Where to get it |
|--------|----------------|
| `VITE_FIREBASE_API_KEY` | Firebase Console → Project Settings → Your apps |
| `VITE_FIREBASE_AUTH_DOMAIN` | same |
| `VITE_FIREBASE_PROJECT_ID` | same |
| `VITE_FIREBASE_STORAGE_BUCKET` | same |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | same |
| `VITE_FIREBASE_APP_ID` | same |
| `VITE_ALGOLIA_APP_ID` | Algolia Dashboard → Settings → API Keys |
| `VITE_ALGOLIA_SEARCH_KEY` | same |
| `VITE_ALGOLIA_INDEX_NAME` | `master_products` |
| `VITE_GEMINI_API_KEY` | Google AI Studio → API Keys (**newly required**) |
| `FIREBASE_SERVICE_ACCOUNT_SPENDIGO_8540C` | Firebase Console → Project Settings → Service accounts |
| `VITE_SENTRY_DSN` | Sentry project settings *(once created)* |
