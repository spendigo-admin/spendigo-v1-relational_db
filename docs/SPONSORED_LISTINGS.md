# Spendigo SmartCart — Sponsored Listings Design

**Last Updated**: 2026-05-01
**Status**: Production-Ready (Phase 2 Implemented)

---

## 1. Overview
Spendigo operates a **Private Ad Network** that is native, privacy-preserving, and keeps 100% of revenue within the ecosystem. We avoid external tracking networks (AdSense/Facebook) to protect shopper data and maintain a premium, retail-focused experience.

## 2. Ad Implementation Status

### A. Carousel Banners (Active & Tracked) ✅
*   **Placement**: Main Hero Carousel on the Consumer Homepage.
*   **Management**: Admins control this via `AdminAdManager` (`/admin/ads`).
*   **Functionality**:
    *   **Creative**: Support for high-resolution images and **MP4 video assets** (stored in Firebase Storage).
*   **Targeting**: Global or Local (Geofenced) targeting with dynamic link URLs.
*   **Analytics**: Real-time **Impression (Views)** incremented on media load, and **Click-through** tracking via `AdCarousel.tsx`.
*   **Revenue**: Sold as premium placements for national brands or local seasonal events.

### B. Tiered Visibility Boosts (Active) ✅
*   **Placement**: `StoreList` and Marketplace Sections.
*   **Logic**: Orchestrated via `MarketplaceContext.tsx` (`filterStoreData` logic).
*   **Functionality**:
    *   **Starter/Free Plan**: Flyers and One-Day Offers are visible only on the individual Store Profile. They are suppressed from the global marketplace "Weekly Rack."
*   **Core/Growth Plan**: Unlocks global discovery. Deals are promoted to the homepage and search result boosters.
*   **Revenue**: Bundled into the **Growth Plan ($79/mo)** or **Core Plan ($49/mo)**.

### C. Featured Stores (Visual Branding) ✅
*   **Placement**: `StoreList` Grid.
*   **Logic**: Stores on the Growth tier are eligibility for premium "Promoted" badges and higher-fidelity logos.
*   **Fairness**: Sorting currently remains distance-centric to prioritize proximity, but Featured stores receive enhanced visual weight (Glassmorphism borders, pulse effects).

### D. Sponsored Product Listings (Schema Phase) 🚧
*   **Status**: Schema Defined (`/sponsored_listings`).
*   **Placement**: Top of Category Search Results.
*   **Logic**: Merchants bid to have specific Master Catalog IDs prioritized.
*   **Constraint**: The **SmartCart Optimizer** NEVER substitutes a more expensive sponsored product for a cheaper matching item in the "Best Split" calculation. Ethics and savings are sacrosanct.

---

## 3. Revenue Architecture

| Ad Unit | Pricing Model | Target Audience | Impact |
| :--- | :--- | :--- | :--- |
| **Carousel Header** | Fixed Monthly | Large National Brands | Awareness & Brand Equity |
| **Marketplace Boost** | Subscription Bundle | Local Independent Grocers | Foot Traffic & Discoverability |
| **Flash Deal Placements** | Duration-based | Specialty Vendors | Inventory Liquidation |
| **CPC Listings** | Pay-per-click | Emerging CPG Brands | Direct Sales Conversion |

---

## 4. Technical Schemas

### Ad Campaigns (`/ads/{adId}`)
*Used for high-impact carousel banners.*
```typescript
interface AdCampaign {
  id: string;
  title: string;
  imageUrl: string;
  mobileImageUrl?: string; // Optimized for portrait viewing
  linkUrl: string;
  status: 'active' | 'draft' | 'archived';
  startDate: string;
  endDate: string;
  priority: number;
  scope: 'global' | 'local';
  views: number;
  clicks: number;
}
```

### Marketplace Plan Filters (`MarketplaceContext`)
*Internal system logic to gate sponsored visibility.*
```typescript
const filterStoreData = (store) => {
  const tier = store.subscriptionTier || 'free';
  const hasPromoPlan = tier !== 'free';
  
  // Suppress marketplace flyers if on free tier
  if (!hasPromoPlan) {
    store.flyer = { ...empty };
    store.activeFlyerItems = [];
  }
  return store;
}
```

---

## 5. Guidelines & Ethics
1.  **Radius Enforcement**: We never show ads for stores outside the shopper's active delivery/search radius. Relevancy is the priority.
2.  **Disclosure**: All paid placements are marked with a "Promoted" or "Featured" tag per Canadian Competition Bureau guidelines.
3.  **Savings Integrity**: The "Cheapest Price" optimization engine handles sponsored products as normal catalog items; a sponsorship fee does not change the item's calculated value to the shopper.
