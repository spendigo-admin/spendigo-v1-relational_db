/**
 * Simple Duplicate Cleanup - Run in Browser Console
 * 
 * On Mac: Option + Command + J (⌥ + ⌘ + J)
 * 
 * 1. Go to Admin → Master Catalog
 * 2. Open console with the shortcut above
 * 3. Paste this entire script and press Enter
 */

async function cleanupDuplicates() {
    console.log('🔍 Finding duplicates...\n');

    // Use the Firebase modules already loaded by your app
    const { collection, getDocs, query, where, updateDoc, deleteDoc, doc } = await import('firebase/firestore');
    const { db } = await import('/src/lib/firebase.ts');

    try {
        // Get all master products
        const masterSnap = await getDocs(collection(db, 'master_products'));
        console.log(`📦 Found ${masterSnap.size} products\n`);

        // Group by barcode
        const barcodeMap = new Map();
        masterSnap.docs.forEach(d => {
            const data = d.data();
            if (data.barcode) {
                if (!barcodeMap.has(data.barcode)) barcodeMap.set(data.barcode, []);
                barcodeMap.get(data.barcode).push({ id: d.id, data });
            }
        });

        // Find duplicates
        const duplicates = [...barcodeMap.entries()].filter(([_, products]) => products.length > 1);

        if (duplicates.length === 0) {
            console.log('✅ No duplicates found!');
            return;
        }

        console.log(`⚠️ Found ${duplicates.length} duplicate groups:\n`);

        // Process each group
        for (const [barcode, products] of duplicates) {
            console.log(`\n📦 Barcode: ${barcode} (${products.length} duplicates)`);

            // Count merchants for each
            const withCounts = await Promise.all(
                products.map(async (p) => {
                    const snap = await getDocs(query(collection(db, 'merchant_products'), where('master_product_id', '==', p.id)));
                    return { ...p, count: snap.size };
                })
            );

            // Sort by merchant count
            const sorted = withCounts.sort((a, b) => b.count - a.count);
            const keep = sorted[0];
            const remove = sorted.slice(1);

            console.log(`  ✅ Keep: ${keep.id} (${keep.count} merchants) - "${keep.data.product_name}"`);
            remove.forEach(r => console.log(`  ❌ Delete: ${r.id} (${r.count} merchants)`));

            if (!confirm(`Delete ${remove.length} duplicate(s) for "${keep.data.product_name}"?`)) {
                console.log('  ⏭️ Skipped');
                continue;
            }

            // Delete duplicates
            for (const r of remove) {
                // Migrate merchant products
                const merchants = await getDocs(query(collection(db, 'merchant_products'), where('master_product_id', '==', r.id)));
                for (const m of merchants.docs) {
                    await updateDoc(doc(db, 'merchant_products', m.id), { master_product_id: keep.id });
                }
                if (!merchants.empty) console.log(`    → Migrated ${merchants.size} merchant products`);

                // Delete
                await deleteDoc(doc(db, 'master_products', r.id));
                console.log(`    → ✅ Deleted ${r.id}`);
            }
        }

        console.log('\n\n✅ Done! Refresh the page.');

    } catch (error) {
        console.error('❌ Error:', error);
        console.log('\n💡 Make sure you\'re on the Admin → Master Catalog page');
    }
}

cleanupDuplicates();
