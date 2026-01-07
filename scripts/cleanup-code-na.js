/**
 * Fix for module resolution error
 */

async function cleanupInvalidProducts() {
    console.log('🔍 Finding products without barcodes...');

    // Use CDN imports that work in browser console
    const { getFirestore, collection, getDocs, deleteDoc, doc, query, where } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');

    // Try to define db. If your app exposes it on window, use it. 
    // Otherwise we might need to initialize it or rely on existing connection.
    // Best bet: Use the default app if initialized.

    // Since we can't easily grab the 'db' instance from the bundled app, 
    // we can use the one from the window if you attach it, OR just re-init (might fail if app already inited).

    // HACK: Most apps expose something. If not, try this:
    const firestore = getFirestore(); // Gets default instance

    try {
        const snap = await getDocs(collection(firestore, 'master_products'));
        let found = 0;

        console.log(`Checking ${snap.size} products...`);

        for (const d of snap.docs) {
            const data = d.data();
            if (!data.barcode || data.barcode === 'N/A' || data.barcode.trim() === '') {
                found++;
                // Check usage
                const mSnap = await getDocs(query(collection(firestore, 'merchant_products'), where('master_product_id', '==', d.id)));

                console.log(`❌ Invalid: ${d.id} | Name: ${data.product_name} | Used by: ${mSnap.size} merchants`);

                if (confirm(`Delete "${data.product_name}"?`)) {
                    await deleteDoc(doc(firestore, 'master_products', d.id));

                    if (mSnap.size > 0 && confirm(`Delete ${mSnap.size} merchant items too?`)) {
                        for (const m of mSnap.docs) await deleteDoc(doc(firestore, 'merchant_products', m.id));
                    }
                    console.log('✅ Deleted');
                }
            }
        }
        if (found === 0) console.log('✅ All clean!');

    } catch (err) {
        console.error('Error. Please paste this entire block:', err);
        // Fallback: If getFirestore() failed, try importing app
        const { getApp } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js');
        console.log("Active Apps:", getApp());
    }
}
cleanupInvalidProducts();
