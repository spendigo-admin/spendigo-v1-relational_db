# Spendigo SmartCart — System Architecture

## 1. Executive Summary
Spendigo SmartCart is a Canada-first marketplace facilitator connecting independent convenience stores with consumers. This architecture is designed to be **serverless, scalable to zero, and strictly cost-controlled**, while maintaining production-grade security and compliance standards.

## 2. C4 Model - Context Diagram
```mermaid
graph TB
    Consumer[Consumer]\n(Web/Mobile App)
    StoreMgr[Store Manager]\n(Web Dashboard)
    Admin[Spendigo Admin]\n(Admin Panel)

    subgraph Spendigo Platform
        API[API Gateway / Load Balancer]
        Core[Core Services\n(Node.js Cloud Functions)]
        Auth[Identity Provider\n(Firebase Auth)]
        DB[(PostgreSQL\nServerless)]
        Storage[(Object Storage\nImages/Docs)]
    end

    Stripe[Stripe Connect]\n(Payments & Payouts)
    Maps[Google Maps / Mapbox]\n(Geolocation)
    OCR[OCR Service]\n(Flyer Processing)

    Consumer -->|Browses, Orders| API
    StoreMgr -->|Manages Inventory, Orders| API
    Admin -->|Moderation, Support| API
    API --> Core
    Core --> Auth
    Core --> DB
    Core --> Storage
    Core --> Stripe
    Core --> Maps
    Core --> OCR
```

## 3. Container Architecture

### 3.1 Frontend Applications
- **Consumer Web**: React (Vite) SPA. Public facing. SEO optimization required.
- **Consumer Mobile**: React Native (Expo). iOS/Android.
- **Merchant Dashboard**: React (Vite) SPA. Protected routes only.
- **Admin Panel**: React (Vite) SPA. High-security, strictly RBAC controlled.

### 3.2 Backend Services (Serverless Functions)
Built as clear domain boundaries within a monorepo, deployed as Google Cloud Functions (2nd Gen) or AWS Lambda equivalent.

| Service Domain | Responsibilities |
| :--- | :--- |
| **Auth** | User management, RBAC, Custom Claims, MFA enforcement. |
| **Marketplace** | Store profiles, Normalization, Search, Catalog Management. |
| **Order** | Order State Machine, Cart Validation, Tax Calculation. |
| **Payment** | Stripe Intents, Webhooks, Payouts, Commissions, Ledger. |
| **Flyer** | Ingestion, OCR pipeline, Deal extraction. |
| **Notification** | Transactional Email (SendGrid/Resend), SMS (Twilio - Critical only). |

### 3.3 Data Store
- **Primary DB**: Serverless PostgreSQL (e.g., Neon or Supabase).
  - Schema: Relational, strictly normalized.
  - RLS (Row Level Security): Enforced at the DB level where possible, or strictly via API.
- **Object Storage**: AWS S3 or Google Cloud Storage.
  - Buckets: `public-assets` (read-only), `private-docs` (store legals), `flyer-uploads` (temp).

## 4. Key Data Flows

### 4.1 Onboarding & Verification
1. Store signs up (Email/Pass).
2. Email Verification (Auth Link).
3. Store creates Profile (Name, Address).
4. Store connects Stripe (Redirect to Stripe Hosted Onboarding).
5. Stripe Webhook returns `account_id` + `restricted` status.
6. Admin validates Store (Manual/Auto).
7. Store goes "Live".

### 4.2 Checkout (Split Payment)
1. Consumer builds cart (Items from Store A + Store B).
2. `POST /checkout` -> Validates inventory & prices.
3. Backend creates `PaymentIntent` with `transfer_group`.
4. Consumer pays via Stripe Elements.
5. Webhook `payment_intent.succeeded` -> Triggers Order Creation.
6. Backend creates Order A and Order B.
7. Ledger records: `(Total - Commission)` allocated to Store A/B connection.

## 5. Security & Compliance
- **Authentication**: Firebase Auth or Supabase Auth. MFA required for Stores/Admins.
- **Authorization**: RBAC (Role-Based Access Control) enforced in middleware.
- **Secrets**: Google Secret Manager or AWS Secrets Manager. NO .env files in prod.
- **Data Residency**: Strict adherence to `us-east` (if Canada not avail in free tier) or `ca-central-1` preference. *Note: Data residency on free tier is best-effort but architecture supports location constraints.*

## 6. Infrastructure
- **IaC**: Terraform. Reproducible environments (Dev, Staging, Prod).
- **CI/CD**: GitHub Actions.
- **Monitoring**: Basic CloudWatch/Stackdriver (Free tier limits).
