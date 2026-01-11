# Email Notifications & Verification System

**Last Updated**: 2026-01-11
**Status**: Active (Firebase Extension)

---

## Architecture Override: Trigger Email Extension

We use the **Firebase Trigger Email Extension** for all transactional emails.

### Architecture
1. **Cloud Functions** (`sendOrderEmails.ts`) detect order events.
2. Function **writes** an email object to the **`mail` collection** in Firestore.
3. **Trigger Email Extension** (running in background) watches `mail` collection.
4. Extension sends the email via configured SMTP (Gmail/Google Workspace).

### Why this approach?
- **Native Integration**: Uses official Firebase patterns.
- **Portability**: Code doesn't care which email provider is used (managed in Console).
- **Audit Trail**: All sent emails are stored in the `mail` collection as documents.

---

## 1. Email Verification (Auth)
*Handled by Client SDK + Firebase Auth*

- **Trigger**: User Registration
- **Mechanism**: `sendEmailVerification(user)` via Frontend SDK
- **Template**: Configured in Firebase Console -> Auth -> Templates

## 2. Transactional Emails (Firestore + Extension)

### 2.1 Order Confirmation
- **Trigger**: `orders/{id}` onCreate
- **Action**: Writes document to `mail`
- **Template**: HTML constructed in Cloud Function

### 2.2 Order Status Updates
- **Trigger**: `orders/{id}` onUpdate (status change)
- **Action**: Writes document to `mail`
- **Template**: HTML constructed in Cloud Function based on status

---

## Deployment

```bash
# 1. Install Extension in Console
# 2. Deploy Functions
npm run build
firebase deploy --only functions
```
