# Email Notifications & Verification System

**Last Updated**: 2026-01-12
**Status**: Active (Firebase Extension)

---

## Architecture Override: Trigger Email Extension

We use the **Firebase Trigger Email Extension** for all transactional emails.

### Architecture
1.  **Cloud Functions** (`sendOrderEmails.ts`) detect order events.
2.  Function **writes** an email object to the **`mail` collection** in Firestore.
3.  **Trigger Email Extension** (running in background) watches `mail` collection.
4.  Extension sends the email via configured SMTP (Gmail/Google Workspace).

### Why this approach?
-   **Native Integration**: Uses official Firebase patterns.
-   **Portability**: Code doesn't care which email provider is used (managed in Console).
-   **Audit Trail**: All sent emails are stored in the `mail` collection as documents.

---

## 1. Authentication Emails (Client SDK)
*These depend on Firebase Console > Authentication > Templates*

### 1.1 Email Verification
-   **Trigger**: User Registration (`auth.onAuthStateChanged`)
-   **Action**: Client calls `sendEmailVerification(user)`
-   **Template**: "Verify your email for Spendigo" (Console Configurable)

### 1.2 Password Reset
-   **Trigger**: User clicks "Forgot Password" on Login screen.
-   **Action**: Client calls `sendPasswordResetEmail(auth, email)`
-   **Template**: "Reset your password for Spendigo" (Console Configurable)

---

## 2. Transactional Emails (Firestore + Extension)

### 2.1 Order Confirmation
-   **Trigger**: `orders/{id}` -> `onCreate`
-   **Source**: `services/api/src/email/sendOrderEmails.ts`
-   **Action**: Writes document to `mail` collection.
-   **Content**: HTML Receipt with order summary and total.

### 2.2 Order Status Updates
-   **Trigger**: `orders/{id}` -> `onUpdate` (when `status` changes)
-   **Source**: `services/api/src/email/sendOrderEmails.ts`
-   **Action**: Writes document to `mail` collection.
-   **Supported Statuses**:
    *   `preparing` (Yellow 👨‍🍳)
    *   `out_for_delivery` (Blue 🚚)
    *   `delivered` (Green ✅)
    *   `cancelled` (Red ❌)

---

## 3. Staff & Management (Merchant)

### 3.1 Team Member Invitations
-   **Current Status**: **Manual / In-App Only**
-   **Mechanism**: The `inviteTeamMember` cloud function creates the user account with a temporary password.
-   **Gap**: Currently, **no automatic email is triggered**. The Merchant Manager must copy the temporary password and send it to the staff member manually (via Slack/SMS/Email).
-   **Future Enhancement**: Add a trigger to the `mail` collection upon user creation in `inviteTeamMember`.

---

## Deployment

```bash
# 1. Install Extension in Console
#    (Search for "Trigger Email")

# 2. Deploy Functions
npm run build
firebase deploy --only functions
```
