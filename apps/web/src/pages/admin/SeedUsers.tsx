import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, collection } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { User } from '../../context/AuthContext';
import { GROCERY_CATALOG } from '../../data/groceryCatalog';
import { STORE_DATA } from '../../data/productData';

// --- DATA DEFINITIONS ---
// Use existing mock data as source of truth
const STORES = Object.values(STORE_DATA).map(store => ({
    id: store.id,
    name: store.name,
    slug: store.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
    tier: store.subscriptionTier || 'free',
    ...store
}));

// --- MASTER CATALOG EXTRACTION ---
// 1. Start with explicit Master Catalog items
const MASTER_MAP = new Map<string, any>();
GROCERY_CATALOG.forEach(item => {
    MASTER_MAP.set(item.name.toLowerCase(), { ...item, storeId: 'master' });
});

// 2. Supplement with items from other stores (merging duplicates by name)
STORES.forEach(store => {
    store.products.forEach((p: any) => {
        const key = p.name.toLowerCase();
        if (!MASTER_MAP.has(key)) {
            MASTER_MAP.set(key, { ...p, storeId: store.id });
        }
    });
});

// 3. Apply Tax Logic and formatting
const UNIQUE_CATALOG_ITEMS = Array.from(MASTER_MAP.values()).map((item, index) => {
    const TAX_EXEMPT_CATEGORIES = ['Fresh Produce', 'Dairy & Eggs', 'Bakery', 'Meat & Seafood', 'Pantry', 'Frozen Foods', 'Dairy & Refrigerated', 'Bakery & Grains', 'Pantry Staples', 'Produce & Frozen'];

    // Check if category matches any exempt category (fuzzy match)
    const isTaxExempt = TAX_EXEMPT_CATEGORIES.some(c =>
        item.category.toLowerCase().includes(c.toLowerCase()) ||
        c.toLowerCase().includes(item.category.toLowerCase())
    );

    return {
        ...item,
        // Preserve ID if it's a distinct SKU (like GROC-...), otherwise generate one if it looks generic
        id: item.id.startsWith('GROC-') ? item.id : `cat-${index + 1000}`,
        description: item.description || `Fresh ${item.name} sourced for quality directly from local suppliers.`,
        unit: item.unit || 'each',
        taxable: !isTaxExempt
    };
});

const CONSUMERS = [
    { email: 'shopper@example.com', name: 'Alice Shopper', avatar: '🛒' },
    { email: 'family@spendigo.ca', name: 'Sarah Family', avatar: '👨‍👩‍👧‍👦' },
    { email: 'student@spendigo.ca', name: 'Steve Student', avatar: '🎓' },
    { email: 'chef@spendigo.ca', name: 'Chef Chris', avatar: '👨‍🍳' }
];

const ADMINS = [
    { email: 'admin@spendigo.ca', name: 'System Admin', adminRole: 'SUPER_ADMIN', avatar: '🛡️' },
    { email: 'admin2@spendigo.ca', name: 'Backup Admin', adminRole: 'SUPER_ADMIN', avatar: '👮‍♂️' }
];

export default function SeedUsers() {
    const [status, setStatus] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const log = (msg: string) => setStatus(prev => [...prev, msg]);

    const seed = async () => {
        if (!confirm("This will seed MASTER CATALOG with Smart Tax Logic, Users, Stores, and History. Continue?")) return;

        setLoading(true);
        setStatus([]);
        const PASSWORD = 'Spendigo123!';

        try {
            // 1. Consumers
            for (const c of CONSUMERS) {
                await createUser(c.email, PASSWORD, {
                    name: c.name,
                    email: c.email,
                    role: 'consumer',
                    avatar: c.avatar
                });
            }

            // 2. Admins
            for (const a of ADMINS) {
                await createUser(a.email, PASSWORD, {
                    name: a.name,
                    email: a.email,
                    role: 'admin',
                    adminRole: a.adminRole as any,
                    avatar: a.avatar
                });
            }

            // 3. Master Catalog (New Phase 5 Feature)
            log(`📦 Seeding Master Catalog (${UNIQUE_CATALOG_ITEMS.length} items)...`);
            for (const item of UNIQUE_CATALOG_ITEMS) {
                await setDoc(doc(db, 'catalog', item.id), item);
            }
            log(`   -> Master Catalog Complete`);

            // 4. Merchants (Owner, Manager, Staff for each store)
            for (const s of STORES) {

                // --- CREATE STORE DOCUMENT ---
                // ... (existing store creation)
                await setDoc(doc(db, 'stores', s.id), {
                    ...s, // Spread all properties from productData
                    status: 'active',
                    joinedAt: new Date().toISOString().split('T')[0],
                    merchantEmail: `${s.slug}.owner@spendigo.ca`,
                    rating: s.rating || 4.5,
                    deliveryTime: s.deliveryTime || '30-45 min',
                    minOrder: 15,
                    deliveryFee: s.deliveryFee || 3.99,
                    tags: s.tags || ['Grocery', 'Local'],
                    image: s.image,
                    province: s.province || 'ON'
                });
                log(`   -> Created Store: ${s.name}`);

                // ... (existing user creation for owner/manager/staff) ...
                await createUser(`${s.slug}.owner@spendigo.ca`, PASSWORD, {
                    name: `${s.name} Owner`,
                    email: `${s.slug}.owner@spendigo.ca`,
                    role: 'merchant',
                    storeId: s.id,
                    storeName: s.name,
                    merchantRole: 'OWNER',
                    subscriptionTier: s.tier as any,
                    avatar: '👔'
                });

                await createUser(`${s.slug}.manager@spendigo.ca`, PASSWORD, {
                    name: `${s.name} Manager`,
                    email: `${s.slug}.manager@spendigo.ca`,
                    role: 'merchant',
                    storeId: s.id,
                    storeName: s.name,
                    merchantRole: 'MANAGER',
                    subscriptionTier: s.tier as any,
                    avatar: '👩‍💼'
                });

                await createUser(`${s.slug}.staff@spendigo.ca`, PASSWORD, {
                    name: `${s.name} Staff`,
                    email: `${s.slug}.staff@spendigo.ca`,
                    role: 'merchant',
                    storeId: s.id,
                    storeName: s.name,
                    merchantRole: 'STAFF',
                    subscriptionTier: s.tier as any,
                    avatar: '🧢'
                });
            }

            // 5. Seed Mock Orders (for Analytics)
            log('📦 Seeding Mock Orders...');
            const ORDER_STATUSES = ['placed', 'preparing', 'out_for_delivery', 'delivered'];

            // Create ~50 orders across stores
            for (let i = 0; i < 50; i++) {
                const randomStore = STORES[Math.floor(Math.random() * STORES.length)];
                const randomConsumer = CONSUMERS[Math.floor(Math.random() * CONSUMERS.length)];
                const daysAgo = Math.floor(Math.random() * 14); // Last 2 weeks

                const date = new Date();
                date.setDate(date.getDate() - daysAgo);
                date.setHours(Math.floor(Math.random() * 14) + 8, Math.floor(Math.random() * 60)); // 8am - 10pm

                const items = randomStore.products.slice(0, Math.floor(Math.random() * 3) + 1).map((p: any) => ({
                    productId: p.id,
                    productName: p.name,
                    price: p.price,
                    quantity: Math.floor(Math.random() * 2) + 1,
                    image: p.image
                }));

                const subtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
                const deliveryFee = typeof randomStore.deliveryFee === 'number' ? randomStore.deliveryFee : 3.99;
                const tax = subtotal * 0.13;
                const total = subtotal + tax + deliveryFee;

                await setDoc(doc(collection(db, 'orders')), {
                    date: date.toISOString(),
                    status: daysAgo > 0 ? 'delivered' : ORDER_STATUSES[Math.floor(Math.random() * ORDER_STATUSES.length)],
                    items,
                    storeName: randomStore.name,
                    storeId: randomStore.id,
                    customerName: randomConsumer.name,
                    customerId: 'mock-consumer-id', // Placeholder
                    subtotal,
                    tax,
                    deliveryFee,
                    total,
                    paymentMethod: 'card',
                    paymentStatus: 'paid', // Key for revenue calc
                    createdAt: date.toISOString()
                });
            }
            log('   -> Created 50 Mock Orders');


            log('✅ Seeding Complete! check Firebase Console.');
        } catch (err: any) {
            log(`❌ Critical Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const createUser = async (email: string, password: string, userData: any) => {
        try {
            log(`Creating ${email}...`);
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            const uid = cred.user.uid;

            // Add ID
            userData.id = uid;

            // Save to Firestore
            await setDoc(doc(db, 'users', uid), userData);
            log(`   -> Success (UID: ${uid})`);

            // Sign out immediately so we can create next user
            await signOut(auth);

        } catch (error: any) {
            if (error.code === 'auth/email-already-in-use') {
                log(`   -> User exists. Updating Firestore profile...`);
                try {
                    // Login to get UID
                    const cred = await import('firebase/auth').then(m => m.signInWithEmailAndPassword(auth, email, password));
                    const uid = cred.user.uid;

                    // Add ID
                    userData.id = uid;

                    // Update Firestore
                    await setDoc(doc(db, 'users', uid), userData);
                    log(`   -> Updated Profile (UID: ${uid})`);
                    await signOut(auth);
                } catch (innerErr: any) {
                    log(`   -> FAILED to update existing user: ${innerErr.message}`);
                }
            } else {
                log(`   -> FAILED: ${error.message}`);
            }
        }
    };

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">Restore Mock Database</h1>
            <p className="mb-4">
                This utility will recreate the standard demo data including:
                <ul className="list-disc ml-6 mt-2 mb-2">
                    <li><strong>Master Product Catalog</strong> (Integrated {UNIQUE_CATALOG_ITEMS.length} items)</li>
                    <li>30+ Users (Shoppers, Merchants, Admins)</li>
                    <li>{STORES.length} Mock Stores with full profiles</li>
                    <li>~50 Mock Orders (Analytics Data)</li>
                </ul>
                <br />
                <strong>Default Password:</strong> <code>Spendigo123!</code>
            </p>

            <button
                onClick={seed}
                disabled={loading}
                className="px-6 py-3 bg-green-600 text-white font-bold rounded shadow hover:bg-green-700 disabled:opacity-50"
            >
                {loading ? 'Seeding...' : 'Seed Database'}
            </button>

            <button
                onClick={async () => {
                    if (!confirm('Force Create/Repair admin2@spendigo.ca?')) return;
                    setLoading(true);
                    log('🚀 Starting creation of Admin 2...');

                    await createUser('admin2@spendigo.ca', 'Spendigo123!', {
                        name: 'Backup Admin',
                        email: 'admin2@spendigo.ca',
                        role: 'admin',
                        adminRole: 'SUPER_ADMIN',
                        avatar: '👮‍♂️'
                    });

                    log('✅ Admin 2 Sequence Finished.');
                    setLoading(false);
                }}
                disabled={loading}
                className="ml-4 px-6 py-3 bg-blue-600 text-white font-bold rounded shadow hover:bg-blue-700 disabled:opacity-50"
            >
                Force Create Admin 2
            </button>

            <div className="mt-8 bg-gray-100 p-4 rounded h-96 overflow-y-auto font-mono text-xs">
                {status.map((line, i) => <div key={i}>{line}</div>)}
            </div>
        </div >
    );
}
