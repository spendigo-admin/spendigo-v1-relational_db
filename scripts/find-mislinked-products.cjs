/**
 * Find Mislinked Merchant Products
 *
 * Reports merchant products whose product_name doesn't semantically match
 * their linked master product name, so they can be corrected in Firestore.
 *
 * Run with: node scripts/find-mislinked-products.cjs
 * Requires Application Default Credentials or service-account.json in scripts/
 */

'use strict';

const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const serviceAccountPath = path.resolve(__dirname, 'service-account.json');

if (!admin.apps.length) {
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else {
        admin.initializeApp({ projectId: 'spendigo-8540c' });
    }
}

const db = admin.firestore();

const STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'with', 'in', 'for',
    'low', 'fat', 'free', 'organic', 'grade', 'large', 'medium', 'small', 'original',
    'pure', 'natural', 'fresh', 'new', 'old', 'best', 'fine', 'extra', 'super']);

function keyWords(s) {
    return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

async function main() {
    console.log('Loading master products...');
    const masterSnap = await db.collection('master_products').get();
    const masterMap = new Map();
    masterSnap.forEach(doc => masterMap.set(doc.id, doc.data().product_name || ''));
    console.log(`Loaded ${masterMap.size} master products. Scanning merchant products...`);

    const merchantSnap = await db.collection('merchant_products').get();
    const mislinked = [];

    merchantSnap.forEach(doc => {
        const { product_name, master_product_id, merchant_id } = doc.data();
        if (!product_name || !master_product_id) return;

        const masterName = masterMap.get(master_product_id);
        if (!masterName) return;

        const merchantWords = keyWords(product_name);
        const masterWords = keyWords(masterName);

        const hasOverlap = merchantWords.some(w => masterWords.includes(w)) ||
                           masterWords.some(w => merchantWords.includes(w));

        if (!hasOverlap) {
            mislinked.push({
                id: doc.id,
                merchantName: product_name,
                masterProductId: master_product_id,
                masterName,
                storeId: merchant_id || 'unknown',
            });
        }
    });

    if (mislinked.length === 0) {
        console.log('\n✅ No mislinked merchant products found.');
    } else {
        console.log(`\n⚠️  Found ${mislinked.length} potentially mislinked merchant product(s):\n`);
        for (const r of mislinked) {
            console.log(`  Path         : merchant_products/${r.id}`);
            console.log(`  Stored name  : "${r.merchantName}"`);
            console.log(`  Master ID    : ${r.masterProductId}`);
            console.log(`  Master name  : "${r.masterName}"`);
            console.log(`  Store ID     : ${r.storeId}`);
            console.log('');
        }
        console.log('Fix: In the Firestore console, correct the master_product_id on each record above.');
    }
}

main().catch(err => { console.error(err); process.exit(1); });
