# Email System Setup Guide (Firebase Extension)

**Last Updated**: 2025-12-30

---

## Overview

We are using the **Trigger Email** Firebase Extension (`firebase/firestore-send-email`). This allows us to send emails simply by writing to the `mail` collection in Firestore.

**Why this is better:**
- No API keys in your code
- Handles email delivery automatically
- Official Google/Firebase solution

---

## ✅ Frontend Changes (Complete)

1. ✅ **Registration Flow**: Sends verification email
2. ✅ **VerifyEmail Page**: Created with auto-refresh
3. ✅ **Routes**: Added /verify-email route

---

## 🔧 Setup Required

### Step 1: Install the Extension

1. Go to the **Firebase Console**:
   - [Extensions Marketplace](https://console.firebase.google.com/project/spendigo-8540c/extensions)

2. Search for **"Trigger Email"** (published by Firebase).
   - Click **Install**.

3. **Configure the Extension**:
   - **Cloud Functions location**: `us-central1` (or match your other functions)
   - **SMTP Connection URI**:
     - *If using Gmail*: `smtps://your-email@gmail.com:YOUR_APP_PASSWORD@smtp.gmail.com:465` (See Note below about App Passwords)
     - *If using other provider*: Get the SMTP string from them.
   - **Email documents collection**: `mail` (Default)
   - **Default FROM address**: `orders@spendigo.ca` (or your email)
   - **Default REPLY-TO address**: `support@spendigo.ca`

   **NOTE about Gmail:**
   - You **cannot** use your regular password.
   - You must enable **2-Step Verification** on your Google Account.
   - Then generate an **App Password**: [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   - Use that 16-character code in the connection URI.

### Step 2: Deploy Updated Functions

We updated the cloud functions to write to the `mail` collection instead of calling SendGrid directly.

```bash
npm run build
firebase deploy --only functions
```

---

## 🧪 Testing

### Test Email Verification:

1. Register a new account
2. Check inbox for verification link

### Test Order Emails:

Manually create a test order in Firestore (or place one in the app):

```javascript
// In Firebase Console -> Firestore -> 'orders' collection -> Add Document
{
  customerEmail: "your@email.com",
  customerName: "Test User",
  storeName: "Test Store",
  date: "2023-12-30T10:00:00Z",
  status: "placed",
  total: 10.00,
  items: [
    { name: "Test Item", quantity: 1, price: 10.00 }
  ]
}
```

Wait a few seconds, look at the **`mail`** collection in Firestore.
- You should see a new document created by our Cloud Function.
- The extension will pick it up and update it with a `delivery` status field (e.g. `state: "SUCCESS"`).

---

## 📧 Email Features

### Order Confirmation:
- Triggered when a new order is created
- Cloud Function creates a document in `mail`
- Extension sends the email

### Status Updates:
- Triggered when order status changes (e.g., `preparing` -> `out_for_delivery`)
- Cloud Function creates a document in `mail`
- Extension sends the email

---

## � Troubleshooting

### Email not sending?

1. **Check Firestore `mail` collection**:
   - Is a document created there?
     - **No?** Issue with Cloud Function (check logs).
     - **Yes?** Check the `delivery` field on that document.
       - If `state: "ERROR"`, read the `error` field to see why (usually SMTP auth fail).

2. **Check Extension Logs**:
   - Go to Extensions tab in Firebase Console -> Trigger Email -> Logs.

### "Auth Error" with Gmail?
- Ensure you used an **App Password**, not your normal password.
- Ensure the connection URI format is correct: `smtps://user:pass@host:465`

---

**Ready to deploy?** Just install the extension and run `firebase deploy --only functions`! �
