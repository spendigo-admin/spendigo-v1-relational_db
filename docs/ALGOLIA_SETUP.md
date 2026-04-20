# Algolia Search Engine Configuration

**Last Updated**: 2026-04-20
**Status**: Production-Ready (v1.0)
**Primary Engine**: Algolia v5

---

## 1. Multi-Tier Index Architecture
Spendigo utilizes a dual-index strategy to balance global discovery with local merchant availability.

### Index A: `master_products`
- **Scope**: Platform-wide standardized products.
- **Sync**: Managed via the official **"Search with Algolia"** Firebase Extension.
- **Searchable Attributes**: `product_name`, `brand_name`, `short_description`, `upc_gtin`, `category_id`.
- **Ranking**: Unweighted (Global Relevance).

### Index B: `merchant_products`
- **Scope**: Hyper-local inventory, pricing, and proximity.
- **Sync**: Managed via a custom Cloud Function trigger (`syncMerchantProductToAlgolia`).
- **Core Feature**: Proximity Search.
- **Attributes**: Includes all Master attributes + `merchant_id`, `price`, `discount_label`, and **`_geoloc`**.

---

## 2. Geospatial Search (Proximity)
The `merchant_products` index is configured to support location-aware queries.

### Requirements:
- **Field**: Each record must contain a `_geoloc` object with `lat` and `lng`.
- **Frontend Trigger**: Searching via `useCatalog.ts` sends the shopper's current coordinates using `aroundLatLng`.
- **Ranking**: Results are sorted by **Distance** first, then **Relevance**.

---

## 3. Extension Configuration (Master Catalog)
During installation of the Firebase Extension for `master_products`, ensure these parameters are set:

| Parameter | Value |
| :--- | :--- |
| **Collection Path** | `master_products` |
| **Index Name** | `master_products` |
| **Fields to Index** | `product_name,brand_name,upc_gtin,category_id,primary_image_url` |
| **Algolia App ID** | `[Production_App_ID]` |
| **Algolia API Key** | `[Production_Admin_Key]` |

---

## 4. Custom Sync Trigger (Merchant Inventory)
The local inventory sync is handled by `services/api/src/triggers/algoliaMerchantTriggers.ts`. 

### Logic Flow:
1. **Trigger**: Detects `onWrite` changes in `/merchant_products/{id}`.
2. **Denormalization**: Fetches the parent `master_product` and `store` location to create a flat Algolia document.
3. **Condition**: Only syncs if `is_active` is true and `available_quantity > 0`.
4. **Availability**: Automatically deletes the Algolia object if an item goes out of stock or is deleted in Firestore.

---

## 5. Security & Keys
- **Admin Key**: Only used in Firebase Extensions and Cloud Functions (Secrets Manager). Never exposed to the client.
- **Search Key**: Used in `apps/web/.env.production`. Restricted to **Search** operations only.

### Environment Variables:
```bash
VITE_ALGOLIA_APP_ID=...
VITE_ALGOLIA_SEARCH_KEY=...    # Restricted Search-Only Key
VITE_ALGOLIA_INDEX_NAME=merchant_products
```