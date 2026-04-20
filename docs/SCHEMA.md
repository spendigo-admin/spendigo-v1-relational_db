# Spendigo SmartCart — Database Schema

**Last Updated**: 2026-04-20
**Database**: Cloud Firestore (NoSQL)
**Status**: Production-Ready (v1.0)

---

## 1. Overview
Spendigo utilizes a **Hybrid Multi-Tenant Catalog Architecture**. This ensures a "Single Source of Truth" for global consumer products (Master Catalog) while allowing merchants complete autonomy over their local inventory, pricing, and hyper-local deals.

---

## 2. Global Collections (Platform-Wide)

### 2.1 `/master_products/{masterProductId}`
The definitive registry for all consumer goods.
- **Identification**: `product_name`, `brand_name`, `upc_gtin` (normalized barcode).
- **Physical**: `is_sold_by_weight`, `net_quantity_value`, `net_quantity_unit`, `package_count`.
- **Classification**: `category_id`, `product_type`, `storage_type`.
- **Commerce**: `tax_category_id` (e.g., zero_rated_grocery), `suggested_retail_price`.
- **SmartCart Logic**: `substitution_group_id` (links interchangeable items).
- **Compliance**: `age_restricted`, `is_canadian_local`.

### 2.2 `/ads/{adId}`
State-of-the-art ad campaign management for the Private Ad Network.
- **Content**: `title`, `description`, `imageUrl`, `linkUrl`.
- **Execution**: `startDate`, `endDate`, `status` (active/draft/archived), `priority`.
- **Analytics**: `views` (Impressions), `clicks` (CTR Tracking), `createdAt`.

### 2.3 `/audit_logs/{txnId}`
**Forensic Security Ledger** with tamper-evident SHA-256 hash chaining.
- **Context**: `timestamp`, `action` (e.g., AUTH_LOGIN, STORE_APPROVE), `resource`.
- **Actor**: `id`, `email`, `ip` (masked in frontend).
- **Integrity**: `prevHash` (Link to prior block), `hash` (SHA-256 of canonicalized payload).

---

## 3. Merchant Collections (Store-Specific)

### 3.1 `/stores/{storeId}`
Root metadata and services for a merchant location.
- **Identity**: `name`, `logo`, `address`, `phone`.
- **Distance-Aware**: `coordinates` (lat/lng), `postalCode` (FSA-fallback), `maxDeliveryRadiusKm`.
- **Policy**: `deliveryFee`, `freeDeliveryThreshold`, `pickupEnabled`, `deliveryEnabled`.
- **State**: `subscriptionTier` (Core/Growth/Premium), `status` (active/pending/suspended).

### 3.2 `/stores/{storeId}/flyers/{flyerId}`
- **Assets**: `imageUrl`, `name`.
- **Validity**: `startDate`, `endDate`, `isActive`.

### 3.3 `/merchant_products/{merchantProductId}`
Lightweight inventory linkage.
- **Link**: `merchant_id`, `master_product_id`.
- **Terms**: `price`, `available_quantity`, `merchant_sku`.
- **Sale State**: `original_price`, `discount_label`, `is_canadian_local`.

---

## 4. Operational Collections

### 4.1 `/product_creation_requests/{requestId}`
Workflow for adding new SKU data to the Master Catalog.
- **Request**: `requested_product_name`, `requested_barcode`, `requested_image_url`.
- **Resolution**: `status` (pending/approved/rejected), `approved_master_product_id`.

### 4.2 `/orders/{orderId}`
Frozen snapshots of transaction data for historical accuracy.
- **Parties**: `customerId`, `storeId`.
- **Status**: `placed`, `preparing`, `out_for_delivery`, `delivered`.
- **Financial**: `subtotal`, `tax`, `deliveryFee`, `serviceFee`, `total`.

---

## 5. Security Rules (RBAC Enforcement)

| Scope | Read | Write | Logic |
|-------|------|-------|-------|
| `master_products` | Public | Admin Only | Global registry protection. |
| `merchant_products` | Public | Owner Only | Verification of `request.auth.uid`. |
| `audit_logs` | Admin Only | System | Append-only logic via `logEvent`. |
| `stores` | Public | Admin/Owner | Subscription checks on ad/flyer features. |

---

## 6. Schema Integrity Notes
1. **Normalization**: Master Products are never duplicated across stores; only `merchant_product` links are created.
2. **Hard Snapshots**: Orders contain embedded product data (name/price) to prevent history distortion if a Master Product is edited or a Store changes its core price later.
3. **Canonical Hashing**: Audit logs are hashed using sorted-key canonicalization to ensure identical payloads always yield the same cryptographic signature regardless of key order.
