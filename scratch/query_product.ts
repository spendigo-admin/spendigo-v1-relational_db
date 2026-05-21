import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./scripts/service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  console.log("Fetching cart for user SxA7TBdB0RUz3HtnKrwqDUdbTtQ2...");
  const doc = await db.collection('carts').doc('SxA7TBdB0RUz3HtnKrwqDUdbTtQ2').get();
  if (doc.exists) {
    console.log("Cart Data:", JSON.stringify(doc.data(), null, 2));
  } else {
    console.log("Cart does not exist.");
  }
}

run().catch(console.error);
