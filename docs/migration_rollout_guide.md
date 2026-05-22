# Spendigo Database Migration: Step-by-Step Rollout & Scratch Deployment Guide

This guide provides the definitive, step-by-step operational checklist for migrating the Spendigo database from Cloud Firestore to Firebase SQL Connect (PostgreSQL) using Drizzle ORM. 

By executing these steps, you will establish a fully isolated, zero-assumption sandbox for development and staging, run pre-flight integrity audits, migrate historical data in batched sequences, implement dual-write resilience, and transition traffic with zero downtime.

---

## Rollout Lifecycle Overview

The migration is divided into 8 linear phases. You must complete each phase and verify its success criteria before proceeding to the next.

```
┌────────────────────────────────────────────────────────┐
│   PHASE 1: Local Sandbox Setup (From Scratch)          │ ◄─ Start here for safe development
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│   PHASE 2: Cloud Staging Environment Provisioning      │ ◄─ 100% Isolated GCP/Firebase Project
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│   PHASE 3: Branch Deployment & CI/CD Setup             │ ◄─ Automated Staging Deployments
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│   PHASE 4: Pre-Flight Integrity Auditing               │ ◄─ Orphan Detection & Log Sweep
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│   PHASE 5: Automated Backfill Execution                │ ◄─ Batched Historical Import
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│   PHASE 6: Data Parity & Aggregation Validation        │ ◄─ 100% Statistical Verification
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│   PHASE 7: Resilient Dual-Write Pipeline Activation    │ ◄─ Live Synchronous Double-Writes
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│   PHASE 8: Read Switchover & Legacy Decommissioning    │ ◄─ Final Cutover & Firestore Sunset
└────────────────────────────────────────────────────────┘
```

---

## Phase 1: Local Sandbox Setup (From Scratch)

Create an entirely local environment where you can modify schemas and run database queries without modifying any cloud assets.

### 1.1 Spin up PostgreSQL in Docker
Deploy a local, persistent PostgreSQL instance configured with a dedicated database for Spendigo development:
```bash
docker run --name spendigo-dev-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=spendigo_dev \
  -p 5432:5432 \
  -d postgres:16
```

Verify that the database is running:
```bash
docker ps | grep spendigo-dev-postgres
```

### 1.2 Configure Local Environment Variables
Create the development environment file `/services/api/.env.development`:
```env
# ── Local PostgreSQL Database URL ─────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/spendigo_dev

# ── Environment Configurations ────────────────────────────────────────────────
NODE_ENV=development
APP_URL=http://localhost:3000
```

### 1.3 Generate and Push Schemas
Initialize Drizzle Kit to analyze your typed schema in `src/db/schema.ts` and push the structure to your local Docker container:
```bash
# Navigate to the API service
cd services/api

# Generate Drizzle migration files
npx drizzle-kit generate

# Push the schema structure to your local database instance
npx drizzle-kit push
```

### 1.4 Spin up Firebase Local Emulators
Start the emulators so that Firestore writes, cloud function triggers, and mock auth run entirely on your local machine:
```bash
# Run from the project root
npx firebase emulators:start --import=./tests/emulator-data --export-on-exit
```

---

## Phase 2: Cloud Staging Environment Provisioning

Staging is a complete clone of your production systems under a **separate, isolated Google Cloud & Firebase project** to prevent data or schema pollution.

### 2.1 Create the Staging Firebase Project
1. Log in to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project** and name it `spendigo-v1-staging`.
3. Choose to enable or disable Google Analytics as desired.
4. Click **Create Project**.
5. Once created, select **Build ➔ Firestore Database** and click **Create Database**.
6. Set the database region (e.g., `nam5 (us-central)` or your specific location) and select **Start in production mode**.

### 2.2 Configure Local CLI Project Aliases
In your terminal, add the newly created staging project as an alias so you can quickly switch targets:
```bash
# Run from the project root
firebase use --add
```
* **Prompt**: Select `spendigo-v1-staging` from the active project list.
* **Prompt**: When asked to name the alias, type `staging`.

To switch back and forth between active environments:
```bash
firebase use staging      # Targets staging
firebase use default      # Targets production
```

### 2.3 Provision Staging Cloud SQL (PostgreSQL)
1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and select your staging project: `spendigo-v1-staging`.
2. Navigate to **Cloud SQL ➔ Create Instance**.
3. Choose **PostgreSQL** as the database engine.
4. Configure the instance settings:
   - **Instance ID**: `spendigo-staging-postgres`
   - **Database Version**: `PostgreSQL 16`
   - **Password**: Generate a strong password (record this for your database URL).
   - **Machine Configuration**: Choose a lightweight single-core instance (e.g., Shared Core `db-f1-micro` or standard custom machine with 2GB RAM).
   - **Storage**: SSD (10GB is sufficient for staging).
   - **Connections**: Enable **Private IP** (if configured inside a shared VPC) or configure **Public IP** with **Authorized Networks** (adding your local IP) to test migrations. Alternatively, configure the secure **Cloud SQL Auth Proxy** (Recommended).
5. Click **Create Instance** and wait for provisioning (5-10 minutes).
6. Create the staging database: Click on your instance, select **Databases ➔ Create Database**, and name it `spendigo_staging`.

### 2.4 Configure Cloud Secret Manager via Firebase CLI
Sensitive production and staging keys must **never** be checked into your Git repository. Inject these keys directly into Google Cloud Secret Manager for your staging project using the Firebase CLI:

```bash
# Ensure you are actively targeting the staging project
firebase use staging

# 1. Set Database URL (Replace variables with your Cloud SQL IP and Password)
firebase secrets:set DATABASE_URL="postgresql://postgres:YOUR_STAGING_PASSWORD@YOUR_CLOUD_SQL_IP:5432/spendigo_staging"

# 2. Set Stripe Test Mode API Secret Key
firebase secrets:set STRIPE_SECRET_KEY="sk_test_51SjU..."

# 3. Set Stripe Test Mode Webhook Signing Secret
firebase secrets:set STRIPE_WEBHOOK_SECRET="whsec_..."

# 4. Set Algolia Admin API Key (For index building operations)
firebase secrets:set ALGOLIA_API_KEY="your_staging_algolia_admin_write_key"
```

### 2.5 Configure Non-Sensitive Environment Variables
For non-sensitive configs, create and edit environment configuration files.

#### Staging Frontend Configuration (`/apps/web/.env.staging`):
```env
# ── Staging Firebase App Credentials ──────────────────────────────────────────
VITE_FIREBASE_API_KEY=AIzaSyStagingKeyHere...
VITE_FIREBASE_AUTH_DOMAIN=spendigo-v1-staging.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=spendigo-v1-staging
VITE_FIREBASE_STORAGE_BUCKET=spendigo-v1-staging.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-staging-sender-id
VITE_FIREBASE_APP_ID=1:your:staging:web:app:id
VITE_FIREBASE_VAPID_KEY=your-staging-web-push-key

# ── Staging Third-Party Credentials ──────────────────────────────────────────
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51SjU...
VITE_ALGOLIA_APP_ID=G4YDI21FPH
VITE_ALGOLIA_SEARCH_KEY=your-staging-search-only-key
VITE_ALGOLIA_INDEX_NAME=staging_master_products
VITE_GEMINI_API_KEY=your-staging-gemini-key
```

#### Staging Backend Configuration (`/services/api/.env.staging`):
```env
STRIPE_PRICE_CORE=price_1SjiGLRFXZKzUZbZoh9O8wp6
STRIPE_PRICE_GROWTH=price_1SjiGuRFXZKzUZbZNVNhWn2W
STRIPE_PRICE_PRO=price_1TZEMvRFXZKzUZbZxPOrD4EQ
ALGOLIA_INDEX_NAME=staging_master_products
ALGOLIA_MERCHANT_INDEX_NAME=staging_merchant_products
APP_URL=https://spendigo-v1-staging.web.app
ADMIN_ALERT_EMAIL=staging-alerts@spendigo.ca
```

---

## Phase 3: Branch Deployment & CI/CD Setup

To automate testing, building, and rolling out code to the staging sandbox, set up an isolated Git branch and dedicated GitHub Actions workflow.

### 3.1 Create and Checkout Staging Branch
From your main repository, branch off to start your staging development cycle:
```bash
# Ensure your branch is clean and up to date
git checkout main
git pull

# Create the staging branch
git checkout -b staging
```

### 3.2 Establish GitHub Repository Secrets
Navigate to your GitHub repository dashboard under **Settings ➔ Secrets and Variables ➔ Actions** and register these secrets:

* `FIREBASE_SERVICE_ACCOUNT_SPENDIGO_STAGING`: JSON service account key for staging. (Generate this from your staging Google Cloud Console under **IAM & Admin ➔ Service Accounts ➔ Create Key ➔ JSON**).
* `VITE_FIREBASE_API_KEY_STAGING`: Staging Firebase API Key.
* `VITE_FIREBASE_AUTH_DOMAIN_STAGING`: `spendigo-v1-staging.firebaseapp.com`.
* `VITE_FIREBASE_PROJECT_ID_STAGING`: `spendigo-v1-staging`.
* `VITE_STRIPE_PUBLISHABLE_KEY_STAGING`: Stripe Publishable Test Key.
* `VITE_ALGOLIA_APP_ID_STAGING`: Staging Algolia App ID.
* `VITE_ALGOLIA_SEARCH_KEY_STAGING`: Staging Algolia public search-only key.

### 3.3 Deploy the CI/CD Staging Workflow
Add the following workflow configuration file to `/Users/I501801/Documents/Projects/Spendigo-v1/.github/workflows/staging.yml` (This will automate full static builds and Cloud Function deployments whenever a commit or pull request merges into `staging`):

```yaml
name: Deploy to Firebase Hosting and Functions on merge to staging

on:
  push:
    branches:
      - staging

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    env:
      FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Run Code Linter
        run: npm run lint

      - name: Build Web Application
        run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY_STAGING }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN_STAGING }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID_STAGING }}
          VITE_FIREBASE_STORAGE_BUCKET: spendigo-v1-staging.appspot.com
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID_STAGING }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID_STAGING }}
          VITE_ALGOLIA_APP_ID: ${{ secrets.VITE_ALGOLIA_APP_ID_STAGING }}
          VITE_ALGOLIA_SEARCH_KEY: ${{ secrets.VITE_ALGOLIA_SEARCH_KEY_STAGING }}
          VITE_ALGOLIA_INDEX_NAME: staging_master_products
          VITE_STRIPE_PUBLISHABLE_KEY: ${{ secrets.VITE_STRIPE_PUBLISHABLE_KEY_STAGING }}

      - name: Deploy Staging Firebase Hosting
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT_SPENDIGO_STAGING }}'
          channelId: live
          projectId: spendigo-v1-staging

      - name: Deploy Staging Firestore and Storage Rules
        uses: w9jds/firebase-action@v15.8.0
        with:
          args: deploy --only firestore,storage --project spendigo-v1-staging
        env:
          GCP_SA_KEY: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_SPENDIGO_STAGING }}

      - name: Deploy Staging Firebase Functions
        uses: w9jds/firebase-action@v15.8.0
        with:
          args: deploy --only functions --project spendigo-v1-staging
        env:
          GCP_SA_KEY: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_SPENDIGO_STAGING }}
```

---

## Phase 4: Pre-Flight Integrity Auditing

Before running the historical data migration, you must run the read-only pre-migration audit script to find any orphans, malformed data structures, or missing references in your Firestore dataset.

### 4.1 Set Up Staging Credentials
To run scripts locally against your cloud staging environment:
1. Save your staging Service Account JSON key to `/Users/I501801/Documents/Projects/Spendigo-v1/services/api/scripts/service-account.json`.
2. Ensure this file is ignored in Git (already handled in `.gitignore` patterns).

### 4.2 Run the Pre-Migration Auditor
Execute the audit script:
```bash
# Navigate to the API service directory
cd /Users/I501801/Documents/Projects/Spendigo-v1/services/api

# Run the auditor using ts-node
npx ts-node scripts/preMigrationAudit.ts
```

### 4.3 Review the Audit Integrity Report
Open and inspect the generated JSON report at:
`/Users/I501801/Documents/Projects/Spendigo-v1/services/api/pre_migration_audit_report.json`

Check the following properties:
* `orphans.merchantProductsMissingStore`: Identifies merchant products that reference non-existent stores.
* `orphans.merchantProductsMissingMaster`: Identifies merchant products referencing non-existent master products.
* `orphans.ordersMissingCustomer` & `orphans.ordersMissingStore`: Identifies orders that reference deleted users or stores.

> [!WARNING]
> If the audit reveals high volume of records referencing non-existent parent IDs, you must determine whether to:
> 1. Allow the backfill script to skip these records (default safe behavior), OR
> 2. Create placeholder stub records in your target PostgreSQL database prior to migrating child elements.

---

## Phase 5: Automated Backfill Execution

With your database tables initialized and your integrity report verified, run the sequential backfill script to transfer data from Firestore to PostgreSQL.

### 5.1 Initialize Schemas on Cloud SQL (Proxy Session)
Connect to your cloud staging PostgreSQL instance and create the tables:
```bash
# Target your staging environment URL
export DATABASE_URL="postgresql://postgres:YOUR_STAGING_PASSWORD@YOUR_CLOUD_SQL_IP:5432/spendigo_staging"

# Run Drizzle Kit push to initialize SQL tables
npx drizzle-kit push
```

### 5.2 Run the Data Backfill Script
Launch the migration execution:
```bash
# Execute the backfill migration using ts-node
npx ts-node scripts/backfillMigration.ts
```

Monitor the logs:
1. **Users Migration**: Watch for successful user insertions.
2. **Stores Migration**: Watch for successful store insertions.
3. **Master Products Migration**: Watch for global product catalog indexing.
4. **Circular Reference Updates**: Drizzle updates the `users.storeId` properties for store owners.
5. **Merchant Products Migration**: Migrates individual inventory prices with compound keys.
6. **Orders & Order Items Migration**: Processes and flattens orders while logging and skipping orphans.

---

## Phase 6: Data Parity & Aggregation Validation

To ensure 100% data integrity, you must compare aggregates and totals between Cloud Firestore and PostgreSQL.

### 6.1 Database Verification Queries
Run these queries on your PostgreSQL instance and compare counts with Firestore:

#### Check 1: Record Count Integrity
```sql
-- Compare with Firestore total users count
SELECT COUNT(*) FROM users;

-- Compare with Firestore total stores count
SELECT COUNT(*) FROM stores;

-- Compare with Firestore total global products count
SELECT COUNT(*) FROM master_products;

-- Compare with Firestore total orders count
SELECT COUNT(*) FROM orders;
```

#### Check 2: Financial Sum Reconciliation
To ensure no transaction records are corrupted or missing currency figures, verify the complete checkout volume:
```sql
-- Compute the sum total of all orders
SELECT SUM(total) as postgres_checkout_total, SUM(tax) as postgres_tax_total FROM orders;
```
*Compare the return values with an aggregation query run on your Firestore `orders` collection.*

#### Check 3: Relational Completeness Scan
Verify that the database does not contain orphaned records:
```sql
-- Check for orders referencing missing users
SELECT COUNT(*) FROM orders o LEFT JOIN users u ON o."customerId" = u.id WHERE u.id IS NULL;

-- Check for order items referencing missing master products
SELECT COUNT(*) FROM order_items oi LEFT JOIN master_products mp ON oi."masterProductId" = mp.id WHERE mp.id IS NULL;
```
*Both queries must return `0` records.*

---

## Phase 7: Resilient Dual-Write Pipeline Activation

To ensure zero downtime, deploy the dual-write architecture inside your Cloud Functions. During this phase, application writes are committed to **both** Firestore (primary) and PostgreSQL (secondary) concurrently.

### 7.1 Review the Dual-Write Resiliency Code Pattern
When saving or editing entities (e.g. within `placeOrder` functions), apply this transactional pattern using Drizzle ORM:

```typescript
import { db } from '../db/client'; // Drizzle client
import * as schema from '../db/schema';

async function handleNewOrder(orderData: any) {
  // 1. Primary Write: Commit to Cloud Firestore
  const firestoreRef = admin.firestore().collection('orders').doc(orderData.id);
  await firestoreRef.set(orderData);
  
  // 2. Secondary Write: Commit to PostgreSQL (Drizzle)
  try {
    await db.insert(schema.orders).values({
      id: orderData.id,
      customerId: orderData.customerId,
      storeId: orderData.storeId,
      storeName: orderData.storeName,
      customerName: orderData.customerName,
      customerEmail: orderData.customerEmail,
      subtotal: orderData.subtotal,
      deliveryFee: orderData.deliveryFee,
      tax: orderData.tax,
      total: orderData.total,
      paymentStatus: orderData.paymentStatus,
      status: orderData.status,
      deliveryAddress: orderData.deliveryAddress,
      createdAt: new Date(),
    });
    
    // Flatten and insert order items
    const orderItemValues = orderData.items.map((item: any, index: number) => ({
      id: `${orderData.id}_item_${index}`,
      orderId: orderData.id,
      masterProductId: item.productId,
      productName: item.productName,
      effectivePrice: item.price,
      quantity: item.quantity,
      taxable: item.taxable ?? true,
    }));
    
    await db.insert(schema.orderItems).values(orderItemValues);
    
  } catch (pgError: any) {
    // CRITICAL: A Postgres write error must NEVER fail the client transaction
    console.error(`PostgreSQL Dual-Write failed for order ${orderData.id}:`, pgError.message);
    
    // Log the payload to a Cloud Pub/Sub dead-letter queue (DLQ) for retry reconciliation
    await publishToDLQ('order-migration-retry', {
      entityType: 'order',
      payload: orderData,
      error: pgError.message,
      timestamp: new Date().toISOString()
    });
  }
}
```

### 7.2 Run an Incremental Sweep Migration
If your dual-write functions are deployed *after* the initial backfill script finished, run a final incremental sweep script to capture any delta data created in the transition window:
```bash
# Run incremental update sweep targeting timestamps greater than the initial backfill start time
npx ts-node scripts/backfillMigration.ts --incremental --since="2026-05-22T10:00:00Z"
```

---

## Phase 8: Read Switchover & Legacy Decommissioning

Once dual-writes are stable and data is verified to be in sync, transition client reads to your new PostgreSQL database.

### 8.1 Shift Frontend Read Routing
Update your API controllers or Cloud Functions to retrieve data directly from PostgreSQL using Drizzle instead of Firestore collection calls:

```typescript
// Legacy Firestore read path (DEPRECATED)
// const stores = await admin.firestore().collection('stores').where('status', '==', 'active').get();

// Modern Drizzle SQL read path (ACTIVE)
import { db } from '../db/client';
import { stores } from '../db/schema';
import { eq } from 'drizzle-orm';

const activeStores = await db.select().from(stores).where(eq(stores.status, 'active'));
```

### 8.2 Lock Legacy Firestore Writing Paths
To prevent old client applications or cached sessions from writing to obsolete Firestore paths, deploy strict Firestore Security Rules that block create, update, and delete actions while keeping reads open:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Lock catalog and orders to read-only during decommissioning phase
    match /master_products/{product} {
      allow read: if true;
      allow write: if false; // Locked
    }
    
    match /orders/{order} {
      allow read: if request.auth != null;
      allow write: if false; // Locked
    }
    
    match /stores/{store} {
      allow read: if true;
      allow write: if false; // Locked
    }
  }
}
```
Deploy the new rules:
```bash
firebase deploy --only firestore:rules --project spendigo-v1-staging
```

### 8.3 Final Archive Backup
Once operations are 100% shifted to PostgreSQL, run a final Google Cloud Storage export of your historical Firestore data for retention compliance:
```bash
gcloud firestore export gs://spendigo-legacy-backups-staging/final-firestore-archive
```

---

## Rollout Troubleshooting Guide

### 1. SSL Connection Handshake Failures
* **Symptom**: `Error: self signed certificate` or `SSL connection failed`.
* **Resolution**: When connecting Cloud Functions or local scripts to GCP SQL Connect, ensure your database connection string has `sslmode=require` or specify the database SSL CA certificates in the Drizzle configuration Pool settings.

### 2. Connection Pool Starvation
* **Symptom**: Cloud functions timeout with `max pool connections reached`.
* **Resolution**: Serverless functions scale down to zero. Always declare your database connection pools and client instances **outside** the cloud function handler block to enable connection reuse across invocations. Use a low max connection size (e.g. `max: 2` or `max: 5` per function instance) to avoid exceeding PostgreSQL pool limits.

### 3. Timestamp Incompatibilities
* **Symptom**: `date/time field value out of range`.
* **Resolution**: Firestore timestamps utilize the `admin.firestore.Timestamp` class containing nanosecond integers. Before inserting into PostgreSQL, verify that timestamps are converted using `.toDate()` or cast explicitly to JavaScript `Date` objects in your TypeScript controllers.
