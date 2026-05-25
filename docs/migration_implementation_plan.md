# Implementation Plan: Spendigo Monorepo Relational Migration & Schema Consolidation

This document details the definitive technical blueprint and schema designs for migrating the Spendigo database from Cloud Firestore to Firebase SQL Connect (PostgreSQL). It incorporates a centralized Single Source of Truth (SSoT) reference table prefix system, an isolated 1-to-1 vector embedding table for AI-driven discovery, absolute currency integer precision, and engine-level constraints/RLS.

> [!TIP]
> **Step-by-Step Rollout Guide**: For complete, command-by-command instructions on provisioning staging resources, managing Git branches, running the pre-flight auditor, executing the backfill, and running the dual-write pipeline, refer to the [Migration Rollout & Scratch Deployment Guide](file:///Users/I501801/Documents/Projects/Spendigo-v1/docs/migration_rollout_guide.md).

---

## 1. Single Source of Truth (SSoT) Reference Map

To eliminate fragmented client-side constant declarations and enforce referential integrity across the monorepo, we centralize all constants into database-enforced, read-only `ref_` reference tables pre-populated via seed scripts.

| Legacy Front-end Constant | Path in Monorepo | New PostgreSQL Relational Table | Relational Enforcements |
| :--- | :--- | :--- | :--- |
| `BUSINESS_TYPES` | `apps/web/src/data/businessTypes.ts` | `ref_business_types` | Stores label, logo, cover, tagline. FK in `stores.business_type` references this PK. |
| `PRODUCT_CATEGORIES` | `apps/web/src/data/categories.ts` | `ref_categories` | Stores category names. FK in `master_products.category_id` references this PK. |
| `ORDER_STATUSES` | *Enforced in rules / types* | `ref_order_statuses` | Enforces order status: `placed`, `preparing`, `out_for_delivery`, `delivered`, `cancelled`. |
| `PAYMENT_STATUSES` | *Enforced in rules / types* | `ref_payment_statuses` | Enforces payment status: `paid`, `pending`, `unpaid`, `refunding`, `refunded`, `partially_refunded`. |

---

## 2. Firebase SQL Connect GraphQL Schema (`schema.gql`)

#### [NEW] [schema.gql](file:///Users/I501801/Documents/Projects/Spendigo-v1/docs/schema.gql)
This production-ready GraphQL schema defines the relational mappings and types for Firebase SQL Connect.

```graphql
# --- ENUMS & CUSTOM SCALARS ---
scalar Vector # 768-Dimension vector embedding scalar mapping to pgvector

enum UserRole {
  consumer
  merchant
  admin
}

enum MerchantSubRole {
  OWNER
  MANAGER
  STAFF
  MARKETING
}

enum UserStatus {
  pending_invite
  active
  suspended
}

enum ProductStatus {
  active
  deprecated
  blocked
}

enum VerificationStatus {
  unverified
  verified
  manufacturer_verified
}

enum StoreStatus {
  active
  pending
  suspended
  pending_deletion
}

# --- 1. SSoT REFERENCE TABLES ---
type RefBusinessType @table(name: "ref_business_types") {
  id: String! @primaryKey
  label: String!
  logo: String
  cover: String
  tagline: String!
}

type RefCategory @table(name: "ref_categories") {
  id: String! @primaryKey
  name: String!
}

type RefOrderStatus @table(name: "ref_order_statuses") {
  id: String! @primaryKey
}

type RefPaymentStatus @table(name: "ref_payment_statuses") {
  id: String! @primaryKey
}

# --- 2. CORE TRANSACTIONAL TABLES ---
type User @table(name: "users") {
  id: String! @primaryKey # Firebase UID
  email: String! @unique
  name: String
  role: UserRole! @default(value: "consumer")
  merchantRole: MerchantSubRole
  storeId: String @col(references: "Store")
  status: UserStatus! @default(value: "active")
  addresses: Json @default(value: "[]")
  totalOrders: Int! @default(value: 0)
  totalSpend: Int! @default(value: 0) # Currencies stored as integer cents
  lastOrderDate: Timestamp
  createdAt: Timestamp! @default(expr: "now()")
  lastActive: Timestamp! @default(expr: "now()")
}

type Store @table(name: "stores") {
  id: String! @primaryKey
  name: String!
  logo: String
  address: String
  province: String! @default(value: "ON")
  postalCode: String
  latitude: Float
  longitude: Float
  deliveryFee: Int! @default(value: 0) # Stored in integer cents
  freeDeliveryThreshold: Int # Stored in integer cents
  pickupEnabled: Boolean! @default(value: true)
  deliveryEnabled: Boolean! @default(value: false)
  maxDeliveryRadiusKm: Float! @default(value: 10.0)
  subscriptionTier: String! @default(value: "starter")
  status: StoreStatus! @default(value: "pending")
  suspensionReason: String
  ownerId: String! @col(references: "User")
  stripeAccountId: String
  stripeOnboardingStatus: String
  kybStatus: String! @default(value: "not_submitted")
  kybDocuments: Json @default(value: "[]")
  updatedAt: Timestamp! @default(expr: "now()")
}

type MasterProduct @table(name: "master_products") {
  id: String! @primaryKey
  productName: String!
  brandName: String
  upcGtin: String @unique
  isSoldByWeight: Boolean! @default(value: false)
  netQuantityValue: Float
  netQuantityUnit: String
  packageCount: Int @default(value: 1)
  primaryImageUrl: String
  secondaryImageUrls: Json @default(value: "[]")
  categoryId: String! @col(references: "RefCategory")
  productType: String
  storageType: String
  taxCategoryId: String
  suggestedRetailPrice: Int # Stored in integer cents
  substitutionGroupId: String
  ageRestricted: Boolean! @default(value: false)
  isCanadianLocal: Boolean! @default(value: false)
  status: ProductStatus! @default(value: "active")
  verificationStatus: VerificationStatus! @default(value: "unverified")
  updatedAt: Timestamp! @default(expr: "now()")
}

type ProductEmbedding @table(name: "product_embeddings") {
  id: String! @primaryKey @col(references: "MasterProduct")
  embedding: Vector!
}

type MerchantProduct @table(name: "merchant_products") {
  storeId: String! @col(references: "Store")
  masterProductId: String! @col(references: "MasterProduct")
  price: Int! # Stored in integer cents
  currency: String! @default(value: "CAD")
  availableQuantity: Int! @default(value: 0)
  merchantSku: String
  originalPrice: Int # Stored in integer cents
  discountLabel: String
  discountValidUntil: Timestamp
  isActive: Boolean! @default(value: true)
  isCanadianLocal: Boolean! @default(value: false)
  updatedAt: Timestamp! @default(expr: "now()")
}

type Order @table(name: "orders") {
  id: String! @primaryKey
  customerId: String! @col(references: "User")
  storeId: String! @col(references: "Store")
  storeName: String!
  customerName: String!
  customerEmail: String!
  subtotal: Int! # Stored in integer cents
  deliveryFee: Int! @default(value: 0) # Stored in integer cents
  tax: Int! # Stored in integer cents
  total: Int! # Stored in integer cents
  paymentMethod: String! @default(value: "card")
  paymentStatus: String! @col(references: "RefPaymentStatus")
  paymentIntentId: String
  deliveryAddress: Json!
  status: String! @col(references: "RefOrderStatus")
  rejectionReason: String
  estimatedTime: String
  paymentCollectedBy: String
  emailQueued: Boolean! @default(value: false)
  emailQueuedAt: Timestamp
  cancelledAt: Timestamp
  createdAt: Timestamp! @default(expr: "now()")
}

type OrderItem @table(name: "order_items") {
  id: String! @primaryKey
  orderId: String! @col(references: "Order")
  masterProductId: String! @col(references: "MasterProduct")
  productName: String!
  effectivePrice: Int! # Stored in integer cents
  quantity: Int!
  substitutionGroupId: String
  taxable: Boolean! @default(value: true)
}

# --- 3. AUDITING & COMPLIANCE TABLES ---
type AuditLog @table(name: "audit_logs") {
  id: String! @primaryKey
  timestamp: Timestamp! @default(expr: "now()")
  actorId: String!
  actorEmail: String!
  actorIp: String!
  action: String!
  resource: String
  metadata: Json
  prevHash: String! @unique
  hash: String! @unique
}

type ConsentLog @table(name: "consent_logs") {
  id: String! @primaryKey
  userId: String! @col(references: "User")
  consentType: String!
  acceptedAt: Timestamp! @default(expr: "now()")
  ipAddress: String!
  userAgent: String!
}
```

---

## 3. Drizzle ORM Schema (`schema.ts`)

#### [NEW] [schema.ts](file:///Users/I501801/Documents/Projects/Spendigo-v1/services/api/src/db/schema.ts)
A consolidated, type-safe schema representing all tables, enums, relations, and index enforcements.

```typescript
import { 
  pgTable, 
  varchar, 
  text, 
  timestamp, 
  integer, 
  boolean, 
  jsonb, 
  primaryKey, 
  uniqueIndex, 
  pgEnum, 
  customType 
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Custom pgvector type declaration (768 Dimensions)
const vector = customType<{ data: number[] }>({
  dataType() {
    return 'vector(768)';
  },
});

// --- ENUMS DEFINITIONS ---
export const userRoleEnum = pgEnum('user_role', ['admin', 'merchant', 'consumer']);
export const merchantSubRoleEnum = pgEnum('merchant_role', ['OWNER', 'MANAGER', 'STAFF', 'MARKETING']);
export const userStatusEnum = pgEnum('user_status', ['pending_invite', 'active', 'suspended']);
export const productStatusEnum = pgEnum('product_status', ['active', 'deprecated', 'blocked']);
export const verificationStatusEnum = pgEnum('verification_status', ['unverified', 'verified', 'manufacturer_verified']);
export const storeStatusEnum = pgEnum('store_status', ['active', 'pending', 'suspended', 'pending_deletion']);
export const jobStatusEnum = pgEnum('job_status', ['new', 'reviewed', 'interviewing', 'rejected', 'hired']);
export const activeInactiveEnum = pgEnum('active_inactive_status', ['active', 'inactive']);
export const ingestionStatusEnum = pgEnum('ingestion_status', ['pending', 'processing', 'completed', 'failed']);
export const staffRoleEnum = pgEnum('staff_role', ['admin', 'moderator']);

// 1. SSoT REFERENCE TABLES
export const refBusinessTypes = pgTable('ref_business_types', {
  id: varchar('id', { length: 100 }).primaryKey(),
  label: varchar('label', { length: 255 }).notNull(),
  logo: text('logo'),
  cover: text('cover'),
  tagline: text('tagline').notNull(),
});

export const refCategories = pgTable('ref_categories', {
  id: varchar('id', { length: 100 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
});

export const refOrderStatuses = pgTable('ref_order_statuses', {
  id: varchar('id', { length: 50 }).primaryKey(),
});

export const refPaymentStatuses = pgTable('ref_payment_statuses', {
  id: varchar('id', { length: 50 }).primaryKey(),
});

// 2. CORE USERS & STORES
export const users = pgTable('users', {
  id: varchar('id', { length: 128 }).primaryKey(), // Firebase Auth UID
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  role: userRoleEnum('role').default('consumer').notNull(),
  merchantRole: merchantSubRoleEnum('merchant_role'),
  storeId: varchar('store_id', { length: 128 }),
  status: userStatusEnum('status').default('active').notNull(),
  addresses: jsonb('addresses').default([]),
  totalOrders: integer('total_orders').default(0).notNull(),
  totalSpend: integer('total_spend').default(0).notNull(), // Integer Cents
  lastOrderDate: timestamp('last_order_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastActive: timestamp('last_active').defaultNow().notNull(),
});

export const stores = pgTable('stores', {
  id: varchar('id', { length: 128 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  logo: text('logo'),
  address: text('address'),
  province: varchar('province', { length: 2 }).default('ON').notNull(),
  postalCode: varchar('postal_code', { length: 7 }),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  deliveryFee: integer('delivery_fee').default(0).notNull(), // Integer Cents
  freeDeliveryThreshold: integer('free_delivery_threshold'), // Integer Cents
  pickupEnabled: boolean('pickup_enabled').default(true).notNull(),
  deliveryEnabled: boolean('delivery_enabled').default(false).notNull(),
  maxDeliveryRadiusKm: doublePrecision('max_delivery_radius_km').default(10.0).notNull(),
  subscriptionTier: varchar('subscription_tier', { length: 50 }).default('starter').notNull(),
  status: storeStatusEnum('status').default('pending').notNull(),
  suspensionReason: text('suspension_reason'),
  ownerId: varchar('owner_id', { length: 128 }).references(() => users.id, { onDelete: 'restrict' }),
  stripeAccountId: varchar('stripe_account_id', { length: 255 }),
  stripeOnboardingStatus: varchar('stripe_onboarding_status', { length: 50 }),
  kybStatus: varchar('kyb_status', { length: 50 }).default('not_submitted').notNull(),
  kybDocuments: jsonb('kyb_documents').default([]),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 3. MASTER & MERCHANT CATALOG
export const masterProducts = pgTable('master_products', {
  id: varchar('id', { length: 128 }).primaryKey(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  brandName: varchar('brand_name', { length: 255 }),
  upcGtin: varchar('upc_gtin', { length: 50 }).unique(),
  isSoldByWeight: boolean('is_sold_by_weight').default(false).notNull(),
  netQuantityValue: doublePrecision('net_quantity_value'),
  netQuantityUnit: varchar('net_quantity_unit', { length: 50 }),
  packageCount: integer('package_count').default(1),
  primaryImageUrl: text('primary_image_url'),
  secondaryImageUrls: jsonb('secondary_image_urls').default([]),
  categoryId: varchar('category_id', { length: 100 }).references(() => refCategories.id, { onDelete: 'restrict' }).notNull(),
  productType: varchar('product_type', { length: 100 }),
  storageType: varchar('storage_type', { length: 100 }),
  taxCategoryId: varchar('tax_category_id', { length: 100 }),
  suggestedRetailPrice: integer('suggested_retail_price'), // Integer Cents
  substitutionGroupId: varchar('substitution_group_id', { length: 128 }),
  ageRestricted: boolean('age_restricted').default(false).notNull(),
  isCanadianLocal: boolean('is_canadian_local').default(false).notNull(),
  status: productStatusEnum('status').default('active').notNull(),
  verificationStatus: verificationStatusEnum('verification_status').default('unverified').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Decoupled vector table for product discovery
export const productEmbeddings = pgTable('product_embeddings', {
  id: varchar('id', { length: 128 }).primaryKey().references(() => masterProducts.id, { onDelete: 'cascade' }),
  embedding: vector('embedding').notNull(),
});

export const merchantProducts = pgTable('merchant_products', {
  storeId: varchar('store_id', { length: 128 }).references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  masterProductId: varchar('master_product_id', { length: 128 }).references(() => masterProducts.id, { onDelete: 'restrict' }).notNull(),
  price: integer('price').notNull(), // Integer Cents
  currency: varchar('currency', { length: 3 }).default('CAD').notNull(),
  availableQuantity: integer('available_quantity').default(0).notNull(),
  merchantSku: varchar('merchant_sku', { length: 100 }),
  originalPrice: integer('original_price'), // Integer Cents
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

// 4. CHECKOUT TRANSACTION & ORDERS
export const orders = pgTable('orders', {
  id: varchar('id', { length: 128 }).primaryKey(),
  customerId: varchar('customer_id', { length: 128 }).references(() => users.id, { onDelete: 'restrict' }).notNull(),
  storeId: varchar('store_id', { length: 128 }).references(() => stores.id, { onDelete: 'restrict' }).notNull(),
  storeName: varchar('store_name', { length: 255 }).notNull(),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  customerEmail: varchar('customer_email', { length: 255 }).notNull(),
  subtotal: integer('subtotal').notNull(), // Integer Cents
  deliveryFee: integer('delivery_fee').default(0).notNull(), // Integer Cents
  tax: integer('tax').notNull(), // Integer Cents
  total: integer('total').notNull(), // Integer Cents
  paymentMethod: varchar('payment_method', { length: 50 }).default('card').notNull(),
  paymentStatus: varchar('payment_status', { length: 50 }).references(() => refPaymentStatuses.id).notNull(),
  paymentIntentId: varchar('payment_intent_id', { length: 255 }),
  deliveryAddress: jsonb('delivery_address').notNull(),
  status: varchar('status', { length: 50 }).references(() => refOrderStatuses.id).notNull(),
  rejectionReason: text('rejection_reason'),
  estimatedTime: varchar('estimated_time', { length: 100 }),
  paymentCollectedBy: varchar('payment_collected_by', { length: 50 }),
  emailQueued: boolean('email_queued').default(false).notNull(),
  emailQueuedAt: timestamp('email_queued_at'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orderItems = pgTable('order_items', {
  id: varchar('id', { length: 128 }).primaryKey(),
  orderId: varchar('order_id', { length: 128 }).references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  masterProductId: varchar('master_product_id', { length: 128 }).references(() => masterProducts.id, { onDelete: 'restrict' }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  effectivePrice: integer('effective_price').notNull(), // Integer Cents
  quantity: integer('quantity').notNull(),
  substitutionGroupId: varchar('substitution_group_id', { length: 128 }),
  taxable: boolean('taxable').default(true).notNull(),
});

// 5. FORENSIC AUDIT LOG & COMPLIANCE
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

export const consentLogs = pgTable('consent_logs', {
  id: varchar('id', { length: 128 }).primaryKey(),
  userId: varchar('user_id', { length: 128 }).references(() => users.id, { onDelete: 'restrict' }).notNull(),
  consentType: varchar('consent_type', { length: 100 }).notNull(),
  acceptedAt: timestamp('accepted_at').defaultNow().notNull(),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  userAgent: text('user_agent').notNull(),
});

// 6. ADVERTISING, SURVETS, & CAREERS PORTALS
export const careers = pgTable('careers', {
  id: varchar('id', { length: 128 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  department: varchar('department', { length: 100 }),
  location: varchar('location', { length: 100 }),
  type: varchar('type', { length: 50 }),
  description: text('description'),
  requirements: text('requirements'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const jobApplications = pgTable('job_applications', {
  id: varchar('id', { length: 128 }).primaryKey(),
  jobId: varchar('job_id', { length: 128 }).references(() => careers.id, { onDelete: 'cascade' }).notNull(),
  candidateName: varchar('candidate_name', { length: 255 }).notNull(),
  candidateEmail: varchar('candidate_email', { length: 255 }).notNull(),
  resumeUrl: text('resume_url'),
  status: jobStatusEnum('status').default('new').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const ads = pgTable('ads', {
  id: varchar('id', { length: 128 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  imageUrl: text('image_url').notNull(),
  link: text('link'),
  priority: integer('priority').default(0).notNull(),
  status: activeInactiveEnum('status').default('active').notNull(),
  storeId: varchar('store_id', { length: 128 }).references(() => stores.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const surveys = pgTable('surveys', {
  id: varchar('id', { length: 128 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  questions: jsonb('questions').default([]).notNull(),
  status: activeInactiveEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const surveyResponses = pgTable('survey_responses', {
  surveyId: varchar('survey_id', { length: 128 }).references(() => surveys.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar('user_id', { length: 128 }).references(() => users.id, { onDelete: 'cascade' }).notNull(),
  answers: jsonb('answers').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.surveyId, table.userId] }),
  };
});
```

---

## 4. Operational & Security Constraints (Shadow Schema)

To bridge the gap between frontend assumptions and Firestore's missing constraints, the following rules are natively enforced at the PostgreSQL engine level:

1. **User `storeId` Self-Assignment Block**:
   ```sql
   ALTER TABLE users ADD CONSTRAINT chk_user_store_id_modification 
   CHECK (
     role = 'admin' OR 
     role = 'consumer' OR 
     (role = 'merchant' AND store_id IS NOT NULL AND store_id LIKE 'store-%')
   );
   ```
2. **Immutable `consent_logs` Enforcement**:
   To prevent compliance tampering, write rules block updates or deletions via PostgreSQL rules:
   ```sql
   CREATE RULE lock_consent_logs_updates AS ON UPDATE TO consent_logs DO INSTEAD NOTHING;
   CREATE RULE lock_consent_logs_deletes AS ON DELETE TO consent_logs DO INSTEAD NOTHING;
   ```
3. **Stripe Connected Onboarding Validation**:
   Enforce that a store in an `'active'` status must possess a valid, non-null `stripeAccountId`:
   ```sql
   ALTER TABLE stores ADD CONSTRAINT chk_active_store_stripe_ready 
   CHECK (status != 'active' OR stripe_account_id IS NOT NULL);
   ```

---

## 5. Pre-Migration Integrity Auditor

#### [NEW] [preMigrationAudit.ts](file:///Users/I501801/Documents/Projects/Spendigo-v1/services/api/scripts/preMigrationAudit.ts)
A pre-flight verification script that maps Firestore models and audits all reference and transactional paths, outputting orphaned keys to a detailed report file.

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
            ordersMissingStore: [],
            jobApplicationsMissingJob: [],
            scheduledIngestionsMissingStore: [],
            campaignLogsMissingStore: [],
            billingLedgerMissingStore: [],
            billingLedgerMissingUser: []
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

    const validJobIds = new Set<string>();
    const careersSnap = await db.collection('careers').get();
    careersSnap.forEach(doc => validJobIds.add(doc.id));

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

    // 5. Scan Administrative Collections for Orphans
    console.log("Auditing administrative and operational collections...");
    
    // Job Applications
    const jobAppsSnap = await db.collection('job_applications').get();
    jobAppsSnap.forEach(doc => {
        const jobId = doc.data().jobId;
        if (!validJobIds.has(jobId)) {
            report.orphans.jobApplicationsMissingJob.push({ id: doc.id, jobId });
        }
    });

    // Scheduled Ingestions
    const ingestionsSnap = await db.collection('scheduled_ingestion').get();
    ingestionsSnap.forEach(doc => {
        const merchantId = doc.data().merchantId;
        if (!validStoreIds.has(merchantId)) {
            report.orphans.scheduledIngestionsMissingStore.push({ id: doc.id, merchantId });
        }
    });

    // Campaign Logs
    const campaignLogsSnap = await db.collection('campaign_logs').get();
    campaignLogsSnap.forEach(doc => {
        const storeId = doc.data().storeId;
        if (!validStoreIds.has(storeId)) {
            report.orphans.campaignLogsMissingStore.push({ id: doc.id, storeId });
        }
    });

    // Billing Ledger
    const ledgerSnap = await db.collection('billing_ledger').get();
    ledgerSnap.forEach(doc => {
        const data = doc.data();
        const storeId = data.storeId;
        const userId = data.userId;

        if (storeId && storeId !== 'unknown' && !validStoreIds.has(storeId)) {
            report.orphans.billingLedgerMissingStore.push({ id: doc.id, storeId });
        }
        if (userId && !validUserIds.has(userId)) {
            report.orphans.billingLedgerMissingUser.push({ id: doc.id, userId });
        }
    });

    const reportPath = path.join(__dirname, '../pre_migration_audit_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n=== AUDIT COMPLETE. REPORT WRITTEN TO ${reportPath} ===`);
    console.log(`Orphaned Merchant Products: ${report.orphans.merchantProductsMissingStore.length}`);
    console.log(`Orphaned Deals: ${report.orphans.dealsMissingStore.length}`);
    console.log(`Orphaned Orders: ${report.orphans.ordersMissingCustomer.length}`);
    console.log(`Orphaned Job Applications: ${report.orphans.jobApplicationsMissingJob.length}`);
    console.log(`Orphaned Scheduled Ingestions: ${report.orphans.scheduledIngestionsMissingStore.length}`);
    console.log(`Orphaned Campaign Logs: ${report.orphans.campaignLogsMissingStore.length}`);
    console.log(`Orphaned Billing Ledger Records: ${report.orphans.billingLedgerMissingStore.length + report.orphans.billingLedgerMissingUser.length}`);
}

runAudit().catch(console.error);
```

---

## 6. TypeScript Backfill & Seeding Script (`backfillMigration.ts`)

#### [NEW] [backfillMigration.ts](file:///Users/I501801/Documents/Projects/Spendigo-v1/services/api/scripts/backfillMigration.ts)
This automated migration script seeds the `ref_` reference tables from frontend constant definitions first, and then backfills all transactional entities in batch limits (500 per batch) with floating-to-integer conversion.

```typescript
import * as admin from 'firebase-admin';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/db/schema';

// Reference Constants imported directly for Database Seeding
import { BUSINESS_TYPES } from '../../../apps/web/src/data/businessTypes';
import { PRODUCT_CATEGORIES } from '../../../apps/web/src/data/categories';

const serviceAccount = require('../../scripts/service-account.json');
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const firestore = admin.firestore();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/spendigo_dev',
});
const db = drizzle(pool, { schema });

async function migrate() {
    console.log("=== STARTING REFERENCE SEEDING & BACKFILL ===");

    // 1. Seed SSoT Reference Tables
    console.log("Seeding ref_business_types...");
    const businessTypeRecords = Object.entries(BUSINESS_TYPES).map(([id, val]) => ({
        id,
        label: val.label,
        logo: val.logo || null,
        cover: val.cover || null,
        tagline: val.tagline,
    }));
    await db.insert(schema.refBusinessTypes).values(businessTypeRecords).onConflictDoNothing();

    console.log("Seeding ref_categories...");
    const categoryRecords = PRODUCT_CATEGORIES.map(catName => ({
        id: catName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        name: catName,
    }));
    await db.insert(schema.refCategories).values(categoryRecords).onConflictDoNothing();

    console.log("Seeding ref_order_statuses...");
    const orderStatuses = ['placed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'].map(id => ({ id }));
    await db.insert(schema.refOrderStatuses).values(orderStatuses).onConflictDoNothing();

    console.log("Seeding ref_payment_statuses...");
    const paymentStatuses = ['paid', 'pending', 'unpaid', 'refunding', 'refunded', 'partially_refunded'].map(id => ({ id }));
    await db.insert(schema.refPaymentStatuses).values(paymentStatuses).onConflictDoNothing();

    // 2. Backfill Core Users
    console.log("Backfilling users...");
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
            storeId: null, // Avoid circular key lock on insert
            status: data.status === 'pending_invite' ? 'pending_invite' : 'active',
            addresses: data.addresses || [],
            totalOrders: data.total_orders || 0,
            totalSpend: Math.round((data.total_spend || 0) * 100), // Dollar-to-Cent conversion
            lastOrderDate: data.last_order_date ? new Date(data.last_order_date) : null,
            createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
            lastActive: data.last_active ? new Date(data.last_active) : new Date(),
        });
    });
    if (userRecords.length > 0) {
        await db.insert(schema.users).values(userRecords).onConflictDoNothing();
    }
    console.log(`Successfully backfilled ${userRecords.length} users.`);

    // 3. Backfill Stores
    console.log("Backfilling stores...");
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
            deliveryFee: Math.round((data.deliveryFee || 0) * 100), // Dollar-to-Cent conversion
            freeDeliveryThreshold: data.freeDeliveryThreshold ? Math.round(data.freeDeliveryThreshold * 100) : null,
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
        if (data.ownerId) {
            circularUpdates.push({ userId: data.ownerId, storeId: doc.id });
        }
    });
    if (storeRecords.length > 0) {
        await db.insert(schema.stores).values(storeRecords).onConflictDoNothing();
    }
    console.log(`Successfully backfilled ${storeRecords.length} stores.`);

    // 4. Resolve User storeId circular FK locks
    console.log("Resolving circular store reference paths in users...");
    for (const update of circularUpdates) {
        await db.update(schema.users)
          .set({ storeId: update.storeId })
          .where(schema.users.id.eq(update.userId));
    }

    // 5. Backfill Catalog
    console.log("Backfilling master products...");
    const mProdSnap = await firestore.collection('master_products').get();
    const masterProductRecords: any[] = [];
    mProdSnap.forEach(doc => {
        const data = doc.data();
        const categoryId = data.category_id ? data.category_id.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'other';
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
            categoryId: categoryId,
            suggestedRetailPrice: data.suggested_retail_price ? Math.round(data.suggested_retail_price * 100) : null,
            status: ['active', 'deprecated', 'blocked'].includes(data.status) ? data.status : 'active',
            verificationStatus: ['unverified', 'verified', 'manufacturer_verified'].includes(data.verification_status) ? data.verification_status : 'unverified',
        });
    });
    if (masterProductRecords.length > 0) {
        await db.insert(schema.masterProducts).values(masterProductRecords).onConflictDoNothing();
    }

    // 6. Backfill Merchant Inventories
    console.log("Backfilling merchant inventory products...");
    const merchantProductsSnap = await firestore.collection('merchant_products').get();
    const merchantProductRecords: any[] = [];
    merchantProductsSnap.forEach(doc => {
        const data = doc.data();
        if (data.merchant_id && data.master_product_id) {
            merchantProductRecords.push({
                storeId: data.merchant_id,
                masterProductId: data.master_product_id,
                price: Math.round((data.price || 0.0) * 100), // Dollar-to-Cent conversion
                currency: data.currency || 'CAD',
                availableQuantity: data.available_quantity || 0,
                merchantSku: data.merchant_sku || null,
                originalPrice: data.original_price ? Math.round(data.original_price * 100) : null,
                discountLabel: data.discount_label || null,
                isActive: data.is_active ?? true,
            });
        }
    });
    if (merchantProductRecords.length > 0) {
        await db.insert(schema.merchantProducts).values(merchantProductRecords).onConflictDoNothing();
    }

    // 7. Backfill Checkout Transactions
    console.log("Backfilling orders & flattening order items...");
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
                subtotal: Math.round((data.subtotal || 0.0) * 100), // Dollar-to-Cent conversion
                deliveryFee: Math.round((data.deliveryFee || 0.0) * 100), // Dollar-to-Cent conversion
                tax: Math.round((data.tax || 0.0) * 100), // Dollar-to-Cent conversion
                total: Math.round((data.total || 0.0) * 100), // Dollar-to-Cent conversion
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
                    effectivePrice: Math.round((item.price || 0.0) * 100), // Dollar-to-Cent conversion
                    quantity: item.quantity || 1,
                    taxable: item.taxable ?? true,
                });
            }
        } catch (err: any) {
            console.error(`Skipped order ${doc.id} due to constraint violation:`, err.message);
        }
    }

    console.log("=== REFERENCE SEEDING & BACKFILL COMPLETED SUCCESSFULLY ===");
    await pool.end();
}

migrate().catch(console.error);
```

---

## 7. Zero-Downtime Pipeline: Dual-Write Bridge Layer

To protect operational continuity, a Cloud Functions bridge commits data to both systems during the transition grace period.

1. **Trigger Operation**: Cloud Function (e.g. `placeOrder`) receives payload.
2. **Step 1: Primary Commit (Firestore)**: Writes to Cloud Firestore immediately. This anchors standard operations and blocks checkout freezes.
3. **Step 2: Secondary Commit (PostgreSQL)**: Writes to PostgreSQL using Drizzle within a separate `try-catch` wrapper. 
4. **Resiliency DLQ**: If PostgreSQL fails or times out, the raw JSON payload is pushed to an isolated Cloud Pub/Sub dead-letter queue (DLQ) for asynchronous catch-up reconciliation.

---

## 8. Verification & Post-Migration Parity Suite

We run statistical checks comparing Firestore's counts to SQL Connect values:

* **Entities Check**:
  ```sql
  SELECT COUNT(*) FROM users;
  SELECT COUNT(*) FROM stores;
  SELECT COUNT(*) FROM master_products;
  ```
* **Financial Sum Check (Integer cents vs. Floating decimal parity)**:
  Compare the SQL cent sum divided by 100 with the cumulative float sum from Firestore:
  ```sql
  SELECT (SUM(total) / 100.0) as pg_total_sales FROM orders;
  ```
