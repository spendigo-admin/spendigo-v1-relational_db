# Firebase Email Trigger Extension Setup

**Last Updated**: 2026-05-01
**Status**: Production-Ready (v1.0)
**Infrastructure**: Cloud Firestore + Trigger Email Extension

---

## 1. Extension Configuration
Spendigo utilizes the **"Trigger Email from Firestore"** extension to decouple application logic from email delivery.

### Essential Settings:
- **Collection**: `mail`
- **Default FROM**: `Spendigo <noreply@spendigo.ca>`
- **Default REPLY-TO**: `support@spendigo.ca`
- **SMTP Gateway**: SendGrid (Production) or SMTP Relay (Enterprise).

---

## 2. Integrated Workflows
The platform automatically queues emails into the `mail` collection based on the following triggers:

### 2.1 Order Confirmation
- **Trigger**: `onOrderCreated` (or `onCreate` on `/orders/{orderId}`).
- **Content**: Dynamic HTML table with items, prices, and branding generated in `sendOrderEmails.ts`.
- **Action**: Informs the shopper that the store has received their order.

### 2.2 Status Updates
- **Trigger**: `onUpdate` on `/orders/{orderId}` when `status` changes.
- **States**: `preparing`, `out_for_delivery`, `delivered`, `cancelled`.
- **Action**: Provides real-time status alerts and tracking details.

### 2.3 Merchant Approval
- **Trigger**: Admin approval via the `StoreManagement.tsx` module.
- **Action**: Sends a "Welcome to Spendigo" kit with dashboard login instructions.

### 2.4 Team Invitations
- **Trigger**: `inviteTeamMember` Cloud Function.
- **Action**: Delivers temporary credentials and an automated email verification link.

---

## 3. Template Management
Spendigo v1.0 utilizes a **Dynamic HTML Generation Engine** within Cloud Functions (`sendOrderEmails.ts`) to construct transactional receipts. This ensures 100% accuracy for nested order items and real-time pricing data. 

Future non-transactional marketing campaigns will utilize the `email_templates` Firestore collection for managed layouts.

---

## 4. Verification & Debugging

### Monitoring Deliverability
1. **Firestore**: Check the `mail` collection.
   - `delivery.state`: Should be `SUCCESS`.
   - `delivery.error`: Contains SMTP rejection details if `state` is `ERROR`.
2. **Logs**: Filter for `sendOrderEmails` in the Firebase Functions log console.

### Local Testing
To test email triggers locally without incurring SMTP costs (Mailtrap/DevRelay):
1. Use the **Firebase Emulator Suite** for Firestore and Functions.
2. Observe the `mail` collection documents being created by the triggers.

---

## 5. Security & Deliverability (SPF/DKIM)
Ensure the following DNS records are active on `spendigo.ca` to prevent emails from landing in spam:
- **SPF**: `v=spf1 include:sendgrid.net ~all`
- **DKIM**: Configure as provided in the SendGrid "Sender Authentication" dashboard.
