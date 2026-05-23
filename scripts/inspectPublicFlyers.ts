import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./scripts/service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function inspectPublicFlyers() {
  const flyersSnapshot = await db.collection('public_flyers').get();
  console.log(`Found ${flyersSnapshot.size} public flyers in Firestore.`);
  
  let totalDeals = 0;
  for (const flyerDoc of flyersSnapshot.docs) {
    const data = flyerDoc.data();
    const dealsSnapshot = await flyerDoc.ref.collection('deals').get();
    console.log(`Flyer: ${data.retailer} (${flyerDoc.id}) - deals count in doc: ${data.dealsCount}, actual deals in subcollection: ${dealsSnapshot.size}`);
    totalDeals += dealsSnapshot.size;
  }
  console.log(`Total deals in public_flyers subcollections: ${totalDeals}`);
}

inspectPublicFlyers().catch(console.error);
