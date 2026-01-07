/**
 * Cleanup Duplicate Master Products
 * 
 * This script finds duplicate products (same barcode) and keeps only:
 * - The one with the most merchant_products linked, OR
 * - The most recently updated one if tied
 * 
 * Run with: npx ts-node scripts/cleanup-duplicates.ts
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin with Application Default Credentials
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'spendigo-8540c'
    });
}

const db = admin.firestore();

interface DuplicateGroup {
    barcode: string;
    products: Array<{
        id: string;
        data: any;
        merchantCount: number;
    }>;
}

async function findDuplicates(): Promise<DuplicateGroup[]> {
    const masterProductsSnap = await db.collection('master_products').get();

    const barcodeMap = new Map<string, any[]>();

    masterProductsSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.barcode) {
            if (!barcodeMap.has(data.barcode)) {
                barcodeMap.set(data.barcode, []);
            }
            barcodeMap.get(data.barcode)!.push({ id: doc.id, data });
        }
    });

    // Filter only duplicates
    const duplicates: DuplicateGroup[] = [];
    for (const [barcode, products] of barcodeMap.entries()) {
        if (products.length > 1) {
            // Count merchant products for each
            const productsWithCounts = await Promise.all(
                products.map(async (product) => {
                    const merchantSnap = await db.collection('merchant_products')
                        .where('master_product_id', '==', product.id)
                        .get();
                    return {
                        ...product,
                        merchantCount: merchantSnap.size
                    };
                })
            );

            duplicates.push({ barcode, products: productsWithCounts });
        }
    }

    return duplicates;
}

async function cleanupDuplicates(dryRun: boolean = true) {
    console.log('🔍 Finding duplicate products...\n');

    const duplicates = await findDuplicates();

    if (duplicates.length === 0) {
        console.log('✅ No duplicates found!');
        return;
    }

    console.log(`Found ${duplicates.length} groups of duplicates:\n`);

    for (const group of duplicates) {
        console.log(`\n📦 Barcode: ${group.barcode}`);
        console.log(`   Duplicates: ${group.products.length}`);

        // Sort by merchant count (desc), then updated_at (desc)
        const sorted = group.products.sort((a, b) => {
            if (a.merchantCount !== b.merchantCount) {
                return b.merchantCount - a.merchantCount;
            }
            const aTime = a.data.updated_at?.toMillis() || 0;
            const bTime = b.data.updated_at?.toMillis() || 0;
            return bTime - aTime;
        });

        const toKeep = sorted[0];
        const toDelete = sorted.slice(1);

        console.log(`   ✅ KEEP: ${toKeep.id} (${toKeep.merchantCount} merchants, "${toKeep.data.product_name}")`);

        for (const product of toDelete) {
            console.log(`   ❌ DELETE: ${product.id} (${product.merchantCount} merchants)`);

            if (!dryRun) {
                // Update any merchant_products that reference this ID to point to the kept one
                const merchantProductsSnap = await db.collection('merchant_products')
                    .where('master_product_id', '==', product.id)
                    .get();

                const batch = db.batch();
                merchantProductsSnap.docs.forEach(doc => {
                    batch.update(doc.ref, { master_product_id: toKeep.id });
                });

                if (!merchantProductsSnap.empty) {
                    await batch.commit();
                    console.log(`      → Migrated ${merchantProductsSnap.size} merchant products to ${toKeep.id}`);
                }

                // Delete the duplicate
                await db.collection('master_products').doc(product.id).delete();
                console.log(`      → Deleted ${product.id}`);
            }
        }
    }

    if (dryRun) {
        console.log('\n\n⚠️  DRY RUN - No changes made. Run with --execute to actually delete duplicates.');
    } else {
        console.log('\n\n✅ Cleanup complete!');
    }
}

// Run
const args = process.argv.slice(2);
const execute = args.includes('--execute');

cleanupDuplicates(!execute)
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
