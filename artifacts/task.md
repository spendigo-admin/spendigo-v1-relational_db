# Task: Phase 3 - Security Hardening & Mobile Launch

## 1. Mobile Expansion (Capacitor) 📱
- [ ] **Environment Configuration**
    - [ ] Review `capacitor.config.ts` for correct production URL
    - [ ] Ensure `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) are present (or documented as manual steps)
- [ ] **Native Build**
    - [ ] Run `npx cap sync` to update native projects
    - [ ] Verify assets (icons/splash screens) are generated
- [ ] **Feature Verification on Native**
    - [ ] Test **Camera** permission for Barcode Scanner
    - [ ] Test **Geolocation** permission for Store Finder

## 2. Security Hardening (Critical) 🔒
- [ ] **Firestore Rules Overhaul**
    - [ ] Lock down `ads` collection (Admin write / Public read)
    - [ ] Lock down `stats` collection (Admin write / Public read)
    - [ ] Strict validation for `orders` (User can only read/write own)
    - [ ] Strict validation for `users` (User can only edit own profile)
- [ ] **Infrastructure Secrets**
    - [ ] Audit `.env` usage
    - [ ] Ensure API keys are restricted in Google Cloud Console

## 3. Financial Infrastructure (Stripe Connect) 💳
*(Required for Marketplace Compliance)*
- [ ] **Connect Onboarding**
    - [ ] Create UI for Merchants to "Connect with Stripe"
    - [ ] Implement OAuth flow for Express Accounts
- [ ] **Payment Splitting**
    - [ ] Update `create-checkout-session` to use `transfer_data` (Platform Fee vs Merchant Payout)
- [ ] **Refund Portal**
    - [ ] Add "Issue Refund" button to Admin Order View

## 4. Stability & Quality 🧪
- [ ] **Error Monitoring**
    - [ ] Install Sentry for React
    - [ ] Verify error reporting in production
- [ ] **Type Safety**
    - [ ] Enable `strict: true` in `tsconfig.json` locally and fix P0 errors

## 5. Verification
- [ ] Run `npm run build` to ensure no regressions
- [ ] Verify Admin Dashboard real-time stats
- [ ] Verify Carousel Ads appearance on Home

---

## 6. Completed Features (Log) ✅
<details>
<summary>View Recently Completed Items</summary>

- **Growth & Engagement**
    - [x] **Carousel Ads System**: Admin Manager, Consumer Component, Tracking
    - [x] **Survey Board**: Admin Creator, Consumer View
    - [x] **Digital Flyers**: PDF-like Viewer, "Nearby Flyers" feed
    - [x] **Traffic Tracking**: Google Analytics + Custom Firestore Hooks

- **Merchant Tools**
    - [x] **Barcode Scanning**: HTML5-QRCode integration
    - [x] **Revenue Analytics**: Daily/Weekly stats
    - [x] **Team Management**: Staff invitations

- **System Admin**
    - [x] **Dashboard**: Real-time traffic, health metrics, activity logs
    - [x] **Store Management**: Approval workflow, Demo Relocation Tool
    - [x] **Ad Manager**: Campaign creation & metrics

- **Core & Architecture**
    - [x] **Data Isolation**: RBAC for Cart/Wishlist
    - [x] **Order Routing**: Dual-write fix for Merchant Orders
    - [x] **Search**: Global Product Search
</details>
