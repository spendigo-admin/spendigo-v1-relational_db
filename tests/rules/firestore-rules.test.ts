/**
 * Firestore Security Rules Tests
 *
 * Prerequisites: Firebase emulator must be running before executing these tests.
 *   firebase emulators:start --only firestore
 *
 * Run: npm run test:rules
 */

import {
    initializeTestEnvironment,
    assertFails,
    assertSucceeds,
    type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { setDoc, doc, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { beforeAll, afterEach, afterAll, describe, it } from 'vitest';

const PROJECT_ID = 'spendigo-rules-test';
const RULES_PATH = resolve(__dirname, '../../firestore.rules');

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
            rules: readFileSync(RULES_PATH, 'utf8'),
            host: '127.0.0.1',
            port: 8080,
        },
    });
});

afterEach(async () => {
    await testEnv.clearFirestore();
});

afterAll(async () => {
    await testEnv.cleanup();
});

// Bypass security rules to seed test data
async function seedUser(uid: string, data: Record<string, unknown>) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users', uid), data);
    });
}

async function seedStore(storeId: string, data: Record<string, unknown>) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'stores', storeId), data);
    });
}

async function seedOrder(orderId: string, data: Record<string, unknown>) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'orders', orderId), data);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Orders — server-side only (allow create: if false)
// ─────────────────────────────────────────────────────────────────────────────
describe('orders', () => {
    it('unauthenticated user cannot create an order', async () => {
        const db = testEnv.unauthenticatedContext().firestore();
        await assertFails(
            setDoc(doc(db, 'orders', 'order-1'), { total: 10, storeId: 'store-1' })
        );
    });

    it('authenticated admin cannot create an order directly (server-side only)', async () => {
        await seedUser('admin-1', { role: 'admin' });
        const db = testEnv.authenticatedContext('admin-1').firestore();
        await assertFails(
            setDoc(doc(db, 'orders', 'order-1'), { total: 10, storeId: 'store-1' })
        );
    });

    it('merchant can update order status and deliveryEvidence for their own store', async () => {
        await seedUser('merchant-1', { role: 'merchant', storeId: 'store-a' });
        await seedOrder('order-1', { storeId: 'store-a', status: 'out_for_delivery', paymentStatus: 'unpaid' });
        const db = testEnv.authenticatedContext('merchant-1').firestore();
        
        await assertSucceeds(
            updateDoc(doc(db, 'orders', 'order-1'), {
                status: 'delivered',
                deliveryEvidence: {
                    evidenceType: 'signature',
                    capturedAt: new Date().toISOString(),
                    signatureName: 'Shahbaz',
                    signatureData: 'data:image/png;base64,...'
                }
            })
        );
    });

    it('merchant can update order payment status for their own store', async () => {
        await seedUser('merchant-1', { role: 'merchant', storeId: 'store-a' });
        await seedOrder('order-1', { storeId: 'store-a', status: 'delivered', paymentStatus: 'unpaid' });
        const db = testEnv.authenticatedContext('merchant-1').firestore();
        
        await assertSucceeds(
            updateDoc(doc(db, 'orders', 'order-1'), {
                paymentStatus: 'paid',
                paymentCollectedBy: {
                    id: 'merchant-1',
                    name: 'Merchant One',
                    timestamp: new Date().toISOString()
                }
            })
        );
    });

    it('merchant cannot update order total or customerId', async () => {
        await seedUser('merchant-1', { role: 'merchant', storeId: 'store-a' });
        await seedOrder('order-1', { storeId: 'store-a', status: 'out_for_delivery', total: 20 });
        const db = testEnv.authenticatedContext('merchant-1').firestore();
        
        await assertFails(
            updateDoc(doc(db, 'orders', 'order-1'), {
                total: 50
            })
        );
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. merchant_products — consumer writes are blocked
// ─────────────────────────────────────────────────────────────────────────────
describe('merchant_products', () => {
    it('consumer cannot create a merchant product', async () => {
        await seedUser('consumer-1', { role: 'consumer' });
        const db = testEnv.authenticatedContext('consumer-1').firestore();
        await assertFails(
            setDoc(doc(db, 'merchant_products', 'prod-1'), {
                merchant_id: 'store-1',
                master_product_id: 'master-1',
                name: 'Test Product',
                price: 5.99,
            })
        );
    });

    it('unauthenticated user cannot create a merchant product', async () => {
        const db = testEnv.unauthenticatedContext().firestore();
        await assertFails(
            setDoc(doc(db, 'merchant_products', 'prod-1'), {
                merchant_id: 'store-1',
                master_product_id: 'master-1',
            })
        );
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Store subcollections — merchant scoped to their own store
// ─────────────────────────────────────────────────────────────────────────────
describe('stores subcollections', () => {
    it("merchant cannot write to another store's deals subcollection", async () => {
        await seedUser('merchant-1', { role: 'merchant', storeId: 'store-a' });
        await seedStore('store-b', { status: 'active' });
        const db = testEnv.authenticatedContext('merchant-1').firestore();
        await assertFails(
            setDoc(doc(db, 'stores', 'store-b', 'deals', 'deal-1'), {
                title: 'Stolen Deal',
                price: 1.00,
            })
        );
    });

    it("merchant can write to their own store's deals subcollection", async () => {
        await seedUser('merchant-1', { role: 'merchant', storeId: 'store-a' });
        await seedStore('store-a', { status: 'active' });
        const db = testEnv.authenticatedContext('merchant-1').firestore();
        await assertSucceeds(
            setDoc(doc(db, 'stores', 'store-a', 'deals', 'deal-1'), {
                title: 'Own Store Deal',
                price: 2.99,
            })
        );
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. job_applications — requires authentication (post P0-9)
// ─────────────────────────────────────────────────────────────────────────────
describe('job_applications', () => {
    it('unauthenticated user cannot create a job application', async () => {
        const db = testEnv.unauthenticatedContext().firestore();
        await assertFails(
            setDoc(doc(db, 'job_applications', 'app-1'), { name: 'Alice', role: 'Engineer' })
        );
    });

    it('authenticated user can create a job application', async () => {
        const db = testEnv.authenticatedContext('user-1').firestore();
        await assertSucceeds(
            setDoc(doc(db, 'job_applications', 'app-1'), { name: 'Alice', role: 'Engineer' })
        );
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. ads — write restricted to admin role (post P0-10)
// ─────────────────────────────────────────────────────────────────────────────
describe('ads', () => {
    it('consumer cannot create an ad', async () => {
        await seedUser('consumer-1', { role: 'consumer' });
        const db = testEnv.authenticatedContext('consumer-1').firestore();
        await assertFails(
            setDoc(doc(db, 'ads', 'ad-1'), { title: 'Free Stuff', imageUrl: 'https://example.com/img.jpg' })
        );
    });

    it('merchant cannot create an ad', async () => {
        await seedUser('merchant-1', { role: 'merchant', storeId: 'store-a' });
        const db = testEnv.authenticatedContext('merchant-1').firestore();
        await assertFails(
            setDoc(doc(db, 'ads', 'ad-1'), { title: 'My Ad', imageUrl: 'https://example.com/img.jpg' })
        );
    });

    it('unauthenticated user cannot create an ad', async () => {
        const db = testEnv.unauthenticatedContext().firestore();
        await assertFails(
            setDoc(doc(db, 'ads', 'ad-1'), { title: 'Anon Ad' })
        );
    });

    it('admin can create an ad', async () => {
        await seedUser('admin-1', { role: 'admin' });
        const db = testEnv.authenticatedContext('admin-1').firestore();
        await assertSucceeds(
            setDoc(doc(db, 'ads', 'ad-1'), { title: 'Official Ad', imageUrl: 'https://example.com/img.jpg' })
        );
    });
});
