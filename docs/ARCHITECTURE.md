# Spendigo SmartCart — System Architecture

**Last Updated**: 2026-01-12
**Status**: Beta (Feature Complete & Optimization Phase)

---

## 1. Executive Summary

Spendigo SmartCart is a Canada-first marketplace facilitator connecting independent convenience stores with consumers. The **current implementation** uses a **Hybrid Architecture**:
-   **Backend**: Firebase (Firestore, Auth, Functions) for core data and logic.
-   **Search**: **Algolia** for high-performance Master Catalog search.
-   **Optimization**: Client-side SmartCart Optimizer with local heuristic algorithms (Store Splitting & Trip Optimization).

---

## 2. C4 Model - Context Diagram (As Implemented)

```mermaid
graph TB
    Consumer[Consumer<br/>Web/Mobile App]
    StoreMgr[Store Manager<br/>Web Dashboard]
    Admin[Spendigo Admin<br/>Admin Panel]

    subgraph Firebase Platform
        Auth[Firebase Auth<br/>User Authentication]
        Firestore[(Cloud Firestore<br/>Real-time Database)]
        Storage[(Firebase Storage<br/>Images/Files)]
        Functions[Cloud Functions<br/>Serverless Logic]
    end

    subgraph External Services
        Stripe[Stripe Payments<br/>Subscription & Checkout]
        Algolia[Algolia Search<br/>Master Catalog Index]
        OSM[OpenStreetMap / Nominatim<br/> Geocoding]
        Email[Firebase Extensions<br/>Trigger Email / SMTP]
    end

    Consumer -->|Login| Auth
    Consumer -->|Real-time Orders| Firestore
    Consumer -->|Global Product Search| Algolia
    
    StoreMgr -->|Manage Inventory| Firestore
    StoreMgr -->|Sync Catalog| Firestore
    Firestore -.->|Index Sync| Algolia

    Admin -->|Moderate Catalog| Firestore
    Admin -->|User Mgmt| Auth
    
    Functions --> Stripe
    Functions --> Email
    Consumer --> OSM
```

---

## 3. Container Architecture (Actual Implementation)

### 3.1 Frontend Applications

| Application | Technology | Status |
|------------|------------|--------|
| **Consumer Web** | React 18 + Vite 7.3 | ✅ Complete |
| **Merchant Dashboard** | React 18 + Vite 7.3 | ✅ Complete |
| **Admin Panel** | React 18 + Vite 7.3 | ✅ Complete |
| **Mobile Apps** | Capacitor 6 (iOS/Android) | ✅ Build Verified |

**Shared Codebase**: Single React app with role-based routing (`ConsumerLayout`, `MerchantLayout`, `AdminLayout`) and shared Design System (`hsl` tokens).

### 3.2 Backend Services (Hybrid)

The architecture uses a **Hybrid approach**:
1.  **Client-Side**: Firebase SDKs for real-time data sync (Orders, Inventory) and simple CRUD.
2.  **Server-Side**: Cloud Functions (Node.js) for privileged operations (Order Emails, Stripe Webhooks, Admin Tasks).

| Component | Technology | Responsibilities |
|-----------|------------|------------------|
| **React Contexts** | Client SDK | Auth state, realtime order listeners, cart management, *SmartCart Optimizer Logic* |
| **Cloud Functions** | Node.js 20 | Order emails, complex admin actions, Stripe webhooks, maintenance tasks |
| **Algolia Extension** | Firebase Extension | Syncs `master_products` to Algolia index for fuzzy search |

### 3.3 Data Store (Firebase Firestore)

**Collection Structure**:
```
/users/{userId}              # User profiles + roles
/stores/{storeId}            # Merchant stores
/orders/{orderId}            # Order documents
/master_products/{mpId}      # Global verified catalog (Synced to Algolia)
/merchant_products/{pId}     # Store-specific inventory & pricing
/product_creation_requests/  # Merchant requests for new products
/carts/{userId}              # Shopping carts
/wishlists/{userId}          # User wishlists
```

**Key Architectural Decisions**:
- **Hybrid Catalog**: Separation of `master_products` (Global Data) and `merchant_products` (Store Data). Merchants link to a Master ID, ensuring consistent data quality while allowing flexible pricing.
- **SmartCart Optimizer**: Runs entirely on the client-side (`useMemo` in `SmartCartWishlist.tsx`). It downloads relevant availability data and performs:
    1.  **Fuzzy Matching**: Matches generic terms ("Milk") to specific inventory ("Dairyland Milk").
    2.  **Store Splitting**: Finds the cheapest combination of stores.
    3.  **Trip Optimization**: Suggests a "Best Single Store" alternative.

---

## 4. Key Data Flows

### 4.1 SmartCart Optimization Flow

```mermaid
sequenceDiagram
    participant User
    participant Optimizer(Client)
    participant Firestore
    participant Algolia

    User->>Optimizer: Adds "Milk" (Generic Item)
    
    par Parallel Fetch
        Optimizer->>Firestore: Fetch Merchant Inventory (local cache)
        Optimizer->>Algolia: (Optional) Search Master Catalog
    end
    
    Optimizer->>Optimizer: Fuzzy Match "Milk" -> "Dairyland 2%"
    Optimizer->>Optimizer: Algorithm: Cheapest Split vs. Single Store
    
    Optimizer-->>User: Display "Best Prices" & "Trip Saver"
    User->>Firestore: Add to Cart (Batched Write)
```

### 4.2 Admin Catalog Verification

```mermaid
sequenceDiagram
    participant Merchant
    participant Firestore
    participant Admin
    participant Algolia

    Merchant->>Firestore: Request New Product
    Admin->>Firestore: Review & Approve Request
    Firestore->>Firestore: Create Master Product
    Firestore->>Algolia: Extension Syncs New Item
    Firestore-->>Merchant: Notification (Approved)
    Merchant->>Firestore: Set Price & Quantity
```

---

## 5. Security & Compliance (Implemented)

| Feature | Implementation | Status |
|---------|----------------|--------|
| **Authentication** | Firebase Auth (Email/Password + Google) | ✅ Complete |
| **Authorization** | RBAC (Consumer/Merchant/Admin) | ✅ Complete |
| **Route Guards** | Layout-level checks | ✅ Complete |
| **Audit Logging** | SHA-256 hash chain | ✅ Complete |
| **Data Isolation** | Per-user Firestore docs | ✅ Complete |
| **Maintenance Mode** | Global platform lockdown | ✅ Complete |

---

## 6. Infrastructure (Current)

| Component | Technology | Configuration |
|-----------|------------|---------------|
| **Hosting** | Firebase Hosting | Production CDN |
| **Database** | Cloud Firestore | Auto-scaling, real-time |
| **Search Engine** | Algolia | `master_products` index |
| **Storage** | Firebase Storage | Images/Files |
| **CI/CD** | GitHub Actions | ✅ Auto-deploy configured |
| **Domain** | spendigo.ca | Connected |

---

## 7. Deployment Architecture

### Development
```bash
npm run dev
# Runs on https://spendigo.ca:443/ (Local proxy)
```

### Production
```bash
npm run build
# Output: apps/web/dist/ (Typescript -> JS)
firebase deploy
# Deploys Hosting + Functions + Firestore Rules
```

---

## 8. Differences from Original Plan

| Original Plan | Current Implementation | Rationale |
|---------------|------------------------|-----------|
| PostgreSQL + Drizzle | Cloud Firestore | Faster development, real-time sync for orders |
| Custom backend search | Algolia | Better typos tolerance & performance (30ms vs 500ms) |
| Server-side Optimization | Client-side Logic | Reduced server costs, instant feedback for user |

---

## 9. Future Enhancements

### Short-Term (Q1 2026)
- [ ] Native Mobile QA (iOS/Android) - *In Progress*
- [ ] Sentry Error Monitoring

### Medium-Term (2026+)
- [ ] Stripe Connect (Marketplace Split Funds)
- [ ] Native Push Notifications (FCM)
- [ ] Server-side rendering (Next.js migration) for improved SEO

---

**For detailed collection schemas, see**: [SCHEMA.md](./SCHEMA.md)  
**For complete tech stack, see**: [TECH_STACK.md](./TECH_STACK.md)
