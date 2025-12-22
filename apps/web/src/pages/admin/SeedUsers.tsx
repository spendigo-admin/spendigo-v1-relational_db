import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { User } from '../../context/AuthContext';

import { STORE_DATA } from '../../data/productData';

// --- DATA DEFINITIONS ---
// Use existing mock data as source of truth
const STORES = Object.values(STORE_DATA).map(store => ({
    id: store.id,
    name: store.name,
    slug: store.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
    tier: store.subscriptionTier || 'free',
    ...store // Keep all other fields like products, flyer, etc.
}));

const CONSUMERS = [
    { email: 'shopper@example.com', name: 'Alice Shopper', avatar: '🛒' },
    { email: 'family@spendigo.ca', name: 'Sarah Family', avatar: '👨‍👩‍👧‍👦' },
    { email: 'student@spendigo.ca', name: 'Steve Student', avatar: '🎓' },
    { email: 'chef@spendigo.ca', name: 'Chef Chris', avatar: '👨‍🍳' }
];

const ADMINS = [
    { email: 'admin@spendigo.ca', name: 'System Admin', adminRole: 'SUPER_ADMIN', avatar: '🛡️' }
];

export default function SeedUsers() {
    const [status, setStatus] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const log = (msg: string) => setStatus(prev => [...prev, msg]);

    const seed = async () => {
        if (!confirm("This will attempt to create ~30 users in Firebase Auth. Password for all will be 'Spendigo123!'. Continue?")) return;

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

            // 3. Merchants (Owner, Manager, Staff for each store)
            for (const s of STORES) {

                // --- CREATE STORE DOCUMENT ---
                // --- CREATE STORE DOCUMENT ---
                // We write the full rich object (products, flyers, etc) to Firestore
                await setDoc(doc(db, 'stores', s.id), {
                    ...s, // Spread all properties from productData
                    status: 'active',
                    joinedAt: new Date().toISOString().split('T')[0],
                    merchantEmail: `${s.slug}.owner@spendigo.ca`,
                    // Ensure we don't overwrite these if they exist in source, but provide defaults if not
                    rating: s.rating || 4.5,
                    deliveryTime: s.deliveryTime || '30-45 min',
                    minOrder: 15,
                    deliveryFee: s.deliveryFee || 3.99,
                    tags: s.tags || ['Grocery', 'Local'],
                    image: s.image // Use high-res image from source
                });
                log(`   -> Created Store: ${s.name}`);

                // Owner
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

                // Manager
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

                // Staff
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
                log(`   -> Skipped (Email exists)`);
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
                    <li>30+ Users (Shoppers, Merchants, Admins)</li>
                    <li>11 Mock Stores with full profiles</li>
                    <li>~100 Products, Flyers, and Deals</li>
                </ul>
                <br />
                <strong>Default Password:</strong> <code>Spendigo123!</code>
            </p>

            <button
                onClick={seed}
                disabled={loading}
                className="px-6 py-3 bg-red-600 text-white font-bold rounded shadow hover:bg-red-700 disabled:opacity-50"
            >
                {loading ? 'Seeding...' : 'Start Seeding'}
            </button>

            <div className="mt-8 bg-gray-100 p-4 rounded h-96 overflow-y-auto font-mono text-xs">
                {status.map((line, i) => <div key={i}>{line}</div>)}
            </div>
        </div>
    );
}
