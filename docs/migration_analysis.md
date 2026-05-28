# Spendigo Migration Analysis: No-Assumption Reference Map

This document establishes the definitive **Reference Map** of all Firestore data structures in the Spendigo monorepo and maps them to their equivalent PostgreSQL relational representations under Firebase SQL Connect.

---

## 1. Global Entities (Platform-Wide)

### 1.1 `master_products` (Global Catalog)
* **Firestore Location**: `/master_products/{productId}`
* **Relational Mapping**: Table `master_products`
* **Attributes Audited**:
  - `id` (VARCHAR(128) PRIMARY KEY)
  - `product_name` (VARCHAR(255) NOT NULL)
  - `brand_name` (VARCHAR(255) NULL)
  - `upc_gtin` (VARCHAR(50) UNIQUE)
  - `is_sold_by_weight` (BOOLEAN DEFAULT FALSE)
  - `net_quantity_value` (DOUBLE PRECISION NULL)
  - `net_quantity_unit` (VARCHAR(50) NULL)
  - `package_count` (INTEGER DEFAULT 1)
  - `primary_image_url` (TEXT NULL)
  - `secondary_image_urls` (JSONB Array)
  - `category_id` (VARCHAR(128) NULL)
  - `product_type` (VARCHAR(100) NULL)
  - `storage_type` (VARCHAR(100) NULL)
  - `tax_category_id` (VARCHAR(100) NULL)
  - `suggested_retail_price` (INTEGER NULL) -> Stored in integer cents.
  - `substitution_group_id` (VARCHAR(128) NULL)
  - `age_restricted` (BOOLEAN DEFAULT FALSE)
  - `is_canadian_local` (BOOLEAN DEFAULT FALSE)
  - `status` (ENUM('active', 'deprecated', 'blocked') DEFAULT 'active')
  - `verification_status` (ENUM('unverified', 'verified', 'manufacturer_verified') DEFAULT 'unverified')
* **Relationships**:
  - Soft-linked in Firestore to `/categories` via `category_id`. Relational representation: Foreign Key referencing `categories(id) ON DELETE SET NULL`.
  - Soft-linked to `/substitution_groups` via `substitution_group_id`. Relational representation: Foreign Key referencing `substitution_groups(id) ON DELETE SET NULL`.

### 1.2 `pending_master_products` (Merchant Submissions)
* **Firestore Location**: `/pending_master_products/{productId}`
* **Relational Mapping**: Table `pending_master_products`
* **Attributes Audited**:
  - `id` (VARCHAR(128) PRIMARY KEY)
  - `product_name` (VARCHAR(255) NOT NULL)
  - `brand_name` (VARCHAR(255) NULL)
  - `upc_gtin` (VARCHAR(50) NULL)
  - `requested_by_merchant_id` (VARCHAR(128) REFERENCES `stores.id`)
  - `status` (VARCHAR(50) DEFAULT 'pending')
* **Relationships**:
  - Created by merchants when auto-discovering items. Links to `stores.id`.

### 1.3 `users` (User Profiles & Roles)
* **Firestore Location**: `/users/{userId}`
* **Relational Mapping**: Table `users`
* **Attributes Audited**:
  - `id` (VARCHAR(128) PRIMARY KEY) -> Maps directly to Firebase Auth `uid`.
  - `email` (VARCHAR(255) UNIQUE NOT NULL)
  - `name` (VARCHAR(255) NULL)
  - `role` (ENUM('admin', 'merchant', 'consumer') NOT NULL)
  - `adminRole` (ENUM('SUPER_ADMIN', 'SUPPORT', 'MODERATOR', 'AUDITOR') NULL)
  - `merchantRole` (ENUM('OWNER', 'MANAGER', 'STAFF', 'MARKETING') NULL)
  - `storeId` (VARCHAR(128) NULL) -> Reference to merchant's assigned store.
  - `status` (ENUM('pending_invite', 'active', 'suspended') DEFAULT 'active')
  - `addresses` (JSONB Array) -> Array of shipping addresses (nested maps).
  - `total_orders` (INTEGER DEFAULT 0) -> Incremented atomically via transactions.
  - `total_spend` (INTEGER DEFAULT 0) -> Tracked in integer cents for consumer metrics.
  - `last_order_date` (TIMESTAMP)
  - `createdAt` (TIMESTAMP)
  - `last_active` (TIMESTAMP)
* **Subcollection**: `/users/{userId}/notifications/{notificationId}`
  - Mapping: Table `notifications` with `userId` as Foreign Key referencing `users(id) ON DELETE CASCADE`.
  - Attributes: `id` (PK), `type` (ENUM), `title`, `message`, `timestamp`, `read` (BOOLEAN), `orderId` (VARCHAR), `link`.
* **FCM Substructure**:
  - Firestore stores multiple tokens in a `fcmTokens` array inside the user document.
  - Relational Mapping: Flattened into table `user_fcm_tokens` with columns: `id` (PK), `user_id` (FK referencing `users.id`), `token` (TEXT), `created_at` (TIMESTAMP).

---

## 2. Store-Specific Entities (Merchant Tier)

### 2.1 `stores` (Merchant Locations)
* **Firestore Location**: `/stores/{storeId}`
* **Relational Mapping**: Table `stores`
* **Attributes Audited**:
  - `id` (VARCHAR(128) PRIMARY KEY)
  - `name` (VARCHAR(255) NOT NULL)
  - `logo` (TEXT NULL)
  - `address` (TEXT NULL)
  - `province` (VARCHAR(2) DEFAULT 'ON') -> Verified in `placeOrder.ts` for province tax rate.
  - `postalCode` (VARCHAR(7) NULL)
  - `location` -> Split into `latitude` (DOUBLE PRECISION) and `longitude` (DOUBLE PRECISION) for geospatial queries.
  - `deliveryFee` (INTEGER NOT NULL) -> Stored in integer cents.
  - `freeDeliveryThreshold` (INTEGER NULL) -> Stored in integer cents.
  - `pickupEnabled` (BOOLEAN DEFAULT TRUE)
  - `deliveryEnabled` (BOOLEAN DEFAULT FALSE)
  - `subscriptionTier` (VARCHAR(50) DEFAULT 'starter') -> Controls deal limits and features.
  - `status` (ENUM('active', 'pending', 'suspended', 'pending_deletion') DEFAULT 'pending')
  - `ownerId` (VARCHAR(128) REFERENCES `users.id`) -> Store Primary Owner.
  - `stripeAccountId` (VARCHAR(255) NULL)
  - `stripeOnboardingStatus` (VARCHAR(50) NULL)
  - `kybStatus` (VARCHAR(50) DEFAULT 'not_submitted')
  - `kybDocuments` (JSONB Array)
* **Subcollections**:
  - `/stores/{storeId}/flyers/{flyerId}`: Map to table `flyers`. FK `store_id` (REFERENCES `stores(id) ON DELETE CASCADE`). Includes array `items` of deals.
  - `/stores/{storeId}/deals/{dealId}`: Map to table `deals`. FK `store_id` (REFERENCES `stores(id) ON DELETE CASCADE`). Links a product to active sale pricing.
  - `/stores/{storeId}/analytics/{dateId}`: Map to table `store_analytics`. FK `store_id` (REFERENCES `stores(id) ON DELETE CASCADE`). Tracks Date-based view aggregates (`views`, `date`).

### 2.2 `merchant_products` (Store Inventory Linkages)
* **Firestore Location**: `/merchant_products/{storeId_productId}`
* **Relational Mapping**: Table `merchant_products` with composite key `(store_id, master_product_id)`
* **Attributes Audited**:
  - `store_id` (VARCHAR(128) REFERENCES `stores.id`)
  - `master_product_id` (VARCHAR(128) REFERENCES `master_products.id`)
  - `price` (INTEGER NOT NULL) -> Stored in integer cents.
  - `currency` (VARCHAR(3) DEFAULT 'CAD')
  - `available_quantity` (INTEGER DEFAULT 0) -> Monitored and decremented atomically in `placeOrder` transaction.
  - `merchant_sku` (VARCHAR(100) NULL)
  - `original_price` (INTEGER NULL) -> Stored in integer cents.
  - `discount_label` (VARCHAR(255) NULL)
  - `discount_valid_until` (TIMESTAMP NULL)
  - `is_active` (BOOLEAN DEFAULT TRUE)

---

## 3. Transactional & Forensic Entities

### 3.1 `orders` (Checkout Transactions)
* **Firestore Location**: `/orders/{orderId}`
* **Relational Mapping**: Table `orders`
* **Attributes Audited**:
  - `id` (VARCHAR(128) PRIMARY KEY)
  - `customerId` (VARCHAR(128) REFERENCES `users(id) ON DELETE RESTRICT`)
  - `storeId` (VARCHAR(128) REFERENCES `stores(id) ON DELETE RESTRICT`)
  - `storeName` (VARCHAR(255) NOT NULL)
  - `customerName` (VARCHAR(255) NOT NULL)
  - `customerEmail` (VARCHAR(255) NOT NULL)
  - `subtotal` (INTEGER NOT NULL) -> Stored in integer cents.
  - `deliveryFee` (INTEGER DEFAULT 0) -> Stored in integer cents.
  - `tax` (INTEGER NOT NULL) -> Stored in integer cents. Computed based on store province rates (e.g., HST/GST/PST).
  - `total` (INTEGER NOT NULL) -> Stored in integer cents.
  - `paymentMethod` (VARCHAR(50) DEFAULT 'card')
  - `paymentStatus` (ENUM('paid', 'pending', 'unpaid') DEFAULT 'unpaid')
  - `paymentIntentId` (VARCHAR(255) NULL) -> Checked for idempotency.
  - `deliveryAddress` (JSONB NOT NULL)
  - `status` (ENUM('placed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled') DEFAULT 'placed')
  - `rejectionReason` (TEXT NULL)
  - `estimatedTime` (VARCHAR(100) NULL)
  - `emailQueued` (BOOLEAN DEFAULT FALSE)
  - `emailQueuedAt` (TIMESTAMP NULL)
  - `cancelledAt` (TIMESTAMP NULL)
  - `createdAt` (TIMESTAMP DEFAULT NOW())
* **Items Substructure**:
  - Firestore keeps point-in-time item data in a nested map array.
  - Relational Mapping: Flattened into dedicated table `order_items` (columns: `id` (PK), `order_id` (FK), `master_product_id` (FK), `product_name`, `effective_price` (INTEGER NOT NULL -> stored in cents), `quantity` (INTEGER NOT NULL), `substitution_group_id`, `taxable` (BOOLEAN)).

### 3.2 `audit_logs` & `audit_logs_meta` (Cryptographic Forensic Ledger)
* **Firestore Location**: `/audit_logs/{txnId}` and `/audit_logs_meta/latest`
* **Relational Mapping**: Table `audit_logs`
* **Attributes Audited**:
  - `id` (VARCHAR(128) PRIMARY KEY)
  - `timestamp` (TIMESTAMP NOT NULL)
  - `actor` -> Split into `actorId` (VARCHAR(128)), `actorEmail` (VARCHAR(255)), `actorIp` (VARCHAR(45)) for indexing.
  - `action` (VARCHAR(100) NOT NULL)
  - `resource` (VARCHAR(255) NULL)
  - `metadata` (JSONB NULL)
  - `prevHash` (VARCHAR(64) UNIQUE NOT NULL) -> Links to prior block hash.
  - `hash` (VARCHAR(64) UNIQUE NOT NULL) -> SHA-256 of sorted-key canonicalization.
* **Integrity Constraints**:
  - Enforced in SQL with a `UNIQUE INDEX` on `prevHash` and `hash` columns to block concurrency-based fork/split chain attacks.

---

## 4. Operational Inconsistencies Audited

1. **Store/Owner Circular Reference Paths**:
   - `stores.ownerId` maps to `users.id`, and `users.storeId` maps to `stores.id`. This circular path makes insertions in Postgres impossible to complete in a single non-nullable pass.
   - **Resolution**: Make `users.storeId` a nullable field referencing `stores.id`. Write the `stores` record first with the `ownerId` set, and then run an update query to assign the `users.storeId` parameter.
2. **Product Reference Discrepancies**:
   - In frontend queries, `/merchant_products/{id}` is queried using document IDs formatted as `storeId_productId`. However, in the internal trigger functions, records are filtered by `merchant_id` and `master_product_id` attributes.
   - **Resolution**: Use the compound key `(store_id, master_product_id)` in Postgres. This matches the semantic indexing rules and guarantees composite uniqueness.
3. **Orphan Documents**:
   - In Firestore, several merchant products still reference store IDs that no longer exist (deleted stores). Similarly, old orders link to consumers who have deleted their accounts.
   - **Resolution**: Our script `preMigrationAudit.ts` scans and logs these orphaned items first, preventing them from violating PostgreSQL foreign key constraints during execution.

---

## 5. Administrative & Core Operational Entities (Platform Tier)

To ensure a smooth scratch rollout, the following 11 collections used in backend cloud functions and administrative pages must be mapped into relational Postgres tables.

### 5.1 `careers` & `job_applications` (Recruiting Portal)
* **Firestore Locations**: `/careers/{jobId}` and `/job_applications/{appId}`
* **Relational Mapping**: Tables `careers` and `job_applications`
* **Attributes**:
  - `careers`: `id` (PK), `title` (VARCHAR(255) NOT NULL), `department` (VARCHAR(100)), `location` (VARCHAR(100)), `type` (VARCHAR(50)), `description` (TEXT), `requirements` (TEXT), `created_at` (TIMESTAMP).
  - `job_applications`: `id` (PK), `job_id` (FK REFERENCES `careers.id` ON DELETE CASCADE), `candidate_name` (VARCHAR(255) NOT NULL), `candidate_email` (VARCHAR(255) NOT NULL), `resume_url` (TEXT), `status` (ENUM('new', 'reviewed', 'interviewing', 'rejected', 'hired') DEFAULT 'new'), `created_at` (TIMESTAMP).

### 5.2 `ads` (Platform Promotional Banners)
* **Firestore Location**: `/ads/{adId}`
* **Relational Mapping**: Table `ads`
* **Attributes**:
  - `id` (PK), `title` (VARCHAR(255) NOT NULL), `image_url` (TEXT NOT NULL), `link` (TEXT), `priority` (INTEGER DEFAULT 0), `status` (ENUM('active', 'inactive') DEFAULT 'active'), `store_id` (FK REFERENCES `stores.id` ON DELETE SET NULL), `created_at` (TIMESTAMP).

### 5.3 `surveys` & `survey_responses` (Feedback Mechanism)
* **Firestore Locations**: `/surveys/{surveyId}` and `/surveys/{surveyId}/responses/{userId}`
* **Relational Mapping**: Tables `surveys` and `survey_responses`
* **Attributes**:
  - `surveys`: `id` (PK), `title` (VARCHAR(255) NOT NULL), `description` (TEXT), `questions` (JSONB), `status` (ENUM('active', 'inactive') DEFAULT 'active'), `created_at` (TIMESTAMP).
  - `survey_responses`: `survey_id` (FK REFERENCES `surveys.id` ON DELETE CASCADE), `user_id` (FK REFERENCES `users.id` ON DELETE CASCADE), `answers` (JSONB NOT NULL), `created_at` (TIMESTAMP). Primary Key: `(survey_id, user_id)`.

### 5.4 `promo_codes` (Discount Management)
* **Firestore Location**: `/promo_codes/{codeId}`
* **Relational Mapping**: Table `promo_codes`
* **Attributes**:
  - `id` (PK), `code` (VARCHAR(50) UNIQUE NOT NULL), `discount_percent` (INTEGER NOT NULL), `max_uses` (INTEGER), `uses_count` (INTEGER DEFAULT 0), `expires_at` (TIMESTAMP), `status` (ENUM('active', 'inactive') DEFAULT 'active').

### 5.5 `scheduled_ingestion` (OSM / Scraping Automation)
* **Firestore Location**: `/scheduled_ingestion/{jobId}`
* **Relational Mapping**: Table `scheduled_ingestions`
* **Attributes**:
  - `id` (PK), `merchant_id` (FK REFERENCES `stores.id` ON DELETE CASCADE), `flyer_url` (TEXT), `status` (ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending'), `log_content` (TEXT), `created_at` (TIMESTAMP).

### 5.6 `staff` (Admin Staff RBAC Profiles)
* **Firestore Location**: `/staff/{email}`
* **Relational Mapping**: Table `staff`
* **Attributes**:
  - `email` (VARCHAR(255) PRIMARY KEY) -> Normalized lowercase email address.
  - `name` (VARCHAR(255) NOT NULL)
  - `role` (ENUM('SUPER_ADMIN', 'SUPPORT', 'MODERATOR', 'AUDITOR') NOT NULL)
  - `status` (VARCHAR(50) DEFAULT 'active')
  - `joined_at` (TIMESTAMP)

### 5.7 `mail` (Trigger Email Queue)
* **Firestore Location**: `/mail/{mailId}`
* **Relational Mapping**: Table `mail`
* **Attributes**:
  - `id` (PK), `to` (TEXT[] NOT NULL), `message` (JSONB NOT NULL), `status` (JSONB), `created_at` (TIMESTAMP).

### 5.8 `payments` (Stripe Checkout Intent Webhook Capture)
* **Firestore Location**: `/payments/{paymentIntentId}`
* **Relational Mapping**: Table `payments`
* **Attributes**:
  - `id` (PK -> Stripe PaymentIntent ID), `status` (VARCHAR(50) NOT NULL), `order_id` (VARCHAR(128)), `metadata` (JSONB), `created_at` (TIMESTAMP).

### 5.9 `billing_ledger` (Subscription Invoicing Audit Trail)
* **Firestore Location**: `/billing_ledger/{ledgerId}`
* **Relational Mapping**: Table `billing_ledger`
* **Attributes**:
  - `id` (PK), `store_id` (VARCHAR(128) REFERENCES `stores.id`), `store_name` (VARCHAR(255)), `user_id` (VARCHAR(128) REFERENCES `users.id`), `user_email` (VARCHAR(255)), `type` (VARCHAR(50)), `amount` (INTEGER), `tier` (VARCHAR(50)), `stripe_charge_id` (VARCHAR(255)), `stripe_invoice_id` (VARCHAR(255)), `billing_reason` (VARCHAR(100)), `timestamp` (TIMESTAMP), `status` (VARCHAR(50)), `description` (TEXT).

### 5.10 `smartcart_optimizer_cache` (Algolia Optimization Caching)
* **Firestore Location**: `/smartcart_optimizer_cache/{cacheKey}`
* **Relational Mapping**: Table `smartcart_optimizer_cache`
* **Attributes**:
  - `cache_key` (VARCHAR(64) PRIMARY KEY), `data_signature` (VARCHAR(64) NOT NULL), `response` (JSONB NOT NULL), `created_at` (TIMESTAMP), `expires_at` (TIMESTAMP).

