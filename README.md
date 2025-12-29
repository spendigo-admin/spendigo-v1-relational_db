# Spendigo SmartCart

**Status**: Production-Ready  
**Last Updated**: 2025-12-24

Spendigo SmartCart is a Canada-first **Marketplace Facilitator** platform connecting independent convenience stores with local consumers. It features smart basket optimization, real-time order management, digital flyer integration, and production-grade security.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: v20+ (v25.2.1 installed)
- **npm**: 11.7.0

**Install Node.js on Mac**:
```bash
brew install node
```
Or download from [nodejs.org](https://nodejs.org/)

### Installation

```bash
# Clone the repository
cd /Users/shahbaz/Documents/Spendigo

# Install all dependencies
npm install
```

### Development

```bash
# Start the dev server (runs on HTTPS)
npm run dev

# Access at:
https://spendigo.ca:446/
```

**Note**: You may need to trust the self-signed SSL certificate in your browser.

### Stripe Webhook Testing (Local)

To test subscription payments and real-time tier updates on your local machine:

1.  **Start the Listener**: In a separate terminal, run:
    ```bash
    npm run stripe:listen
    ```
    This forwards Stripe events to your local Firebase functions emulator.

2.  **Verify Webhook Secret**: Ensure your `whsec_...` secret from the terminal matches the one in `services/api/.runtimeconfig.json`.

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
spendigo/
├── apps/
│   └── web/              # React frontend (Consumer, Merchant, Admin)
├── docs/                 # Architecture, API specs, legal docs
├── .gemini/             # Development artifacts
└── package.json         # Workspace root
```

---

## 🛠️ Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | React + TypeScript | 18.2.0 + 5.0+ |
| **Build Tool** | Vite | 7.3.0 |
| **Backend** | Firebase (BaaS) | 10.14.1 |
| **Database** | Cloud Firestore | NoSQL, real-time |
| **Authentication** | Firebase Auth | Email/Password + SSO |
| **Mobile** | Capacitor | 6.0.0 (iOS/Android) |
| **Styling** | TailwindCSS + Custom CSS | 3.0+ |

**See**: [docs/TECH_STACK.md](./docs/TECH_STACK.md) for complete details.

---

## 🏗️ Architecture

Spendigo uses a **Firebase-based serverless architecture**:

- **Frontend**: Single React app with role-based routing
- **Backend**: Firebase (Auth, Firestore, Storage)
- **State Management**: React Context API (7 contexts)
- **Real-time Sync**: Firestore `onSnapshot` listeners
- **Security**: RBAC + SHA-256 audit ledger

**See**: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for full architecture diagram.

---

## 🔐 Security Features

- ✅ **HTTPS/SSL**: Local dev with self-signed certificate
- ✅ **RBAC**: Role-based access (Consumer, Merchant, Admin)
- ✅ **Route Guards**: Layout-level authentication checks
- ✅ **Audit Logging**: Tamper-evident blockchain-lite ledger
- ✅ **Data Isolation**: Per-user Firestore documents
- ✅ **Maintenance Mode**: Platform-wide lockdown capability
- ✅ **Suspended Stores**: Automatic merchant lockout

---

## 📱 Mobile Deployment

Build native iOS and Android apps from the same codebase:

```bash
# Sync web assets to native projects
npx cap sync

# Open in native IDE
npx cap open ios      # Xcode
npx cap open android  # Android Studio
```

**See**: [docs/MOBILE_DEPLOYMENT.md](./docs/MOBILE_DEPLOYMENT.md) for detailed instructions.

---

## 📊 Database Schema

Firestore Collections:
- `/users` - User profiles and roles
- `/stores` - Merchant stores and products
- `/orders` - Order documents with real-time sync
- `/catalog` - Master product catalog
- `/audit_logs` - Security audit trail
- `/carts` - Shopping carts
- `/notifications` - User notifications

**See**: [docs/SCHEMA.md](./docs/SCHEMA.md) for complete schema documentation.

---

## 🧪 Testing

```bash
# Run unit tests (Vitest)
npm test

# Build production bundle (validates TypeScript)
npm run build
```

**E2E Testing**: Manual browser verification (automated tests pending)

**See**: Gap Analysis in [docs/GAP_ANALYSIS.md](./docs/GAP_ANALYSIS.md)

---

## 📦 Key Features

### Consumer Experience
- 🔍 Cross-store product search
- 💰 SmartCart price comparison
- 📱 Real-time order tracking
- ❤️ Wishlist with price alerts
- 🧮 Provincial tax calculation

### Merchant Dashboard
- 📊 Real-time order Kanban board
- 📰 Digital flyer creation
- 📦 Inventory management from master catalog
- 💳 Payment status tracking
- 📈 Analytics dashboard

### Admin Panel
- 👥 User management (role promotion)
- 🏪 Store approval/suspension
- 🔐 Security audit ledger
- 🛠️ Platform maintenance mode
- 📊 Real-time system events

---

## 🚢 Deployment

### Web (Firebase Hosting)
```bash
npm run build
firebase deploy
```

### Mobile (iOS App Store)
1. Build: `npx cap sync`
2. Open: `npx cap open ios`
3. Archive in Xcode → Upload to App Store

### Mobile (Google Play)
1. Build: `npx cap sync`
2. Open: `npx cap open android`
3. Generate signed APK/AAB → Upload to Play Console

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [TECH_STACK.md](./docs/TECH_STACK.md) | Complete technology stack |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System architecture diagrams |
| [SCHEMA.md](./docs/SCHEMA.md) | Database schema (Firestore) |
| [MOBILE_DEPLOYMENT.md](./docs/MOBILE_DEPLOYMENT.md) | iOS/Android build guide |
| [ACCESSIBILITY.md](./docs/ACCESSIBILITY.md) | A11y compliance |
| [MERCHANT_BILLING.md](./docs/MERCHANT_BILLING.md) | Billing & Subscription guide |

---

## 🐛 Troubleshooting

### "Cannot find module 'react'" errors
```bash
rm -rf node_modules package-lock.json
npm install
```

### SSL certificate warnings
Trust the certificate:
```bash
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain \
  /Users/shahbaz/.gemini/antigravity/certs/cert.pem
```

### Port 443 in use
```bash
# Kill existing process
sudo lsof -ti:443 | xargs sudo kill -9

# Restart dev server
npm run dev
```

---

## 📝 License

Proprietary - All rights reserved.

---

## 👥 Team

**Development**: Shahbaz + AI Assistant (Antigravity)  
**Platform**: Spendigo SmartCart  
**Contact**: [support@spendigo.ca](mailto:support@spendigo.ca)

---

## 🎯 Roadmap

### ✅ Completed (Phase 1-8)
- Core shopping experience
- Merchant order management (with Hold/Resume & Rejection Reasons)
- Admin panel with audit logs
- Real-time Firestore sync & In-App Notifications
- Real-time store geocoding & proximity search
- Production build verification

### 🔜 Q1 2025
- Real Stripe Connect integration
- Firestore security rules hardening (RBAC enforcement)
- CI/CD pipeline (GitHub Actions)
- Error monitoring (Sentry)

### 🔮 Q2-Q3 2025
- Server-side rendering (Next.js migration)
- Advanced analytics & Demand forecasting
- Native mobile push notifications (FCM)
- Multi-region deployment

---

**Built with ❤️ in Canada** 🇨🇦
