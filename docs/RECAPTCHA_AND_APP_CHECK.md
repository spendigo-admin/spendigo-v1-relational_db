# Firebase App Check & reCAPTCHA Enterprise Setup

This document provides reference information and configuration instructions for **Firebase App Check** and **reCAPTCHA Enterprise** on the Spendigo platform.

---

## 📋 Overview

Spendigo protects its backend services (Firebase Cloud Functions, Firestore, and Cloud Storage) against abuse, billing fraud, and unauthorized bots using **Firebase App Check**. 

App Check certifies that incoming traffic actually originates from our official React Web app. Unverified requests are either blocked (e.g., in critical optimization endpoints) or logged as security alerts (e.g., in marketing campaigns).

### Protected Endpoints
1. **`cartOptimize`** / **`smartcartOptimize`** — REST HttpsonRequest Cloud Functions (rejects unverified requests with HTTP `401 Unauthorized`).
2. **`sendCampaign`** — Callable Https Cloud Function (logs warnings when App Check assertion fails).

---

## ⚙️ Key Configuration Details

* **reCAPTCHA Version**: **reCAPTCHA Enterprise** (Managed via Google Cloud Console / Firebase Console).
* **Site Key (Public)**: `6LeA4u0s...` (This is a reCAPTCHA Enterprise-specific key).
* **Environment Variable**: `VITE_FIREBASE_APP_CHECK_KEY` (configured on build environments / Vercel / GitHub Actions).

> [!IMPORTANT]
> **reCAPTCHA Enterprise vs. reCAPTCHA v3 (Classic)**:
> In the Firebase Web SDK, you **must** instantiate the App Check provider using `ReCaptchaEnterpriseProvider`. 
> Instantiating the provider using `ReCaptchaV3Provider` with an Enterprise key will cause the client token handshake to fail silently or result in `storage/unauthenticated` and HTTP `401` errors on the backend.

---

## 💻 Technical Implementation

### 1. Frontend Integration (`apps/web/src/lib/firebase.ts`)

App Check is initialized dynamically on the client, only when running in non-development environments, and strictly on web/desktop environments (excluding native Capacitor wrappers):

```typescript
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { app } from './firebase'; // initialized Firebase App instance
import { Capacitor } from '@capacitor/core';

if (typeof window !== 'undefined' && !import.meta.env.DEV && !Capacitor.isNativePlatform()) {
    if (import.meta.env.VITE_FIREBASE_APP_CHECK_KEY) {
        initializeAppCheck(app, {
            // Must use ReCaptchaEnterpriseProvider for key compatibility
            provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_FIREBASE_APP_CHECK_KEY),
            isTokenAutoRefreshEnabled: true // Refresh App Check tokens automatically in the background
        });
        console.info('[AppCheck] Initialized with reCAPTCHA Enterprise.');
    } else {
        console.warn('[AppCheck] Warning: VITE_FIREBASE_APP_CHECK_KEY missing. App Check is disabled.');
    }
}
```

### 2. Backend Cloud Functions Verification

#### HttpsonRequest REST Endpoints (`cartOptimize.ts` & `optimizeEndpoint.ts`)
REST requests do not pass through the Firebase SDK wrapper. We verify the `X-Firebase-AppCheck` header manually in the function body, bypassing it strictly in local emulator runs:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const cartOptimize = functions.https.onRequest(async (req, res) => {
    // 1. Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
    
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    // 2. Enforce App Check in non-emulator environments
    if (process.env.FUNCTIONS_EMULATOR !== 'true') {
        const appCheckToken = req.header('X-Firebase-AppCheck');
        if (!appCheckToken) {
            res.status(401).json({ error: 'App Check token required.' });
            return;
        }
        try {
            await admin.appCheck().verifyToken(appCheckToken);
        } catch (error) {
            res.status(401).json({ error: 'Invalid App Check token.' });
            return;
        }
    }
    
    // Proceed with business logic...
});
```

#### Callable Endpoints (`sendCampaign.ts`)
For `onCall` functions, the Firebase SDK automatically verifies the token and exposes the assertion result in `context.app`. 

```typescript
export const sendCampaign = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    
    // Warn if App Check is missing, but do not block (to prevent legacy client lockouts)
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        functions.logger.warn('[sendCampaign] App Check token missing — verify reCAPTCHA Enterprise config', { 
            uid: context.auth.uid 
        });
    }

    // Proceed with business logic...
});
```

---

## 🛠️ Configuration & Maintenance Steps

If you need to change reCAPTCHA credentials or register new domains:

### Step 1: Google Cloud reCAPTCHA Enterprise
1. Go to the **Google Cloud Console** under the active Spendigo project.
2. Search for **reCAPTCHA Enterprise**.
3. Create a new Key:
   - **Platform**: Website.
   - **Domain Verification**: Add your domain(s) (e.g., `spendigo.ca`, `spendigo-8540c.web.app`). Enable "Verify domains" to prevent key stealing.
4. Copy the generated **Site Key**.

### Step 2: Bind reCAPTCHA in Firebase Console
1. Open the **Firebase Console**.
2. Navigate to **App Check** > **Apps** tab.
3. Select your Web App and click **Register**.
4. Choose **reCAPTCHA Enterprise** and paste the **Site Key** copied in Step 1.
5. Set token time-to-live (TTL) as needed (default is 1 hour).
6. Save the settings.

### Step 3: Deploy Frontend Config
1. Update the environment variables in your deployment pipeline or local `.env.production` file:
   ```env
   VITE_FIREBASE_APP_CHECK_KEY=YOUR_RECAPTCHA_ENTERPRISE_SITE_KEY
   ```
2. Build and redeploy the frontend client:
   ```bash
   npm run build && firebase deploy --only hosting
   ```

---

## 🔍 Troubleshooting

### Error: `unauthorized` or `401 App Check token required`
* **Check local dev**: The emulator bypasses App Check validation if `process.env.FUNCTIONS_EMULATOR === 'true'`. Ensure you are running functions locally via the Firebase Emulator Suite.
* **Verify Site Key**: Ensure the site key configured in `VITE_FIREBASE_APP_CHECK_KEY` matches the public Enterprise Key registered in Google Cloud Console.
* **Provider Mismatch**: Ensure your code is using `new ReCaptchaEnterpriseProvider()` instead of `new ReCaptchaV3Provider()`.
* **Domain Whitelist**: Double check that the domain you are visiting is explicitly whitelisted in the reCAPTCHA Enterprise console. If testing on staging or custom domains, those domains must be registered.
