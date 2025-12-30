# Spendigo Production Deployment Guide

**Date**: 2025-12-30  
**Target**: Firebase Hosting + Cloud Functions  
**Domain**: Custom GoDaddy Domain  
**Stripe Mode**: Test (Sandbox)
**Status**: Active Production Deployment

---

## Phase 1: Pre-Deployment Checklist ✅

### 1.1 Verify Your Firebase Project
```bash
cd /Users/shahbaz/Documents/Spendigo
firebase use
```

**Expected Output**: Should show `spendigo-8540c` (or similar)

**If you see an error**, initialize the project:
```bash
firebase use --add
# Select your Firebase project from the list
# Choose alias: production
```

### 1.2 Check Current Configuration
```bash
firebase functions:config:get
```

**Verify these keys exist:**
- `stripe.secret_key` (starts with `sk_test_...`)
- `stripe.price_core` (starts with `price_...`)
- `stripe.price_growth` (starts with `price_...`)
- `stripe.webhook_secret` (we'll update this in Step 2.2)

---

## Phase 2: Stripe Webhook Setup (Production) 🔐

### 2.1 Create Webhook Endpoint in Stripe Dashboard

1. **Go to Stripe Dashboard** (Test Mode):
   - URL: https://dashboard.stripe.com/test/webhooks

2. **Click "Add endpoint"**

3. **Configure the endpoint:**
   - **Endpoint URL**: `https://us-central1-spendigo-8540c.cloudfunctions.net/stripeWebhook`
   - **Description**: "Spendigo Production Webhook (Test Mode)"
   - **Events to send**:
     - `checkout.session.completed`
     - `customer.subscription.deleted`
     - `invoice.payment_failed` (optional, for failed renewals)

4. **Click "Add endpoint"**

### 2.2 Update Firebase Config with Production Webhook Secret

After creating the webhook, Stripe will show you a **Signing secret** (starts with `whsec_...`).

**Copy that secret** and run:
```bash
firebase functions:config:set stripe.webhook_secret="whsec_PASTE_YOUR_PRODUCTION_SECRET_HERE"
```

**⚠️ IMPORTANT**: This is different from your local `whsec_...` secret. The production Cloud Function needs its own secret.

---

## Phase 3: Code Preparation 🛠️

### 3.1 Update Frontend URLs for Production

Open: `apps/web/src/pages/merchant/Subscription.tsx`

Find the success/cancel URLs (around line 60-61) and verify they say:
```typescript
success_url: `https://spendigo.ca/merchant/subscription?session_id={CHECKOUT_SESSION_ID}`,
cancel_url: `https://spendigo.ca/merchant/subscription`,
```

**If they say `https://spendigo.ca:446/` or `localhost`**, change them to `https://spendigo.ca/`.

### 3.2 Update Firebase Config (if needed)

Open: `apps/web/src/lib/firebase.ts`

Verify the `connectFunctionsEmulator` is **only called in development**:
```typescript
// Connect to emulators in development
if (import.meta.env.DEV) {
  connectFunctionsEmulator(functions, 'localhost', 5001);
}
```

This ensures production uses the real Cloud Functions URL.

---

## Phase 4: Build Production Bundle 🏗️

### 4.1 Clean Previous Builds
```bash
rm -rf apps/web/dist
```

### 4.2 Build the Application
```bash
npm run build
```

**Expected Output**: Should end with something like:
```
✓ built in 15s
dist/index.html                   x.xx kB
dist/assets/index-abc123.js     xxx.xx kB
```

**If you see errors**, stop here and share the error message.

### 4.3 Test the Build Locally (Optional)
```bash
cd apps/web
npx vite preview
```

Visit `http://localhost:4173` to verify the production build works.

Press `Ctrl+C` to stop the preview server.

---

## Phase 5: Deploy to Firebase 🚀

### 5.1 Deploy Cloud Functions First

**Why first?** Your website will call these functions, so they need to be live before the frontend.

```bash
firebase deploy --only functions
```

**Expected Output**:
```
✔  Deploy complete!

Functions:
  - createCheckoutSession: https://us-central1-...
  - stripeWebhook: https://us-central1-...
  - getPaymentHistory: https://us-central1-...
```

**⏱️ Duration**: 2-5 minutes (first deploy is slower)

### 5.2 Deploy Firestore Rules & Indexes

```bash
firebase deploy --only firestore
```

**Expected Output**:
```
✔  firestore: rules file firestore.rules compiled successfully
✔  firestore: deployed indexes in firestore.indexes.json successfully
```

### 5.3 Deploy the Website

```bash
firebase deploy --only hosting
```

**Expected Output**:
```
✔  Deploy complete!

Hosting URL: https://spendigo-8540c.web.app
```

### 5.4 Full Deployment (Alternative)

Or deploy everything at once:
```bash
firebase deploy
```

---

## Phase 6: Verify Deployment ✅

### 6.1 Test the Default Firebase URL

Open your browser and visit:
```
https://spendigo-8540c.web.app
```

(Replace `spendigo-8540c` with your actual project ID)

**What to check:**
- ✅ Website loads without errors
- ✅ Login/Signup works
- ✅ Products and stores are visible
- ✅ Shopping cart works
- ✅ Checkout redirects to Stripe

### 6.2 Test Stripe Payment Flow (End-to-End)

1. **Sign up** as a Merchant
2. Go to **Subscription** page
3. Click **Subscribe to Growth ($99)**
4. **Use Stripe Test Card**:
   - Card Number: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/34`)
   - CVC: Any 3 digits (e.g., `123`)
   - ZIP: Any 5 digits (e.g., `12345`)

5. **Verify**:
   - You're redirected back to the Subscription page
   - Your tier changes from "Starter" to "Growth" (may take 5-10 seconds)
   - Payment appears in the **Payment History** section

### 6.3 Check Firebase Logs

If something doesn't work:
```bash
firebase functions:log
```

Look for errors related to `stripeWebhook` or `createCheckoutSession`.

---

## Phase 7: Connect Your GoDaddy Domain 🌐

### 7.1 Add Custom Domain in Firebase Console

1. Go to: https://console.firebase.google.com/project/spendigo-8540c/hosting/sites
2. Click **"Add custom domain"**
3. Enter your domain: `spendigo.ca` (or `www.spendigo.ca`)
4. Click **"Continue"**

Firebase will give you DNS records to add.

### 7.2 Add DNS Records in GoDaddy

**Option A: Using Firebase's Default Setup (A Records)**

Firebase will show you 2 IP addresses. In GoDaddy:

1. Go to: https://dcc.godaddy.com/manage/spendigo.ca/dns
2. **Add an A record**:
   - **Name**: `@` (for root domain) or `www` (for www subdomain)
   - **Type**: `A`
   - **Value**: `[First IP from Firebase]`
   - **TTL**: 600 seconds
3. **Add another A record**:
   - **Name**: `@` or `www`
   - **Type**: `A`
   - **Value**: `[Second IP from Firebase]`
   - **TTL**: 600 seconds

**Option B: Using CNAME (if you're using www.spendigo.ca)**

If Firebase gives you a CNAME target:
1. **Add a CNAME record**:
   - **Name**: `www`
   - **Type**: `CNAME`
   - **Value**: `spendigo-8540c.web.app` (or the target Firebase provides)
   - **TTL**: 600 seconds

### 7.3 Verify Domain Ownership

Back in the Firebase Console, click **"Verify"**.

Firebase will check the DNS records.

**⏱️ This may take 5-60 minutes** depending on DNS propagation.

### 7.4 SSL Certificate Provisioning

Once verified, Firebase **automatically** provisions a free SSL certificate.

**Status**: You'll see "Pending" → "Connected" in the Firebase Console.

**⏱️ Duration**: 10-60 minutes

---

## Phase 8: Post-Deployment Configuration 🔧

### 8.1 Update Stripe Checkout URLs

If you deployed with a custom domain, update the Cloud Function:

Edit: `services/api/src/payments/createCheckoutSession.ts`

Change:
```typescript
success_url: `https://yourdomain.com/merchant/subscription?session_id={CHECKOUT_SESSION_ID}`,
cancel_url: `https://yourdomain.com/merchant/subscription`,
```

Then re-deploy functions:
```bash
firebase deploy --only functions
```

### 8.2 Update Firebase Auth Authorized Domains

1. Go to: https://console.firebase.google.com/project/spendigo-8540c/authentication/settings
2. Scroll to **"Authorized domains"**
3. Click **"Add domain"**
4. Add: `spendigo.ca`
5. Click **"Add"**

This allows users to sign in from your custom domain.

### 8.3 Test from Custom Domain

Once DNS propagates, visit:
```
https://spendigo.ca
```

Repeat the verification steps from Phase 6.

---

## Phase 9: Monitoring & Maintenance 📊

### 9.1 Check Firebase Hosting Metrics

- **URL**: https://console.firebase.google.com/project/spendigo-8540c/hosting
- **Metrics**: Requests, bandwidth, errors

### 9.2 Monitor Cloud Functions

```bash
# Live logs
firebase functions:log --only stripeWebhook

# Recent errors
firebase functions:log --only stripeWebhook --limit 100
```

### 9.3 Set Up Alerts (Optional)

1. Go to: https://console.firebase.google.com/project/spendigo-8540c/monitoring
2. Create alerts for:
   - High error rates
   - Function timeouts
   - Firestore quota exceeded

---

## Troubleshooting 🔧

### Issue: "Build failed" during `npm run build`

**Solution**: Check the terminal output for TypeScript errors. Run:
```bash
npm run build 2>&1 | tee build-log.txt
```

Share the contents of `build-log.txt`.

### Issue: Website shows blank page

**Check 1**: Open browser DevTools (F12) → Console tab. Look for errors.

**Check 2**: Verify the build output:
```bash
ls -la apps/web/dist/
```

Should contain `index.html` and an `assets/` folder.

**Check 3**: Check Firebase Hosting logs in the Console.

### Issue: Stripe webhook not firing

**Check 1**: Go to: https://dashboard.stripe.com/test/webhooks  
Click on your webhook → "Events" tab. You should see events with "Succeeded" status.

**Check 2**: View function logs:
```bash
firebase functions:log --only stripeWebhook --limit 50
```

Look for "Upgrading user..." messages.

**Check 3**: Verify the webhook secret matches:
```bash
firebase functions:config:get stripe.webhook_secret
```

### Issue: Domain not connecting

**Check 1**: Verify DNS propagation:
```bash
dig spendigo.ca
```

Should show Firebase's IP addresses.

**Check 2**: Wait 24-48 hours for full DNS propagation (rare, but possible).

**Check 3**: Try incognito mode or a different browser to bypass cache.

---

## Security Checklist (Before Public Launch) 🔒

- [ ] Review Firestore Security Rules (currently in dev mode)
- [ ] Remove `.runtimeconfig.json` from version control
- [ ] Set up Firebase App Check (bot protection)
- [ ] Enable Firebase Authentication Rate Limiting
- [ ] Add Sentry or error monitoring
- [ ] Review Firebase Usage Quotas
- [ ] Set up billing alerts in Firebase Console
- [ ] Update Privacy Policy with your deployed URL
- [ ] Test all user flows (Consumer, Merchant, Admin)

---

## Rollback Procedure (If Needed) ⏮️

If the deployment breaks something:

### Rollback Hosting
```bash
firebase hosting:channel:deploy staging
# Test on staging URL first
# Only then:
firebase hosting:channel:deploy live
```

### Rollback Functions
Firebase keeps the last 10 versions. In the Console:
1. Go to Functions → Select function → "Revisions" tab
2. Click "Rollback" on the previous working version

---

## Next Steps After Successful Deployment 🎯

1. **Invite Beta Testers**: Share your URL with 5-10 merchants
2. **Monitor for Errors**: Check logs daily for the first week
3. **Gather Feedback**: Use tools like Hotjar or Google Analytics
4. **Plan Stripe Live Mode**: When ready, repeat this process with live keys
5. **Implement Missing Features**: Refer to `docs/GAP_ANALYSIS.md`

---

**Prepared By**: Shahbaz + AI Development Team  
**Last Updated**: 2025-12-30  
**Status**: Deployed to Production

---

## Quick Reference Commands

```bash
# Check current project
firebase use

# View config
firebase functions:config:get

# Build production
npm run build

# Deploy everything
firebase deploy

# Deploy specific services
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore

# View logs
firebase functions:log
firebase hosting:channel:list

# Rollback
firebase hosting:channel:deploy previous
```

---

**Good luck with your deployment! 🚀**
