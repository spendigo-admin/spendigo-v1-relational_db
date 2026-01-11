# Spendigo Production Deployment Guide

**Date**: 2026-01-11
**Target**: Firebase Hosting + Cloud Functions
**Domain**: Custom GoDaddy Domain (spendigo.ca)
**Stripe Mode**: Test (Sandbox)
**Status**: Active Production Deployment

---

## 🚀 Recommended Deployment (Auto-Deploy)

We strongly recommend using the **CI/CD Pipeline** for all deployments to ensure consistency.

### Method: Push to `main`
Any code pushed to the `main` branch is automatically built and deployed to Firebase Hosting.

```bash
git add .
git commit -m "feat: new production release"
git push origin main
```

*See `docs/CI_CD_SETUP.md` for pipeline details and troubleshooting.*

---

## 🛠️ Manual Deployment (Fallback)

Use this method for initial setup, troubleshooting, or deploying specific backend services (Rules/Functions) that are not fully automated in the basic pipeline.

### Phase 1: Pre-Deployment Checklist ✅

1. **Verify Project**:
   ```bash
   firebase use spendigo-8540c
   ```

2. **Check Config**:
   ```bash
   firebase functions:config:get
   ```
   *Should list Stripe keys and webhook secrets.*

### Phase 2: Deploy Backend Services

Deploy functions and security rules first:

```bash
# 1. Deploy Cloud Functions (Stripe Webhooks, etc.)
firebase deploy --only functions

# 2. Deploy Firestore Security Rules & Indexes
firebase deploy --only firestore
```

### Phase 3: Deploy Frontend (Hosting)

```bash
# 1. Build the production React bundle
npm run build

# 2. Deploy to Firebase Hosting
firebase deploy --only hosting
```

**Hosting URL**: `https://spendigo.ca` (or `https://spendigo-8540c.web.app`)

---

## 🔧 Post-Deployment Verification

### 1. Verify Domain
Visit `https://spendigo.ca`.
- ✅ SSL Lock icon is present.
- ✅ Site loads without console errors.

### 2. Verify Stripe Webhooks
If you re-deployed functions, ensure the Webhook Secret matches:
- **Stripe Dashboard**: Developers > Webhooks > `https://.../stripeWebhook` > Signing Secret (`whsec_...`)
- **Firebase Config**:
  ```bash
  firebase functions:config:set stripe.webhook_secret="whsec_..."
  firebase functions:config:get
  ```

### 3. Verify Mobile Assets
If updating the mobile app wrapper:
- Follow `docs/MOBILE_DEPLOYMENT.md` to sync changes to Android/iOS projects.

---

## 🆘 Troubleshooting

### "Permission Denied"
- Ensure you are logged in: `firebase login`
- Check project permissions in Firebase Console.

### "Build Failed"
- Run `npm run build` locally to see TypeScript errors.
- Fix errors before attempting deploy.

### Site cached / Old version?
- Hard refresh (`Cmd+Shift+R`).
- Check `firebase.json` cache headers.

---

**Prepared By**: Shahbaz + AI Development Team
**Last Updated**: 2026-01-11
