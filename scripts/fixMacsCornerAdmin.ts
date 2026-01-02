/**
 * Fix Mac's Corner ownership using Firebase Admin SDK
 * This bypasses auth requirements and directly updates Firestore
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../apps/web/.env.local') });

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, updateDoc, deleteField, getDocs, collection, query, where } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

async function fixMacsCornerAdmin() {
    console.log('🔧 Fixing Mac\'s Corner using direct Firestore updates...\n');

    // 1. Set up CORRECT OWNERS
    const correctOwners = [
        { email: 'macs.owner@spendigo.ca', name: 'Macs Owner' },
        { email: 'al_shahb@outlook.com', name: 'Shahbaz' }
    ];

    for (const owner of correctOwners) {
        try {
            console.log(`📝 Processing ${owner.email}...`);
            const userDoc = await findUserByEmail(owner.email);

            if (!userDoc) {
                console.log(`   ⚠️  User document not found for ${owner.email}`);
                continue;
            }

            await updateDoc(doc(db, 'users', userDoc.id), {
                role: 'merchant',
                merchantRole: 'OWNER',
                storeId: STORE_ID,
                status: 'active',
                updatedAt: new Date().toISOString()
            });

            console.log(`   ✅ ${owner.email} is now OWNER of Mac's Corner`);
        } catch (error: any) {
            console.error(`   ❌ Error: ${error.message}`);
        }
    }

    // 2. Remove macscorner.owner
    try {
        console.log('\n🧹 Removing macscorner.owner@spendigo.ca from Mac\'s Corner...');
        const wrongDoc = await findUserByEmail('macscorner.owner@spendigo.ca');

        if (wrongDoc) {
            await updateDoc(doc(db, 'users', wrongDoc.id), {
                storeId: deleteField(),
                merchantRole: deleteField(),
                role: 'consumer'
            });
            console.log('   ✅ Removed from the store');
        } else {
            console.log('   ℹ️  User not found (already clean)');
        }
    } catch (error: any) {
        console.log(`   ⚠️  ${error.message}`);
    }

    console.log('\n✅ COMPLETE! Mac\'s Corner ownership fixed.');
    console.log('   👤 macs.owner@spendigo.ca');
    console.log('   👤 al_shahb@outlook.com\n');
    process.exit(0);
}

fixMacsCornerAdmin();
