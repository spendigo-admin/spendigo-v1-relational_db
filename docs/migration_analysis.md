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
  - `suggested_retail_price` (DOUBLE PRECISION NULL)
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
  - `merchantRole` (ENUM('OWNER', 'MANAGER', 'STAFF', 'MARKETING') NULL)
  - `storeId` (VARCHAR(128) NULL) -> Reference to merchant's assigned store.
  - `status` (ENUM('pending_invite', 'active', 'suspended') DEFAULT 'active')
  - `addresses` (JSONB Array) -> Array of shipping addresses (nested maps).
  - `total_orders` (INTEGER DEFAULT 0) -> Incremented atomically via transactions.
  - `total_spend` (DOUBLE PRECISION DEFAULT 0.0) -> Tracked for consumer metrics.
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
  - `deliveryFee` (DOUBLE PRECISION NOT NULL)
  - `freeDeliveryThreshold` (DOUBLE PRECISION NULL)
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
  - `price` (DOUBLE PRECISION NOT NULL)
  - `currency` (VARCHAR(3) DEFAULT 'CAD')
  - `available_quantity` (INTEGER DEFAULT 0) -> Monitored and decremented atomically in `placeOrder` transaction.
  - `merchant_sku` (VARCHAR(100) NULL)
  - `original_price` (DOUBLE PRECISION NULL)
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
  - `subtotal` (DOUBLE PRECISION NOT NULL)
  - `deliveryFee` (DOUBLE PRECISION DEFAULT 0.0)
  - `tax` (DOUBLE PRECISION NOT NULL) -> Computed based on store province rates (e.g., HST/GST/PST).
  - `total` (DOUBLE PRECISION NOT NULL)
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
  - Relational Mapping: Flattened into dedicated table `order_items` (columns: `id` (PK), `order_id` (FK), `master_product_id` (FK), `product_name`, `effective_price`, `quantity`, `substitution_group_id`, `taxable`).

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
