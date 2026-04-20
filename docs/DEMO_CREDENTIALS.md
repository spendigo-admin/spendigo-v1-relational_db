# Spendigo Demo Credentials (v1.0)

**CONFIDENTIAL — Internal/QA Use Only**
**Last Updated**: 2026-04-20
**Security Status**: Forensic Chains Active

---

## 🔑 Universal Demo Password

To simplify multi-role testing, all demo accounts utilize:
> **`Spendigo123!`**

---

## 🛡️ Administrative Tier (Platform Control)

| Account ID | Primary Access | Audit Status |
| :--- | :--- | :--- |
| `admin@spendigo.ca` | **Root Super-Admin** | Forensic-Ready |
| `moderator@spendigo.ca` | Catalog & Ad Moderation | Logged |

**Permissions**:
- **Master Catalog**: Approve/Reject SKU requests.
- **Forensic Audit**: Verify SHA-256 integrity chains and download legal evidence.
- **Ad Manager**: Control the Private Ad Network (Priority/Active status).
- **Merchant Approval**: Verify KYB business licenses.

---

## 🏪 Merchant Tier (Store Ops)

### Premium Merchant (Growth Plan)
| Account ID | Store Name | Role |
| :--- | :--- | :--- |
| `organic.owner@spendigo.ca` | Organic Market | OWNER |
| `manager@organicmarket.com` | Organic Market | MANAGER |

### Core Merchants (Standard Plan)
| Account ID | Store Name | Role |
| :--- | :--- | :--- |
| `bakery.owner@spendigo.ca` | The Daily Loaf | OWNER |
| `butcher.owner@spendigo.ca` | The Butcher's Block | OWNER |
| `freshmart.owner@spendigo.ca` | FreshMart | OWNER |

**Permissions**:
- **Inventory Control**: Update local price Override and "Canadian Local" status.
- **Subscription**: Manage Stripe billing and apply promo codes (e.g., `WELCOME2026`).
- **Team**: Invite staff members with automated welcome triggers.

---

## 🛒 Consumer Tier (Marketplace Shoppers)

| Account ID | Experience Type |
| :--- | :--- |
| `chef@spendigo.ca` | Verified Shopper (Wishlist Heavy) |
| `family@spendigo.ca` | Budget Optimizer (SmartCart Heavy) |
| `student@spendigo.ca` | Savings Hunter (Flash Deal focus) |

**Permissions**:
- **SmartCart**: Execute 10-stage optimization across multiple stores.
- **Private Ad network**: View featured carousels and store highlights.
- **Wishlist**: Save frequent items for automated price-drop monitoring.

---

## 💳 Stripe Test Protocol

When testing **Store Subscriptions** or **SmartCart Checkout**:

- **Card Number**: `4242 4242 4242 4242`
- **Expiry**: Any future date (e.g., `12/28`)
- **CVC**: `123`
- **ZIP/Postal**: `M5V 2H1` (or any valid FSA)

---

## 🚨 Compliance & Cleanup Checklist
- [ ] **Data Wipe**: Ensure `audit_logs` are backed up before clearing for GA launch.
- [ ] **FCM Tokens**: Reset FCM device tokens in the `users` docs to prevent cross-account notifications.
- [ ] **Product Sweep**: Purge any "Test" or "Garbage" master products with non-standard barcodes (e.g., "123456").
