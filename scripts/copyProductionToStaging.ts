import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

// 1. Initialize Production Firebase App
const prodServiceAccountPath = './scripts/service-account-prod.json';
if (!fs.existsSync(prodServiceAccountPath)) {
  console.error(`Error: Production service account key not found at ${prodServiceAccountPath}`);
  process.exit(1);
}
const prodServiceAccount = JSON.parse(fs.readFileSync(prodServiceAccountPath, 'utf8'));
const prodApp = initializeApp({
  credential: cert(prodServiceAccount)
}, 'production');

const prodDb = getFirestore(prodApp);

// 2. Initialize Staging Firebase App
const stagingServiceAccountPath = './scripts/service-account.json';
if (!fs.existsSync(stagingServiceAccountPath)) {
  console.error(`Error: Staging service account key not found at ${stagingServiceAccountPath}`);
  process.exit(1);
}
const stagingServiceAccount = JSON.parse(fs.readFileSync(stagingServiceAccountPath, 'utf8'));
const stagingApp = initializeApp({
  credential: cert(stagingServiceAccount)
}, 'staging');

const stagingDb = getFirestore(stagingApp);

async function copyCollection(collectionName: string) {
  console.log(`\n--- Copying collection "${collectionName}" from Production to Staging ---`);
  
  const prodSnap = await prodDb.collection(collectionName).get();
  console.log(`Found ${prodSnap.size} documents in Production "${collectionName}".`);
  
  if (prodSnap.size === 0) {
    console.log(`Skipping empty collection.`);
    return;
  }

  // Delete existing staging collection first to ensure a clean sync
  const stagingSnap = await stagingDb.collection(collectionName).get();
  if (stagingSnap.size > 0) {
    console.log(`Wiping ${stagingSnap.size} existing documents in Staging "${collectionName}"...`);
    const deleteBatch = stagingDb.batch();
    stagingSnap.forEach(doc => {
      deleteBatch.delete(doc.ref);
    });
    await deleteBatch.commit();
    console.log(`Staging "${collectionName}" wiped clean.`);
  }

  // Copy in batches of 500
  let batch = stagingDb.batch();
  let count = 0;
  let batchCount = 0;

  for (const doc of prodSnap.docs) {
    const data = doc.data();
    const destRef = stagingDb.collection(collectionName).doc(doc.id);
    batch.set(destRef, data);
    count++;
    batchCount++;

    if (batchCount === 500) {
      await batch.commit();
      console.log(`Committed batch of 500 (Total: ${count}/${prodSnap.size})`);
      batch = stagingDb.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`Committed final batch of ${batchCount} (Total: ${count}/${prodSnap.size})`);
  }

  console.log(`[✓] Collection "${collectionName}" successfully synchronized!`);
}

async function runSync() {
  console.log('=== STARTING PRODUCTION-TO-STAGING DATA SYNCHRONIZATION ===');
  
  // Synchronize essential catalog and metadata collections
  await copyCollection('categories');
  await copyCollection('master_products');
  await copyCollection('careers');
  await copyCollection('staff');
  
  console.log('\n[✓] SUCCESS: Production-to-Staging catalog sync complete!');
  process.exit(0);
}

runSync().catch(err => {
  console.error('Synchronization failed:', err);
  process.exit(1);
});
