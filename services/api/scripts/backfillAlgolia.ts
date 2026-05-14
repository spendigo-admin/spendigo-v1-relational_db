import * as admin from 'firebase-admin';
import { algoliasearch } from 'algoliasearch';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY;
const ALGOLIA_INDEX_NAME = process.env.ALGOLIA_MERCHANT_INDEX_NAME || 'merchant_products';

if (!ALGOLIA_APP_ID || !ALGOLIA_API_KEY) {
  console.error('Missing Algolia credentials in environment variables.');
  process.exit(1);
}

// Ensure you have FIREBASE_AUTH_EMULATOR_HOST or GOOGLE_APPLICATION_CREDENTIALS set or just use default
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const algoliaClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY);

async function backfill() {
  console.log(`Starting backfill to Algolia index: ${ALGOLIA_INDEX_NAME}`);
  
  const merchantProductsRef = db.collection('merchant_products');
  const snapshot = await merchantProductsRef.get();
  
  if (snapshot.empty) {
    console.log('No merchant products found to backfill.');
    return;
  }

  const objectsToIndex = [];
  console.log(`Found ${snapshot.size} merchant products. Processing...`);

  // We should fetch master_products and stores in memory if possible, or batch
  const masterCache = new Map();
  const storeCache = new Map();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    // Skip if inactive
    if (data.is_active === false || data.available_quantity <= 0) {
      continue;
    }

    if (!data.merchant_id || !data.master_product_id) continue;

    // Fetch Master
    if (!masterCache.has(data.master_product_id)) {
      const masterDoc = await db.collection('master_products').doc(data.master_product_id).get();
      if (masterDoc.exists) masterCache.set(data.master_product_id, masterDoc.data());
    }
    
    // Fetch Store
    if (!storeCache.has(data.merchant_id)) {
      const storeDoc = await db.collection('stores').doc(data.merchant_id).get();
      if (storeDoc.exists) storeCache.set(data.merchant_id, storeDoc.data());
    }

    const masterData = masterCache.get(data.master_product_id);
    const storeData = storeCache.get(data.merchant_id);

    if (!masterData || !storeData) continue;

    let geoloc = null;
    if (storeData.location?.lat && storeData.location?.lng) {
      geoloc = { lat: storeData.location.lat, lng: storeData.location.lng };
    } else if (storeData.geoloc?.latitude && storeData.geoloc?.longitude) {
      geoloc = { lat: storeData.geoloc.latitude, lng: storeData.geoloc.longitude };
    }

    const payload: any = {
      objectID: doc.id,
      merchant_product_id: doc.id,
      merchant_id: data.merchant_id,
      master_product_id: data.master_product_id,
      price: data.price || 0,
      original_price: data.original_price || null,
      available_quantity: data.available_quantity || 0,
      merchant_sku: data.merchant_sku || '',
      discount_label: data.discount_label || '',
      product_name: masterData.product_name || '',
      brand_name: masterData.brand_name || '',
      short_description: masterData.short_description || '',
      category_id: masterData.category_id || '',
      dietary_tags: masterData.dietary_tags || [],
      upc_gtin: masterData.upc_gtin || '',
      barcode: masterData.barcode || '',
      primary_image_url: masterData.primary_image_url || '',
      updated_at: Date.now()
    };

    if (geoloc) {
      payload._geoloc = geoloc;
    }

    objectsToIndex.push(payload);
  }

  console.log(`Prepared ${objectsToIndex.length} verified records for Algolia.`);
  
  if (objectsToIndex.length > 0) {
    try {
      // Chunking if too many
      const chunkSize = 1000;
      for (let i = 0; i < objectsToIndex.length; i += chunkSize) {
        const chunk = objectsToIndex.slice(i, i + chunkSize);
        await algoliaClient.saveObjects({ indexName: ALGOLIA_INDEX_NAME, objects: chunk });
        console.log(`Saved chunk ${i/chunkSize + 1} to Algolia.`);
      }
      console.log('Backfill complete!');
    } catch (e) {
      console.error('Error saving objects to Algolia:', e);
    }
  }
}

backfill()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
