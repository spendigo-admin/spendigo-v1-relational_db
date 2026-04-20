# Email Notifications & Verification System

**Last Updated**: 2026-04-20
**Status**: Production-Ready (v1.0)
**Engine**: Cloud Functions + Firebase Trigger Email Extension

---

## 1. Authentication & Security
The integrity of the Spendigo marketplace depends on verified users, especially for the **Forensic Audit Ledger** compliance.

### 1.1 Email Verification
- **Required For**: All Merchant and Admin roles. Features are gated until `emailVerified` is `true`.
- **Shopper UX**: Shoppers can browse, but must verify their email to save wishlists or place orders.
- **Provider**: Firebase Auth Client SDK.

### 1.2 Password Resets
- Standardized self-service flow via the Firebase Auth "Forgot Password" triggers.

---

## 2. Dynamic Transactional Alerts
Spendigo uses the `mail` collection to queue automated, rich HTML communications.

### 2.1 Order Lifecycle
| Event | Trigger | Content |
| :--- | :--- | :--- |
| **Confirmed** | `onCreate` in `/orders` | Detailed receipt with store branding and items list. |
| **Status Change** | `onUpdate` in `/orders` | Progression alerts (Preparing, Out for Delivery, etc.). |
| **Refunded** | ` refundOrder` API call | Confirmation of credit back to the primary payment method. |

### 2.2 Merchant Team Management
- **Invite Sent**: When a store owner invites a new staff member via `inviteTeamMember`, the system automatically:
  1. Generates a temporary password.
  2. Generates an email verification link.
  3. Queues a **"Welcome to the Team"** email with the credentials and verification link.

---

## 3. Marketplace Policy Communications

### 3.1 Merchant Approval (KYB)
When the Admin Master Catalog processes a `PartnerWithUs` request, an automated verification email is sent confirming that the store is live and proximity alerts are active for their region.

### 3.2 Savings Notifications
- **Price Drop Alerts**: Based on products in the consumer's wishlist.
- **Trip Consolidation Tips**: AI-generated hints via Gemini 2.5 on how to save by adding 1-2 more items to a trip.

---

## 4. Operational Monitoring
- **Queue Status**: Administrators monitor the `mail` collection for `delivery.state`.
- **SMTP Health**: Automated alerts in Sentry on `delivery.error` events.
- **Forensic Logs**: Every transactional email trigger is cross-referenced with a cryptographic entry in the `audit_logs` collection.
