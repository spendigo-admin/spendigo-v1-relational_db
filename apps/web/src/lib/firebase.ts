import { initializeApp } from 'firebase/app';
import { initializeAuth, indexedDBLocalPersistence, browserPopupRedirectResolver } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getAnalytics } from 'firebase/analytics';
import { getMessaging } from 'firebase/messaging';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { Capacitor } from '@capacitor/core';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize App Check (production web only — ReCaptchaEnterprise throws in Capacitor WKWebView)
if (typeof window !== 'undefined' && !import.meta.env.DEV && !Capacitor.isNativePlatform()) {
    if (!import.meta.env.VITE_FIREBASE_APP_CHECK_KEY) {
        throw new Error('[Spendigo] VITE_FIREBASE_APP_CHECK_KEY is required in production. Set it in apps/web/.env.local.');
    }
    initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_FIREBASE_APP_CHECK_KEY),
        isTokenAutoRefreshEnabled: true
    });
}

// Export Services
// initializeAuth with indexedDBLocalPersistence bypasses the __/auth/iframe handshake
// that hangs in Capacitor WKWebView when capacitor://localhost isn't an authorized domain.
// browserPopupRedirectResolver is required for signInWithPopup on web; omitted on native
// because WKWebView has no popup support and GoogleAuth plugin bypasses it entirely.
export const auth = Capacitor.isNativePlatform()
    ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
    : initializeAuth(app, { persistence: indexedDBLocalPersistence, popupRedirectResolver: browserPopupRedirectResolver });
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// getMessaging requires navigator.serviceWorker (unavailable in WKWebView)
// getAnalytics uses document.cookie APIs that also behave oddly in WKWebView
export const messaging = (typeof window !== 'undefined' && !Capacitor.isNativePlatform()) ? getMessaging(app) : null;
export const analytics = (typeof window !== 'undefined' && !Capacitor.isNativePlatform()) ? getAnalytics(app) : null;

// Connect to Emulator in Development
if (import.meta.env.DEV) {
    connectFunctionsEmulator(functions, 'localhost', 5001);
}

export default app;
