# Spendigo SmartCart — Sponsored Listings Design

**Last Updated**: 2026-01-12
**Status**: Plan Active (Phase 1 Implemented)

## 1. Overview
Instead of relying on external ad networks (e.g. AdSense) which leak user data and distract shoppers, Spendigo implements a **Private Ad Network**. This system is native, privacy-preserving, and keeps 100% of revenue within the ecosystem.

## 2. Ad Implementation Status

### A. Featured Stores (Homepage Boost) ✅
*   **Placement**: "Featured Stores" section on the Homepage.
*   **Logic**: 
    1.  User enters `StoreList` page.
    2.  System fetches stores.
    3.  **Sort Order**: Stores with `subscriptionTier: 'growth'` are prioritized to the top.
    4.  **Display**: These stores get a subtle "Star" badge or premium border.
*   **Revenue**: Bundled into the **Growth Plan ($79/mo)**.

### B. Carousel Banners (Admin Managed) ✅
*   **Placement**: Main Hero Carousel on the Consumer Homepage.
*   **Management**: Admins control this via `AdminAdManager` (`/admin/ads`).
*   **Functionality**:
    *   Upload Banner Image (Firebase Storage).
    *   Set Target URL (Internal `/store/xy` or External).
    *   Set Active Dates (Start/End).
    *   Track Views/Clicks (Basic analytics in Firestore).
*   **Revenue**: Sold manually to large brands or used for internal promos (Reference: `$500-$2000/mo`).

### C. Sponsored Product Listings (New) 🚧
*   **Status**: In Development (Schema Defined).
*   **Placement**: Top of Search Results or Category Pages.
*   **Logic**: Merchants bid to have their specific product (e.g. "MyBrand Coffee") appear at the top when a user browses the "Coffee" category.
*   **Billing**: Pay-per-click or Fixed Duration.
*   **Schema**: managed in `/sponsored_listings` collection.

### D. Search Priority (SmartCart) 🚧
*   **Status**: Planned for Q2.
*   **Logic**: When a user searches "Milk", products from Growth Tier stores will appear first if the price variance is < 10%.
*   **Fairness Check**: The **SmartCart Optimizer** will NEVER substitute a cheaper product for a sponsored, more expensive one. Sponsored listings only affect *visual sorting* in the browse/search UI, not the optimization engine logic.

---

## 3. Revenue Projections (Revised)

| Ad Type | Monthly Cost | Volume (Est) | Monthly Revenue |
| :--- | :--- | :--- | :--- |
| **Growth Plan** (Bundled Boost) | $79/merchant | 50 merchants | $3,950 |
| **Carousel Slots** (National) | $1,000/slot | 3 slots | $3,000 |
| **Product Listings** (CPC) | ~$0.50/click | 2000 clicks | $1,000 |
| **Carousel Slots** (Local) | $250/slot | 10 slots | $2,500 |
| **Total Ad Revenue** | | | **~$10,450 / mo** |

---

## 4. Technical Schemas

### Ad Campaigns (`/ads/{adId}`)
Used for Homepage Banners.

```typescript
interface AdCampaign {
  id: string;
  type: 'carousel' | 'featured_store';
  title: string;
  imageUrl: string;
  linkUrl: string; // e.g., "/store/123"
  active: boolean;
  priority: number;
}
```

### Sponsored Listings (`/sponsored_listings/{id}`)
Used for Product sorting boosts.

```typescript
interface SponsoredListing {
  id: string;
  merchantId: string;
  productId: string;
  categoryIds: string[];
  cost: number;
  status: 'active' | 'scheduled';
}
```

## 5. Guidelines & Ethics
1.  **Relevance**: Ad algorithms must verify the store is within the user's delivery radius. We do not show ads for unreachable stores.
2.  **Disclosure**: Featured Listings are marked with a "Promoted" or "Featured" label to comply with Canadian advertising standards.
3.  **Optimization Integrity**: The "Cheapest Price" calculated by SmartCart is sacrosanct. Ads never override savings.
