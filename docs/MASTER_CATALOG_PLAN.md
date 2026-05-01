# Spendigo Master Catalog: Production Status (v1.0)

**Last Updated**: 2026-05-01
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
| **Search & Discovery** | ✅ | **Algolia v5** explicit submission strategy with FSA fallback logic. |
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
*   **ID-Driven Matching**: The optimizer uses unified Master IDs to provide 100% accurate price comparisons across competing store locations.
*   **Substitution Engine**: Surfaces cheaper alternatives based on `substitution_group_id` (e.g., matching Store Brand 2L Milk vs Name Brand 2L Milk).
*   **AI Narrative Layer**: Leverages **Gemini 2.5 Flash** to translate Master Catalog metadata into actionable "Savings Stories" and price-drop alerts.
*   **Performance Memoization**: Utilizes the 60s TTL cache (`performCachedSearch`) to ensure sub-second optimization even for large carts.

---

## 4. Search & Performance
- **Hybrid Resolution**: `useCatalog.ts` orchestrates hits across Firestore (for precision Barcode/ID lookups) and Algolia (for high-speed fuzzy text and geo-search).
- **Proximity Filtering**: Integrated with **Haversine distance** and **FSA (Postal Code)** fallback logic.

---

## 5. Ongoing Maintenance
- **Catalog Cleansing**: Regular administrative sweeps to merge duplicate master items and verify manufacturer images.
- **Ingestion Guard**: Enforces a **65% Fuzzy Matching floor** for all merchant inventory linking to prevent catalog pollution.
- **Brand Validation**: Future integration with Direct-to-Manufacturer data feeds to reach "Manufacturer Verified" status on premium SKUs.
