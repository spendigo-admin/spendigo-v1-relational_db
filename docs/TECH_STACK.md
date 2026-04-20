# Spendigo SmartCart — Tech Stack

**Last Updated**: 2026-04-20
**Status**: Production-Ready (v1.0)

---

## 1. Core Stack (Production)

### Frontend (Web & Hybrid)
- **Framework**: React 18.2.0 (Functional Components, Hooks)
- **Build Tool**: Vite 7.3.0 (ESM-based HMR)
- **Language**: TypeScript 5.4+ (Strict Mode)
- **Styling**: TailwindCSS 3.4+ + Managed CSS Variables for Design System
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
- **BaaS**: Firebase 10.14.1
  - **Auth**: Firebase Auth (Email/Pass, Google, Facebook OAuth)
  - **Firestore**: Real-time NoSQL document store (Global Sync)
  - **Storage**: Firebase Storage (Secure image/PDF assets)
  - **Functions**: Node.js 20 Serverless Cloud Functions
- **Hosting**: Firebase Global CDN

---

## 2. Advanced Features & Integrations

### 🛡️ Security & Forensic Auditing
- **Audit Ledger**: Custom SHA-256 chain-of-trust implementation.
- **Tamper-Evidence**: Immutable logging of price changes, approvals, and system events.
- **Integrity**: `IntegrityUtils` for validation of the secure audit chain.
- **RBAC**: Granular Permission-based access control (e.g., `flyers:write`, `analytics:read`).

### 📍 Geospatial & Proximity
- **Geocoding**: OpenStreetMap (Nominatim API) for automated store location verification.
- **Geofencing**: Proximity-based deal alerts and push notifications.
- **Reach Visualization**: Merchant dashboard maps for coverage management.

### 📦 Smart Inventory Resolution
- **Service**: **Open Food Facts API** integration.
- **Workflow**: Automated high-fidelity product data ingestion via UPC/GTIN.
- **Catalog**: 10,000+ item Master Catalog with Facilitator moderation.

### 🧠 AI & Optimization
- **Engine**: **Google Gemini (v0.24.1)**.
- **Usage**: SmartCart grocery list optimization and AI-driven insights for merchants.

---

## 3. Third-Party Services Matrix

| Service | Purpose | Status |
|---------|---------|--------|
| **Algolia (v5)** | Full-text search & Master Catalog faceting | ✅ Active |
| **Stripe** | Standard Connect for merchant payouts & Checkout | ✅ Active |
| **Sentry** | Full-stack error tracking & performance monitoring | ✅ Active |
| **Nominatim** | Open-source geocoding and reverse geocoding | ✅ Active |
| **PDFKit** | Headless generation of retail flyers and invoices | ✅ Active |
| **Google Analytics** | Data API for merchant traffic insights | ✅ Active |

---

## 4. Development & CI/CD Tooling

- **Orchestration**: Turbo 1.10.0 (Monorepo management)
- **Testing**: Vitest (Unit) + Playwright (E2E / Browser Automation)
- **Linting**: ESLint 9.0 + Prettier (Production-grade linting)
- **SSL**: Vite SSL plugin for secure local development on `spendigo.ca` aliases.
- **Deployment**: GitHub Actions (Auto-deploy to Firebase on Merge)

---

## 5. Architectural Rationale

### ✅ Real-Time vs. Polling
The decision to use **Firestore Snapshots** over REST polling ensures that stock levels, order statuses, and price drops are visible to all users in < 200ms globally, which is critical for a high-velocity retail marketplace.

### ✅ Facilitator Moderation Model
The **Hybrid Catalog** (Master + Merchant) uses a "Master Data Management" approach. Merchants link to trusted global IDs, ensuring data hygiene while allowing individual price and inventory flexibility.

### ✅ Forensic Trust
By implementing a **SHA-256 audit chain** directly in the `AuditContext`, Spendigo provides local merchants and legal teams with tamper-evident evidence of business transactions, meeting SOC2/GDPR compliance requirements ahead of scale.
