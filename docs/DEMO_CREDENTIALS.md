# Spendigo Demo Credentials

**CONFIDENTIAL - Internal Use Only**  
**Last Updated**: 2026-01-11

---

## Universal Password

All demo accounts use the same password:

> **Spendigo123!**

---

## 🛡️ System Admins

| Email | Role |
|-------|------|
| admin@spendigo.ca | ADMIN |
| admin2@spendigo.ca | ADMIN |

**Permissions**: Full platform access, user management, store moderation, audit logs, maintenance mode

---

## 🏪 Merchant Accounts

### Owners

| Email | Role | Store |
|-------|------|-------|
| bakery.owner@spendigo.ca | OWNER | The Daily Loaf |
| bodega.owner@spendigo.ca | OWNER | Corner Bodega |
| books.owner@spendigo.ca | OWNER | The Book Nook |
| butcher.owner@spendigo.ca | OWNER | The Butcher's Block |
| cornerbodega.owner@spendigo.ca | OWNER | Corner Bodega |
| costco.owner@spendigo.ca | OWNER | Costco |
| costcobusiness.owner@spendigo.ca | OWNER | Costco Business Center |
| freshmart.owner@spendigo.ca | OWNER | FreshMart |
| greenvalley.owner@spendigo.ca | OWNER | Green Valley Market |
| greenvalleymarket.owner@spendigo.ca | OWNER | Green Valley Market |
| hasty.owner@spendigo.ca | OWNER | Hasty Mart |
| hastymart.owner@spendigo.ca | OWNER | Hasty Mart |
| macs.owner@spendigo.ca | OWNER | Mac's Corner Store |
| macscorner.owner@spendigo.ca | OWNER | Mac's Corner Store |
| metro.owner@spendigo.ca | OWNER | Metro Express |
| metroexpress.owner@spendigo.ca | OWNER | Metro Express |
| quickpick.owner@spendigo.ca | OWNER | QuickPick Market |
| thebooknook.owner@spendigo.ca | OWNER | The Book Nook |
| thebutchersblock.owner@spendigo.ca | OWNER | The Butcher's Block |
| thedailyloaf.owner@spendigo.ca | OWNER | The Daily Loaf |

**Permissions**: Full store management, team invitations, subscription management, order fulfillment, analytics

### Managers

| Email | Role | Store |
|-------|------|-------|
| bakery.manager@spendigo.ca | MANAGER | The Daily Loaf |
| bodega.manager@spendigo.ca | MANAGER | Corner Bodega |
| books.manager@spendigo.ca | MANAGER | The Book Nook |
| butcher.manager@spendigo.ca | MANAGER | The Butcher's Block |
| cornerbodega.manager@spendigo.ca | MANAGER | Corner Bodega |
| costco.manager@spendigo.ca | MANAGER | Costco |
| costcobusiness.manager@spendigo.ca | MANAGER | Costco Business Center |
| freshmart.manager@spendigo.ca | MANAGER | FreshMart |
| greenvalley.manager@spendigo.ca | MANAGER | Green Valley Market |
| greenvalleymarket.manager@spendigo.ca | MANAGER | Green Valley Market |
| hasty.manager@spendigo.ca | MANAGER | Hasty Mart |
| hastymart.manager@spendigo.ca | MANAGER | Hasty Mart |
| macs.manager@spendigo.ca | MANAGER | Mac's Corner Store |
| macscorner.manager@spendigo.ca | MANAGER | Mac's Corner Store |
| metro.manager@spendigo.ca | MANAGER | Metro Express |
| metroexpress.manager@spendigo.ca | MANAGER | Metro Express |
| quickpick.manager@spendigo.ca | MANAGER | QuickPick Market |
| thebooknook.manager@spendigo.ca | MANAGER | The Book Nook |
| thebutchersblock.manager@spendigo.ca | MANAGER | The Butcher's Block |
| thedailyloaf.manager@spendigo.ca | MANAGER | The Daily Loaf |

**Permissions**: Order fulfillment, inventory management, flyer creation (view-only for subscription settings)

### Staff

| Email | Role | Store |
|-------|------|-------|
| bakery.staff@spendigo.ca | STAFF | The Daily Loaf |
| bodega.staff@spendigo.ca | STAFF | Corner Bodega |
| books.staff@spendigo.ca | STAFF | The Book Nook |
| butcher.staff@spendigo.ca | STAFF | The Butcher's Block |
| cornerbodega.staff@spendigo.ca | STAFF | Corner Bodega |
| costco.staff@spendigo.ca | STAFF | Costco |
| costcobusiness.staff@spendigo.ca | STAFF | Costco Business Center |
| freshmart.staff@spendigo.ca | STAFF | FreshMart |
| greenvalley.staff@spendigo.ca | STAFF | Green Valley Market |
| greenvalleymarket.staff@spendigo.ca | STAFF | Green Valley Market |
| hasty.staff@spendigo.ca | STAFF | Hasty Mart |
| hastymart.staff@spendigo.ca | STAFF | Hasty Mart |
| macs.staff@spendigo.ca | STAFF | Mac's Corner Store |
| macscorner.staff@spendigo.ca | STAFF | Mac's Corner Store |
| metro.staff@spendigo.ca | STAFF | Metro Express |
| metroexpress.staff@spendigo.ca | STAFF | Metro Express |
| quickpick.staff@spendigo.ca | STAFF | QuickPick Market |
| thebooknook.staff@spendigo.ca | STAFF | The Book Nook |
| thebutchersblock.staff@spendigo.ca | STAFF | The Butcher's Block |
| thedailyloaf.staff@spendigo.ca | STAFF | The Daily Loaf |

**Permissions**: Order view (read-only), limited dashboard access

---

## 🛒 Shoppers (Consumers)

| Email | Role | Notes |
|-------|------|-------|
| chef@spendigo.ca | USER | Regular shopper |
| family@spendigo.ca | USER | Regular shopper |
| shopper@example.com | USER | Regular shopper |
| student@spendigo.ca | USER | Regular shopper |
| al_sb@outpacexct.com | USER | Regular shopper |
| sync_check_9977@test.com | USER | Test account |
| verif_shopper@test.com | USER | Test account |
| verif_user@test.com | USER | Test account |

### Merchant Test Accounts (Consumer Side)
| Email | Role | Notes |
|-------|------|-------|
| al_shahb@outlook.com | MERCHANT | Merchant test account |
| verif_merch@test.com | MERCHANT | Merchant test account |
| verif_merchant@test.com | MERCHANT | Merchant test account |

**Permissions**: Browse products, create orders, manage cart, wishlist, profile

---

## Usage Guidelines

### For Testing

1. **Consumer Flow**: Use any `USER` account to:
   - Browse stores and products
   - Add items to cart
   - Place orders
   - Track deliveries

2. **Merchant Flow**: Use any `OWNER` or `MANAGER` account to:
   - Manage orders
   - Update inventory
   - Create flyers
   - Test subscription upgrades (use Stripe test cards)

3. **Admin Flow**: Use `admin@spendigo.ca` to:
   - Moderate stores
   - Manage users
   - View audit logs
   - Enable/disable maintenance mode

### Security Notes

- **NEVER** share these credentials publicly
- **NEVER** commit this file to version control
- These accounts should be **deleted or disabled** before public launch
- Consider using **temporary test users** in Firebase Auth emulator for local development

### Stripe Test Cards

When testing subscriptions:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Authentication Required**: `4000 0027 6000 3184`

Expiry: Any future date (e.g., `12/34`)  
CVC: Any 3 digits (e.g., `123`)  
ZIP: Any 5 digits (e.g., `12345`)

---

## Cleanup Checklist (Before Public Launch)

- [ ] Delete all demo accounts from Firebase Auth
- [ ] Remove `DEMO_USERS` constant from codebase
- [ ] Delete this file or move to a secure location
- [ ] Update Firestore Security Rules to prevent unauthorized access
- [ ] Create a "Real User Onboarding" workflow
- [ ] Disable any hard-coded admin overrides

---

**Document Owner**: Shahbaz  
**Classification**: CONFIDENTIAL - Internal Testing Only
