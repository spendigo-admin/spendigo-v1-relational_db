# Search Implementation (v1.0)

**Last Updated**: 2026-04-20
**Status**: Production-Ready

---

## 1. Hybrid Search Architecture
Spendigo employs a multi-tier search strategy to balance performance, precision, and proximity.

### Tier 1: Exact Barcode Resolution (`useCatalog.ts`)
- **Mechanism**: Direct Firestore index lookup.
- **Handling**: Uses `generateBarcodeVariants()` to normalize inputs across GTIN-8, GTIN-12 (UPC), GTIN-13 (EAN), and GTIN-14 formats.
- **Trigger**: Activated when the query is purely numeric and fits standard barcode lengths.

### Tier 2: Proximity-Aware Cloud Search (Algolia v5)
- **Primary Engine**: Algolia `merchant_products` and `master_products` indices.
- **Geospatial Constraint**: Queries are filtered using `aroundLatLng` (Shopper GPS) and `aroundRadius` (Search distance in km).
- **Ranking**: Results are weighted by **Relevance** (exact name match) > **Popularity** > **Distance**.
- **Sync**: Real-time synchronization via the `algolia.firestore-algolia-search` Firebase extension.

### Tier 3: Local Fuzzy Optimization (`fuzzy-search.ts`)
- **Usage**: Primarily within the **SmartCart Optimizer** and **AddItemsPanel**.
- **Logic**: Combines Levenshtein Distance (typo tolerance) with Token Overlap (exact word matching).
- **Threshold**: Standardized 65% confidence floor for generic matching, 70% for substitutions.

---

## 2. Contextual Filtering & Faceting

### Global Search (`Search.tsx`)
- **Debounced Input**: 800ms delay to prevent excessive Algolia API operations.
- **Store Grouping**: Results are clustered by Store Name for easier shopper "trip planning."
- **FSA Fallback**: If GPS distance calculation fails, the system falls back to matching the **FSA (Forward Sortation Area)** of the postal codes (first 3 characters).

### Category Facets
- **Master Index**: Categories are derived from the global `master_products` schema.
- **Dynamic Filtering**: UI components (`StoreList`, `Search`) allow one-tap filtering across "Bakery," "Dairy," "Produce," etc.

---

## 3. Data Integrity & Sync

| Component | Responsibility | Status |
|-----------|----------------|--------|
| **Algolia Index** | Powering high-speed fuzzy search across the marketplace. | ✅ Active |
| **GTIN Normalization** | Ensuring "001234..." matches "1234..." across all formats. | ✅ Active |
| **Merchant Inventory** | Syncing local stock changes to Algolia within < 300ms. | ✅ Active |
| **Geo-Indexing** | Enabling "Find Milk within 5km" queries. | ✅ Active |

---

## 4. Maintenance & Configuration
- **Algolia Dashboard**: Manage searchable attributes (`product_name`, `brand_name`, `search_keywords`).
- **Keyword Synonyms**: Custom mapping for terms like "Soda" -> "Pop" to improve regional matching.
- **Analytics**: Search queries are captured to identify "Zero Result" gaps, which inform Master Catalog expansion priorities.
