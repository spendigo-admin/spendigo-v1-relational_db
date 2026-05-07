import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./scripts/service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function inspectStores() {
  const storesSnapshot = await db.collection('stores').get();
  for (const doc of storesSnapshot.docs) {
    const data = doc.data();
    console.log(`Store: ${data.name} (${doc.id})`);
    console.log(`  logoUrl: ${data.logoUrl}`);
    console.log(`  image: ${data.image}`);
    console.log(`  logo: ${data.logo}`);
  }
}

inspectStores().catch(console.error);
