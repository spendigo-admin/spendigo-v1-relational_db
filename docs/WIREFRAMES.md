# Spendigo SmartCart — UI Wireframes

**Last Updated**: 2026-04-20
**Status**: Production-Ready (v1.0)
**Design System**: Premium Vanilla CSS / React (Emerald Green & Primary Blue Aesthetic)
**Brand Assets**: Custom SVG `LogoIcon` (Scalable Shopping Cart)

## 1. Core User Flows (Mermaid)

### 1.1 SmartCart Optimization & Proximity Flow
*How the user optimizes their trip and receives geofenced alerts.*
```mermaid
graph TD
    A[User Inputs: "Milk", "Eggs"] --> B[Wishlist State]
    B -->|AI Fuzzy Matcher| C{Master Catalog Match}
    C -->|Found| D[Display Specific Products]
    C -->|Not Found| B
    D -->|User Moves Near Store| E[Geo-fencing Trigger]
    E --> F[Push Notification: "Milk $2.99 at FreshMart"]
    F --> G[Audible 'Ding' Alert]
    G --> H[User Adds to Trolley]
```

### 1.2 Merchant Onboarding & Location Verification
*How a merchant registers and verifies proximity reach.*
```mermaid
graph TD
    A[Partner With Us] --> B[Multi-Step Registration]
    B --> C[Store Address Input]
    C -->|Automated Geocoding| D{Location Verified}
    D --> E[Proximity Dashboard]
    E --> F[Set Alert Radius (1-10km)]
    F --> G[Upload Flyers/Deals]
    G --> H[Live on Marketplace]
```

## 2. Key Screen Mockups

### 2.1 Consumer: SmartCart Wishlist (`/smartcart`)
*   **Header**: "Smart List Optimizer"
*   **Input Area**: "Add a generic item..." (e.g. "Bread") - *Auto-matches to 10,000+ Master items*.
*   **Main List**: 
    *   Displays generic terms with resolved specific products.
    *   **Canadian Badge**: 🍁 markers for local products.
*   **Insights Panel**: 
    *   **"Trip Optimizer"**: Toggle between **Best Split (Savings)** and **Best Single Store (Convenience)**.
*   **CTA**: "Add All to Trolley".

### 2.2 Consumer: Premium Store Profile (`/store/:id`)
*   **Hero**: High-impact Store Banner + Glassmorphism Store Identity Card.
*   **Retail Info Board**: 
    *   Rating (Shopper Voice) • Delivery Time • Delivery Fee • "Certified by Spendigo🍁".
*   **Sticky Navigation Tabs**: 
    *   **🛒 Store Items**: Categorized grid/list view with "Hot Deal" stickers.
    *   **📰 Weekly Flyer**: Full retail flyer view with "Days Left" countdown.
    *   **🔥 Flash Deals**: Validated time-limited offers with animated pulse effects.
    *   **⭐ Shopper Voice**: Advanced rating distribution and customer feedback.
    *   **ℹ️ Store Info**: Location, Delivery boundaries, and specific Store Hours.

### 2.3 Merchant: Proximity Dashboard (`/merchant/dashboard`)
*   **Visualizer**: Map-based view of the store's reach.
*   **Geocode Status**: 🟢 Verified (Automated lat/long resolution).
*   **Alert Controller**: Slider to adjust notify-radius (e.g. 2.5km boundary).
*   **Market Benchmarks**: "Average Market Price" vs. Store Price visualization.
*   **Inventory Proof**: Camera-based barcode scanner interface for rapid catalog linking.

### 2.4 Admin: Master Catalog Manager (`/admin/catalog`)
*   **Tabs**:
    *   **Master Products**: Searchable grid of global product IDs.
    *   **Creation Requests**: Workflow for merchant-submitted new products with "Confidence" scores.
    *   **Pending Review**: Staging area for automated discoveries.
*   **Action Drawer**: "Approve & Activate" workflow with integrity checks.
*   **Smart Resolver**: UPC/GTIN Ingester tool for Open Food Facts integration.

### 2.5 Admin: Security Audit Ledger (`/admin/audit`)
*   **Governance**: Tamper-evident, SOC2-ready event logging.
*   **Forensic View**: 
    *   Trace IDs • Masked IPs • SHA-256 Hash Chaining.
    *   "Verify Integrity" tool (Visual validation of the ledger chain).
*   **Compliance Tools**: 
    *   JSON Export + Checksum files.
    *   PII Redaction status indicators.

### 2.6 Multi-Step Registration (`/register`)
*   **Layout**: Progress-tracked interactive flow (Account -> Delivery).
*   **Social**: Google & Facebook Auth integrations.
*   **Aesthetics**: Glassmorphism cards with vibrant gradients.

## 3. Responsive & Interactive Experience
*   **Mobile Mobile-First**: Bottom Navigation (Home, Search, Trolley, Profile).
*   **Micro-Animations**: Pulse effects for deals, slide-in panels, and scale-on-hover retail cards.
*   **Soundscape**: Audible "ding" notifications for order alerts and price drops.
*   **Performance**: Algolia-powered search results in < 50ms.
