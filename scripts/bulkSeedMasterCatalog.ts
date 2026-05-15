import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./scripts/service-account.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// --- CONFIG ---
const BATCH_SIZE = 400;
const OFF_PAGE_SIZE = 200;
const OFF_FIELDS = [
    'code', 'product_name', 'product_name_fr', 'brands', 'generic_name',
    'image_front_url', 'image_url', 'quantity', 'categories_tags',
    'nutriments', 'ingredients_text', 'ingredients_text_fr',
    'allergens_tags', 'labels_tags'
].join(',');

// OFF tag → our category_id (must match PRODUCT_CATEGORIES in apps/web/src/data/categories.ts)
// tagType: 'categories' (default) or 'labels' for label-filtered queries (Halal, Vegetarian)
const CATEGORY_QUERIES: Array<{ offTag: string; categoryId: string; tagType?: string }> = [
    // Already seeded
    { offTag: 'dairy-products',             categoryId: 'Dairy & Eggs' },
    { offTag: 'breads',                     categoryId: 'Bakery' },
    { offTag: 'meats',                      categoryId: 'Meat & Seafood' },
    { offTag: 'beverages',                  categoryId: 'Beverages' },
    { offTag: 'snacks',                     categoryId: 'Snacks' },
    { offTag: 'cereals-and-their-products', categoryId: 'Pantry' },
    { offTag: 'frozen-foods',               categoryId: 'Frozen' },
    { offTag: 'condiments',                 categoryId: 'Pantry' },
    // Missing categories
    { offTag: 'fruits-and-vegetables',      categoryId: 'Produce' },
    { offTag: 'fresh-vegetables',           categoryId: 'Produce' },
    { offTag: 'fresh-fruits',               categoryId: 'Produce' },
    { offTag: 'household-products',         categoryId: 'Household' },
    { offTag: 'cleaning-products',          categoryId: 'Household' },
    { offTag: 'personal-care',              categoryId: 'Personal Care' },
    { offTag: 'beauty',                     categoryId: 'Personal Care' },
    { offTag: 'dietary-supplements',        categoryId: 'Health & Medicine' },
    { offTag: 'baby-foods',                 categoryId: 'Baby & Kids' },
    { offTag: 'pet-food',                   categoryId: 'Pet Supplies' },
    { offTag: 'asian-foods',                categoryId: 'International & Desi' },
    { offTag: 'indian-cuisine',             categoryId: 'International & Desi' },
    { offTag: 'en:halal',                   categoryId: 'Halal',      tagType: 'labels' },
    { offTag: 'en:vegetarian',              categoryId: 'Vegetarian', tagType: 'labels' },
];

// Keyword → category fallback (must match PRODUCT_CATEGORIES in apps/web/src/data/categories.ts)
const KEYWORD_CATEGORY_MAP: Record<string, string> = {
    'lait': 'Dairy & Eggs', 'milk': 'Dairy & Eggs',
    'cream': 'Dairy & Eggs', 'yogourt': 'Dairy & Eggs',
    'cheese': 'Dairy & Eggs', 'egg': 'Dairy & Eggs', 'oeuf': 'Dairy & Eggs',
    'pain': 'Bakery', 'bread': 'Bakery',
    'bun': 'Bakery', 'cookie': 'Bakery',
    'poulet': 'Meat & Seafood', 'chicken': 'Meat & Seafood',
    'beef': 'Meat & Seafood', 'pork': 'Meat & Seafood', 'steak': 'Meat & Seafood',
    'fruit': 'Produce', 'legume': 'Produce',
    'apple': 'Produce', 'banana': 'Produce', 'tomato': 'Produce',
    'vegetable': 'Produce', 'carrot': 'Produce', 'potato': 'Produce',
    'soda': 'Beverages', 'pop': 'Beverages',
    'water': 'Beverages', 'juice': 'Beverages', 'drink': 'Beverages',
    'shampoo': 'Personal Care', 'soap': 'Personal Care', 'toothpaste': 'Personal Care',
    'detergent': 'Household', 'cleaner': 'Household', 'laundry': 'Household',
    'vitamin': 'Health & Medicine', 'supplement': 'Health & Medicine',
    'baby': 'Baby & Kids', 'infant': 'Baby & Kids',
    'dog': 'Pet Supplies', 'cat': 'Pet Supplies', 'pet': 'Pet Supplies',
};

interface OFFProduct {
    code?: string;
    product_name?: string;
    product_name_fr?: string;
    brands?: string;
    generic_name?: string;
    image_front_url?: string;
    image_url?: string;
    quantity?: string;
    categories_tags?: string[];
    nutriments?: Record<string, number>;
    ingredients_text?: string;
    ingredients_text_fr?: string;
    allergens_tags?: string[];
    labels_tags?: string[];
}

function deriveCategory(p: OFFProduct, defaultCategory: string): string {
    const searchText = `${p.product_name || ''} ${p.generic_name || ''} ${(p.categories_tags || []).join(' ')}`.toLowerCase();
    for (const [keyword, cat] of Object.entries(KEYWORD_CATEGORY_MAP)) {
        if (searchText.includes(keyword)) return cat;
    }
    return defaultCategory;
}

function mapToMasterProduct(p: OFFProduct, categoryId: string) {
    const cleanBarcode = (p.code || '').trim().replace(/[^0-9]/g, '');
    const name = p.product_name || p.generic_name || '';

    return {
        product_name: name,
        product_name_fr: p.product_name_fr || null,
        brand_name: p.brands?.split(',')[0]?.trim() || 'Generic',
        barcode: cleanBarcode,
        upc_gtin: cleanBarcode,
        primary_image_url: p.image_front_url || p.image_url || '',
        short_description: p.generic_name || name,
        ingredients: p.ingredients_text || null,
        ingredients_fr: p.ingredients_text_fr || null,
        allergens: Array.isArray(p.allergens_tags)
            ? p.allergens_tags.map(t => t.replace(/^en:/, ''))
            : [],
        dietary_tags: Array.isArray(p.labels_tags)
            ? p.labels_tags.map(t => t.replace(/^en:/, ''))
            : [],
        nutrition: {
            calories: p.nutriments?.['energy-kcal_100g'] ?? null,
            protein: p.nutriments?.proteins_100g ?? null,
            fat: p.nutriments?.fat_100g ?? null,
            carbs: p.nutriments?.carbohydrates_100g ?? null,
        },
        net_quantity_value: parseFloat(String(p.quantity || '').match(/[\d.]+/)?.[0] || '0') || null,
        net_quantity_unit: String(p.quantity || '').match(/[a-zA-Z]+/)?.[0] || null,
        category_id: categoryId,
        data_source: 'open_food_facts',
        status: 'active',
        verification_status: 'unverified',
        is_sold_by_weight: categoryId === 'Meat & Seafood' || categoryId === 'Produce',
        tax_category_id: 'zero_rated_grocery',
        created_by: 'bulk_seed_script',
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
    };
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchOFFCategory(offTag: string, tagType = 'categories', retries = 4): Promise<OFFProduct[]> {
    const url =
        `https://world.openfoodfacts.org/cgi/search.pl` +
        `?action=process` +
        `&tagtype_0=countries&tag_contains_0=contains&tag_0=canada` +
        `&tagtype_1=${tagType}&tag_contains_1=contains&tag_1=${encodeURIComponent(offTag)}` +
        `&json=true&page_size=${OFF_PAGE_SIZE}&fields=${encodeURIComponent(OFF_FIELDS)}`;

    for (let attempt = 1; attempt <= retries; attempt++) {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'SpendigoApp - BulkSeed - Version 1.0' }
        });

        if (res.ok) {
            const json = await res.json() as { products?: OFFProduct[] };
            return json.products || [];
        }

        if (res.status === 503 && attempt < retries) {
            const delay = attempt * 3000;
            process.stdout.write(`503, retrying in ${delay / 1000}s... `);
            await sleep(delay);
            continue;
        }

        throw new Error(`OFF API returned ${res.status} for tag "${offTag}"`);
    }

    return [];
}

async function loadExistingBarcodes(): Promise<Set<string>> {
    console.log('Loading existing master_products barcodes...');
    const snap = await db.collection('master_products').select('upc_gtin').get();
    const existing = new Set<string>();
    snap.forEach(doc => {
        const v = doc.data().upc_gtin;
        if (v) existing.add(String(v));
    });
    console.log(`  Found ${existing.size} existing SKUs.`);
    return existing;
}

async function main() {
    const existingBarcodes = await loadExistingBarcodes();

    const allProducts: Array<{ docId: string; data: ReturnType<typeof mapToMasterProduct> }> = [];
    const seenBarcodes = new Set<string>(existingBarcodes);

    for (const { offTag, categoryId, tagType } of CATEGORY_QUERIES) {
        process.stdout.write(`Fetching OFF category "${offTag}"... `);
        let products: OFFProduct[] = [];

        try {
            products = await fetchOFFCategory(offTag, tagType);
        } catch (err) {
            console.error(`  ERROR: ${err}`);
            continue;
        }

        let added = 0;
        let skipped = 0;

        for (const p of products) {
            const barcode = (p.code || '').trim().replace(/[^0-9]/g, '');
            const hasMinimumData = barcode && p.product_name && (p.image_front_url || p.image_url);

            if (!hasMinimumData) { skipped++; continue; }
            if (seenBarcodes.has(barcode)) { skipped++; continue; }

            seenBarcodes.add(barcode);
            const resolvedCategory = deriveCategory(p, categoryId);
            allProducts.push({ docId: `mp-${barcode}`, data: mapToMasterProduct(p, resolvedCategory) });
            added++;
        }

        console.log(`${products.length} fetched → ${added} queued, ${skipped} skipped`);
        await sleep(2000);
    }

    if (allProducts.length === 0) {
        console.log('Nothing to write. Exiting.');
        return;
    }

    console.log(`\nWriting ${allProducts.length} products to Firestore in batches of ${BATCH_SIZE}...`);

    let batch = db.batch();
    let opCount = 0;
    let totalWritten = 0;

    for (const { docId, data } of allProducts) {
        batch.set(db.collection('master_products').doc(docId), data, { merge: false });
        opCount++;

        if (opCount === BATCH_SIZE) {
            await batch.commit();
            totalWritten += opCount;
            console.log(`  Committed ${totalWritten} / ${allProducts.length}`);
            batch = db.batch();
            opCount = 0;
        }
    }

    if (opCount > 0) {
        await batch.commit();
        totalWritten += opCount;
    }

    console.log(`\n✅ Done. ${totalWritten} new SKUs written to master_products.`);
    console.log(`   Previous total: ${existingBarcodes.size} → New total: ~${existingBarcodes.size + totalWritten}`);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
