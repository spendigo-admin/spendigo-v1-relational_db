import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../apps/web/.env.local') });

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

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
const STORE_ID = '5'; // Mac's Corner from seedFirebase.ts

async function fixMacsCorner() {
    console.log('🔧 Fixing Mac\'s Corner Users...\n');

    // 0. Ensure Store Exists
    const storeRef = doc(db, 'stores', STORE_ID);
    const storeDoc = await getDoc(storeRef);
    if (!storeDoc.exists()) {
        console.log('⚠️  Store "5" does not exist. Creating it...');
        await setDoc(storeRef, {
            id: STORE_ID,
            name: "Mac's Corner",
            status: 'active',
            merchantEmail: 'macs.owner@spendigo.ca', // Default to one
            createdAt: new Date().toISOString()
        });
    } else {
        console.log('✅ Store "Mac\'s Corner" (5) exists.');
    }

    const targets = [
        { email: 'macs.owner@spendigo.ca', name: 'Macs Owner' },
        { email: 'macscorner.owner@spendigo.ca', name: 'MacsCorner Owner' }
    ];

    for (const target of targets) {
        try {
            console.log(`Processing ${target.email}...`);
            // 1. Get UID (Sign in)
            let uid;
            try {
                const cred = await signInWithEmailAndPassword(auth, target.email, PASSWORD);
                uid = cred.user.uid;
            } catch (e: any) {
                console.error(`   ❌ Could not sign in (User might not exist in Auth): ${e.message}`);
                continue;
            }

            // 2. Update Firestore Doc
            const userRef = doc(db, 'users', uid);
            await setDoc(userRef, {
                email: target.email,
                name: target.name,
                role: 'merchant',
                merchantRole: 'OWNER',
                storeId: STORE_ID,
                status: 'active',
                updatedAt: new Date().toISOString()
            }, { merge: true });

            console.log(`   ✅ Configured as OWNER for Store ${STORE_ID}`);

        } catch (error: any) {
            console.error(`   ❌ Error: ${error.message}`);
        }
    }

    console.log('\n✅ Fix Complete. Both users should now see the same dashboard.\n');
    process.exit(0);
}

fixMacsCorner();
