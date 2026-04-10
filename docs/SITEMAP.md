# Spendigo Site Map

**Last Updated**: 2026-04-09
**Status**: Beta (Routes Implemented)
**Base URL**: `https://spendigo.ca`

---

## 🛍️ Consumer App (Public)

### Core Navigation
- [Home](https://spendigo.ca/) - Store listings, hero banner, featured stats.
- [Search](https://spendigo.ca/search) - Global product search filtered by category/store.
- [SmartCart](https://spendigo.ca/smartcart) - Wishlist optimization engine (Cheapest Price Finder).
- [SmartCart Prototype](https://spendigo.ca/smartcart/prototype) - **Beta**: Experimental optimizer interface.
- [How It Works](https://spendigo.ca/how-it-works) - Explainer page for the Optimizer.
- [Shopping Cart](https://spendigo.ca/cart) - Manage items and quantities.
- [Checkout](https://spendigo.ca/checkout) - Payment, delivery address, and order placement.
- [Surveys](https://spendigo.ca/surveys) - Participate in polls and provide feedback.
- [Flyers Hub](https://spendigo.ca/flyers) - Centralized view of all active store flyers.

### Store & Product
- [Store Detail](https://spendigo.ca/store/:id) - Products, flyers, deals, and ratings.
- [Product Detail](https://spendigo.ca/product/:id) - Product info, images, and add-to-cart.

### User Account
- [Profile](https://spendigo.ca/profile) - User settings, saved addresses, order history.
- [Notifications](https://spendigo.ca/notifications) - Price drop alerts and order updates.
- [Order Tracking](https://spendigo.ca/order/:id) - Visual timeline of active orders.

### Information & Careers
- [Careers Portal](https://spendigo.ca/careers) - Latest job openings at Spendigo.
- [Job Detail](https://spendigo.ca/careers/:id) - Detailed job description and application.
- [Partner With Us](https://spendigo.ca/partner) - Information for potential merchants.
- [Privacy Policy](https://spendigo.ca/privacy) - Data handling and legal information.
- [Terms of Service](https://spendigo.ca/terms) - Platform usage terms.

---

## 👔 Merchant Admin (Secure)

### Dashboard & Setup
- [Merchant Dashboard](https://spendigo.ca/merchant/dashboard) - Overview: Sales stats, recent orders, quick actions.
- [Store Onboarding](https://spendigo.ca/merchant/onboarding) - Step-by-step setup for new merchants.

### Management
- [Product Catalog](https://spendigo.ca/merchant/products) - Add/Edit/Delete products, manage stock.
- [Order Manager](https://spendigo.ca/merchant/orders) - View incoming orders, update status (Preparing/Ready).
- [Analytics] - (Note: Linked via Dashboard metrics)
- [Flyer Manager](https://spendigo.ca/merchant/flyers) - Create and manage weekly digital flyers.
- [Deals Manager](https://spendigo.ca/merchant/deals) - Create one-day offers and clearance sales.
- [Store Settings](https://spendigo.ca/merchant/settings) - Store profile and configuration.
- [Subscription](https://spendigo.ca/merchant/subscription) - Manage platform subscription tier.

---

## 🔐 Authentication
- [Login](https://spendigo.ca/login) - Universal login.
- [Register (Consumer)](https://spendigo.ca/register) - New consumer account creation.
- [Register (Merchant)](https://spendigo.ca/register/business) - Business account registration.
- [Verify Email](https://spendigo.ca/verify-email) - Email ownership verification.
- [Forgot Password](https://spendigo.ca/forgot-password) - Recovery flow.
- [Reset Password](https://spendigo.ca/reset-password) - Secure password reset.

---

## 🛡️ System Admin (Internal)

### Dashboard & Security
- [System Dashboard](https://spendigo.ca/admin/dashboard) - Overview: Platform health, revenue stats, system alerts.
- [Audit Logs](https://spendigo.ca/admin/audit-logs) - **Security**: View SHA-256 tamper-evident log ledger.

### Entity Management
- [User Management](https://spendigo.ca/admin/users) - View/Ban consumers and merchants.
- [Store Management](https://spendigo.ca/admin/stores) - Approve new merchants, oversee compliance.
- [Master Catalog](https://spendigo.ca/admin/catalog) - Manage global product definitions.
- [Career Management](https://spendigo.ca/admin/careers) - **New**: Manage job listings and applications.

### Platform Tools
- [Ad Manager](https://spendigo.ca/admin/ads) - Manage carousel campaigns and sponsorships.
- [Survey Manager](https://spendigo.ca/admin/surveys) - Create polls and view responses.
- [System Tools](https://spendigo.ca/admin/tools) - DevOps: Maintenance mode, data migration tools.
- [Settings](https://spendigo.ca/admin/settings) - Global platform settings.

---

## 🕸️ Orphan & Internal Files
These files exist in the `src/pages` directory but are not currently accessible via active routes in `App.tsx`.

- `FlyerModeration.tsx` (Admin) - **Imported but Unrouted**: Planned feature for admin-level flyer vetting.
- `SeedUsers.tsx` (Admin) - **Unrouted**: Legacy tool for test data initialization.
