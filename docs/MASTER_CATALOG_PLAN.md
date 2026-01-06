# Spendigo Master Catalog: Implementation Status

## 1. Requirement Analysis
The "Facilitator-Safe Master Catalog" model effectively solves the core business constraint: **Spendigo must strictly control product identity while Merchant's control inventory and pricing.**

## 2. Implementation Status

| Phase | Description | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Foundation (Security & Schema)** | ✅ **COMPLETED** | Rules applied with strict existence checks. |
| **Phase 2** | **Data Seeding (Migration)** | ✅ **COMPLETED** | 175 Master Products, 249 Merchant Products, 34 Categories migrated. |
| **Phase 3** | **Frontend Integration (Read)** | ✅ **COMPLETED** | Store Detail, Product Detail, and Search updated to use `useCatalog` hook. |
| **Phase 4** | **Merchant UI (Write)** | 🚧 **IN PROGRESS** | Need to build Dashboard UI for adding/requesting products. |
| **Phase 5** | **Admin UI (Approval)** | 📅 **PENDING** | Admin dashboard to process creation requests. |

## 3. Phase 4 Details: Merchant Product Management

### Objectives
Merchants need a way to manage their inventory without violating the single-source-of-truth master catalog.

### Features to Implement
1.  **Catalog Search & Add**:
    *   Merchant searches the global `master_products` collection.
    *   If found, they click "Add to Store".
    *   System creates a `merchant_products` doc linked to that master ID.
    *   Validation: Ensure they don't already have it.
    
2.  **Request New Product**:
    *   If search yields no results, Merchant clicks "Request New Product".
    *   Form requires: Name, Brand, Category, Description, Image (optional URL or upload), Barcode (optional).
    *   System creates a `product_creation_requests` doc with `status: 'pending'`.
    
3.  **My Products List**:
    *   Update existing `Products.tsx` to list from `merchant_products`.
    *   Allow editing of **only** merchant-owned fields (Price, Inventory, Status).
    *   Prevent editing of master fields (Name, Image).

### Technical Plan
*   **Hook Updates**: Add `addMerchantProduct`, `requestMasterProduct`, `updateInventory` to `useCatalog.ts`.
*   **UI Components**:
    *   `MasterCatalogSearch`: A component to search `master_products` (read-only for merchant).
    *   `ProductRequestModal`: Form for new request.
    *   `MerchantProductEditor`: Form for pricing/inventory.
