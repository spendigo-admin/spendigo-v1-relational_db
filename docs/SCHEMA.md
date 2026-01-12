# Spendigo SmartCart — Database Schema

**Last Updated**: 2026-01-12
**Database**: Cloud Firestore (NoSQL)
**Status**: Beta (SmartCart Optimizer Implemented)

---

## 1. Overview

Spendigo uses **Cloud Firestore** with a **Hybrid Catalog Architecture** to balance global product standardization with merchant-specific inventory control. The schema is designed for the **SmartCart Optimizer**, ensuring robust product matching, tax calculations, and substitution logic.

---

## 2. Collection Structure

### 2.1 Core Catalog (SmartCart System)

```
/master_products            # Global Spendigo-managed product catalog
/pending_master_products    # Auto-discovered products awaiting admin review
/merchant_products          # Merchant-specific price & stock (Links to Master)
/product_creation_requests  # Merchant requests for new master products
/categories                 # Centralized category taxonomy
/substitution_groups        # Groups of interchangeable products (e.g. Milk 2L)
```

### 2.2 User & Commerce

```
/users                      # User profiles and authentication
/stores                     # Merchant store data
/orders                     # Order documents
/audit_logs                 # Security audit ledger
/carts                      # Shopping carts
/wishlists                  # User wishlists
```

### 2.3 Marketing (New)

```
/sponsored_listings         # Paid ad slots for top-of-list placement
```

### 2.4 Subcollections

```
/users/{userId}/notifications/{notifId} # In-app notifications
/stores/{storeId}/flyers/{flyerId}      # Digital flyers
```

### 2.5 Platform Support

```
/settings                   # Platform-wide settings
/surveys                    # Consumer surveys & polls
/stats                      # Traffic analytics & counters
/mail                       # Outbound emails (Trigger Email Extension)
```

---

## 3. Document Schemas (TypeScript Interfaces)

### 3.1 Master Catalog (`/master_products/{masterId}`)

**Purpose**: The "Source of Truth" for all products. Shared across all merchants.

```typescript
interface MasterProduct {
  master_product_id: string;     // e.g. "mp-coca-cola-355ml-1234"
  
  // Identification
  product_name: string;
  product_name_fr?: string;      // Bilingual support
  brand_name: string;
  brand_family_id?: string;
  barcode: string;               // GTIN-12/13
  upc_gtin: string;              // Normalized GTIN-14 (Indexed in Algolia)
  
  // Classification
  category_id: string;           // e.g. "Dairy", "Snacks"
  subcategory?: string;
  product_type: 'food' | 'non-food';
  storage_type: 'ambient' | 'refrigerated' | 'frozen';
  is_sold_by_weight: boolean;
  
  // Tax & Economy
  tax_category_id: string;       // e.g. "taxable_grocery", "zero_rated_grocery"
  suggested_retail_price?: number;
  
  // Measurements
  net_quantity_value?: number;
  net_quantity_unit?: string;    // 'ml', 'g', 'kg', 'l'
  package_count?: number;        // Multipack quantity (e.g. 12 cans)
  unit_type?: 'weight' | 'volume' | 'count';
  
  // Media
  primary_image_url: string;
  secondary_image_urls?: string[];
  short_description?: string;
  
  // SmartCart Logic
  substitution_group_id?: string; // Links to /substitution_groups
  nutrition?: Record<string, number>;
  ingredients?: string;
  allergens?: string[];
  dietary_tags?: string[];        // 'gluten-free', 'vegan', etc.
  
  // Governance
  status: 'active' | 'deprecated' | 'blocked';
  verification_status: 'unverified' | 'verified' | 'manufacturer_verified';
  created_at: FirebaseTimestamp;
  updated_at: FirebaseTimestamp;
}
```

### 3.2 Merchant Inventory (`/merchant_products/{merchantProductId}`)

**Purpose**: Connects a store to a Master Product with local price/stock.

```typescript
interface MerchantProduct {
  merchant_product_id: string;   // Format: "{storeId}_{masterId}"
  merchant_id: string;           // Reference to /stores
  master_product_id: string;     // Reference to /master_products
  
  // Local Overrides
  price: number;
  currency: 'CAD';
  available_quantity: number;
  merchant_sku?: string;         // Internal store code
  
  // Discounting
  original_price?: number;
  discount_label?: string;
  
  // Metadata
  is_active: boolean;
  created_at: FirebaseTimestamp;
  updated_at: FirebaseTimestamp;
}
```

### 3.3 Sponsored Listings (`/sponsored_listings/{adId}`)

**Purpose**: Paid placement for products within specific categories.

```typescript
interface SponsoredListing {
  id: string;
  merchantId: string;
  productId: string;        // merchant_product_id
  categoryIds: string[];    // Where this ad appears
  
  // Timing
  startDate: string;        // ISO Date
  endDate: string;          // ISO Date
  status: 'active' | 'scheduled' | 'expired';
  
  // Metrics
  impressions: number;
  clicks: number;
  
  // Billing
  cost: number;
  stripePaymentId?: string;
}
```

---

## 4. User & Order Schema

### 4.1 Users (`/users/{userId}`)

```typescript
interface User {
  id: string;                    // Firebase Auth UID
  email: string;
  name: string;
  role: 'consumer' | 'merchant' | 'admin';
  
  // Merchant Fields
  storeId?: string;              // Primary store ID
  
  // Preferences
  fcmToken?: string;             // For Push Notifications
}
```

### 4.2 Orders (`/orders/{orderId}`)

```typescript
interface Order {
  id: string;
  date: string;                  // ISO timestamp
  status: 'placed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  
  // Parties
  customerId: string;
  storeId: string;
  
  // Money
  subtotal: number;
  tax: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
  paymentStatus: 'paid' | 'pending';
  
  // Items (Snapshot of MerchantProduct + MasterProduct at time of purchase)
  items: Array<{
    productId: string;           // merchant_product_id
    masterId: string;
    name: string;
    price: number;
    quantity: number;
    image: string;
    taxable: boolean;
  }>;
}
```

---

## 5. Security Rules (RBAC)

**File**: `firestore.rules`

| Collection | Read Access | Write Access |
|------------|-------------|--------------|
| `master_products` | Public (All) | Admin Only (Merchants can create via Requests) |
| `merchant_products` | Public (All) | Merchant (Own Scope) |
| `pending_master_products` | Public (All) | Merchant (Create), Admin (Commit/Delete) |
| `users` | Own Profile | Own Profile |
| `stores` | Public | Admin (Create), Owner (Update) |
| `orders` | Involved Parties | Involved Parties |
| `sponsored_listings` | Public (Active) | System / Admin |
| `audit_logs` | Admin | System (Append Only) |

---

## 6. Migration Notes

**Legacy Schema**: The original `catalog` collection is deprecated and replaced by the `master_products` + `merchant_products` split.

**Key Changes**:
- **Normalized Data**: Product details (name, image, nutrition) live in `master_products`.
- **Lightweight Inventory**: `merchant_products` only contains price, stock, and ID links.
- **Tax Accuracy**: Tax calculation now relies on `master_products.tax_category_id` (e.g. 'zero_rated_grocery') rather than a simple boolean.
- **Substitution**: Supported via `substitution_group_id`.

---

**For architecture overview, see**: [ARCHITECTURE.md](./ARCHITECTURE.md)  
**For tech stack details, see**: [TECH_STACK.md](./TECH_STACK.md)

---

## 6. Migration Notes

**Legacy Schema**: The original `catalog` collection is deprecated and replaced by the `master_products` + `merchant_products` split.

**Key Changes**:
- **Normalized Data**: Product details (name, image, nutrition) live in `master_products`.
- **Lightweight Inventory**: `merchant_products` only contains price, stock, and ID links.
- **Tax Accuracy**: Tax calculation now relies on `master_products.tax_category_id` (e.g. 'zero_rated_grocery') rather than a simple boolean.
- **Substitution**: Supported via `substitution_group_id`.

---

**For architecture overview, see**: [ARCHITECTURE.md](./ARCHITECTURE.md)  
**For tech stack details, see**: [TECH_STACK.md](./TECH_STACK.md)
