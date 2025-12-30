# Email System Setup Instructions

**Last Updated**: 2025-12-30

---

## ✅ Frontend Changes (Complete)

1. ✅ **Registration Flow**: Sends verification email
2. ✅ **VerifyEmail Page**: Created with auto-refresh
3. ✅ **Routes**: Added /verify-email route

---

## 🔧 Backend Setup Required

### Step 1: Install SendGrid Package

```bash
cd services/api
npm install @sendgrid/mail
cd ../..
```

### Step 2: Get SendGrid API Key

1. **Sign up for SendGrid**:
   - Go to: https://signup.sendgrid.com/
   - Free plan: 100 emails/day forever

2. **Create API Key**:
   - Login to SendGrid Dashboard
   - Go to: Settings → API Keys
   - Click "Create API Key"
   - Name: `Spendigo Production`
   - Permissions: `Full Access`
   - **Copy the key** (starts with `SG.`)

3. **Add to Firebase**:
```bash
firebase functions:config:set sendgrid.api_key="SG.YOUR_API_KEY_HERE"
```

### Step 3: Verify Sender Email

SendGrid requires sender verification:

1. Go to: https://app.sendgrid.com/settings/sender_auth/senders
2. Click "Create New Sender"
3. Fill in:
   - **From Name**: Spendigo
   - **From Email**: orders@spendigo.ca (use your actual domain)
   - **Reply To**: support@spendigo.ca
   - Address: Your business address
4. Verify email (check inbox for verification link)

**Note**: If you don't have a custom domain, use a Gmail address temporarily:
- From Email: yourname+spendigo@gmail.com
- This works but looks less professional

### Step 4: Deploy Functions

```bash
npm run build
firebase deploy --only functions
```

Expected output:
```
✔ functions[sendOrderConfirmation(us-central1)] Successful create operation.
✔ functions[sendOrderStatusUpdate(us-central1)] Successful create operation.
```

---

## 🧪 Testing

### Test Email Verification:

1. Register a new account with your real email
2. Check inbox for verification email
3. Click link
4. Confirm you can access the platform

### Test Order Emails:

Option A: Place a real test order through the UI

Option B: Manually trigger via Firestore:

```typescript
// In Firebase Console → Firestore
// Add a test order document:
{
  id: "TEST_" + Date.now(),
  customerEmail: "your@email.com",
  customerName: "Test User",
  date: new Date().toISOString(),
  storeName: "Test Store",
  items: [
    {
      name: "Test Product",
      quantity: 2,
      price: 9.99
    }
  ],
  total: 19.98,
  status: "placed",
  deliveryAddress: "123 Test St, Toronto, ON M1M 1M1"
}
```

This will automatically trigger the email function!

---

## 📧 Email Features

### Verification Email:
- Sent immediately on registration
- Link expires after 1 hour (Firebase default)
- Can be resent with 60-second cooldown

### Order Confirmation:
- Sent when order is created
- Includes all order details
- Has "Track Order" button

### Status Updates:
- Sent when order status changes:
  - `preparing` → "Your order is being prepared"
  - `out_for_delivery` → "Your order is out for delivery"
  - `delivered` → "Your order has been delivered"
  - `cancelled` → "Your order has been cancelled"

---

## 🔐 Firebase Email Template Configuration

1. Go to: https://console.firebase.google.com/project/spendigo-8540c/authentication/emails
2. Click "Templates" tab
3. Customize "Email address verification":
   - **From name**: Spendigo
   - **Reply-to**: support@spendigo.ca
   - **Subject**: Verify your Spendigo account
   - **Body**: Customize the message

---

## 💰 Costs

### SendGrid Free Tier:
- 100 emails/day
- 40,000 emails first 30 days
- Forever free

### Upgrade if needed:
- Essentials: $19.95/mo (50K emails)
- Pro: $89.95/mo (100K emails)

### Estimated Usage:
- 10 sign-ups/day = 10 verification emails
- 20 orders/day = 20 order confirmations + 40 status updates
- **Total**: ~70 emails/day (well within free tier)

---

## 🐛 Troubleshooting

### Emails not sending?

**Check Cloud Function logs**:
```bash
firebase functions:log --only sendOrderConfirmation
```

**Common issues**:
1. SendGrid API key not set: Run `firebase functions:config:get`
2. Sender not verified: Check SendGrid dashboard
3. Email in spam: Add SPF/DKIM records in your domain

### Verification emails not arriving?

1. Check spam folder
2. Try with different email provider (Gmail, Outlook)
3. Check Firebase Auth settings

---

## 📝 Next Steps

1. **Install SendGrid package** (see Step 1)
2. **Get API key** (see Step 2)
3. **Deploy functions** (see Step 4)
4. **Test end-to-end**

---

## 🚀 Quick Start Commands

```bash
# 1. Install SendGrid
cd services/api && npm install @sendgrid/mail && cd ../..

# 2. Set API key (replace with your key)
firebase functions:config:set sendgrid.api_key="SG.YOUR_KEY"

# 3. Build and deploy
npm run build
firebase deploy --only functions

# 4. Test
# Register a new account and check email!
```

---

**Ready to deploy?** Run the commands above and you'll have a complete email system! 📧✅
