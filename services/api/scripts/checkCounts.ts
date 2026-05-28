import { Pool } from 'pg';

const url = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: url,
});

async function checkCounts() {
  const tables = [
    'ref_business_types',
    'ref_categories',
    'ref_order_statuses',
    'ref_payment_statuses',
    'staff',
    'users',
    'stores',
    'master_products',
    'merchant_products',
    'orders',
    'order_items',
    'careers',
    'job_applications',
    'ads',
    'surveys',
    'survey_responses'
  ];

  console.log("=== DB RECORD COUNT SUMMARY ===");
  for (const table of tables) {
    try {
      const res = await pool.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`${table.padEnd(25)}: ${res.rows[0].count}`);
    } catch (err: any) {
      console.error(`Error querying ${table}:`, err.message);
    }
  }

  console.log("\n=== CHECKING SPECIFIC ORDER (ORDER-001) ===");
  try {
    const res = await pool.query("SELECT * FROM orders WHERE id = 'ORDER-001'");
    if (res.rows.length > 0) {
      console.log("ORDER-001 found in PostgreSQL:", JSON.stringify(res.rows[0], null, 2));
    } else {
      console.log("ORDER-001 NOT found in PostgreSQL.");
    }
  } catch (err: any) {
    console.error("Error querying ORDER-001:", err.message);
  }
  pool.end();
}

checkCounts().catch(console.error);
