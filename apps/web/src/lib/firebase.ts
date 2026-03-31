import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getAnalytics } from 'firebase/analytics';
import { getMessaging } from 'firebase/messaging';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

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

// Initialize App Check (Production only to avoid local dev blocking)
if (typeof window !== 'undefined' && !import.meta.env.DEV) {
    // Only initialize if we have a key
    if (import.meta.env.VITE_FIREBASE_APP_CHECK_KEY) {
        initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider(import.meta.env.VITE_FIREBASE_APP_CHECK_KEY),
            isTokenAutoRefreshEnabled: true
        });
    } else {
        console.warn("App Check key is missing in production environment.");
    }
}

// Export Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Connect to Emulator in Development
if (import.meta.env.DEV) {
    connectFunctionsEmulator(functions, 'localhost', 5001);
}

export default app;
