# Spendigo SmartCart

**Status**: Beta (Feature Complete)  
**Last Updated**: 2026-04-09

Spendigo SmartCart is a Canada-first **Marketplace Facilitator** platform connecting independent convenience stores with local consumers. It features smart basket optimization, real-time order management, digital flyer integration, robust subscription management, and production-grade security.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: v20+ 
- **npm**: 11.7.0

**Install Node.js on Mac**:
```bash
brew install node
```
Or download from [nodejs.org](https://nodejs.org/)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd Spendigo-v1

# Install all dependencies
npm install
```

### Development

```bash
# Start the dev server (runs on HTTPS)
npm run dev

# Access at:
https://spendigo.ca/
```

**Note**: You may need to trust the self-signed SSL certificate in your browser. Local development is configured to use the `spendigo.ca` host via `@vitejs/plugin-basic-ssl`.

### Stripe Webhook Testing (Local)

To test subscription payments and real-time tier updates on your local machine:

1.  **Start the Listener**: In a separate terminal, run:
    ```bash
    npm run stripe:listen
    ```
    This forwards Stripe events to your local Firebase functions emulator.

2.  **Verify Webhook Secret**: Ensure your `whsec_...` secret from the terminal matches the one in your environment variables.

3.  **Place Test Order**: Use test card numbers (e.g., `4242...`) in the app. The listener will catch the event and trigger the local Cloud Function to upgrade your account!

### Production Build

```bash
# Compile TypeScript and build for production
npm run build

# Output: apps/web/dist/ (876kb bundle)
```

---

## 📁 Project Structure

This is a **monorepo** managed by Turbo and npm workspaces:

```
Spendigo-v1/
├── apps/
│   └── web/              # React frontend (Consumer, Merchant, Admin)
├── services/
│   ├── api/              # Cloud Functions (Stripe, Algolia, Email, PDF)
│   └── smartcart_optimizer # Optimization core logic
├── packages/             # Shared configurations & types
├── docs/                 # Architecture, API specs, sitemaps
├── .gemini/             # AI Development context
└── package.json         # Workspace root
```

---

## 🛠️ Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | React + TypeScript | 18.2.0 + 5.4+ |
| **Build Tool** | Vite | 7.3.0 |
| **Backend** | Firebase (BaaS) | 10.14.1 |
| **Database** | Cloud Firestore | NoSQL, real-time |
| **Authentication** | Firebase Auth | Email/Password + SSO |
| **Mobile** | Capacitor | 6.0.0 (iOS/Android) |
| **Styling** | TailwindCSS + Custom CSS | 3.4+ |

**See**: [docs/TECH_STACK.md](./docs/TECH_STACK.md) for complete details.

---

## 🏗️ Architecture

Spendigo uses a **Firebase-based serverless architecture**:

- **Frontend**: Single React app with role-based routing
- **Backend**: Firebase Admin SDK (Functions) & Client SDK (Web)
- **Monitoring**: **Sentry** (Error tracking & performance)
- **State Management**: React Context API (8+ contexts including Auth, Cart, Wishlist, Audit)
- **Real-time Sync**: Firestore `onSnapshot` listeners
- **Security**: RBAC + SHA-256 tamper-evident audit ledger

---

## 🔐 Security Features

- ✅ **HTTPS/SSL**: Local development with secure context
- ✅ **RBAC**: Multi-tenant role-based access control (Consumer, Merchant, Admin)
- ✅ **Audit Logging**: Tamper-evident blockchain-lite ledger (`AuditContext.tsx`)
- ✅ **Integrity Verification**: Client-side price tampering detection (`IntegrityUtils.ts`)
- ✅ **PII Redaction**: Automatic redaction in logs to SOC2 standards
- ✅ **Maintenance Mode**: Remote platform-wide lockdown
- ✅ **Suspended Stores**: Automated merchant lockout and cleanup

---

## 📊 Database Schema

Firestore Collections:
- `/users` - User profiles, FCM tokens, and roles
- `/stores` - Merchant store metadata and configuration
- `/merchant_products` - Individual merchant product listings and prices
- `/master_products` - Global canonical product definitions
- `/orders` - Order documents with real-time status sync
- `/audit_logs` - SHA-256 linked security audit chain
- `/notifications` - Multi-channel system notifications
- `/price_history` - 30-day tracking of product price fluctuations

**See**: [docs/SCHEMA.md](./docs/SCHEMA.md) and [docs/SITEMAP.md](./docs/SITEMAP.md) for full details.

---

## 🧪 Testing

```bash
# Run unit tests (Vitest)
npm test

# Run E2E tests (Playwright)
npm run test:e2e

# Build production bundle (validates TypeScript)
npm run build
```

---

## 📦 Key Features

### 🛒 Consumer Experience
- 🔍 **Advanced Search**: Algolia-powered full-text search and faceting
- 💰 **SmartCart Optimizer**: Real-time basket optimization finding the lowest total price
- 📱 **Real-time Tracking**: Live order updates via Firestore and FCM Push Notifications
- 🌍 **Multilingual**: i18n support for global consumer reach
- 🛡️ **Integrity Check**: Automated validation against price attacks
- ⭐ **Product Reviews**: Verified purchase badges and helpfulness ranking

### 📊 Merchant Dashboard
- 🚀 **Onboarding**: Integrated setup with Stripe Express
- 📁 **Catalog Sync**: Add products directly from the Spendigo Master Catalog
- 📰 **Digital Flyers**: Interactive flyer builder for weekly promotions
- 💳 **Stripe Subscriptions**: Multiple tiers (Free, Core, Growth) with feature gating
- 📉 **Analytics**: Detailed revenue and traffic insights

### 🛡️ System Admin Panel
- 👥 **User Management**: Role orchestration and platform auditing
- 🏪 **Store Oversight**: Approval workflow and compliance monitoring
- 📝 **Master Catalog Management**: Centralized product definition and mapping
- 🛡️ **Audit Ledger**: Forensic view of SHA-256 linked security logs
- 🛠️ **System Tools**: Maintenance mode and test data seeding

---

## 🚢 Deployment

### Web (Firebase Hosting)
```bash
npm run build
firebase deploy --only hosting
```

### Mobile (iOS & Android)
Build native apps from the same codebase using Capacitor:
```bash
# Sync web dist to native platforms
npx cap sync

# Open in native IDEs
npx cap open ios
npx cap open android
```

---

## 📚 Documentation index

| Document | Description |
|----------|-------------|
| [TECH_STACK.md](./docs/TECH_STACK.md) | Complete technology stack & library versions |
| [SITEMAP.md](./docs/SITEMAP.md) | Full route map and orphan page identification |
| [SCHEMA.md](./docs/SCHEMA.md) | Database schema (Firestore) |
| [MOBILE_DEPLOYMENT.md](./docs/MOBILE_DEPLOYMENT.md) | iOS/Android native build guide |

---

## 🎯 Roadmap

### ✅ Completed
- [x] **Advanced Search**: Algolia integration (Master & Merchant Products)
- [x] **Security Hardening**: SHA-256 Audit Ledger & Integrity Utils
- [x] **Subscription System**: Full Stripe Checkout & Webhook flow
- [x] **Monitoring**: Sentry SDK integration for React & Functions
- [x] **SEO & Metadata**: Dynamic OpenGraph/Twitter support via `react-helmet-async`
- [x] **Legal Compliance**: Privacy Policy & Terms of Service implementation
- [x] **Internationalization**: `i18next` framework integration
- [x] **Push Notifications**: FCM notification dispatch architecture

### 🔜 Upcoming
- [ ] Native Mobile App Store QA (iOS/Android)
- [ ] Stripe Connect (Direct payout split per store)
- [ ] Server-side Rendering (Next.js candidate migration)
- [ ] Automated CI/CD performance benchmarking

---

**Built with ❤️ in Canada** 🇨🇦
