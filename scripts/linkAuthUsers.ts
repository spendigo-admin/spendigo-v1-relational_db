/**
 * Link existing Auth users to Firestore user documents
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../apps/web/.env.local') });

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const PASSWORD = 'Spendigo123!';

const USERS = [
    { email: 'admin@spendigo.ca', name: 'Platform Admin', role: 'admin', adminRole: 'SUPER_ADMIN' },
    { email: 'freshmart.owner@spendigo.ca', name: 'FreshMart Owner', role: 'merchant', merchantRole: 'OWNER', storeId: '1' },
    { email: 'freshmart.manager@spendigo.ca', name: 'FreshMart Manager', role: 'merchant', merchantRole: 'MANAGER', storeId: '1' },
    { email: 'freshmart.staff@spendigo.ca', name: 'FreshMart Staff', role: 'merchant', merchantRole: 'STAFF', storeId: '1' },
    { email: 'quickpick.owner@spendigo.ca', name: 'QuickPick Owner', role: 'merchant', merchantRole: 'OWNER', storeId: '2' },
    { email: 'metro.owner@spendigo.ca', name: 'Metro Owner', role: 'merchant', merchantRole: 'OWNER', storeId: '3' },
    { email: 'shopper@example.com', name: 'John Shopper', role: 'consumer' },
    { email: 'family@spendigo.ca', name: 'Family Account', role: 'consumer' },
    { email: 'student@spendigo.ca', name: 'Student User', role: 'consumer' },
    { email: 'chef@spendigo.ca', name: 'Chef User', role: 'consumer' },
    { email: 'al_sb@outpacexct.com', name: 'Shahbaz', role: 'consumer' },
];

async function linkUsers() {
    console.log('🔗 Linking Auth users to Firestore...\n');

    for (const userData of USERS) {
        try {
            // Sign in to get UID
            const userCredential = await signInWithEmailAndPassword(auth, userData.email, PASSWORD);
            const uid = userCredential.user.uid;

            // Create Firestore document
            await setDoc(doc(db, 'users', uid), {
                ...userData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            console.log(`✅ ${userData.email} → ${uid}`);
        } catch (error: any) {
            console.error(`❌ ${userData.email}: ${error.message}`);
        }
    }

    console.log('\n✅ All users linked!');
    process.exit(0);
}

linkUsers();
