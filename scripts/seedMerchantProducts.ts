import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Load service account
const serviceAccountPath = './scripts/service-account.json';
if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Error: Service account file not found at ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const firestore = getFirestore();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL environment variable is missing.');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function seedMerchantProducts() {
  console.log('=== STARTING MERCHANT PRODUCTS SEEDING FOR STAGING ===');
  
  // 1. Fetch stores from PostgreSQL
  console.log('Fetching stores from PostgreSQL...');
  const storeRes = await pool.query('SELECT id, name FROM stores');
  const stores = storeRes.rows;
  console.log(`Found ${stores.length} stores in PostgreSQL.`);
  
  if (stores.length === 0) {
    console.error('No stores found in PostgreSQL. Please run backfill first.');
    pool.end();
    return;
  }

  // 2. Fetch master products from PostgreSQL
  console.log('Fetching master products from PostgreSQL...');
  const productRes = await pool.query('SELECT id, product_name, suggested_retail_price FROM master_products LIMIT 40');
  const masterProducts = productRes.rows;
  console.log(`Loaded ${masterProducts.length} master products.`);

  if (masterProducts.length === 0) {
    console.error('No master products found in PostgreSQL. Please run backfill first.');
    pool.end();
    return;
  }

  // 3. Clear existing merchant products in both PostgreSQL and Firestore
  console.log('Wiping existing merchant products in PostgreSQL...');
  await pool.query('TRUNCATE TABLE merchant_products CASCADE');
  console.log('Wiping existing merchant products in Firestore...');
  const existingMProducts = await firestore.collection('merchant_products').get();
  const batch = firestore.batch();
  existingMProducts.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
  console.log(`Deleted ${existingMProducts.size} merchant products from Firestore.`);

  // 4. Generate & Insert new merchant products
  console.log('Generating merchant products...');
  let totalSeeded = 0;

  for (const store of stores) {
    console.log(`Seeding inventory for store: ${store.name} (${store.id})...`);
    
    // Choose a random subset of 10 products for this store
    const shuffled = [...masterProducts].sort(() => 0.5 - Math.random());
    const storeProducts = shuffled.slice(0, 12);

    for (const masterProd of storeProducts) {
      const docId = `${store.id}_${masterProd.id}`;
      
      // Determine realistic price (around suggested price, or fallback to $4.99)
      const baseCents = masterProd.suggested_retail_price || 499;
      // Vary price slightly per store (within +/- 10%)
      const variance = Math.round(baseCents * (0.9 + Math.random() * 0.2));
      const priceCents = Math.max(99, variance);
      const priceDecimal = parseFloat((priceCents / 100).toFixed(2));

      const availableQty = Math.floor(Math.random() * 80) + 20; // 20 to 99 items
      const sku = `SKU-${store.id.substring(6, 10).toUpperCase()}-${masterProd.id.substring(0, 4).toUpperCase()}`;

      // Firestore Write
      await firestore.collection('merchant_products').doc(docId).set({
        merchant_id: store.id,
        master_product_id: masterProd.id,
        price: priceDecimal,
        currency: 'CAD',
        available_quantity: availableQty,
        merchant_sku: sku,
        is_active: true,
        original_price: null,
        discount_label: null
      });

      // PostgreSQL Write
      await pool.query(
        `INSERT INTO merchant_products (store_id, master_product_id, price, currency, available_quantity, merchant_sku, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [store.id, masterProd.id, priceCents, 'CAD', availableQty, sku, true]
      );

      totalSeeded++;
    }
  }

  console.log(`\n[✓] SUCCESS: Successfully seeded ${totalSeeded} merchant products across all stores in both databases!`);
  
  // Verify counts
  const finalPgCountRes = await pool.query('SELECT COUNT(*) FROM merchant_products');
  console.log(`PostgreSQL Merchant Products Count: ${finalPgCountRes.rows[0].count}`);
  const finalFsCount = await firestore.collection('merchant_products').get();
  console.log(`Firestore Merchant Products Count: ${finalFsCount.size}`);

  pool.end();
}

seedMerchantProducts().catch(err => {
  console.error('Seeding failed:', err);
  pool.end();
});
