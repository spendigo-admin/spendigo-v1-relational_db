# Spendigo SmartCart — UI Wireframes

**Last Updated**: 2026-01-12
**Status**: Implemented (Beta)
**Design System**: Tailwind CSS (Custom Theme: Bright White & Blue)

## 1. Core User Flows (Mermaid)

### 1.1 SmartCart Optimization Flow
*How the user optimizes their generic recurring grocery list.*
```mermaid
graph TD
    A[User Inputs: "Milk", "Eggs"] --> B[Wishlist State]
    B -->|Frontend Auto-Match| C{Fuzzy Matcher}
    C -->|Found| D[Display Specific Products]
    C -->|Not Found| B
    D -->|Click 'Optimize Trip'| E[Trip Optimizer Engine]
    E --> F{Compare Scenarios}
    F --> G[Scenario A: Best Split (Lowest Price)]
    F --> H[Scenario B: Best Single Store (Convenience)]
    G --> I[User Selects Preference]
    H --> I
    I --> J[Bulk Add to Cart]
```

### 1.2 Merchant Product Management (Hybrid Catalog)
*How a merchant adds inventory.*
```mermaid
graph TD
    A[Merchant Dashboard] --> B[My Products]
    B -->|Click Add| C[Global Search Modal (Algolia)]
    C -->|Type Name/Barcode| D{Found in Master?}
    D -->|Yes| E[Select & Set Price]
    D -->|No| F[Click 'Request New']
    F --> G[Fill Request Form]
    G --> H[Pending Admin Approval]
    E --> I[Live in Store]
```

## 2. Key Screen Mockups

### 2.1 Consumer: SmartCart Wishlist (`/smartcart`)
*   **Header**: "Smart List Optimizer"
*   **Input Area**: "Add a generic item..." (e.g. "Bread") - *Auto-matches to available inventory*.
*   **Main List**: 
    *   Displays generic terms ("Milk") with resolved specific products underneath ("Dairyland 2% - $4.99").
    *   **Edit Control**: Click to swap the specific product match.
*   **Smart Insights Panel (Right/Bottom)**: 
    *   **"Trip Optimizer"**: Toggle between:
        *   **Best Split**: "Save $5.20 by visiting 2 stores."
        *   **Best Single Store**: "Pay $2.00 more to buy everything at FreshMart."
*   **CTA**: "Add All to Cart".

### 2.2 Merchant: Product Editor (`/merchant/products`)
*   **Layout**: Split view.
*   **Left (Locked)**: Master Data (Image, Name, Description, Nutrition).
    *   *Note*: "This data is managed by Spendigo".
*   **Right (Editable)**: Store Data.
    *   Price Input (Large).
    *   Inventory Spinner.
    *   Status Toggle (Active/Hidden).
*   **Footer**: "Save Changes" button.

### 2.3 Admin: Master Catalog Grid (`/admin/catalog`)
*   **Tool**: Data Grid (React Table).
*   **Columns**: Image (Thumbnail), Name, Brand, Barcode, # Stores, Status.
*   **Actions (Row)**: Edit, Merge, Block.
*   **Filter Bar**: "Pending Verification", "Missing Image", "Flagged".
*   **Bulk Actions**: "Export CSV", "Update Tax Category".

### 2.4 Consumer: Store Profile (`/store/:id`)
*   **Hero**: Store Banner Image + Avatar.
*   **Stats**: "0.5km away" • "Delivery: $3.99" • "Rating: 4.8★".
*   **Tabs**: "Flyers" (PDF Viewer), "Deals" (Red Grid), "Aisles" (Categories).
*   **Search**: In-store search bar ("Search FreshMart...").

### 2.5 Checkout: Split Payment (`/checkout`)
*   **Header**: "Secure Checkout".
*   **Order Breakdown**:
    *   **Store A (FreshMart)**: 3 items - $12.50.
    *   **Store B (Bakery)**: 1 item - $5.00.
*   **Payment Method**: Stripe Elements (Card / Google Pay).
*   **Disclaimer**: "You will see two separate charges on your statement."
*   **Submit**: "Pay $17.50".

### 2.6 Global Search (Header)
*   **Input**: "Algolia Autocomplete"
*   **Results Dropdown**:
    *   **Instant Result**: Shows thumbnail, Name, Brand.
    *   **Highlights**: Matching text is bolded (e.g. "**Coca**-Cola").
    *   **Speed**: < 50ms response.

## 3. Responsive Behavior
*   **Mobile**: Bottom Navigation Bar (Home, Search, Cart, Profile).
*   **Desktop**: Top Navigation Bar with Mega-Menu for Categories. Sidebar for Filters.
