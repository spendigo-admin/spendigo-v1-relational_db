const admin = require('firebase-admin');

// Initialize Firebase Admin (assuming service account or env defaults)
const serviceAccount = require('./service-account.json');
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

    // 1. Scan merchant_products
    console.log("Scanning merchant_products...");
    const productsSnap = await db.collection('merchant_products').get();
    const orphanedProducts = [];
    productsSnap.forEach(doc => {
        const merchantId = doc.data().merchant_id;
        if (merchantId && !validStoreIds.has(String(merchantId))) {
            orphanedProducts.push({ id: doc.id, merchantId });
        }
    });

    // 2. Scan Deals (Collection Group)
    console.log("Scanning deals...");
    const dealsSnap = await db.collectionGroup('deals').get();
    const orphanedDeals = [];
    dealsSnap.forEach(doc => {
        const storeId = doc.ref.parent.parent?.id;
        if (storeId && !validStoreIds.has(storeId)) {
            orphanedDeals.push({ id: doc.id, storeId });
        }
    });

    // 3. Scan Flyers (Collection Group)
    console.log("Scanning flyers...");
    const flyersSnap = await db.collectionGroup('flyers').get();
    const orphanedFlyers = [];
    flyersSnap.forEach(doc => {
        const storeId = doc.ref.parent.parent?.id;
        if (storeId && !validStoreIds.has(storeId)) {
            orphanedFlyers.push({ id: doc.id, storeId });
        }
    });

    // 4. Scan Users
    console.log("Scanning users...");
    const usersSnap = await db.collection('users').get();
    const orphanedUsers = [];
    usersSnap.forEach(doc => {
        const storeId = doc.data().storeId;
        if (storeId && !validStoreIds.has(storeId)) {
            orphanedUsers.push({ id: doc.id, storeId, role: doc.data().role, stripeCustomerId: doc.data().stripeCustomerId });
        }
    });

    console.log("\n=================================");
    console.log("         ORPHAN SCAN RESULTS      ");
    console.log("=================================");
    console.log(`Orphaned Merchant Products: ${orphanedProducts.length}`);
    console.log(`Orphaned Deals: ${orphanedDeals.length}`);
    console.log(`Orphaned Flyers: ${orphanedFlyers.length}`);
    console.log(`Users with Deleted Stores: ${orphanedUsers.length}`);
    
    if (orphanedUsers.length > 0) {
        console.log("\nDangling Users:");
        orphanedUsers.forEach(u => console.log(` - UID: ${u.id} | Store: ${u.storeId} | StripeCustomer: ${u.stripeCustomerId || 'None'}`));
    }
}

scan().catch(console.error);
