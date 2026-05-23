import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./scripts/service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function testWrite() {
  const flyerId = '7889162';
  const docRef = db.collection('public_flyers').doc(flyerId).collection('deals').doc('test_deal');
  
  console.log('Writing test deal...');
  await docRef.set({
    id: 'test_deal',
    name: 'Test Deal Product',
    price: 9.99,
    ingestedAt: new Date()
  });
  console.log('Successfully wrote test deal!');
  
  const snap = await docRef.get();
  console.log('Read back:', snap.exists ? JSON.stringify(snap.data()) : 'Does not exist');
  
  // Clean up
  await docRef.delete();
  console.log('Successfully cleaned up test deal!');
}

testWrite().catch(console.error);
