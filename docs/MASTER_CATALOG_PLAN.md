# Spendigo Master Catalog: Production Status (v1.0)

**Last Updated**: 2026-04-20
**Status**: Production-Ready / Feature-Complete

## 1. Overview
The **Facilitator-Safe Master Catalog** is the foundation of Spendigo's data integrity. It enforces a "Single Source of Truth" for product attributes while allowing merchants to retain autonomy over local inventory and pricing.

## 2. Implementation Milestones

| Milestone | Status | Key Deliverables |
| :--- | :--- | :--- |
| **Foundation** | ✅ | Strict RBAC rules for `/master_products` and `/merchant_products`. |
| **Data Migration** | ✅ | Automated migration of legacy assets into the dual-collection schema. |
| **Merchant Integration** | ✅ | Barcode-first linking workflow with **Open Food Facts** enrichment. |
| **Admin Moderation** | ✅ | End-to-end "Pending Review" queue with a Forensic-ready approval ledger. |
| **Search & Discovery** | ✅ | **Algolia v5** proximity search integrated with the Master Catalog index. |
| **Savings Intelligence** | ✅ | **Substitution Groups** and **SmartCart Optimization** using unified IDs. |

---

## 3. Core Engine Features

### 3.1 Advanced Merchant Workflows
*   **Intelligent Linking**: Merchants link their inventory to global SKUs using `master_product_id`.
*   **Average Market Pricing**: The dashboard provides a real-time "Average Market Price" signal by aggregating all merchant listings for a specific Master SKU, helping stores set competitive prices.
*   **Proximity-Aware Inventory**: Store reach is managed individually for each merchant, ensuring search results are geofenced to the store's service radius.

### 3.2 Automated Enrichment Lifecycle
*   **Zero-Day Indexing**: New barcode scans not found in the Master Catalog are auto-imported to the `pending_review` queue using the **Open Food Facts API**.
*   **Forensic Verification**: Every administrative approval or modification to a Master Product is cryptographically logged in the **Forensic Audit Ledger** for legal defensibility.

### 3.3 Consumer Optimization (SmartCart)
*   **ID-Driven Matching**: The optimizer uses unified Master IDs to provide 100% accurate price comparisons across different store names.
*   **Substitution Engine**: Surfaces cheaper alternatives based on `substitution_group_id` (e.g., matching Store Brand 2L Milk vs Name Brand 2L Milk).
*   **Bulk Saving Hints**: Analyzes package sizes at the Master level to flag "Better Value" upsell opportunities.

---

## 4. Search & Performance
- **Hybrid Resolution**: `useCatalog.ts` orchestrates hits across Firestore (for precision Barcode/ID lookups) and Algolia (for high-speed fuzzy text and geo-search).
- **Proximity Filtering**: Integrated with **Haversine distance** and **FSA (Postal Code)** fallback logic.

---

## 5. Ongoing Maintenance
- **Catalog Cleansing**: Regular administrative sweeps to merge duplicate master items and verify manufacturer images.
- **Brand Validation**: Future integration with Direct-to-Manufacturer data feeds to reach "Manufacturer Verified" status on premium SKUs.
