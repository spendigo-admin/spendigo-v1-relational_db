import * as admin from 'firebase-admin';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Load service account relative to services/api/scripts/reconcileFinance.ts
const serviceAccountPath = path.join(__dirname, '../../../scripts/service-account.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error(`Error: Service account file not found at ${serviceAccountPath}`);
    process.exit(1);
}

const serviceAccount = require(serviceAccountPath);
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const firestore = admin.firestore();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function reconcile() {
  console.log("=== STARTING FINANCIAL PARITY RECONCILIATION ===");

  // 1. Gather Firestore Sums
  console.log("Aggregating Firestore orders...");
  const ordersSnap = await firestore.collection('orders').get();
  let firestoreTotalCents = 0;
  let firestoreTaxCents = 0;
  let firestoreCount = 0;

  ordersSnap.forEach(doc => {
    const data = doc.data();
    firestoreTotalCents += Math.round(parseFloat(data.total || 0) * 100);
    firestoreTaxCents += Math.round(parseFloat(data.tax || 0) * 100);
    firestoreCount++;
  });

  const firestoreTotal = firestoreTotalCents / 100.0;
  const firestoreTax = firestoreTaxCents / 100.0;

  // 2. Gather PostgreSQL Sums
  console.log("Aggregating PostgreSQL orders...");
  const pgRes = await pool.query('SELECT COUNT(*) as count, SUM(total) as total, SUM(tax) as tax FROM orders');
  const pgCount = parseInt(pgRes.rows[0].count);
  const pgTotalCents = parseInt(pgRes.rows[0].total || 0);
  const pgTaxCents = parseInt(pgRes.rows[0].tax || 0);

  const pgTotalDollars = pgTotalCents / 100.0;
  const pgTaxDollars = pgTaxCents / 100.0;

  // 3. Comparison
  console.log("\n================ RECONCILIATION REPORT ================");
  console.log(`Metric                     | Firestore         | PostgreSQL        | Discrepancy`);
  console.log(`---------------------------+-------------------+-------------------+------------`);
  
  const countDiff = pgCount - firestoreCount;
  console.log(`Order Count                | ${firestoreCount.toString().padEnd(17)} | ${pgCount.toString().padEnd(17)} | ${countDiff}`);
  
  const totalDiff = pgTotalDollars - firestoreTotal;
  console.log(`Total Sales ($)            | $${firestoreTotal.toFixed(2).padEnd(16)} | $${pgTotalDollars.toFixed(2).padEnd(16)} | $${totalDiff.toFixed(2)}`);
  
  const taxDiff = pgTaxDollars - firestoreTax;
  console.log(`Total Tax Collected ($)     | $${firestoreTax.toFixed(2).padEnd(16)} | $${pgTaxDollars.toFixed(2).padEnd(16)} | $${taxDiff.toFixed(2)}`);
  
  console.log(`=======================================================`);
  
  if (countDiff === 0 && Math.abs(totalDiff) < 0.01 && Math.abs(taxDiff) < 0.01) {
    console.log("\n[✓] SUCCESS: 100% absolute financial and mathematical parity achieved!");
  } else {
    console.log("\n[!] WARNING: Mismatches detected. Review legacy records or stubs.");
  }

  pool.end();
}

reconcile().catch(console.error);
