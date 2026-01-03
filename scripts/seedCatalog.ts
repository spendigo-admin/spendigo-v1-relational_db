/**
 * Catalog Seed Script
 * 
 * Populates the 'catalog' collection in Firestore with sample products
 * that include barcode/SKU information.
 * 
 * Usage: npx tsx scripts/seedCatalog.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../apps/web/.env.local') });

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

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
const auth = getAuth(app);

const CATALOG_ITEMS = [
    {
        name: 'Organic Bananas',
        category: 'Produce & Frozen',
        image: 'https://images.unsplash.com/photo-1603833665858-e61d17a86279',
        description: 'Fresh organic bananas, grown sustainably.',
        unit: 'lb',
        taxable: false,
        barcode: '4011', // PLU/Barcode
    },
    {
        name: 'Whole Milk (2L)',
        category: 'Dairy & Refrigerated',
        image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150',
        description: 'Fresh whole milk, locally sourced.',
        unit: 'ea',
        taxable: false,
        barcode: '068700011030', // Sample UPC
    },
    {
        name: 'Large Eggs (12pk)',
        category: 'Dairy & Refrigerated',
        image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f',
        description: 'Grade A large eggs.',
        unit: 'ea',
        taxable: false,
        barcode: '068100805123',
    },
    {
        name: 'Sourdough Bread',
        category: 'Bakery & Grains',
        image: 'https://images.unsplash.com/photo-1585478259715-876a6a81fc08',
        description: 'Artisan sourdough bread, baked daily.',
        unit: 'loaf',
        taxable: false,
        barcode: '852319004012',
    },
    {
        name: 'Ground Beef (Levan)',
        category: 'Produce & Frozen',
        image: 'https://images.unsplash.com/photo-1588166524941-e9453167f08d',
        description: 'Lean ground beef, 1lb pack.',
        unit: 'lb',
        taxable: false,
        barcode: '021345000000',
    },
    {
        name: 'Heinz Ketchup',
        category: 'Pantry Staples',
        image: 'https://images.unsplash.com/photo-1627142647716-444a95786328',
        description: 'Classic tomato ketchup.',
        unit: 'ea',
        taxable: true,
        barcode: '057000002120',
    },
    {
        name: 'Cheerios Cereal',
        category: 'Breakfast & Beverages',
        image: 'https://images.unsplash.com/photo-1526433290886-c30953a968f9',
        description: 'Toasted whole grain oat cereal.',
        unit: 'box',
        taxable: true,
        barcode: '016000275263',
    },
    {
        name: 'Coca-Cola (12pk)',
        category: 'Breakfast & Beverages',
        image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97',
        description: 'Original taste cola soft drink.',
        unit: 'pack',
        taxable: true,
        barcode: '049000028904',
    }
];

async function seedCatalog() {
    console.log('📚 Seeding master catalog with barcodes...');

    // Login as Admin
    try {
        await signInWithEmailAndPassword(auth, 'admin@spendigo.ca', 'Spendigo123!');
        console.log('✅ Authenticated as Admin');
    } catch (e: any) {
        console.error('❌ Authentication failed:', e.message);
        process.exit(1);
    }

    const batch = writeBatch(db);

    for (const item of CATALOG_ITEMS) {
        // Create a deterministic ID based on barcode or name
        const id = item.barcode || item.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const docRef = doc(db, 'catalog', id);
        batch.set(docRef, { ...item, updatedAt: new Date().toISOString() });
    }

    try {
        await batch.commit();
        console.log(`✅ Successfully seeded ${CATALOG_ITEMS.length} items into 'catalog'.`);
    } catch (error) {
        console.error('❌ Error seeding catalog:', error);
    }
    process.exit(0);
}

seedCatalog();
