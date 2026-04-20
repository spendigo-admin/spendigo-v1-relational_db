# Production Readiness — Remaining Tasks

**Project Status**: Feature-Complete v1.0
**Next Milestone**: General Availability (GA)

---

## 1. Brand Assets & Icons (✅ COMPLETED)
- Favicons (16x16, 32x32), Apple Touch Icons, and SVG assets have been integrated into `apps/web/public/`.
- `manifest.webmanifest` is correctly configured for PWA installation.

---

## 2. Security & Compliance

### Forensic Audit Genesis (❌ PENDING)
- The first production log entry must be manually generated as the **Genesis Block** to initialize the SHA-256 hash chain.
- **Action**: Run `testLog()` in the Admin Dashboard once the production database is provisioned.

### Merchant KYB (Know Your Business) Verification (⚠️ IN PROGRESS)
- Automate the validation of uploaded business licenses.
- **Action**: Integrate a document storage trigger to notify admins when a new `PartnerWithUs` application is ready for compliance review.

---

## 3. Product Catalog Expansion (⚠️ IN PROGRESS)

### Master Catalog Baseline (❌ PENDING)
- The current catalog contains ~50 high-quality SKUs. For a viable launch, a baseline of 500+ verified items is recommended.
- **Action**: Use the "Pending Review" workflow to approve items submitted by pilot merchants.

### Open Food Facts Sync (✅ COMPLETED)
- Integration hooks for fetching external product data for unlisted barcodes are active.

---

## 4. Operational Assets

### Staging Environment (❌ PENDING)
- **Option A**: Setup Firebase Preview Channels for UI review.
- **Option B**: Provisions a separate `spendigo-staging` Firebase project for destructive data testing.

### Careers Portal Intake (❌ PENDING)
- Currently, the careers page allows viewing jobs, but the application submission flow (CV upload to Firebase Storage) needs final validation.

---

## 5. Mobile Synchronization (⚠️ IN PROGRESS)

### Logic Parity (❌ PENDING)
- Port the `SmartCart` algorithm refactor (including delivery fee weighting and dynamic trip analysis) from `apps/web` to `apps/mobile`.

---

## 6. GitHub Secrets Checklist (⚠️ PENDING VERIFICATION)

| Secret | Verified |
|--------|:---:|
| `VITE_FIREBASE_API_KEY` | ✅ |
| `VITE_FIREBASE_AUTH_DOMAIN` | ✅ |
| `VITE_ALGOLIA_APP_ID` | ✅ |
| `VITE_ALGOLIA_SEARCH_KEY` | ✅ |
| `VITE_GEMINI_API_KEY` | ✅ |
| `FIREBASE_SERVICE_ACCOUNT` | ✅ |
| `VITE_SENTRY_DSN` | ✅ |
