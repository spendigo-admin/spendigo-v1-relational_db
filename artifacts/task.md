# Task: Phase 3 - Security Hardening & Mobile Launch

**Last Updated**: 2026-01-03

---

## 1. Immediate Fixes (Critical) 🔴

### 1.1 Firestore Rules - `stats` Collection
- [ ] Add security rules for `stats` collection (traffic tracking)
- [ ] Deploy updated rules: `firebase deploy --only firestore:rules`

### 1.2 Documentation Updates
- [ ] Update `SCHEMA.md` with `ads`, `surveys`, `stats` collections
- [ ] Update `SITEMAP.md` with new routes (`/surveys`, `/admin/ads`)
- [ ] Fix `README.md` roadmap dates (currently says 2025)
- [ ] Update `TECH_STACK.md` - Google SSO is complete, not mock

---

## 2. Mobile Expansion (Capacitor) 📱

### 2.1 Native Build Preparation
- [ ] Run `npx cap sync` to update native projects
- [ ] Verify `android/` and `ios/` folders exist and are configured
- [ ] Check for missing native config files:
  - `google-services.json` (Android)
  - `GoogleService-Info.plist` (iOS)

### 2.2 Feature Verification on Native
- [ ] Test **Camera** permission (Barcode Scanner)
- [ ] Test **Geolocation** permission (Store Finder)
- [ ] Test **Push Notification** permission placeholder
- [ ] Verify app icons and splash screens render correctly

### 2.3 Build & Test
- [ ] Build iOS: `npx cap open ios` → Xcode → Simulator
- [ ] Build Android: `npx cap open android` → Android Studio → Emulator

---

## 3. Financial Infrastructure 💳

> **Note**: Stripe Connect for merchant payment splitting has been **deferred** for future consideration. Current implementation uses direct Stripe checkout for subscriptions only.

### 3.1 Future Considerations (When Ready)
- [ ] Implement Stripe Connect for marketplace fee splitting
- [ ] Add "Issue Refund" button to Admin Order View
- [ ] Build Promo Code system for Growth tier merchants

---

## 4. Observability & Quality 🧪

### 4.1 Error Monitoring
- [ ] Install Sentry for React (`@sentry/react`)
- [ ] Configure source maps upload
- [ ] Verify error capture in production

### 4.2 Performance
- [ ] Add Firestore composite indexes for complex queries
- [ ] Review bundle size (currently ~1.4MB)
- [ ] Consider code splitting for admin routes

### 4.3 Code Quality
- [ ] Enable `noUnusedLocals` in tsconfig
- [ ] Enable `noUnusedParameters` in tsconfig
- [ ] Run lint and fix warnings

---

## 5. Verification Checklist ✅

- [ ] Run `npm run build` - no errors
- [ ] Verify Traffic Dashboard shows real data (24h/7d/30d)
- [ ] Verify Carousel Ads load on Homepage
- [ ] Verify Barcode Scanner works on mobile browser
- [ ] Test complete checkout flow with Stripe test card

---

## 6. Completed Features (History Log) 📜

<details>
<summary>Click to expand completed items</summary>

### Growth & Engagement
- [x] **Carousel Ads System**: Admin Manager, Consumer Component, View/Click Tracking
- [x] **Survey Board**: Admin Creator, Consumer View
- [x] **Digital Flyers**: PDF-like Viewer, "Nearby Flyers" feed
- [x] **Traffic Tracking**: Firebase Analytics + Custom Firestore Hooks (24h/7d/30d/365d)

### Merchant Tools
- [x] **Barcode Scanning**: html5-qrcode integration
- [x] **Revenue Analytics**: Daily/Weekly/Monthly breakdown
- [x] **Team Management**: Staff invitations with RBAC

### System Admin
- [x] **Dashboard**: Real-time traffic, health metrics, activity logs
- [x] **Store Management**: Approval workflow, Demo Relocation Tool
- [x] **Ad Manager**: Campaign CRUD with metrics
- [x] **User Management**: Ban/Promote capabilities

### Core & Architecture
- [x] **Data Isolation**: RBAC for Cart/Wishlist/Notifications
- [x] **Order Routing**: Dual-write for Merchant Orders
- [x] **Global Search**: Cross-store product search
- [x] **SmartCart**: Price optimization algorithm
- [x] **Stripe Subscriptions**: Core/Growth tiers with webhooks

### Infrastructure
- [x] **Production Deployment**: Firebase Hosting
- [x] **Security Headers**: HSTS, X-Frame-Options, etc.
- [x] **Audit Logging**: SHA-256 hash chain
- [x] **TypeScript Strict Mode**: Enabled in tsconfig

</details>

---

## 7. Reference Links

- **Gap Analysis**: [docs/GAP_ANALYSIS.md](../docs/GAP_ANALYSIS.md)
- **Architecture**: [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
- **Schema**: [docs/SCHEMA.md](../docs/SCHEMA.md)
- **Deployment Guide**: [docs/DEPLOYMENT_GUIDE.md](../docs/DEPLOYMENT_GUIDE.md)

---

**Status**: Feature Complete → Security & Mobile QA Phase
