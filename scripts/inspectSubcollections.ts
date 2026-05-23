import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./scripts/service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function inspectSubcollections() {
  const flyersSnapshot = await db.collection('public_flyers').limit(1).get();
  if (flyersSnapshot.empty) {
    console.log("No flyers found.");
    return;
  }
  
  const flyerDoc = flyersSnapshot.docs[0];
  const subcollections = await flyerDoc.ref.listCollections();
  console.log(`Flyer doc ID: ${flyerDoc.id}`);
  console.log(`Subcollections found: ${subcollections.map(c => c.id).join(', ')}`);
}

inspectSubcollections().catch(console.error);
