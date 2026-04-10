# Spendigo SmartCart — Tech Stack

**Last Updated**: 2026-04-09
**Status**: Beta (Feature Complete)

---

## 1. Core Stack (As Implemented)

### Frontend (Web)
- **Framework**: React 18.2.0
- **Build Tool**: Vite 7.3.0
- **Language**: TypeScript 5.4+ (Strict Mode)
- **Styling**: TailwindCSS 3.4+ + Custom Design System (CSS Variables)
- **State Management**: React Context API (AuthContext, CartContext, MarketplaceContext, OrderContext, AuditContext, etc.)
- **Routing**: React Router v6.20.0
- **Error Handling**: react-error-boundary 6.0.0 + Sentry SDK
- **SEO**: react-helmet-async (Dynamic meta tags, titles, canonicals)
- **i18n**: i18next + react-i18next (Multi-language support ready)

### Frontend (Mobile)
- **Framework**: Capacitor 6.0.0 (Native wrapper for web app)
- **Platforms**: iOS 17+ + Android 14+
- **Build**: Same React codebase as web

### Backend & Database
- **Backend-as-a-Service**: Firebase 10.14.1
  - **Authentication**: Firebase Auth (Email/Password + SSO ready)
  - **Database**: Cloud Firestore (NoSQL, real-time)
  - **Storage**: Firebase Storage (Images, files)
  - **Logic**: Cloud Functions (Node.js 20)
  - **Email**: Trigger Email Extension (SMTP via Firestore)
- **Runtime**: Hybrid (Client Direct + Serverless Functions)

### Security
- **HTTPS/SSL**: @vitejs/plugin-basic-ssl 2.1.0 (Local dev: spendigo.ca)
- **RBAC**: Custom role-based access control (Consumer, Merchant, Admin)
- **Audit Logging**: SHA-256 hash chain (blockchain-lite) in Firestore (`AuditContext.tsx`)
- **Integrity**: `IntegrityUtils.ts` (Price tampering detection & catalog sync verification)

---

## 2. Development Tools

- **Linter**: ESLint 9.0+
- **Formatter**: Prettier 3.0+
- **Testing**: Vitest (configured, unit tests) + Playwright (E2E)
- **Package Manager**: npm 11.7.0 (pnpm supported: 8.0+)
- **Monorepo**: Turbo 1.10.0 (build orchestration)
- **CI/CD**: GitHub Actions (Auto-deploy to Firebase)
- **TypeScript Compiler**: 5.4+

---

## 3. Deployment Targets

| Platform | Status | Command |
|----------|--------|---------|
| **Web (Firebase Hosting)** | ✅ Ready | `firebase deploy` OR `git push` (CI/CD) |
| **iOS App Store** | ✅ Ready | `npx cap sync && npx cap open ios` |
| **Android Play Store** | ✅ Ready | `npx cap sync && npx cap open android` |

---

## 4. Key Architectural Decisions

### ✅ **Why Firebase?**
The current implementation uses **Firebase** instead of PostgreSQL because:
- **Faster Development**: No server management, instant real-time sync.
- **Scalability**: Auto-scales from 0 to 10,000+ users.
- **Cost**: Free tier supports 50k reads/day, perfect for MVP.
- **Real-time**: Built-in WebSocket for live order updates.

### ✅ **Why Context API (Not Redux)?**
- Simpler for current scale (8+ contexts).
- TypeScript-friendly.
- No extra 50kb bundle overhead.

### ✅ **Why Vite?**
- 10-100x faster dev server.
- Native ESM (no bundling in dev).
- Production build: ~14s (876kb bundle).

---

## 5. Third-Party Services

| Category | Service | Status |
|----------|---------|--------|
| **Auth** | Firebase Auth (Email + Google SSO) | ✅ Implemented |
| **Database** | Cloud Firestore | ✅ Implemented |
| **Storage** | Firebase Storage | ✅ Implemented |
| **Search** | **Algolia** (Full-text + Faceting) | ✅ Implemented (v5 Client) |
| **Analytics** | Firebase + Google Analytics Data API | ✅ Implemented |
| **Monitoring** | **Sentry** (Error tracking & performance) | ✅ Implemented |
| **Payments** | **Stripe Checkout** (Subscriptions) | ✅ Implemented |
| **Geocoding** | OpenStreetMap (Nominatim) | ✅ Implemented |
| **Email** | Trigger Email Extension | ✅ Implemented |
| **PDF** | PDFKit (Invoices/Receipts) | ✅ Implemented |
| **AI/ML** | Google Gemini (SmartCart Optimization) | ✅ Implemented (v0.24.1) |

---

## 6. Version Matrix

### Runtime Versions
```
Node.js:       v20.0.0+ (Required for Cloud Functions)
npm:           11.7.0
TypeScript:    5.4+
React:         18.2.0
```

### Production Dependencies (Web App)
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.20.0",
  "firebase": "^10.14.1",
  "@capacitor/core": "^6.0.0",
  "algoliasearch": "^5.46.2",
  "react-instantsearch": "^7.22.1",
  "html5-qrcode": "^2.3.8",
  "date-fns": "^4.1.0",
  "@stripe/stripe-js": "^9.0.1",
  "@google/generative-ai": "^0.24.1",
  "@sentry/react": "^10.46.0",
  "react-error-boundary": "^6.0.0",
  "react-helmet-async": "^3.0.0",
  "react-i18next": "^16.6.6",
  "i18next": "^25.10.10"
}
```

### Production Dependencies (Cloud Functions)
```json
{
  "firebase-admin": "^12.0.0",
  "firebase-functions": "^4.5.0",
  "algoliasearch": "^5.50.0",
  "stripe": "^20.1.0",
  "pdfkit": "^0.18.0",
  "@google-analytics/data": "^5.2.1"
}
```

---

## 7. Production Status

| Category | Status | Notes |
|----------|--------|-------|
| **Build** | ✅ Passing | Exit code 0, 876kb bundle |
| **Type Safety** | ✅ Passing | Zero TypeScript errors |
| **Search** | ✅ Passing | Algolia index active (`master_products`) |
| **Security** | ✅ Complete | RBAC + Audit logs (SHA-256) + HTTPS |
| **Documentation** | ✅ Complete | Full documentation suite updated |
| **Monitoring** | ✅ Complete | Sentry integration active |

---

## 8. Migration Notes (Original Plan vs. Actual)

The initial tech stack document planned for PostgreSQL + Drizzle ORM and a custom Node.js backend.

**Actual implementation uses**:
- **Firebase** (managed backend) for acceleration and real-time.
- **Firestore** (NoSQL) for high-performance scale and real-time syncing.
- **Serverless Cloud Functions** (Node.js) for backend logic and integrations.

**Rationale**: Firebase accelerated development by 3-4 weeks and provides superior out-of-the-box real-time capabilities for the order management system.
