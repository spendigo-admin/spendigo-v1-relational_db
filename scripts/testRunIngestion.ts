import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import { runIngestion } from '../services/api/src/utils/flippScraper';

const serviceAccount = JSON.parse(fs.readFileSync('./scripts/service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: 'spendigo-8540c.firebasestorage.app'
});

async function test() {
  console.log('Starting ingestion run for postal code M5V 2H1...');
  const result = await runIngestion('M5V 2H1', false);
  console.log('Ingestion result:', JSON.stringify(result, null, 2));
}

test().catch(console.error);
