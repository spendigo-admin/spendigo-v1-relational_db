# Spendigo SmartCart — Tech Stack

**Last Updated**: 2026-05-25
**Status**: Production-Ready (v1.0) / Database Migration in Transition

---

## 1. Core Stack (Production)

### Frontend (Web & Hybrid)
- **Framework**: React 18.2.0 (Functional Components, Hooks)
- **Build Tool**: Vite 7.3.0 (ESM-based HMR)
- **Language**: TypeScript 5.4+ (Strict Mode)
- **Styling**: TailwindCSS 3.0+ + Managed CSS Variables for Design System
- **Branding**: Custom SVG `LogoIcon` component for multi-scale brand identity.
- **State Management**: React Context API (Auth, Cart, Marketplace, Orders, Notifications, Confirmation, Review, Audit)
- **Routing**: React Router v6.20+
- **SEO**: react-helmet-async (Dynamic SSR-ready meta tags)
- **i18n**: i18next + react-i18next (Multi-language localization)

### Mobile Foundation
- **Framework**: Capacitor 6.0.0 (Native JS Bridge)
- **Architecture**: Single Codebase (Hybrid) targeting iOS 17+ and Android 14+
- **Features**: Native Push Notifications, Camera-based Barcode Scanning (`html5-qrcode`)

### Backend & Infrastructure
- **BaaS & Relational Backend**: Firebase 10.14.1 & Google Cloud Platform
  - **Auth**: Firebase Auth (Email/Pass, Google, Facebook OAuth; with planning for Apple Sign-In)
  - **Database (Relational / Target)**: **Firebase SQL Connect (PostgreSQL 16)** via Drizzle ORM (strongly typed, composite keys, indexing, and engine-level rules/constraints).
  - **Database (NoSQL / Transition)**: **Cloud Firestore** (acting as primary real-time store during the dual-write transition phase).
  - **Vector Storage**: Isolated 1-to-1 vector embedding table via **pgvector** (768-Dimension) for semantic similarity search.
  - **Storage**: Firebase Storage (Secure user assets, merchant KYB business registration uploads, and candidate resume storage).
  - **Functions**: Node.js 22 Serverless Cloud Functions (optimized database connection reuse, utilizing GCP Secret Manager for sensitive environment credentials).
- **Hosting**: Firebase Global CDN

---

## 2. Advanced Features & Integrations

### 🛡️ Security & Forensic Auditing
- **Audit Ledger**: Custom SHA-256 chain-of-trust cryptographic ledger implemented in Cloud SQL `audit_logs` table with unique indexes on `prev_hash` and `hash` to prevent fork/split chain attacks.
- **Consent Ledger**: Immutable `consent_logs` table with write-protection enforced natively at the PostgreSQL engine level via RULES (`lock_consent_logs_updates`, `lock_consent_logs_deletes`).
- **RBAC**: Granular permission-based access control with administrative engine-level constraints (e.g., blocking non-admin modifications of user `storeId`).
- **KYB Isolation**: Path-restricted storage security rules for `/stores/{storeId}/documents/` separating sensitive business licenses.

### 📍 Geospatial & Proximity
- **Geocoding**: OpenStreetMap (Nominatim API) + PostgreSQL `latitude` and `longitude` fields for automated store location verification.
- **Geofencing**: Proximity-based deal alerts and push notifications.
- **Reach Visualization**: Merchant dashboard maps for coverage management.

### 📦 Smart Inventory Resolution
- **Service**: **Open Food Facts API** integration.
- **Workflow**: Automated high-fidelity product data ingestion via UPC/GTIN.
- **Catalog**: 10,000+ item Master Catalog with Facilitator moderation.

### 🧠 AI & Optimization
- **Engine**: **Google Gemini (v0.24.1)**.
- **Vector Database**: pgvector (768-Dimension vector embeddings mapping) stored in `product_embeddings` for AI-driven semantic product discovery and SmartCart grocery list optimization.

---

## 3. Third-Party Services Matrix

| Service | Purpose | Status |
|---------|---------|--------|
| **Algolia (v5)** | Full-text search & Master Catalog faceting | ✅ Active |
| **Stripe** | Standard Connect for merchant payouts & Checkout (utilizing **Absolute Currency Integer Precision** in cents) | ✅ Active |
| **Sentry** | Full-stack error tracking & performance monitoring | ✅ Active |
| **Nominatim** | Open-source geocoding and reverse geocoding | ✅ Active |
| **PDFKit** | Headless generation of retail flyers and invoices | ✅ Active |
| **Google Analytics** | Data API for merchant traffic insights | ✅ Active |
| **GCP Monitoring** | Infrastructure observability and system health metrics | ✅ Active |

---

## 4. Development & CI/CD Tooling

- **Orchestration**: Turbo 1.10.0 (Monorepo management)
- **Testing**: Vitest 4.1+ (Unit) + Playwright (E2E / Browser Automation)
- **Linting**: ESLint 8.0+ + Prettier (Production-grade linting)
- **SSL**: Vite SSL plugin for secure local development on `spendigo.ca` aliases.
- **Deployment**: GitHub Actions (Auto-deploy to Firebase on Merge)

---

## 5. Architectural Rationale

### ✅ PostgreSQL Relational Migration (SQL Connect)
The transition to **Firebase SQL Connect (PostgreSQL 16) with Drizzle ORM** enables robust relational enforcements, data validation constraints (e.g. Stripe connected account status verification), and high-integrity transactional guarantees that were complex or impossible to natively enforce in Firestore.

### ✅ Resilient Dual-Write & Incremental Transition
To guarantee zero downtime during deployment, writes are synchronously mirrored to both Cloud Firestore (primary) and PostgreSQL (secondary). An incremental update sweep captures transition window deltas before a clean cutover of read operations.

### ✅ Real-Time vs. Polling
The decision to use **Firestore Snapshots** over REST polling during the legacy support window ensures that stock levels, order statuses, and price drops are visible to all users in < 200ms globally, which is critical for a high-velocity retail marketplace.

### ✅ Facilitator Moderation Model
The **Hybrid Catalog** (Master + Merchant) uses a "Master Data Management" approach. Merchants link to trusted global IDs, ensuring data hygiene while allowing individual price and inventory flexibility.

### ✅ Forensic Trust
By implementing a **SHA-256 audit chain** directly in the relational `audit_logs` ledger, Spendigo provides local merchants and legal teams with tamper-evident evidence of business transactions, meeting SOC2/GDPR compliance requirements ahead of scale.

### ✅ Vector-Enriched Semantic Search
By decoupling `product_embeddings` into a 1-to-1 table with `pgvector` compatibility, the platform enables advanced semantic search and recommendation matching without degrading core relational database performance.

