# Algolia Extension Configuration
**Last Updated:** January 2026

To enable full-text search, you must install the **"Search with Algolia"** Firebase Extension.

## 1. Prerequisites (Algolia Account)
1.  Go to [Algolia.com](https://www.algolia.com/) and Sign Up (Free "Build" plan is sufficient).
2.  Create a new **Application** (e.g., named "Spendigo").
3.  Go to **Settings** > **API Keys**. You will need:
    *   **Application ID**
    *   **Search-Only API Key** (for Frontend)
    *   **Admin API Key** (for Firebase Extension)

## 2. Installation
1. Go to **Firebase Console** -> **Extensions**.
2. Search for `algolia`.
3. Select **"Search with Algolia"** (by Algolia).
4. Click **Install**.

## 3. Configuration Parameters
During installation, use the following settings:

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Collection Path** | `master_products` | The collection to index. |
| **Algolia App ID** | `[Your Algolia App ID]` | From Algolia Dashboard. |
| **Algolia API Key** | `[Your Algolia Admin API Key]` | **Important**: Use the "Write" or "Admin" key here, NOT the search key. |
| **Algolia Index Name** | `master_products` | Matches your .env config. |
| **Fields to Index** | `product_name,brand_name,short_description,upc_gtin,category_id,dietary_tags,primary_image_url` | Comma-separated list of fields to sync. |
| **Transform Function** | *Leave Empty* | Unless we need specific data transformation. |

## 4. Post-Install
After installation:
1.  **Re-save** a document in `master_products` to verify it syncs to Algolia.
2.  If you have existing data, you may need to run a "Backfill" script (Algolia provides a script for this).

## 5. Frontend Keys
Ensure your `.env.local` has the **Search-Only** key, not the Admin key.

```bash
VITE_ALGOLIA_APP_ID=...
VITE_ALGOLIA_SEARCH_KEY=...  <-- Search Only Key
VITE_ALGOLIA_INDEX_NAME=master_products
```