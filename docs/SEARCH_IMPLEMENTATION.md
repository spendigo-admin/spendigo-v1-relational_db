# Search Implementation (Active)

**Last Updated**: 2026-01-12
**Status**: Active Production

## Executive Summary
This document outlines the implemented strategy for full-text search using **Algolia**. The integration creates a hybrid search system that prioritizes precise barcode matches (Firestore) but falls back to fuzzy text search (Algolia) for misspelled or broad queries.

## 1. Architecture

### Hybrid Search Logic (`useCatalog.ts`)
1.  **Exact Barcode Match**: Browser checks if input is a barcode (numeric). Queries Firestore `upc_gtin` index directly. (Cost: 1 Read)
2.  **Algolia Search**: If generic text, query Algolia Index `master_products`. (Cost: 1 Search op)
3.  **Firestore Fallback**: If Algolia fails or returns 0 results, fall back to basic `name.contains` query in Firestore.

### SmartCart Optimization Logic (`SmartCartWishlist.tsx`)
In addition to global search, the optimization engine uses a client-side fuzzy matcher:
-   **Goal**: Match generic wishlist items (e.g., "Milk") to specific merchant inventory.
-   **Method**: Client downloads store inventory and performs a local fuzzy search using `includes()` and Master Catalog references.
-   **Visuals**: Displays the matched specific product (e.g., "Dairyland 2%") instead of generic text.

## 2. Configuration Parameters

| Service | Setting | Value |
|---------|---------|-------|
| **Algolia** | Index Name | `master_products` |
| **Algolia** | Searchable Attributes | `product_name`, `brand_name`, `short_description`, `category_id`, `dietary_tags`, `upc_gtin` |
| **Algolia** | Retrieved Attributes | `primary_image_url` (Critical for UI), `product_name`, `brand_name` |
| **Algolia** | Custom Ranking | `desc(popularity_score)` |
| **Firebase** | Extension | `algolia.firestore-algolia-search` |

## 3. Frontend Integration

### Environment Variables (.env.local)
```bash
VITE_ALGOLIA_APP_ID=...
VITE_ALGOLIA_SEARCH_KEY=...
VITE_ALGOLIA_INDEX_NAME=master_products
```

### Dependency (v5)
Using `algoliasearch/lite` v5 client.
```typescript
const { results } = await searchClient.search({
    requests: [{ indexName: 'master_products', query: '...' }]
});
```

## 4. Maintenance / Troubleshooting
-   **Missing Results**: Check if the Firebase Extension is running. Check Algolia dashboard "Logs" for indexing errors.
-   **Stale Data**: The extension listens to `onWrite`. If data is changed manually in console, it syncs. If data is imported via script bypassing triggers, a re-index is needed.
