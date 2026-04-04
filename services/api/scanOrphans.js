const admin = require('firebase-admin');

// Initialize Firebase Admin (assuming service account or env defaults)
const serviceAccount = require('/Users/I501801/Documents/Projects/Spendigo-v1/scripts/service-account.json');
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function scan() {
    console.log("Fetching all active stores...");
    const storesSnap = await db.collection('stores').get();
    const validStoreIds = new Set();
    storesSnap.forEach(doc => validStoreIds.add(doc.id));
    console.log(`Found ${validStoreIds.size} valid stores.`);

    // 1. Scan and Delete merchant_products
    console.log("Scanning merchant_products...");
    const productsSnap = await db.collection('merchant_products').get();
    let orphanedProductsCount = 0;
    const productDeletes = [];
    productsSnap.forEach(doc => {
        const merchantId = doc.data().merchant_id;
        if (merchantId && !validStoreIds.has(String(merchantId))) {
            productDeletes.push(doc.ref.delete());
            orphanedProductsCount++;
        }
    });
    await Promise.all(productDeletes);
    console.log(`Deleted ${orphanedProductsCount} orphaned merchant_products.`);

    // 2. Scan and Delete Deals (Collection Group)
    console.log("Scanning deals...");
    const dealsSnap = await db.collectionGroup('deals').get();
    let orphanedDealsCount = 0;
    const dealDeletes = [];
    dealsSnap.forEach(doc => {
        const storeId = doc.ref.parent.parent?.id;
        if (storeId && !validStoreIds.has(storeId)) {
            dealDeletes.push(doc.ref.delete());
            orphanedDealsCount++;
        }
    });
    await Promise.all(dealDeletes);
    console.log(`Deleted ${orphanedDealsCount} orphaned deals.`);

    // 3. Scan and Delete Flyers (Collection Group)
    console.log("Scanning flyers...");
    const flyersSnap = await db.collectionGroup('flyers').get();
    let orphanedFlyersCount = 0;
    const flyerDeletes = [];
    flyersSnap.forEach(doc => {
        const storeId = doc.ref.parent.parent?.id;
        if (storeId && !validStoreIds.has(storeId)) {
            flyerDeletes.push(doc.ref.delete());
            orphanedFlyersCount++;
        }
    });
    await Promise.all(flyerDeletes);
    console.log(`Deleted ${orphanedFlyersCount} orphaned flyers.`);

    console.log("\n=================================");
    console.log("         ORPHAN CLEANUP SUCCESS   ");
    console.log("=================================");
    console.log(`Deleted Merchant Products: ${orphanedProductsCount}`);
    console.log(`Deleted Deals: ${orphanedDealsCount}`);
    console.log(`Deleted Flyers: ${orphanedFlyersCount}`);
}

scan().catch(console.error);
