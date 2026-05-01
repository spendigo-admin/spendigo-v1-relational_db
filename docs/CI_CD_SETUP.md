# GitHub Actions CI/CD Setup Guide

**Last Updated**: 2026-05-01
**Status**: Production-Ready (v1.0)
**Pipeline**: `.github/workflows/main.yml`

---

## 1. Overview
Spendigo utilizes a robust **Continuous Integration and Continuous Deployment (CI/CD)** pipeline to ensure that every change to the `main` branch is validated and safely promoted to production. The pipeline can also be triggered manually via the **GitHub Actions** interface (`workflow_dispatch`).

### Managed Operations:
- **Automated Validation**: Runs unit and integration tests (`npm test`) on every push.
- **Vite Build**: Compiles the React monorepo with production-scoped environment variables.
- **Full-Stack Deployment**: Orchestrates the simultaneous update of **Hosting**, **Cloud Functions**, **Firestore Rules/Indexes**, and **Storage Rules**.

---

## 2. Infrastructure Configuration (GitHub Secrets)
To enable the pipeline, the following secrets must be configured in **GitHub → Settings → Secrets & Variables → Actions**:

### 2.1 Security & Access
- `FIREBASE_SERVICE_ACCOUNT_SPENDIGO_8540C`: The JSON key file from the Google Cloud Console.
- `GITHUB_TOKEN`: Automatically provided by GitHub for repository tracking.

### 2.2 Framework Environment (Vite)
These are injected into the build process to configure the production client:
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`
- `VITE_ALGOLIA_APP_ID`, `VITE_ALGOLIA_SEARCH_KEY`, `VITE_ALGOLIA_INDEX_NAME`
- `VITE_GEMINI_API_KEY`: For real-time shopping insights.
- `VITE_SENTRY_DSN`: For production error monitoring.
- `VITE_STRIPE_PUBLISHABLE_KEY`: For merchant subscriptions and checkouts.
- `VITE_FIREBASE_APP_CHECK_KEY`: reCAPTCHA Enterprise key for platform security.
- `VITE_FIREBASE_VAPID_KEY`: Web Push notification identity key.


---

## 3. Workflow Logic (`main.yml`)
The pipeline follows a strict execution order to prevent broken releases:

1. **Checkout**: Pulls the latest code from `main`.
2. **Environment Setup**: Provisions **Node.js v22** and caches `node_modules` for faster builds. (Uses `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` for internal action compatibility).
3. **Dependency Sync**: Uses `npm ci` to ensure an exact replica of the `package-lock.json` environment.
4. **Build & Test**:
   ```bash
   npm run build  # Builds the turbo monorepo
   npm test       # Must pass 100% to proceed
   ```
5. **Live Promotion**:
   - Deploys static assets to **Firebase Hosting**.
   - Deploys server-side logic to **Cloud Functions**.
   - Applies security governance to **Firestore** and **Storage**.

---

## 4. Troubleshooting Support

### Action Failures
- **Testing**: If `npm test` fails, the deployment is aborted. Check the log for specific test failures (v1.0 requires 100% pass rate).
- **Env Mismatch**: If some features (like Search or AI) fail in production but work locally, verify that the corresponding `VITE_*` secret is present in GitHub.

### Rollback Strategy
If a deployment introduced a critical bug:
1. Revert the commit in Git: `git revert HEAD && git push origin main`.
2. The CI/CD pipeline will automatically re-deploy the previous stable version.

---

## 5. Operations & Costs
- **Duration**: Average build/test/deploy cycle takes ~4-6 minutes.
- **Limits**: GitHub Actions provides ample free-tier minutes for the Spendigo development scale.
- **Monitoring**: Real-time progress is visible in the **GitHub Actions Tab**.
