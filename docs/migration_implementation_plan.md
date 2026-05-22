# Spendigo Migration: Implementation Plan

This document outlines the architecture, database schema, database relationships, and migration safety protocols for moving the Spendigo database from Cloud Firestore to Firebase SQL Connect (PostgreSQL) using Drizzle ORM.

> [!TIP]
> **Step-by-Step Rollout Guide**: For complete, command-by-command instructions on provisioning staging resources, managing Git branches, running the pre-flight auditor, executing the backfill, and running the dual-write pipeline, refer to the [Migration Rollout & Scratch Deployment Guide](file:///Users/I501801/Documents/Projects/Spendigo-v1/docs/migration_rollout_guide.md).

---

## Executive Summary

Spendigo's high-performance Canadian marketplace facilitator features a hybrid catalog (Master vs. Merchant catalogs), subcollections (`deals`, `flyers`, `analytics`, `notifications`, `responses`), and a forensic audit log ledger with SHA-256 cryptographic chaining. 

To transition from a document-based NoSQL architecture to a strictly-typed, relational PostgreSQL database, we must resolve circular relationships, nested maps/arrays, unique constraints, and foreign key deletion behaviors. This plan establishes a **Constraint-First** design to guarantee relational and transactional safety, safeguarding Spendigo's checkout and catalog operations.

---

## User Review Required (The "/grill-me" Clarifications)

Below are the 5 critical architectural decisions identified during deep scanning of `firestore.rules`, `catalog.ts`, `placeOrder.ts`, and trigger codes.

### 1. Circular User-Store Ownership
> [!IMPORTANT]
> **The Conflict**: A `user` of role `merchant` contains a `storeId` field pointing to their store. Conversely, a `store` contains an `ownerId` field pointing to their owning `user`. Additionally, a store has team members.
>
> **Recommended Approach**: 
> - Treat `stores.owner_id` as the **definitive single source of truth** for primary ownership (Foreign Key referencing `users.id` with `ON DELETE RESTRICT`).
> - Model the `users.store_id` as a nullable Foreign Key referencing `stores.id` (`ON DELETE SET NULL`), signifying which store the merchant is currently assigned to manage. This supports multi-merchant teams and clean schema initialization without circular insert deadlocks.

### 2. Merchant Product Identifiers (Primary Key Strategy)
> [!IMPORTANT]
> **The Conflict**: In Firestore, `/merchant_products/{id}` documents are often keyed deterministically as `storeId_masterProductId`.
>
> **Recommended Approach**:
> - Implement a **composite primary key** `(store_id, master_product_id)` in the PostgreSQL `merchant_products` table.
> - This native database constraint prevents a merchant from creating duplicate pricing/inventory entries for the same master product, while maintaining high index performance.

### 3. JSONB vs. Relational Sub-Tables for Arrays
> [!IMPORTANT]
> **The Conflict**: Several Firestore entities utilize nested arrays of maps (e.g., `orders.items`, `users.addresses`, `users.fcmTokens`).
>
> **Recommended Approach**:
> - **Flatten `order_items` into a dedicated table**: Items inside orders are critical for analytics, inventory auditing, and financial verification. Keeping them in a separate `order_items` table with foreign keys ensures full referential integrity.
> - **Flatten `user_fcm_tokens` into a dedicated table**: FCM tokens are frequently added, deleted, and batched during notification cycles. A separate table `user_fcm_tokens` prevents hot-spot locks on the main `users` table.
> - **Keep `users.addresses` as JSONB**: Shopper addresses are updated as a single payload and do not require joining. Storing them in a `JSONB` column inside the `users` table is perfectly sufficient.

### 4. Referential Cascading and Deletion Policies
> [!WARNING]
> **The Conflict**: Firestore permits orphaned records (e.g. products without merchant links, orders with missing shopper profiles). PostgreSQL requires rigorous deletion cascading behavior.
>
> **Recommended Approach**:
> - **Store deletion**: `ON DELETE CASCADE` for secondary operational entities (`merchant_products`, `deals`, `flyers`, `analytics`).
> - **Store deletion on Orders/Payments**: `ON DELETE RESTRICT`. We must NEVER allow a merchant's deletion to erase historical transaction and billing data used for tax audits.
> - **Master Product deletion**: `ON DELETE RESTRICT`. A master product cannot be deleted if a merchant currently sells it. Instead, its status should be set to `'deprecated'`.
> - **User deletion**: `ON DELETE RESTRICT` if they have orders. `ON DELETE CASCADE` for their `notifications`, `carts`, `wishlists`, and `fcm_tokens`.

### 5. Tamper-Evident Forensic Audit Chain Enforcement
> [!IMPORTANT]
> **The Conflict**: Audit logs are sequentially linked using `prevHash` and `hash`.
>
> **Recommended Approach**:
> - Perform canonicalization and SHA-256 computation in the **application layer** (inside our TypeScript Drizzle service) using the exact sorted-key canonicalization rules defined in `services/api/src/utils/audit.ts` to ensure 100% hash parity with old records.
> - Enforce serial transaction order at the database layer using a unique sequential index or trigger to prevent concurrent write collisions from producing split-brain chains.

---

## Proposed Changes

We will group database tables logically by component layers, order them to handle relational dependencies, and specify exact schemas and Row Level Security (RLS) policies.

```mermaid
erDiagram
    users ||--o{ user_fcm_tokens : owns
    users ||--o{ notifications : receives
    users ||--o{ orders : places
    users ||--o{ reviews : writes
    stores ||--o| users : owned_by
    stores ||--o{ merchant_products : hosts
    stores ||--o{ deals : offers
    stores ||--o{ flyers : publishes
    stores ||--o{ store_analytics : generates
    master_products ||--o{ merchant_products : references
    master_products ||--o{ pending_master_products : upgrades
    orders ||--o{ order_items : contains
    audit_logs ||--o| audit_logs : chains
```

### 1. Database Schema (`schema.ts`)
#### [NEW] [schema.ts](file:///Users/I501801/Documents/Projects/Spendigo-v1/services/api/src/db/schema.ts)
A strictly-typed Drizzle ORM schema mapping out all collections and subcollections.

```typescript
import { 
  pgTable, 
  varchar, 
  text, 
  timestamp, 
  integer, 
  doublePrecision, 
  boolean, 
  jsonb, 
  primaryKey, 
  uniqueIndex, 
  pgEnum 
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums matching Firestore catalog and user roles
export const userRoleEnum = pgEnum('user_role', ['admin', 'merchant', 'consumer']);
export const merchantSubRoleEnum = pgEnum('merchant_role', ['OWNER', 'MANAGER', 'STAFF', 'MARKETING']);
export const userStatusEnum = pgEnum('user_status', ['pending_invite', 'active', 'suspended']);
export const productStatusEnum = pgEnum('product_status', ['active', 'deprecated', 'blocked']);
export const verificationStatusEnum = pgEnum('verification_status', ['unverified', 'verified', 'manufacturer_verified']);
export const storeStatusEnum = pgEnum('store_status', ['active', 'pending', 'suspended', 'pending_deletion']);
export const orderStatusEnum = pgEnum('order_status', ['placed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled']);
export const paymentStatusEnum = pgEnum('payment_status', ['paid', 'pending', 'unpaid']);
export const notificationTypeEnum = pgEnum('notification_type', ['price_drop', 'order', 'promo', 'system', 'alert', 'review', 'approval', 'stock']);

// 1. USERS TABLE
export const users = pgTable('users', {
  id: varchar('id', { length: 128 }).primaryKey(), // Firebase UID
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  role: userRoleEnum('role').default('consumer').notNull(),
  merchantRole: merchantSubRoleEnum('merchant_role'),
  storeId: varchar('store_id', { length: 128 }), // FK defined via relations
  status: userStatusEnum('status').default('active').notNull(),
  addresses: jsonb('addresses').default([]), // Stored as JSONB
  totalOrders: integer('total_orders').default(0).notNull(),
  totalSpend: doublePrecision('total_spend').default(0.0).notNull(),
  lastOrderDate: timestamp('last_order_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastActive: timestamp('last_active').defaultNow().notNull(),
});

// 2. STORES TABLE
export const stores = pgTable('stores', {
  id: varchar('id', { length: 128 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  logo: text('logo'),
  address: text('address'),
  province: varchar('province', { length: 2 }).default('ON').notNull(),
  postalCode: varchar('postal_code', { length: 7 }),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  deliveryFee: doublePrecision('delivery_fee').default(0.0).notNull(),
  freeDeliveryThreshold: doublePrecision('free_delivery_threshold'),
  pickupEnabled: boolean('pickup_enabled').default(true).notNull(),
  deliveryEnabled: boolean('delivery_enabled').default(false).notNull(),
  maxDeliveryRadiusKm: doublePrecision('max_delivery_radius_km').default(10.0).notNull(),
  subscriptionTier: varchar('subscription_tier', { length: 50 }).default('starter').notNull(),
  status: storeStatusEnum('status').default('pending').notNull(),
  suspensionReason: text('suspension_reason'),
  ownerId: varchar('owner_id', { length: 128 }).references(() => users.id, { onDelete: 'restrict' }), // Primary Owner
  stripeAccountId: varchar('stripe_account_id', { length: 255 }),
  stripeOnboardingStatus: varchar('stripe_onboarding_status', { length: 50 }),
  kybStatus: varchar('kyb_status', { length: 50 }).default('not_submitted').notNull(),
  kybDocuments: jsonb('kyb_documents').default([]),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 3. MASTER PRODUCTS TABLE
export const masterProducts = pgTable('master_products', {
  id: varchar('id', { length: 128 }).primaryKey(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  brandName: varchar('brand_name', { length: 255 }),
  upcGtin: varchar('upc_gtin', { length: 50 }).unique(), // Unique index for UPC lookups
  isSoldByWeight: boolean('is_sold_by_weight').default(false).notNull(),
  netQuantityValue: doublePrecision('net_quantity_value'),
  netQuantityUnit: varchar('net_quantity_unit', { length: 50 }),
  packageCount: integer('package_count').default(1),
  primaryImageUrl: text('primary_image_url'),
  secondaryImageUrls: jsonb('secondary_image_urls').default([]),
  categoryId: varchar('category_id', { length: 128 }),
  productType: varchar('product_type', { length: 100 }),
  storageType: varchar('storage_type', { length: 100 }),
  taxCategoryId: varchar('tax_category_id', { length: 100 }),
  suggestedRetailPrice: doublePrecision('suggested_retail_price'),
  substitutionGroupId: varchar('substitution_group_id', { length: 128 }),
  ageRestricted: boolean('age_restricted').default(false).notNull(),
  isCanadianLocal: boolean('is_canadian_local').default(false).notNull(),
  status: productStatusEnum('status').default('active').notNull(),
  verificationStatus: verificationStatusEnum('verification_status').default('unverified').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 4. PENDING MASTER PRODUCTS TABLE
export const pendingMasterProducts = pgTable('pending_master_products', {
  id: varchar('id', { length: 128 }).primaryKey(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  brandName: varchar('brand_name', { length: 255 }),
  upcGtin: varchar('upc_gtin', { length: 50 }),
  requestedByMerchantId: varchar('requested_by_merchant_id', { length: 128 }).references(() => stores.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 5. MERCHANT PRODUCTS TABLE (Composite Primary Key)
export const merchantProducts = pgTable('merchant_products', {
  storeId: varchar('store_id', { length: 128 }).references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  masterProductId: varchar('master_product_id', { length: 128 }).references(() => masterProducts.id, { onDelete: 'restrict' }).notNull(),
  price: doublePrecision('price').notNull(),
  currency: varchar('currency', { length: 3 }).default('CAD').notNull(),
  availableQuantity: integer('available_quantity').default(0).notNull(),
  merchantSku: varchar('merchant_sku', { length: 100 }),
  originalPrice: doublePrecision('original_price'),
  discountLabel: varchar('discount_label', { length: 255 }),
  discountValidUntil: timestamp('discount_valid_until'),
  isActive: boolean('is_active').default(true).notNull(),
  isCanadianLocal: boolean('is_canadian_local').default(false).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.storeId, table.masterProductId] }),
  };
});

// 6. ORDERS TABLE
export const orders = pgTable('orders', {
  id: varchar('id', { length: 128 }).primaryKey(),
  customerId: varchar('customer_id', { length: 128 }).references(() => users.id, { onDelete: 'restrict' }).notNull(),
  storeId: varchar('store_id', { length: 128 }).references(() => stores.id, { onDelete: 'restrict' }).notNull(),
  storeName: varchar('store_name', { length: 255 }).notNull(),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  customerEmail: varchar('customer_email', { length: 255 }).notNull(),
  subtotal: doublePrecision('subtotal').notNull(),
  deliveryFee: doublePrecision('delivery_fee').default(0.0).notNull(),
  tax: doublePrecision('tax').notNull(),
  total: doublePrecision('total').notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }).default('card').notNull(),
  paymentStatus: paymentStatusEnum('payment_status').default('unpaid').notNull(),
  paymentIntentId: varchar('payment_intent_id', { length: 255 }),
  deliveryAddress: jsonb('delivery_address').notNull(),
  status: orderStatusEnum('status').default('placed').notNull(),
  rejectionReason: text('rejection_reason'),
  estimatedTime: varchar('estimated_time', { length: 100 }),
  paymentCollectedBy: varchar('payment_collected_by', { length: 50 }),
  emailQueued: boolean('email_queued').default(false).notNull(),
  emailQueuedAt: timestamp('email_queued_at'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 7. ORDER ITEMS TABLE
export const orderItems = pgTable('order_items', {
  id: varchar('id', { length: 128 }).primaryKey(),
  orderId: varchar('order_id', { length: 128 }).references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  masterProductId: varchar('master_product_id', { length: 128 }).references(() => masterProducts.id, { onDelete: 'restrict' }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  effectivePrice: doublePrecision('effective_price').notNull(),
  quantity: integer('quantity').notNull(),
  substitutionGroupId: varchar('substitution_group_id', { length: 128 }),
  taxable: boolean('taxable').default(true).notNull(),
});

// 8. FORENSIC AUDIT LOGS
export const auditLogs = pgTable('audit_logs', {
  id: varchar('id', { length: 128 }).primaryKey(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  actorId: varchar('actor_id', { length: 128 }).notNull(),
  actorEmail: varchar('actor_email', { length: 255 }).notNull(),
  actorIp: varchar('actor_ip', { length: 45 }).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  resource: varchar('resource', { length: 255 }),
  metadata: jsonb('metadata'),
  prevHash: varchar('prev_hash', { length: 64 }).notNull(),
  hash: varchar('hash', { length: 64 }).notNull(),
}, (table) => {
  return {
    prevHashIdx: uniqueIndex('prev_hash_idx').on(table.prevHash),
    hashIdx: uniqueIndex('hash_idx').on(table.hash),
  };
});

// 9. RELATIONS DEFINITIONS FOR DRIZZLE
export const usersRelations = relations(users, ({ one, many }) => ({
  store: one(stores, {
    fields: [users.storeId],
    references: [stores.id],
  }),
  notifications: many(notifications),
  orders: many(orders),
  fcmTokens: many(userFcmTokens),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  owner: one(users, {
    fields: [stores.ownerId],
    references: [users.id],
  }),
  merchantProducts: many(merchantProducts),
  deals: many(deals),
  flyers: many(flyers),
}));

export const merchantProductsRelations = relations(merchantProducts, ({ one }) => ({
  store: one(stores, {
    fields: [merchantProducts.storeId],
    references: [stores.id],
  }),
  masterProduct: one(masterProducts, {
    fields: [merchantProducts.masterProductId],
    references: [masterProducts.id],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  masterProduct: one(masterProducts, {
    fields: [orderItems.masterProductId],
    references: [masterProducts.id],
  }),
}));

export const userFcmTokens = pgTable('user_fcm_tokens', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 128 }).references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: text('token').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: varchar('id', { length: 128 }).primaryKey(),
  userId: varchar('user_id', { length: 128 }).references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: notificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  read: boolean('read').default(false).notNull(),
  orderId: varchar('order_id', { length: 128 }),
  link: text('link'),
});

export const deals = pgTable('deals', {
  id: varchar('id', { length: 128 }).primaryKey(),
  storeId: varchar('store_id', { length: 128 }).references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  productId: varchar('product_id', { length: 128 }).notNull(),
  price: doublePrecision('price').notNull(),
  salePrice: doublePrecision('sale_price'),
  validUntil: timestamp('valid_until').notNull(),
  status: varchar('status', { length: 50 }).default('active').notNull(),
});

export const flyers = pgTable('flyers', {
  id: varchar('id', { length: 128 }).primaryKey(),
  storeId: varchar('store_id', { length: 128 }).references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  imageUrl: text('image_url'),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  items: jsonb('items').default([]), // Inline items representing deals inside a flyer
});
```

---

## Safety & Validation Architecture

We will introduce a strict, multi-step validation system to secure the entire migration lifecycle.

```
                  [Live Firestore State]
                            │
                            ▼
              ┌───────────────────────────┐
              │   Pre-Migration Auditor   │
              │  (Find & Log Orphans/Gaps)│
              └─────────────┬─────────────┘
                            │ (Audit Report Generated)
                            ▼
              ┌───────────────────────────┐
              │    TS Backfill Script     │
              │ (Batch Transact, Log Errs)│
              └─────────────┬─────────────┘
                            │ (DB Writes via Drizzle)
                            ▼
                  [Firebase SQL Connect]
                            │
                            ▼
              ┌───────────────────────────┐
              │  Post-Parity Verification  │
              │  (Sum totals, count checks)│
              └───────────────────────────┘
```

### 1. Pre-Migration Auditor (`preMigrationAudit.ts`)
#### [NEW] [preMigrationAudit.ts](file:///Users/I501801/Documents/Projects/Spendigo-v1/services/api/scripts/preMigrationAudit.ts)
This script runs a complete read-only sweep of Firestore data, outputting any anomalies (such as orders linking to non-existent shoppers, or merchant products missing valid store parent records) before we touch the database.

```typescript
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const serviceAccount = require('../../scripts/service-account.json');
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function runAudit() {
    console.log("=== STARTING PRE-MIGRATION INTEGRITY AUDIT ===");
    const report: any = {
        timestamp: new Date().toISOString(),
        stores: { total: 0, suspended: 0 },
        users: { total: 0, merchants: 0, consumers: 0, admins: 0, missingRole: [] },
        orphans: {
            merchantProductsMissingStore: [],
            merchantProductsMissingMaster: [],
            dealsMissingStore: [],
            flyersMissingStore: [],
            ordersMissingCustomer: [],
            ordersMissingStore: []
        }
    };

    // 1. Map valid entities for fast lookup
    const validStoreIds = new Set<string>();
    const storesSnap = await db.collection('stores').get();
    storesSnap.forEach(doc => {
        validStoreIds.add(doc.id);
        report.stores.total++;
        if (doc.data().status === 'suspended') report.stores.suspended++;
    });

    const validUserIds = new Set<string>();
    const usersSnap = await db.collection('users').get();
    usersSnap.forEach(doc => {
        validUserIds.add(doc.id);
        report.users.total++;
        const role = doc.data().role;
        if (role === 'merchant') report.users.merchants++;
        else if (role === 'consumer') report.users.consumers++;
        else if (role === 'admin') report.users.admins++;
        else report.users.missingRole.push(doc.id);
    });

    const validMasterProductIds = new Set<string>();
    const masterProductsSnap = await db.collection('master_products').get();
    masterProductsSnap.forEach(doc => validMasterProductIds.add(doc.id));

    const pendingMasterProductIds = new Set<string>();
    const pendingProductsSnap = await db.collection('pending_master_products').get();
    pendingProductsSnap.forEach(doc => pendingMasterProductIds.add(doc.id));

    // 2. Scan Merchant Products for Orphans
    console.log("Auditing merchant products...");
    const mProductsSnap = await db.collection('merchant_products').get();
    mProductsSnap.forEach(doc => {
        const data = doc.data();
        const storeId = data.merchant_id;
        const masterId = data.master_product_id;

        if (!validStoreIds.has(storeId)) {
            report.orphans.merchantProductsMissingStore.push({ id: doc.id, storeId });
        }
        if (!validMasterProductIds.has(masterId) && !pendingMasterProductIds.has(masterId)) {
            report.orphans.merchantProductsMissingMaster.push({ id: doc.id, masterId });
        }
    });

    // 3. Scan Deals and Flyers for Orphans (Collection Groups)
    console.log("Auditing deals & flyers subcollections...");
    const dealsSnap = await db.collectionGroup('deals').get();
    dealsSnap.forEach(doc => {
        const storeId = doc.ref.parent.parent?.id;
        if (!storeId || !validStoreIds.has(storeId)) {
            report.orphans.dealsMissingStore.push({ id: doc.id, storeId });
        }
    });

    const flyersSnap = await db.collectionGroup('flyers').get();
    flyersSnap.forEach(doc => {
        const storeId = doc.ref.parent.parent?.id;
        if (!storeId || !validStoreIds.has(storeId)) {
            report.orphans.flyersMissingStore.push({ id: doc.id, storeId });
        }
    });

    // 4. Scan Orders for Orphans
    console.log("Auditing orders...");
    const ordersSnap = await db.collection('orders').get();
    ordersSnap.forEach(doc => {
        const data = doc.data();
        const customerId = data.customerId;
        const storeId = data.storeId;

        if (!validUserIds.has(customerId)) {
            report.orphans.ordersMissingCustomer.push({ id: doc.id, customerId });
        }
        if (!validStoreIds.has(storeId)) {
            report.orphans.ordersMissingStore.push({ id: doc.id, storeId });
        }
    });

    const reportPath = path.join(__dirname, '../pre_migration_audit_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n=== AUDIT COMPLETE. REPORT WRITTEN TO ${reportPath} ===`);
    console.log(`Orphaned Merchant Products: ${report.orphans.merchantProductsMissingStore.length}`);
    console.log(`Orphaned Deals: ${report.orphans.dealsMissingStore.length}`);
    console.log(`Orphaned Orders: ${report.orphans.ordersMissingCustomer.length}`);
}

runAudit().catch(console.error);
```

### 2. TypeScript Migration Backfill Script (`backfillMigration.ts`)
#### [NEW] [backfillMigration.ts](file:///Users/I501801/Documents/Projects/Spendigo-v1/services/api/scripts/backfillMigration.ts)
A robust TypeScript script running in sequential batch limits, supporting error handling and skip conditions for invalid record links.

```typescript
import * as admin from 'firebase-admin';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/db/schema';

const serviceAccount = require('../../scripts/service-account.json');
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const firestore = admin.firestore();

// PostgreSQL Connection configuration (pointing to staging or production SQL Connect proxy)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/spendigo',
});
const db = drizzle(pool, { schema });

async function migrate() {
    console.log("Starting backfill migration to SQL Connect...");
    
    // Step 1: Migrate Users (Dependency for Stores & Orders)
    console.log("Migrating users...");
    const usersSnap = await firestore.collection('users').get();
    const userRecords: any[] = [];
    usersSnap.forEach(doc => {
        const data = doc.data();
        userRecords.push({
            id: doc.id,
            email: data.email || `${doc.id}@unknown.com`,
            name: data.name || null,
            role: ['admin', 'merchant', 'consumer'].includes(data.role) ? data.role : 'consumer',
            merchantRole: data.merchantRole || null,
            storeId: null, // Initialized to null to prevent circular FK constraint errors
            status: data.status === 'pending_invite' ? 'pending_invite' : 'active',
            addresses: data.addresses || [],
            totalOrders: data.total_orders || 0,
            totalSpend: data.total_spend || 0.0,
            lastOrderDate: data.last_order_date ? new Date(data.last_order_date) : null,
            createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
            lastActive: data.last_active ? new Date(data.last_active) : new Date(),
        });
    });

    if (userRecords.length > 0) {
        await db.insert(schema.users).values(userRecords).onConflictDoNothing();
    }
    console.log(`Migrated ${userRecords.length} users.`);

    // Step 2: Migrate Stores
    console.log("Migrating stores...");
    const storesSnap = await firestore.collection('stores').get();
    const storeRecords: any[] = [];
    const circularUpdates: Array<{ userId: string, storeId: string }> = [];

    storesSnap.forEach(doc => {
        const data = doc.data();
        storeRecords.push({
            id: doc.id,
            name: data.name,
            logo: data.logo || null,
            address: data.address || null,
            province: data.province || 'ON',
            postalCode: data.postalCode || null,
            latitude: data.location?.lat || null,
            longitude: data.location?.lng || null,
            deliveryFee: data.deliveryFee || 0.0,
            freeDeliveryThreshold: data.freeDeliveryThreshold || null,
            pickupEnabled: data.pickupEnabled ?? true,
            deliveryEnabled: data.deliveryEnabled ?? false,
            subscriptionTier: data.subscriptionTier || 'starter',
            status: ['active', 'pending', 'suspended', 'pending_deletion'].includes(data.status) ? data.status : 'pending',
            ownerId: data.ownerId || null,
            stripeAccountId: data.stripeAccountId || null,
            stripeOnboardingStatus: data.stripeOnboardingStatus || null,
            kybStatus: data.kybStatus || 'not_submitted',
            kybDocuments: data.kybDocuments || [],
        });

        // Record merchant assignments for circular FK update in Step 5
        if (data.ownerId) {
            circularUpdates.push({ userId: data.ownerId, storeId: doc.id });
        }
    });

    if (storeRecords.length > 0) {
        await db.insert(schema.stores).values(storeRecords).onConflictDoNothing();
    }
    console.log(`Migrated ${storeRecords.length} stores.`);

    // Step 3: Migrate Master Products
    console.log("Migrating master products...");
    const mProdSnap = await firestore.collection('master_products').get();
    const masterProductRecords: any[] = [];
    mProdSnap.forEach(doc => {
        const data = doc.data();
        masterProductRecords.push({
            id: doc.id,
            productName: data.product_name,
            brandName: data.brand_name || null,
            upcGtin: data.upc_gtin || null,
            isSoldByWeight: data.is_sold_by_weight ?? false,
            netQuantityValue: data.net_quantity_value || null,
            netQuantityUnit: data.net_quantity_unit || null,
            packageCount: data.package_count || 1,
            primaryImageUrl: data.primary_image_url || null,
            secondaryImageUrls: data.secondary_image_urls || [],
            categoryId: data.category_id || null,
            taxCategoryId: data.tax_category_id || null,
            status: ['active', 'deprecated', 'blocked'].includes(data.status) ? data.status : 'active',
            verificationStatus: ['unverified', 'verified', 'manufacturer_verified'].includes(data.verification_status) ? data.verification_status : 'unverified',
        });
    });

    if (masterProductRecords.length > 0) {
        await db.insert(schema.masterProducts).values(masterProductRecords).onConflictDoNothing();
    }
    console.log(`Migrated ${masterProductRecords.length} master products.`);

    // Step 4: Resolve Circular storeId Links in users table
    console.log("Resolving circular store reference paths in users...");
    for (const update of circularUpdates) {
        await db.update(schema.users)
          .set({ storeId: update.storeId })
          .where(schema.users.id.eq(update.userId));
    }
    console.log("Circular store IDs updated.");

    // Step 5: Migrate Merchant Products (Composite constraints applied)
    console.log("Migrating merchant products...");
    const merchantProductsSnap = await firestore.collection('merchant_products').get();
    const merchantProductRecords: any[] = [];
    merchantProductsSnap.forEach(doc => {
        const data = doc.data();
        // Zero-Assumption Safe Link Verification
        if (data.merchant_id && data.master_product_id) {
            merchantProductRecords.push({
                storeId: data.merchant_id,
                masterProductId: data.master_product_id,
                price: data.price || 0.0,
                currency: data.currency || 'CAD',
                availableQuantity: data.available_quantity || 0,
                merchantSku: data.merchant_sku || null,
                originalPrice: data.original_price || null,
                discountLabel: data.discount_label || null,
                isActive: data.is_active ?? true,
            });
        }
    });

    if (merchantProductRecords.length > 0) {
        await db.insert(schema.merchantProducts).values(merchantProductRecords).onConflictDoNothing();
    }
    console.log(`Migrated ${merchantProductRecords.length} merchant products.`);

    // Step 6: Migrate Orders & Flattened Order Items
    console.log("Migrating orders & order items...");
    const ordersSnap = await firestore.collection('orders').get();
    for (const doc of ordersSnap.docs) {
        const data = doc.data();
        try {
            await db.insert(schema.orders).values({
                id: doc.id,
                customerId: data.customerId,
                storeId: data.storeId,
                storeName: data.storeName || 'Store name',
                customerName: data.customerName || 'Customer',
                customerEmail: data.customerEmail || 'unknown@spendigo.ca',
                subtotal: data.subtotal || 0.0,
                deliveryFee: data.deliveryFee || 0.0,
                tax: data.tax || 0.0,
                total: data.total || 0.0,
                paymentStatus: data.paymentStatus || 'unpaid',
                status: data.status || 'placed',
                deliveryAddress: data.deliveryAddress || {},
                createdAt: data.createdAt ? new Date(data.createdAt.toDate()) : new Date(),
            });

            const items = data.items || [];
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                await db.insert(schema.orderItems).values({
                    id: `${doc.id}_item_${i}`,
                    orderId: doc.id,
                    masterProductId: item.productId,
                    productName: item.productName || 'Unknown Product',
                    effectivePrice: item.price || 0.0,
                    quantity: item.quantity || 1,
                    taxable: item.taxable ?? true,
                });
            }
        } catch (err: any) {
            console.error(`Skipping order ${doc.id} due to constraint violation (e.g. customer/store orphan):`, err.message);
        }
    }

    console.log("=== BACKFILL MIGRATION COMPLETE ===");
    await pool.end();
}

migrate().catch(console.error);
```

---

## Post-Migration Parity Verification Suite

We will verify success using statistical aggregations comparing Firestore and PostgreSQL counts.

- **Check 1: Total Entities Parity**:
  - Run matching `COUNT(*)` in Postgres against total collection snapshots in Firestore for `users`, `stores`, `master_products`, and `merchant_products`.
- **Check 2: Financial Aggregations Check**:
  - Sum the total values in `orders` (e.g., total transactional value, service fees, tax collection) across both databases to ensure 100% data integrity.
  ```sql
  SELECT SUM(total) as postgres_sum FROM orders;
  ```
- **Check 3: Relationship Verification (No Orphan Check)**:
  - Check that all relational fields perfectly resolve without constraint issues.

---

## Zero-Downtime Pipeline: Dual-Write Implementation Flow

To guarantee zero downtime and protect our transactional integrity during the grace transition, we propose the following **Dual-Write Architecture** inside our Firebase Cloud Functions:

1. **Trigger / Operation Inbound**: Orders are placed or catalogs updated via the HTTPS Callables (`placeOrder`, etc.) or internal queues.
2. **Step 1: Write to Firestore (Primary/Fallback Anchor)**: Perform the standard Firestore transaction or batch write. This ensures client dashboards and existing applications continue running without disruption.
3. **Step 2: Dual-Write to Postgres (Secondary Target)**: Immediately after Firestore succeeds, write the record to PostgreSQL inside the same Cloud Function using Drizzle ORM.
4. **Resiliency/Retry Isolation**:
   - Wrap the PostgreSQL write in a separate try-catch block. A secondary DB write failure must **never** roll back a successful primary payment/order capture in Firestore.
   - If PostgreSQL is slow or unavailable, log the payload to a **Cloud Pub/Sub dead-letter queue** for an asynchronous retry handler to re-process and catch up, preventing data loss.

---

## Verification Plan

### Automated Verification
1. Run `npx ts-node scripts/preMigrationAudit.ts` in our staging workspace. This will dump a detailed audit file `/Users/I501801/Documents/Projects/Spendigo-v1/services/api/pre_migration_audit_report.json`.
2. Inspect the audit report to identify any anomalies.
3. Provision a local or staging PostgreSQL container, configure `DATABASE_URL`, and run `npx ts-node scripts/backfillMigration.ts`.
4. Run SQL aggregation checks comparing Firestore's live totals with PostgreSQL table statistics.

### Manual Verification
- Deploy schema to a staging environment and ask the user to verify schema matching and operational triggers prior to moving to full staging deployment.
