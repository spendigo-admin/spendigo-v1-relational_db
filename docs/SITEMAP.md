# Spendigo Site Map

**Last Updated**: 2026-05-01
**Status**: Production-Ready (v1.0)
**Base URL**: `https://spendigo.ca`

---

## 🛍️ Consumer App (Public)

### Core Discovery
- [Store Rack (Home)](https://spendigo.ca/) - Store grid, hero carousel, and live marketplace stats.
- [Global Search](https://spendigo.ca/search) - Multi-store product search with category faceting.
- [Flyers Hub](https://spendigo.ca/flyers) - Centralized circulars for all active marketplace merchants.
- [Flash Deals](https://spendigo.ca/deals) - Time-limited inventory liquidation offers.
- [Price Comparison](https://spendigo.ca/compare) - **New**: Real-time pricing index across multiple merchants.
- [Surveys](https://spendigo.ca/surveys) - Community feedback and shopper preference polling.

### SmartCart Optimization
- [SmartCart Optimizer](https://spendigo.ca/smartcart) - Wishlist builder with multi-store "Best Split" logic.
- [Savings Insights](https://spendigo.ca/smartcart/prototype) - **Beta**: Gemini-powered shopping strategy advice.
- [How It Works](https://spendigo.ca/how-it-works) - Visual guide to distance-based savings.
- [Cart Manager](https://spendigo.ca/cart) - Staging area for multi-store checkout preparation.

### Corporate & Support
- [Partner With Us](https://spendigo.ca/partner) - B2B lead generation for potential merchants.
- [Careers Hub](https://spendigo.ca/careers) - Job board and culture portal for Spendigo HQ.
- [Legal Center](https://spendigo.ca/privacy) - Privacy Policy and Terms of Service.

### Store & Product Experience
- [Store Detail](https://spendigo.ca/store/:id) - Tabbed interface:
  - **Weekly Flyers**: Standard digital circulars.
  - **Hot Offers**: Exclusive digital deals.
  - **Store Info**: Hours, geocoded location, and delivery services.
- [Product Detail](https://spendigo.ca/product/:id) - Cross-store pricing table and substitution suggestions.

### User Account & Checkout
- [Checkout](https://spendigo.ca/checkout) - Multi-store order fulfillment and payment.
- [Order Status](https://spendigo.ca/order/:id) - Real-time tracking from store prep to delivery.
- [User Profile](https://spendigo.ca/profile) - Preferences, saved addresses, and transaction history.
- [Notifications](https://spendigo.ca/notifications) - Price drop alerts and proximity notifications.

---

## 👔 Merchant Operations (Secure)

### Presence & Compliance
- [Operations Center](https://spendigo.ca/merchant/dashboard) - **New**: Proximity Dashboard with geocoding and reach visualization.
- [Onboarding](https://spendigo.ca/merchant/onboarding) - Business verification and store setup.
- [Operations Settings](https://spendigo.ca/merchant/settings) - Profile management and operating hours.
- [Subscription](https://spendigo.ca/merchant/subscription) - Core/Growth plan management.

### Inventory & Sales
- [Inventory Manager](https://spendigo.ca/merchant/products) - Stock control and Master Catalog linking.
- [Order Ledger](https://spendigo.ca/merchant/orders) - Real-time order fulfillment workflow.
- [Campaign Manager](https://spendigo.ca/merchant/flyers) - Digital flyer publishing tool.
- [Flash Deal Editor](https://spendigo.ca/merchant/deals) - One-day offer creation.
- [Analytics Suite](https://spendigo.ca/merchant/analytics) - **New**: Sales velocity and conversion funnel tracking.

---

## 🔐 Authentication Ecosystem
- [Login Portal](https://spendigo.ca/login) - Universal RBAC entry.
- [Merchant Registration](https://spendigo.ca/register/business) - Corporate KYB onboarding.
- [Shopper Signup](https://spendigo.ca/register) - Consumer account creation.
- [Recovery Services](https://spendigo.ca/forgot-password) - Forgot/Reset password and email verification loops.

---

## 🛡️ System Administration (Internal)

### Governance & Security
- [Control Center](https://spendigo.ca/admin/dashboard) - Platform health and aggregate revenue metrics.
- [Security Audit Ledger](https://spendigo.ca/admin/audit-logs) - **Forensic**: Tamper-evident SHA-256 chain verification.
- [Store Overseer](https://spendigo.ca/admin/stores) - Global store moderation and compliance.
- [User Directory](https://spendigo.ca/admin/users) - RBAC management and access control.
- [MFA Enrollment](https://spendigo.ca/admin/mfa-setup) - Secondary factor configuration for internal accounts.
- [System Health](https://spendigo.ca/admin/health) - Infrastructure monitoring and container status.

### Content & Tools
- [Master Catalog](https://spendigo.ca/admin/catalog) - Product definitions with "Pending Review" workflow.
- [Ad Engine](https://spendigo.ca/admin/ads) - AdCarousel performance tracking (Views/Clicks).
- [Careers Manager](https://spendigo.ca/admin/careers) - Job board administration.
- [DevOps Tools](https://spendigo.ca/admin/tools) - Maintenance mode and system health.
- [Flyer Ingestion](https://spendigo.ca/admin/flyer-ingestion) - **New**: Batch upload and OCR processing for digital circulars.
- [Survey Manager](https://spendigo.ca/admin/surveys) - Campaign creation for consumer feedback loops.
- [Marketplace Insights](https://spendigo.ca/admin/insights) - Aggregate store performance and regional heatmaps.
- [Global Settings](https://spendigo.ca/admin/settings) - Feature flags and platform-wide configuration.

---

## 🕸️ Hidden & Development Assets
These files represent planned or deprecated administrative features not currently routed.

- `FlyerModeration.tsx` (Admin) - **Unrouted**: Planned queue for manual flyer verification.
- `SeedUsers.tsx` (Admin) - **Unrouted**: Developer tool for local environment bootstrapping.
- `Maintenance.tsx` - **Global**: Overlay triggered via `platform/settings`.
