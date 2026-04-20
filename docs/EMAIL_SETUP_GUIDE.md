# Email System Setup Guide (Firebase Extension)

**Last Updated**: 2026-04-20
**Status**: Production-Ready (v1.0)
**Collection**: `mail`

---

## 1. Overview
Spendigo utilizes the **Trigger Email** Firebase Extension (`firebase/firestore-send-email`) for all transactional communications. This architecture ensures high deliverability, a persistent audit trail of sent messages, and complete decoupling of business logic from the SMTP gateway.

### Core Benefits:
- **Scalability**: Handles thousands of parallel order confirmations.
- **Security**: SMTP credentials reside exclusively in the Firebase Secrets Manager.
- **Auditability**: Every email sent exists as a document in Firestore, providing a permanent record of shopper communications.

---

## 2. Infrastructure Setup (SendGrid Production)
While Gmail can be used for testing, Spendigo v1.0 requires a professional SMTP service like **SendGrid** for high inbox placement and SPF/DKIM compliance.

### Step 1: Install & Configure Extension
1. Install the extension via the [Firebase Marketplace](https://console.firebase.google.com/project/_/extensions).
2. **SMTP Connection URI**: `smtps://apikey:YOUR_SENDGRID_API_KEY@smtp.sendgrid.net:465`
3. **Email collection**: `mail`
4. **Default FROM**: `Spendigo <noreply@spendigo.ca>`
5. **Default REPLY-TO**: `support@spendigo.ca`

---

## 3. Integrated Production Workflows

### 3.1 Order Confirmation
- **Trigger**: New order creation in `/orders`.
- **Design**: Rich HTML table showing items, pricing, and "Track Order" call-to-action.
- **Audit**: Every confirmation is linked to a `txnId` in the Forensic Audit ledger.

### 3.2 Status Progress alerts
- **Trigger**: Merchant updates order from `placed` -> `preparing` -> `out_for_delivery`.
- **States**: Color-coded badges in the email body match the Spendigo retail design system.

### 3.3 Merchant Onboarding
- **Trigger**: Admin approval of a `PartnerWithUs` application.
- **Action**: Dynamically generates a "Welcome to Spendigo" email with first-time dashboard setup instructions.

---

## 4. Verification & Testing

### Test Email Verification (Authentication)
Registration via the Client SDK triggers the standard Firebase Auth verification flow. Ensure the **Action URL** in Firebase Authentication settings points to `https://spendigo.ca/__/auth/action`.

### Transactional Testing (Admin Dashboard)
1. Navigate to **Admin -> Settings -> System Management**.
2. Trigger the **📨 Send Test Email** function.
3. Observe the `mail` collection:
   - `delivery.state: "PENDING"` -> Extension is picking it up.
   - `delivery.state: "SUCCESS"` -> Email transmitted to SMTP gateway.
   - `delivery.state: "ERROR"` -> Check `delivery.error` for credentials or DNS blocks.

---

## 5. Deliverability Checklist (DNS)
To prevent your emails from being flagged as spam by Google/Microsoft, the following records must be active on `spendigo.ca`:

| Record Type | Host | Value |
| :--- | :--- | :--- |
| **SPF** | `@` | `v=spf1 include:sendgrid.net ~all` |
| **DKIM** | `s1._domainkey` | (As provided in SendGrid dashboard) |
| **DMARC** | `_dmarc` | `v=DMARC1; p=quarantine;` |

---

## 6. Troubleshooting
- **No document in `mail`?**: Check Cloud Functions logs for trigger failure on `onCreate` / `onUpdate`.
- **Authentication Error?**: Verify the SendGrid API key hasn't expired and the SMTP URI string is correctly formatted (URL-encode special characters if necessary).
- **CSS Issues?**: Remember that email clients (especially Outlook) require inline CSS. All Spendigo templates use the `sendOrderEmails.ts` inline-styling engine for maximum compatibility.
