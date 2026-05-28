/**
 * Firebase Seed Script
 * 
 * Seeds a new Firebase instance with all necessary data:
 * - Users (admin, merchants, consumers)
 * - Stores (with products, flyers, team)
 * - Orders
 * - Platform settings
 * - Audit logs
 * 
 * Usage:
 * 1. Update apps/web/.env.local with new Firebase config
 * 2. Run: npx tsx scripts/seedFirebase.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from apps/web/.env.local
config({ path: resolve(__dirname, '../apps/web/.env.local') });

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, writeBatch } from 'firebase/firestore';

// Read Firebase config from .env.local
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

const PASSWORD = 'Spendigo123!'; // Default password for all test accounts

// ===== USER DATA =====
const USERS = [
    // Admin
    {
        email: 'admin@spendigo.ca',
        name: 'Platform Admin',
        role: 'admin',
        adminRole: 'SUPER_ADMIN',
    },

    // Merchants - FreshMart
    {
        email: 'freshmart.owner@spendigo.ca',
        name: 'FreshMart Owner',
        role: 'merchant',
        merchantRole: 'OWNER',
        storeId: '1',
    },
    {
        email: 'freshmart.manager@spendigo.ca',
        name: 'FreshMart Manager',
        role: 'merchant',
        merchantRole: 'MANAGER',
        storeId: '1',
    },
    {
        email: 'freshmart.staff@spendigo.ca',
        name: 'FreshMart Staff',
        role: 'merchant',
        merchantRole: 'STAFF',
        storeId: '1',
    },

    // Merchants - QuickPick
    {
        email: 'quickpick.owner@spendigo.ca',
        name: 'QuickPick Owner',
        role: 'merchant',
        merchantRole: 'OWNER',
        storeId: '2',
    },

    // Merchants - Metro
    {
        email: 'metro.owner@spendigo.ca',
        name: 'Metro Owner',
        role: 'merchant',
        merchantRole: 'OWNER',
        storeId: '3',
    },

    // Consumers
    {
        email: 'shopper@example.com',
        name: 'John Shopper',
        role: 'consumer',
    },
    {
        email: 'family@spendigo.ca',
        name: 'Family Account',
        role: 'consumer',
    },
    {
        email: 'student@spendigo.ca',
        name: 'Student User',
        role: 'consumer',
    },
    {
        email: 'chef@spendigo.ca',
        name: 'Chef User',
        role: 'consumer',
    },
    {
        email: 'al_sb@outpacexct.com',
        name: 'Shahbaz',
        role: 'consumer',
    },
];

// ===== STORE DATA =====
const STORES = [
    {
        id: '1',
        name: 'FreshMart',
        logo: '🥬',
        status: 'active',
        subscriptionTier: 'growth',
        rating: 4.8,
        team: [
            {
                id: 'owner-1',
                name: 'FreshMart Owner',
                email: 'freshmart.owner@spendigo.ca',
                role: 'OWNER',
                lastActive: 'Today',
            },
            {
                id: 'manager-1',
                name: 'FreshMart Manager',
                email: 'freshmart.manager@spendigo.ca',
                role: 'MANAGER',
                lastActive: 'Today',
            },
            {
                id: 'staff-1',
                name: 'FreshMart Staff',
                email: 'freshmart.staff@spendigo.ca',
                role: 'STAFF',
                lastActive: 'Yesterday',
            },
        ],
    },
    {
        id: '2',
        name: 'QuickPick',
        logo: '🏪',
        status: 'active',
        subscriptionTier: 'free',
        rating: 4.5,
        team: [
            {
                id: 'owner-2',
                name: 'QuickPick Owner',
                email: 'quickpick.owner@spendigo.ca',
                role: 'OWNER',
                lastActive: 'Today',
            },
        ],
    },
    {
        id: '3',
        name: 'Metro Express',
        logo: '🛒',
        status: 'active',
        subscriptionTier: 'core',
        rating: 4.6,
        team: [
            {
                id: 'owner-3',
                name: 'Metro Owner',
                email: 'metro.owner@spendigo.ca',
                role: 'OWNER',
                lastActive: 'Today',
            },
        ],
    },
    {
        id: '4',
        name: 'Costco Business',
        logo: '📦',
        status: 'active',
        subscriptionTier: 'growth',
        rating: 4.7,
        team: [],
    },
    {
        id: '5',
        name: "Mac's Corner",
        logo: '🏪',
        status: 'active',
        subscriptionTier: 'free',
        rating: 4.3,
        team: [],
    },
];

// ===== PLATFORM SETTINGS =====
const PLATFORM_SETTINGS = {
    maintenanceMode: false,
    maintenanceMessage: 'System maintenance in progress',
    maintenanceRequest: null,
};

// ===== SEED FUNCTIONS =====

async function createAuthUser(email: string, password: string) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log(`✅ Created Auth user: ${email}`);
        return userCredential.user.uid;
    } catch (error: any) {
        if (error.code === 'auth/email-already-exists' || error.code === 'auth/email-already-in-use') {
            console.log(`⚠️  Auth user already exists: ${email}, signing in...`);
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            return userCredential.user.uid;
        }
        console.error(`❌ Failed to create Auth user ${email}:`, error.message);
        throw error;
    }
}

async function seedUsers() {
    console.log('\n📝 Seeding users...');

    for (const userData of USERS) {
        try {
            // Create Firebase Auth user
            const uid = await createAuthUser(userData.email, PASSWORD);

            // Create Firestore user document
            await setDoc(doc(db, 'users', uid), {
                ...userData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            console.log(`✅ Created Firestore doc for: ${userData.email} (${userData.role})`);
        } catch (error: any) {
            console.error(`❌ Failed to seed user ${userData.email}:`, error.message);
        }
    }
}

async function seedStores() {
    console.log('\n🏪 Seeding stores...');

    const batch = writeBatch(db);

    for (const store of STORES) {
        const storeRef = doc(db, 'stores', store.id);
        batch.set(storeRef, {
            ...store,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        console.log(`✅ Queued store: ${store.name}`);
    }

    await batch.commit();
    console.log('✅ All stores committed');
}

async function seedPlatformSettings() {
    console.log('\n⚙️  Seeding platform settings...');

    await setDoc(doc(db, 'settings', 'platform'), PLATFORM_SETTINGS);
    console.log('✅ Platform settings created');
}

async function seedSampleOrder() {
    console.log('\n📦 Seeding sample order...');

    const sampleOrder = {
        id: 'ORDER-001',
        userId: 'sample-user',
        userEmail: 'shopper@example.com',
        storeId: '1',
        storeName: 'FreshMart',
        items: [
            {
                id: 'p1',
                name: 'Organic Avocados (5pk)',
                price: 6.99,
                quantity: 2,
                image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578',
            },
            {
                id: 'p2',
                name: 'Almond Milk (1L)',
                price: 4.49,
                quantity: 1,
                image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150',
            },
        ],
        subtotal: 18.47,
        tax: 2.40,
        total: 20.87,
        status: 'preparing',
        date: new Date().toISOString(),
        deliveryAddress: {
            street: '123 Main St',
            city: 'Toronto',
            province: 'ON',
            postalCode: 'M5V 1A1',
        },
    };

    await setDoc(doc(db, 'orders', 'ORDER-001'), sampleOrder);
    console.log('✅ Sample order created');
}

async function seedAuditLog() {
    console.log('\n📋 Seeding initial audit log...');

    const auditLog = {
        id: 'audit-init',
        action: 'SYSTEM_INITIALIZED',
        actor: {
            uid: 'system',
            email: 'system@spendigo.ca',
        },
        timestamp: new Date().toISOString(),
        metadata: {
            message: 'Firebase instance initialized with seed data',
        },
        previousHash: null,
        hash: 'INIT',
    };

    await setDoc(doc(db, 'auditLogs', 'audit-init'), auditLog);
    console.log('✅ Initial audit log created');
}

// ===== MAIN EXECUTION =====

async function main() {
    console.log('🚀 Starting Firebase seed process...');
    console.log(`📍 Project: ${firebaseConfig.projectId}`);
    console.log(`🔐 Default password: ${PASSWORD}`);

    try {
        await seedUsers();
        
        console.log('\n🔐 Signing in as admin for subsequent collection seeding...');
        await signInWithEmailAndPassword(auth, 'admin@spendigo.ca', PASSWORD);

        await seedStores();
        await seedPlatformSettings();
        await seedSampleOrder();
        await seedAuditLog();

        console.log('\n✅ ========================================');
        console.log('✅ SEED COMPLETE!');
        console.log('✅ ========================================\n');

        console.log('📝 Test Accounts Created:');
        console.log('   Admin:    admin@spendigo.ca');
        console.log('   Merchant: freshmart.owner@spendigo.ca');
        console.log('   Consumer: shopper@example.com');
        console.log(`   Password: ${PASSWORD} (all accounts)\n`);

        console.log('🏪 Stores: 5 stores with team members');
        console.log('📦 Orders: 1 sample order');
        console.log('⚙️  Settings: Platform settings initialized\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Seed failed:', error);
        process.exit(1);
    }
}

main();
