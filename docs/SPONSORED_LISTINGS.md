# Sponsored Listings & Internal Ad Network Design

## 1. Overview
Instead of external networks like Google Ads (which leak traffic to competitors), Spendigo will build a **Private Ad Network**. This allows us to keep 100% of the revenue and ensures ads are relevant to the grocery shopping experience.

## 2. Ad Formats

### A. "Featured Stores" (Store Boost)
*   **Placement**: Top of the "Nearby Stores" list on the Homepage.
*   **Appearance**: Subtle gold border or "Promoted" badge.
*   **Targeting**: Geo-located (only shown to users within delivery radius).
*   **Access**:
    *   **Automated**: Included automatically for **Growth Plan ($99/mo)** merchants.
    *   **Manual**: (Future) One-time boost purchase for Core merchants ($10/week).

### B. "Sponsored Products" (Search Boost)
*   **Placement**: First 2 slots in search results (e.g., user types "Milk", local dairy farm's sponsored milk appears first).
*   **Appearance**: Tagged with a small "Ad" or "Sponsored" label.
*   **Access**: Growth Plan merchants get priority ranking in search algorithms.

### C. "Brand Banners" (Homepage Carousel)
*   **Placement**: Main Hero Carousel on the Consumer App Homepage.
*   **Content**: High-quality banners for national brands (e.g., Coca-Cola, Kraft) or major local events.
*   **Revenue**: High-ticket manual sales (e.g., $500 - $2,000 / month).
*   **Management**: Admin-controlled via "Ad Manager" in the Admin Dashboard.

## 3. Revenue Projections (Est.)

| Ad Type | Monthly Cost | Volume (Est) | Monthly Revenue |
| :--- | :--- | :--- | :--- |
| **Growth Plan** (Bundled Boost) | $99/merchant | 50 merchants | $4,950 |
| **Spotlight Boost** (Add-on) | $25/week | 20 boosts | $2,000 |
| **Brand Banners** (Enterprise) | $1,000/slot | 2 slots | $2,000 |
| **Total Ad Revenue** | | | **~$9,000 / mo** |

*Note: This is significantly higher than the ~$150/mo expected from Google AdSense for similar traffic.*

## 4. Implementation Strategy (MVP)

### Phase 1: Growth Plan Priority (Immediate)
*   **Logic**: Update the `getStores` and `searchProducts` algorithms.
*   **Rule**: `if (store.subscriptionTier === 'growth') { score += 100 }`
*   **UI**: Add a `div` badge saying "Sponsored" or "Featured" for these items.

### Phase 2: Brand Banner System (Post-Launch)
*   **Database**: Create `ads` collection in Firestore.
*   **Admin UI**: Interface to upload banner image, set URL, and set active dates.
*   **Frontend**: Inject these banners into the Home Carousel.

## 5. Risk & Quality Control
*   **Relevance**: Algorithms must still respect distance. Do not show a "Sponsored" store that is 50km away.
*   **Dilution**: Limit "Featured" slots to max 3 at the top to avoid banner blindness.
