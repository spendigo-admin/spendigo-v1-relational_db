/**
 * Fix Mac's Corner ownership by acting as an Admin User
 * This uses the Client SDK but authenticates as 'admin@spendigo.ca' to satisfy Firestore Rules.
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../apps/web/.env.local') });

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, updateDoc, deleteField, collection, query, where, getDocs } from 'firebase/firestore';

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

const ADMIN_EMAIL = 'admin@spendigo.ca';
const PASSWORD = 'Spendigo123!';
const STORE_ID = '5'; // Mac's Corner

async function findUserByEmail(email: string) {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        return null;
    }

    return snapshot.docs[0];
}

async function fixMacsCorner() {
    console.log('🔧 Fixing Mac\'s Corner Ownership (authenticated as Admin)...\n');

    try {
        // 1. Sign In as Admin
        console.log(`🔐 Signing in as ${ADMIN_EMAIL}...`);
        await signInWithEmailAndPassword(auth, ADMIN_EMAIL, PASSWORD);
        console.log('   ✅ Authenticated as Admin');

        // 2. Fix al_shahb@outlook.com
        console.log('\n📝 Promoting al_shahb@outlook.com to OWNER...');
        const shahbazDoc = await findUserByEmail('al_shahb@outlook.com');

        if (shahbazDoc) {
            await updateDoc(doc(db, 'users', shahbazDoc.id), {
                role: 'merchant',
                merchantRole: 'OWNER',
                storeId: STORE_ID,
                status: 'active',
                updatedAt: new Date().toISOString()
            });
            console.log('   ✅ Success: al_shahb@outlook.com is now an OWNER of Store 5');
        } else {
            console.log('   ❌ Error: User al_shahb@outlook.com not found in Firestore');
        }

        // 3. Fix macs.owner@spendigo.ca (Ensure it's also correct)
        console.log('\n📝 Verifying macs.owner@spendigo.ca...');
        const macsDoc = await findUserByEmail('macs.owner@spendigo.ca');
        if (macsDoc) {
            await updateDoc(doc(db, 'users', macsDoc.id), {
                role: 'merchant',
                merchantRole: 'OWNER',
                storeId: STORE_ID,
                status: 'active', // Ensure active
                updatedAt: new Date().toISOString()
            });
            console.log('   ✅ Success: macs.owner@spendigo.ca confirmed as OWNER of Store 5');
        } else {
            console.log('   ❌ Error: User macs.owner@spendigo.ca not found');
        }

        // 4. Remove macscorner.owner@spendigo.ca
        console.log('\n🧹 Cleaning up macscorner.owner@spendigo.ca...');
        const wrongDoc = await findUserByEmail('macscorner.owner@spendigo.ca');

        if (wrongDoc) {
            await updateDoc(doc(db, 'users', wrongDoc.id), {
                storeId: deleteField(),
                merchantRole: deleteField(),
                role: 'consumer'
            });
            console.log('   ✅ Success: Removed ownership from macscorner.owner@spendigo.ca');
        } else {
            console.log('   ℹ️  User macscorner.owner@spendigo.ca not found (already clean)');
        }

    } catch (error: any) {
        console.error('\n❌ FATAL ERROR:', error.message);
        if (error.code === 'permission-denied') {
            console.error('   Auth check failed. Does admin@spendigo.ca exist with "role": "admin"?');
        }
    }

    console.log('\n✅ Script Finished.\n');
    process.exit(0);
}

fixMacsCorner();
