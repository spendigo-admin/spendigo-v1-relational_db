import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../apps/web/.env.local') });

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, deleteField } from 'firebase/firestore';

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
const STORE_ID = '5'; // Mac's Corner

async function fixMacsCornerCorrectly() {
    console.log('🔧 Fixing Mac\'s Corner - CORRECT VERSION...\n');

    // 1. CORRECT OWNERS: macs.owner and al_shahb
    const correctOwners = [
        { email: 'macs.owner@spendigo.ca', name: 'Macs Owner' },
        { email: 'al_shahb@outlook.com', name: 'Shahbaz' }
    ];

    for (const owner of correctOwners) {
        try {
            console.log(`✅ Setting up ${owner.email} as OWNER of Mac's Corner...`);
            const cred = await signInWithEmailAndPassword(auth, owner.email, PASSWORD);
            const uid = cred.user.uid;

            await setDoc(doc(db, 'users', uid), {
                email: owner.email,
                name: owner.name,
                role: 'merchant',
                merchantRole: 'OWNER',
                storeId: STORE_ID,
                status: 'active',
                updatedAt: new Date().toISOString()
            }, { merge: true });

            console.log(`   ✅ ${owner.email} configured as OWNER for Store ${STORE_ID}`);
        } catch (error: any) {
            console.error(`   ❌ Error with ${owner.email}: ${error.message}`);
        }
    }

    // 2. REMOVE macscorner.owner from this store (it was a mistake)
    try {
        console.log('\n🧹 Removing macscorner.owner@spendigo.ca from Mac\'s Corner...');
        const wrongCred = await signInWithEmailAndPassword(auth, 'macscorner.owner@spendigo.ca', PASSWORD);
        const wrongUid = wrongCred.user.uid;

        await updateDoc(doc(db, 'users', wrongUid), {
            storeId: deleteField(),
            merchantRole: deleteField(),
            role: 'consumer'
        });
        console.log('   ✅ Removed macscorner.owner from the store');
    } catch (error: any) {
        console.log(`   ⚠️  Could not remove macscorner.owner (might not exist): ${error.message}`);
    }

    console.log('\n✅ Fix Complete! Mac\'s Corner now has the CORRECT two owners.');
    console.log('   👤 macs.owner@spendigo.ca');
    console.log('   👤 al_shahb@outlook.com\n');
    process.exit(0);
}

fixMacsCornerCorrectly();
