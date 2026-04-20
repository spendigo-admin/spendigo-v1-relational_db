# Firebase Email Trigger Extension Setup

**Last Updated**: 2026-04-20
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

### 2.1 Order Confirmation (`sendOrderConfirmation`)
- **Trigger**: `onCreate` on `/orders/{orderId}`.
- **Content**: Dynamic HTML table with items, prices, and branding.
- **Action**: Informs the shopper that the store has received their order.

### 2.2 Status Updates (`sendOrderStatusUpdate`)
- **Trigger**: `onUpdate` on `/orders/{orderId}` when `status` changes.
- **States**: 
  - `preparing` (Yellow)
  - `out_for_delivery` (Blue)
  - `delivered` (Green)
  - `cancelled` (Red)
- **Action**: Provides real-time tracking links to the shopper.

### 2.3 Merchant Approval
- **Trigger**: Admin approval of a `PartnerWithUs` application.
- **Action**: Sends a "Welcome to Spendigo" kit with dashboard login instructions.

---

## 3. Template Management
While the v1.0 engine uses inline HTML generation within Cloud Functions for high-speed dynamic data (Order Lists), future expansion will utilize the **`email_templates`** Firestore collection for non-transactional marketing.

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
