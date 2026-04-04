# Production Readiness — Remaining Tasks

These items require external accounts, assets, or infrastructure decisions that can't be automated.

---

## 1. Favicon & App Icons (❌ PENDING)

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

## 2. Error Tracking — Sentry (✅ COMPLETED)
- The `@sentry/react` SDK has been installed and integrated into `apps/web/src/main.tsx`.
- CSP headers have been updated to allow Sentry ingestion endpoints.

---

## 3. Per-page SEO Meta Tags — `react-helmet-async` (✅ COMPLETED)
- `react-helmet-async` has been installed.
- Custom `<SEO />` component has been created.
- Integrated into all major consumer, merchant, and admin routes. 
- Transactions and admin portals correctly use `noIndex`.

---

## 4. Staging Environment (❌ PENDING)

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
2. Request creation of `.github/workflows/staging.yml` to auto-deploy on push to `staging`

### Option B — Separate Firebase Project (full isolation)
- Completely separate Firestore, Auth, Functions, Storage
- Better for testing data migrations or destructive changes

**Steps:**
1. Create a new Firebase project (e.g. `spendigo-staging`) at https://console.firebase.google.com
2. Run `firebase use --add` to link it locally
3. Add all the same GitHub Secrets with a `_STAGING` suffix
4. Request creation of `staging.yml` workflow using those secrets

---

## 5. `users-export.json` — Verify & Clean (✅ COMPLETED)
- The local export file has been successfully deleted from disk.

---

## 6. GitHub Secrets Checklist (⚠️ PENDING VERIFICATION)

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
| `VITE_GEMINI_API_KEY` | Google AI Studio → API Keys |
| `FIREBASE_SERVICE_ACCOUNT_SPENDIGO_8540C` | Firebase Console → Project Settings → Service accounts |
| `VITE_SENTRY_DSN` | Sentry project settings |
