# Firebase Migration Guide

Complete guide to migrate Spendigo to a new Firebase instance with Cloud Functions enabled.

## Prerequisites

✅ New Firebase project created with Blaze plan enabled  
✅ Firebase config obtained from new project  
✅ `tsx` installed globally: `npm install -g tsx`

---

## Step 1: Update Environment Variables

Edit `apps/web/.env.local` with your **new** Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your-new-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-new-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-new-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-new-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-new-sender-id
VITE_FIREBASE_APP_ID=your-new-app-id
```

**Where to find these**:
1. Go to Firebase Console → Project Settings → General
2. Scroll to "Your apps" → Web app
3. Copy the config values

---

## Step 2: Update Firebase CLI Project

Link your local project to the new Firebase instance:

```bash
cd /Users/shahbaz/Documents/Spendigo
firebase use --add
# Select your new project
# Enter alias: production
```

Or set as default:
```bash
firebase use your-new-project-id
```

---

## Step 3: Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

This deploys your security rules to the new instance.

---

## Step 4: Run Seed Script

```bash
# Load environment variables and run seed
cd /Users/shahbaz/Documents/Spendigo
npx tsx scripts/seedFirebase.ts
```

**What this creates**:

**Users** (11 total):
- `admin@spendigo.ca` - Super Admin
- `freshmart.owner@spendigo.ca` - Merchant Owner (Store 1)
- `freshmart.manager@spendigo.ca` - Merchant Manager (Store 1)
- `freshmart.staff@spendigo.ca` - Merchant Staff (Store 1)
- `quickpick.owner@spendigo.ca` - Merchant Owner (Store 2)
- `metro.owner@spendigo.ca` - Merchant Owner (Store 3)
- `shopper@example.com` - Consumer
- `family@spendigo.ca` - Consumer
- `student@spendigo.ca` - Consumer
- `chef@spendigo.ca` - Consumer
- `al_sb@outpacexct.com` - Your account (Consumer)

**All accounts password**: `Spendigo123!`

**Stores** (5 stores):
- FreshMart (with 3 team members)
- QuickPick
- Metro Express
- Costco Business
- Mac's Corner

**Collections created**:
- `/users` - User accounts with roles
- `/stores` - Store data with team info
- `/orders` - Sample order
- `/settings/platform` - Platform settings
- `/auditLogs` - Initial audit log

---

## Step 5: Deploy Cloud Functions

```bash
cd services/api
npm install
npm run build
cd ../..
firebase deploy --only functions
```

**Expected output**:
```
✔  functions[inviteTeamMember] Successful create operation
```

---

## Step 6: Verify Migration

### Test Admin Access
1. Open https://localhost:444/login
2. Login: `admin@spendigo.ca` / `Spendigo123!`
3. Should redirect to `/admin/dashboard`
4. Verify: 5 stores appear in Platform Activity

### Test Merchant Access
1. Login: `freshmart.owner@spendigo.ca` / `Spendigo123!`
2. Should redirect to `/merchant/dashboard`
3. Go to Settings → Team
4. Verify: 3 team members listed

### Test Team Invitation (NEW FEATURE!)
1. As merchant owner, go to Settings → Team
2. Click "+ Add Member"
3. Invite: `test.staff@example.com` with role "Staff"
4. Should show temp password
5. Logout and login with new credentials
6. Should work! ✅

### Test Consumer Access
1. Login: `shopper@example.com` / `Spendigo123!`
2. Should redirect to `/` (consumer home)
3. Browse stores

---

## Step 7: Update Product Data (Optional)

The seed script creates users and stores but **not products/flyers** (those are in `/apps/web/src/data/productData.ts` as mock data).

If you want real product data in Firestore, you can:
1. Keep using mock data (current setup)
2. Create a separate seed script to import products
3. Manually add products via merchant dashboard

---

## Rollback Plan

If anything goes wrong:

1. **Switch back to old Firebase**:
   ```bash
   # Revert .env.local to old config
   firebase use old-project-id
   ```

2. **Old data is untouched** - Your original Firebase instance remains unchanged

---

## Post-Migration Checklist

- [ ] All test logins work (admin, merchant, consumer)
- [ ] Stores appear in admin dashboard
- [ ] Merchant can view their team
- [ ] Team invitation creates Firebase Auth accounts
- [ ] Invited users can log in
- [ ] Cloud Functions deployed and accessible
- [ ] Firestore rules deployed
- [ ] No console errors

---

## Collections Schema Reference

### `/users/{userId}`
```typescript
{
  email: string
  name: string
  role: 'admin' | 'merchant' | 'consumer'
  
  // Admin only
  adminRole?: 'SUPER_ADMIN' | 'SUPPORT' | 'MODERATOR' | 'AUDITOR'
  
  // Merchant only
  merchantRole?: 'OWNER' | 'MANAGER' | 'STAFF' | 'MARKETING'
  storeId?: string
  
  createdAt: string
  updatedAt: string
}
```

### `/stores/{storeId}`
```typescript
{
  id: string
  name: string
  logo: string
  status: 'active' | 'suspended' | 'pending'
  subscriptionTier: 'free' | 'core' | 'growth'
  rating: number
  team: Array<{
    id: string
    name: string
    email: string
    role: 'OWNER' | 'MANAGER' | 'STAFF' | 'MARKETING'
    lastActive: string
  }>
  createdAt: string
  updatedAt: string
}
```

### `/settings/platform`
```typescript
{
  maintenanceMode: boolean
  maintenanceMessage: string
  maintenanceRequest: {
    requesterId: string
    requesterName: string
    targetState: boolean
    timestamp: number
  } | null
}
```

### `/orders/{orderId}`
```typescript
{
  id: string
  userId: string
  userEmail: string
  storeId: string
  storeName: string
  items: Array<{
    id: string
    name: string
    price: number
    quantity: number
    image: string
  }>
  subtotal: number
  tax: number
  total: number
  status: 'placed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled'
  date: string
  deliveryAddress: {
    street: string
    city: string
    province: string
    postalCode: string
  }
}
```

---

## Troubleshooting

**Seed script fails with "permission denied"**:
- Check Firebase console Authentication settings
- Ensure email/password sign-in is enabled

**Functions deployment fails**:
- Ensure Blaze plan is enabled
- Check billing is set up
- Run `firebase login` to re-authenticate

**Can't login after migration**:
- Verify .env.local has correct new Firebase config
- Clear browser cache/cookies
- Check Firebase Console → Authentication for user existence

---

## Cost Monitoring

Monitor your new Firebase instance costs:
- Firebase Console → Usage and billing
- Set budget alerts for safety
- Expected cost: $0/month for development usage (free tier)
