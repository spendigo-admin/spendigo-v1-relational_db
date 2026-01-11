# Spendigo SmartCart — Sponsored Listings Design

**Last Updated**: 2026-01-11
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

### C. Search Priority (SmartCart) 🚧
*   **Status**: Planned for Q2.
*   **Logic**: When a user searches "Milk", products from Growth Tier stores will appear first if the price variance is < 10%.
*   **Fairness Check**: The **SmartCart Optimizer** will NEVER substitute a cheaper product for a sponsored, more expensive one. Sponsored listings only affect *visual sorting* in the browse/search UI, not the optimization engine logic.

---

## 3. Revenue Projections (Revised)

| Ad Type | Monthly Cost | Volume (Est) | Monthly Revenue |
| :--- | :--- | :--- | :--- |
| **Growth Plan** (Bundled Boost) | $79/merchant | 50 merchants | $3,950 |
| **Carousel Slots** (National) | $1,000/slot | 3 slots | $3,000 |
| **Carousel Slots** (Local) | $250/slot | 10 slots | $2,500 |
| **Total Ad Revenue** | | | **~$9,450 / mo** |

---

## 4. Technical Schema (`/ads/{adId}`)

```typescript
interface AdCampaign {
  id: string;
  type: 'carousel' | 'featured_store';
  
  // Content
  title: string;
  imageUrl: string;
  linkUrl: string; // e.g., "/store/123"
  
  // Scheduling
  startDate: string; // ISO
  endDate: string;
  isActive: boolean;
  priority: number; // 1-10 (Higher shows first)
  
  // Analytics
  views: number;
  clicks: number;
}
```

## 5. Guidelines & Ethics
1.  **Relevance**: Ad algorithms must verify the store is within the user's delivery radius. We do not show ads for unreachable stores.
2.  **Disclosure**: Featured Listings are marked with a "Promoted" or "Featured" label to comply with Canadian advertising standards.
3.  **Optimization Integrity**: The "Cheapest Price" calculated by SmartCart is sacrosanct. Ads never override savings.
