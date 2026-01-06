import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { STORE_DATA } from './productData.ts';
import { GROCERY_CATALOG } from './groceryCatalog.ts';

// Determine project ID
const projectId = process.env.GCLOUD_PROJECT || 'demo-project';

// Initialize Firebase Admin
// If running in local emulator, no credentials needed usually, or use default
if (process.env.FIRESTORE_EMULATOR_HOST) {
    initializeApp({ projectId });
} else {
    // If you were running against real prod, you'd need creds. 
    // For this context, we assume local or properly env-var configured.
    try {
        initializeApp();
    } catch (e) {
        console.log('App already initialized or failed init', e);
    }
}

const db = getFirestore();

// Helper to sanitize IDs
const sanitizeId = (id: string) => id.replace(/[^a-zA-Z0-9-_]/g, '_');

// Master Product Map to deduplicate
// Key: normalized product name (lowercase)
// Value: masterProductId
const masterProductMap = new Map<string, string>();

const WALMART_SEEDS = [
    {
        name: "Your Fresh Market Ciabatta Buns",
        product_name_fr: "Petits pains ciabatta Marché Frais",
        brand: "Your Fresh Market",
        upc: "6000198046009",
        category: "Bakery",
        subcategory: "Bread Rolls & Buns",
        image: "https://i5.walmartimages.ca/images/Enlarge/261/278/6000200261278.jpg",
        description: "Your Fresh Market Ciabatta Buns. Crusty on the outside and soft on the inside. 6 pk, 500g.",
        short_description_fr: "Petits pains ciabatta Marché Frais. Croûtés à l'extérieur et moelleux à l'intérieur. 6 pqt, 500g.",
        net_quantity_value: 500,
        net_quantity_unit: "g",
        package_count: 6,
        unit_type: "weight",
        storage_type: "ambient",
        product_type: "food",
        tax_category_id: "zero_rated_grocery",
        is_sold_by_weight: false,
        suggested_retail_price: 3.97,
        search_keywords: ["bread", "rolls", "buns", "ciabatta", "pain"],
        verification_status: "verified",
        dimensions: { length: 25, width: 15, height: 8, unit: "cm" }
    },
    {
        name: "Maple Leaf Boneless Skinless Chicken Breasts",
        product_name_fr: "Poitrines de poulet désossées sans peau Maple Leaf",
        brand: "Maple Leaf",
        upc: "6000191279309",
        category: "Meat & Seafood",
        subcategory: "Chicken",
        image: "https://i5.walmartimages.ca/images/Enlarge/127/930/6000191279309.jpg",
        description: "Fresh boneless skinless chicken breasts. No added hormones. 4 Breasts.",
        short_description_fr: "Poitrines de poulet fraîches désossées et sans peau. Sans hormones ajoutées. 4 poitrines.",
        net_quantity_value: 4,
        net_quantity_unit: "count",
        package_count: 4,
        unit_type: "count",
        storage_type: "refrigerated",
        product_type: "food",
        tax_category_id: "zero_rated_grocery",
        is_sold_by_weight: true,
        suggested_retail_price: 15.50,
        search_keywords: ["chicken", "poulet", "breast", "meat", "poultry"],
        verification_status: "verified",
        dimensions: { length: 20, width: 15, height: 5, unit: "cm" }
    },
    {
        name: "Gray Ridge Premium Large White Eggs",
        product_name_fr: "Gros œufs blancs de qualité supérieure Gray Ridge",
        brand: "Gray Ridge",
        upc: "6000191268613",
        category: "Dairy & Eggs",
        subcategory: "Eggs",
        image: "https://i5.walmartimages.ca/images/Enlarge/686/13_/6000191268613.jpg",
        description: "Gray Ridge Premium Large White Eggs. 18 Count.",
        short_description_fr: "Gros œufs blancs de qualité supérieure Gray Ridge. 18 unités.",
        net_quantity_value: 18,
        net_quantity_unit: "count",
        package_count: 18,
        unit_type: "count",
        storage_type: "refrigerated",
        product_type: "food",
        tax_category_id: "zero_rated_grocery",
        is_sold_by_weight: false,
        suggested_retail_price: 6.48,
        search_keywords: ["eggs", "oeufs", "large eggs", "white eggs", "dairy"],
        verification_status: "verified",
        dimensions: { length: 30, width: 10, height: 7, unit: "cm" }
    },
    {
        name: "Sealtest Partly Skimmed 1% Milk",
        product_name_fr: "Lait 1 % partiellement écrémé Sealtest",
        brand: "Sealtest",
        upc: "6000199044320",
        category: "Dairy & Eggs",
        subcategory: "Milk",
        image: "https://i5.walmartimages.ca/images/Enlarge/904/432/6000199044320.jpg",
        description: "Sealtest Partly Skimmed 1% Milk. 4 L bag.",
        short_description_fr: "Lait 1 % partiellement écrémé Sealtest. Sac de 4 L.",
        net_quantity_value: 4,
        net_quantity_unit: "L",
        package_count: 1,
        unit_type: "volume",
        storage_type: "refrigerated",
        product_type: "food",
        tax_category_id: "zero_rated_grocery",
        is_sold_by_weight: false,
        suggested_retail_price: 5.89,
        search_keywords: ["milk", "lait", "1%", "dairy", "beverage"],
        verification_status: "verified",
        dimensions: { length: 20, width: 20, height: 30, unit: "cm" }
    }
];

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

    // 0. Process WALMART_SEEDS (Specific overrides/new items)
    for (const item of WALMART_SEEDS) {
        const masterId = `mp-${item.upc}`;
        const normalizedName = item.name.trim().toLowerCase();
        masterProductMap.set(normalizedName, masterId);

        const ref = db.collection('master_products').doc(masterId);
        const data = {
            master_product_id: masterId,
            product_name: item.name,
            product_name_fr: (item as any).product_name_fr || '',
            brand_name: item.brand,
            barcode: item.upc,
            upc_gtin: item.upc,
            category_id: `cat-${sanitizeId(item.category).toLowerCase()}`,
            primary_image_url: item.image,
            short_description: item.description,
            short_description_fr: (item as any).short_description_fr || '',

            // Gap Attributes
            product_type: item.product_type,
            storage_type: item.storage_type,
            net_quantity_value: item.net_quantity_value,
            net_quantity_unit: item.net_quantity_unit,
            package_count: item.package_count,
            unit_type: item.unit_type,
            tax_category_id: (item as any).tax_category_id || 'zero_rated_grocery',
            is_sold_by_weight: (item as any).is_sold_by_weight || false,
            suggested_retail_price: (item as any).suggested_retail_price || 0,
            search_keywords: (item as any).search_keywords || [],
            verification_status: (item as any).verification_status || 'verified',
            dimensions: (item as any).dimensions || null,

            data_source: 'admin_seed',
            created_at: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp(),
            status: 'active'
        };
        batch.set(ref, data, { merge: true });
        count++;
    }

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

                // Defaults for generic
                product_type: 'food',
                category_id: `cat-${sanitizeId(item.category).toLowerCase()}`,
                primary_image_url: item.image,
                tax_category_id: 'zero_rated_grocery',
                is_sold_by_weight: false,
                verification_status: 'unverified',

                created_at: FieldValue.serverTimestamp(),
                updated_at: FieldValue.serverTimestamp(),
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
                    created_at: FieldValue.serverTimestamp(),
                    updated_at: FieldValue.serverTimestamp(),
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
                created_at: FieldValue.serverTimestamp(),
                updated_at: FieldValue.serverTimestamp()
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
