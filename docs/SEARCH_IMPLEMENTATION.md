# Search Implementation (Active)

## Executive Summary
This document outlines the implemented strategy for full-text search using **Algolia**. The integration creates a hybrid search system that prioritizes precise barcode matches (Firestore) but falls back to fuzzy text search (Algolia) for misspelled or broad queries.

## 1. Architecture

### Hybrid Search Logic (`useCatalog.ts`)
1.  **Exact Barcode Match**: Browser checks if input is a barcode (numeric). Queries Firestore `upc_gtin` index directly. (Cost: 1 Read)
2.  **Algolia Search**: If generic text, query Algolia Index `master_products`. (Cost: 1 Search op)
3.  **Firestore Fallback**: If Algolia fails or returns 0 results, fall back to basic `name.contains` query in Firestore.

## 2. Configuration Parameters

| Service | Setting | Value |
|---------|---------|-------|
| **Algolia** | Index Name | `master_products` |
| **Algolia** | Searchable Attributes | `product_name`, `brand_name`, `short_description`, `category_id`, `dietary_tags` |
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
- **Missing Results**: Check if the Firebase Extension is running. Check Algolia dashboard "Logs" for indexing errors.
- **Stale Data**: The extension listens to `onWrite`. If data is changed manually in console, it syncs. If data is imported via script bypassing triggers, a re-index is needed.
