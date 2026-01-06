
import * as admin from 'firebase-admin';
import { STORE_DATA } from './productData';
import { GROCERY_CATALOG } from './groceryCatalog';

// Determine project ID
const projectId = process.env.GCLOUD_PROJECT || 'demo-project';

// Initialize Firebase Admin
// If running in local emulator, no credentials needed usually, or use default
if (process.env.FIRESTORE_EMULATOR_HOST) {
    admin.initializeApp({ projectId });
} else {
    // If you were running against real prod, you'd need creds. 
    // For this context, we assume local or properly env-var configured.
    try {
        admin.initializeApp();
    } catch (e) {
        console.log('App already initialized or failed init', e);
    }
}

const db = admin.firestore();

// Helper to sanitize IDs
const sanitizeId = (id: string) => id.replace(/[^a-zA-Z0-9-_]/g, '_');

// Master Product Map to deduplicate
// Key: normalized product name (lowercase)
// Value: masterProductId
const masterProductMap = new Map<string, string>();

async function seedCategories() {
    console.log('--- Seeding Categories ---');
    const categories = new Set<string>();

    // Collect all categories from STORE_DATA and GROCERY_CATALOG
    GROCERY_CATALOG.forEach(p => categories.add(p.category));

    // Also check store specific products that might have ad-hoc categories
    Object.values(STORE_DATA).forEach((store: any) => {
        if (store.products) {
            store.products.forEach((p: any) => {
                if (p.category) categories.add(p.category);
            });
        }
    });

    const batch = db.batch();

    for (const catName of categories) {
        const catId = `cat-${sanitizeId(catName).toLowerCase()}`;
        const catRef = db.collection('categories').doc(catId);
        batch.set(catRef, {
            category_id: catId,
            name: catName,
            active: true
        }, { merge: true });
    }

    await batch.commit();
    console.log(`Seeded ${categories.size} categories.`);
}

async function seedMasterProducts() {
    console.log('--- Seeding Master Products ---');
    const batch = db.batch();
    let count = 0;

    // 1. Process GROCERY_CATALOG (The source of truth for many items)
    for (const item of GROCERY_CATALOG) {
        const normalizedName = item.name.trim().toLowerCase();

        // If we haven't seen this product yet, create a master record
        if (!masterProductMap.has(normalizedName)) {
            // Use the item.id as master ID if it looks generic, else generate one
            const masterId = item.id.startsWith('GROC-') ? item.id : `mp-${sanitizeId(item.name).toLowerCase()}`;

            masterProductMap.set(normalizedName, masterId);

            const ref = db.collection('master_products').doc(masterId);
            const data = {
                master_product_id: masterId,
                product_name: item.name,
                // In a real app we'd parse brand, size, etc.
                // For now we map available fields
                product_type: 'grocery',
                category_id: `cat-${sanitizeId(item.category).toLowerCase()}`,
                primary_image_url: item.image,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                status: 'active'
            };
            batch.set(ref, data, { merge: true });
            count++;
        }
    }

    // 2. Process Store-Specific Items (Cross-check aliases)
    // Some stores have items not in GROCERY_CATALOG or have different IDs for same items
    for (const store of Object.values(STORE_DATA)) {
        const products = store.products || [];
        for (const p of products) {
            const normalizedName = p.name.trim().toLowerCase();

            if (!masterProductMap.has(normalizedName)) {
                const masterId = `mp-${sanitizeId(p.name).toLowerCase()}-${Math.floor(Math.random() * 1000)}`;
                masterProductMap.set(normalizedName, masterId);

                const ref = db.collection('master_products').doc(masterId);
                const data = {
                    master_product_id: masterId,
                    product_name: p.name,
                    category_id: p.category ? `cat-${sanitizeId(p.category).toLowerCase()}` : 'cat-general',
                    primary_image_url: p.image,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                    status: 'active'
                };
                batch.set(ref, data, { merge: true });
                count++;
            }
        }
    }

    await batch.commit();
    console.log(`Seeded ${count} NEW master products.`);
}

async function seedMerchantProducts() {
    console.log('--- Seeding Merchant Products ---');

    // We need to write in chunks of 500 for bigger datasets, but here batch size is likely ok or we use multiple batches
    // Let's just use one big loop with commits every 400 items

    let batch = db.batch();
    let opCount = 0;

    for (const store of Object.values(STORE_DATA)) {
        const merchantId = store.id;
        const products = store.products || [];

        console.log(`Processing Store: ${store.name} (${merchantId}) - ${products.length} products`);

        for (const p of products) {
            const normalizedName = p.name.trim().toLowerCase();
            const masterId = masterProductMap.get(normalizedName);

            if (!masterId) {
                console.warn(`WARNING: No master product found for "${p.name}" in store ${store.name}. Skipping.`);
                continue;
            }

            const merchantProductId = `${merchantId}_${masterId}`; // Composite key
            const ref = db.collection('merchant_products').doc(merchantProductId);

            const data = {
                merchant_id: merchantId,
                master_product_id: masterId,
                merchant_sku: p.id, // Keeping original ID as SKU
                price: p.price,
                currency: 'CAD',
                available_quantity: 100, // Default mock stock
                visibility: true,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            };

            if (p.originalPrice) {
                // @ts-ignore
                data.original_price = p.originalPrice;
            }

            if (p.discount) {
                // @ts-ignore
                data.discount_label = p.discount;
            }

            batch.set(ref, data, { merge: true });
            opCount++;

            if (opCount % 400 === 0) {
                await batch.commit();
                batch = db.batch();
                console.log(`...Committed ${opCount} merchant products`);
            }
        }
    }

    if (opCount % 400 !== 0) {
        await batch.commit();
    }
    console.log(`Total Merchant Products Seeded: ${opCount}`);
}

async function main() {
    try {
        await seedCategories();
        // Wait a small bit to ensure writes propagate if using emulator sometimes helps

        await seedMasterProducts();
        await seedMerchantProducts();

        console.log('Migration Complete');
    } catch (e) {
        console.error('Migration Failed', e);
        process.exit(1);
    }
}

main();
