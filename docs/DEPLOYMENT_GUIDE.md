# Spendigo Production Deployment Guide

**Last Updated**: 2026-05-01
**Platform**: Firebase Full-Stack (Hosting + Functions + Firestore)
**CI/CD**: GitHub Actions (main.yml)
**Status**: Production v1.0

---

## 1. CI/CD Pipeline (Automated)
The primary deployment method is the automated GitHub Actions pipeline.

### Workflow:
1. **Trigger**: Any push or merge to the `main` branch.
2. **Build**: Compiles the `apps/web` React bundle with production environment variables (Node.js v22).
3. **Validate**: Runs unit and integration tests (`npm test`).
4. **Deploy (Hosting)**: Deploys the static assets to the `live` channel.
5. **Deploy (Backend)**: Simultaneously deploys Cloud Functions, Firestore Security Rules, Indexes, and Storage Rules.

**Action**: `git push origin main`

---

## 2. Infrastructure Setup (First-Time)

### Google Cloud & Firebase
- **Project ID**: `spendigo-8540c`
- **Location**: `us-central1`
- **Service Account**: `FIREBASE_SERVICE_ACCOUNT_SPENDIGO_8540C` must be added to GitHub Secrets.

### Essential Security Secrets
All frontend and backend keys must be configured in **GitHub → Settings → Secrets & Variables → Actions**:
- `VITE_GEMINI_API_KEY`: API access for Smart Insights.
- `VITE_ALGOLIA_SEARCH_KEY`: Public key for proximity search.
- `VITE_SENTRY_DSN`: Error tracking ingestion.
- `VITE_FIREBASE_APP_CHECK_KEY`: reCAPTCHA Enterprise key for App Check protection.
- `VITE_STRIPE_PUBLISHABLE_KEY`: Client-side token for Stripe Elements.
- `VITE_FIREBASE_VAPID_KEY`: Identification for Web Push Notifications.
- `STRIPE_SECRET_KEY`: (In Cloud Functions Secrets Manager).

---

## 3. Manual Deployment (Break-Glass Only)
In cases where the CI/CD pipeline fails, use the following commands from the root:

```bash
# 1. Login & Project Selection
firebase login
firebase use spendigo-8540c

# 2. Build Web App
npm run build

# 3. Full Deployment
firebase deploy
```

*Note: Individual deployments can be targeted using `--only functions`, `--only firestore`, etc.*

---

## 4. Post-Deployment Verification

### 4.1 System Smoke Tests
1. **SSL Verification**: Confirm `https://spendigo.ca` is serving over HTTPS with valid certificates.
2. **Search Connectivity**: Run a search for "Milk" to verify the Algolia v5 connection.
3. **Auth Flow**: Perform a test login to verify Firestore connection and RBAC rules.
4. **App Check**: Confirm that requests from non-whitelisted domains or unauthorized clients are blocked.
5. **Push Notifications**: Verify the "Notifications" panel correctly requests permission and registers the VAPID token.
6. **Audit Logs**: Verify that the deployment action or post-deploy smoke test is visible in the **Forensic Audit Dashboard**.

### 4.2 Webhook Reconciliation
Ensure the **Stripe Webhook Secret** (`whsec_...`) in the Stripe Dashboard matches the Secret stored in Google Cloud Secret Manager for the `stripeWebhook` function.

---

## 5. Rollback Procedure
If a production issue is detected:
1. **Hosting**: Use the Firebase Console to "Rollback" to a previous version (instant).
2. **Backend**: Revert the `main` branch in Git and allow the CI/CD pipeline to re-deploy.
3. **Database**: Point-in-time recovery is available via Firestore scheduled backups (Growth/Premium plans only).
