# Email Notifications & Verification System

**Last Updated**: 2025-12-30  
**Status**: Implementation Guide

---

## Overview

This document outlines the email notification system for Spendigo, including:
- **Email Verification** for new user registration
- **Order Status Updates** via email
- **Transactional Emails** (receipts, shipping notifications, etc.)

---

## Table of Contents

1. [Email Verification (Firebase Auth)](#email-verification)
2. [Transactional Emails (SendGrid/Firebase Extensions)](#transactional-emails)
3. [Implementation Steps](#implementation-steps)
4. [Email Templates](#email-templates)
5. [Testing](#testing)

---

## Email Verification

### Current State
- Users can register with email/password
- No email verification required
- Users can immediately access the platform

### Required Changes

#### 1. Enable Email Verification in Firebase Auth

**Firebase Console:**
1. Go to: https://console.firebase.google.com/project/spendigo-8540c/authentication/settings
2. Enable **Email Link Sign-in** (optional, better UX)
3. Configure **Email Templates**:
   - Click "Templates" tab
   - Customize "Email address verification"
   - Set sender name: "Spendigo"
   - Customize the email template

#### 2. Update Registration Flow

**File**: `apps/web/src/context/AuthContext.tsx`

Add email verification after registration:

```typescript
import { sendEmailVerification } from 'firebase/auth';

const register = async (userData: Partial<User> & { password: string }): Promise<boolean> => {
    try {
        const userCredential = await createUserWithEmailAndPassword(
            auth, 
            userData.email!, 
            userData.password
        );
        const uid = userCredential.user.uid;

        // Send verification email
        await sendEmailVerification(userCredential.user, {
            url: `${window.location.origin}/verify-email?verified=true`,
            handleCodeInApp: false,
        });

        // Create User Profile
        const newUser: any = {
            id: uid,
            email: userData.email!,
            name: userData.name || 'New User',
            role: userData.role || 'consumer',
            emailVerified: false, // Add this field
        };

        // Add merchant fields if needed
        if (userData.role === 'merchant') {
            newUser.merchantRole = 'OWNER';
            newUser.subscriptionTier = 'free';
            if (userData.storeName) newUser.storeName = userData.storeName;
        }

        await setDoc(doc(db, 'users', uid), newUser);
        
        // Show success message
        alert('✅ Registration successful! Please check your email to verify your account.');
        
        return true;
    } catch (error: any) {
        console.error('Registration failed:', error);
        alert(`Registration failed: ${error.message}`);
        return false;
    }
};
```

#### 3. Add Email Verification Gate

**New File**: `apps/web/src/pages/consumer/VerifyEmail.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../../lib/firebase';

const VerifyEmail: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [resending, setResending] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        // Refresh user to check if email is verified
        const checkVerification = setInterval(async () => {
            await auth.currentUser?.reload();
            if (auth.currentUser?.emailVerified) {
                navigate('/');
            }
        }, 3000);

        return () => clearInterval(checkVerification);
    }, [navigate]);

    const handleResend = async () => {
        if (!auth.currentUser) return;
        
        setResending(true);
        try {
            await sendEmailVerification(auth.currentUser);
            setMessage('✅ Verification email sent! Check your inbox.');
        } catch (error: any) {
            setMessage(`❌ Error: ${error.message}`);
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--surface-0)]">
            <div className="glass-panel max-w-md w-full p-8 text-center">
                <div className="text-6xl mb-4">📧</div>
                <h1 className="text-2xl font-bold mb-2 text-[var(--text-main)]">
                    Verify Your Email
                </h1>
                <p className="text-[var(--text-muted)] mb-6">
                    We've sent a verification link to <strong>{user?.email}</strong>
                </p>
                <p className="text-sm text-[var(--text-muted)] mb-6">
                    Click the link in the email to verify your account. This page will automatically
                    refresh once you're verified.
                </p>
                
                {message && (
                    <div className="mb-4 p-3 rounded-lg bg-blue-50 text-blue-800 text-sm">
                        {message}
                    </div>
                )}

                <button
                    onClick={handleResend}
                    disabled={resending}
                    className="w-full py-3 mb-3 bg-[var(--brand-primary)] text-white rounded-lg font-medium disabled:opacity-50"
                >
                    {resending ? 'Sending...' : 'Resend Verification Email'}
                </button>

                <button
                    onClick={logout}
                    className="w-full py-3 border border-[var(--glass-border)] rounded-lg text-[var(--text-muted)]"
                >
                    Sign Out
                </button>
            </div>
        </div>
    );
};

export default VerifyEmail;
```

#### 4. Add Route Protection

Update `App.tsx` to redirect unverified users:

```typescript
// In AuthContext, check emailVerified
useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            // Check if email is verified
            if (!firebaseUser.emailVerified && firebaseUser.providerData[0]?.providerId === 'password') {
                // Email/password user who hasn't verified
                // Redirect to verification page
                window.location.href = '/verify-email';
                return;
            }
            
            // Continue normal flow...
        }
    });
    
    return unsubscribe;
}, []);
```

---

## Transactional Emails

### Option 1: Firebase Extensions (Recommended for MVP)

**Trigger Email Extension** - Sends emails via SendGrid, Mailgun, or SMTP

#### Installation Steps:

1. **Install Extension**:
```bash
firebase ext:install firebase/firestore-send-email
```

2. **Configure During Installation**:
   - SMTP Connection URI: Your email provider settings
   - Default FROM address: `noreply@spendigo.ca`
   - Default REPLY-TO address: `support@spendigo.ca`
   - Firestore collection: `mail`

3. **Send Emails via Firestore**:

```typescript
// Example: Send order confirmation
await addDoc(collection(db, 'mail'), {
    to: user.email,
    template: {
        name: 'orderConfirmation',
        data: {
            customerName: user.name,
            orderId: order.id,
            orderDate: order.date,
            items: order.items,
            total: order.total,
        },
    },
});
```

### Option 2: SendGrid (Production-Ready)

**Pros:**
- 100 free emails/day
- Professional email templates
- Analytics & tracking
- Delivery monitoring

**Setup:**

1. **Sign up**: https://sendgrid.com/
2. **Create API Key**
3. **Add to Firebase Functions config**:

```bash
firebase functions:config:set sendgrid.api_key="YOUR_SENDGRID_API_KEY"
```

4. **Create Cloud Function**:

**File**: `services/api/src/email/sendOrderConfirmation.ts`

```typescript
import * as functions from 'firebase-functions';
import * as sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = functions.config().sendgrid.api_key;
sgMail.setApiKey(SENDGRID_API_KEY);

export const sendOrderConfirmation = functions.firestore
    .document('orders/{orderId}')
    .onCreate(async (snapshot, context) => {
        const order = snapshot.data();
        
        const msg = {
            to: order.customerEmail,
            from: 'orders@spendigo.ca',
            subject: `Order Confirmation - ${order.id}`,
            text: `Thank you for your order! Order ID: ${order.id}`,
            html: `
                <h1>Thank you for your order!</h1>
                <p>Order ID: <strong>${order.id}</strong></p>
                <p>Total: $${order.total.toFixed(2)}</p>
                <p>We'll send you another email when your order ships.</p>
            `,
        };
        
        try {
            await sgMail.send(msg);
            console.log('Order confirmation sent to', order.customerEmail);
        } catch (error) {
            console.error('Error sending email:', error);
        }
    });
```

5. **Deploy Function**:
```bash
firebase deploy --only functions:sendOrderConfirmation
```

---

## Email Templates

### 1. Order Confirmation

**Subject**: Your Spendigo Order #{orderId} is Confirmed!

**Content**:
```
Hi {customerName},

Thank you for shopping with {storeName}!

Order Details:
- Order ID: {orderId}
- Date: {orderDate}
- Total: ${total}

Items:
{itemsList}

Track your order: https://spendigo.ca/order/{orderId}

Need help? Reply to this email or contact support.

Best,
The Spendigo Team
```

### 2. Order Shipped

**Subject**: Your Order #{orderId} Has Shipped! 📦

### 3. Order Delivered

**Subject**: Your Order #{orderId} Has Been Delivered! ✅

### 4. Order Cancelled

**Subject**: Your Order #{orderId} Has Been Cancelled

---

## Implementation Steps

### Phase 1: Email Verification (Week 1)

- [ ] Update AuthContext with email verification
- [ ] Create VerifyEmail page
- [ ] Add route protection
- [ ] Update Firebase Auth templates
- [ ] Test with test accounts

### Phase 2: Order Notifications (Week 2)

- [ ] Choose email provider (SendGrid recommended)
- [ ] Create email templates
- [ ] Implement order confirmation emails
- [ ] Implement shipping notification emails
- [ ] Implement delivery confirmation emails

### Phase 3: Additional Notifications (Week 3)

- [ ] Password reset emails
- [ ] Team invitation emails (merchants)
- [ ] Promotional emails (optional)
- [ ] Newsletter system (optional)

---

## Testing

### Test Email Verification:

1. Register with a test email
2. Check inbox for verification email
3. Click verification link
4. Confirm redirect to verified state

### Test Order Emails:

```typescript
// Trigger test order
const testOrder = {
    id: 'TEST_' + Date.now(),
    customerEmail: 'test@example.com',
    customerName: 'Test User',
    items: [...],
    total: 99.99,
    status: 'placed',
};

await addDoc(collection(db, 'orders'), testOrder);
// Should trigger email
```

### Email Debugging:

```typescript
// Add to Cloud Function
console.log('Email sent:', {
    to: order.customerEmail,
    subject: msg.subject,
    status: 'success',
});
```

---

## Cost Estimates

### SendGrid (Recommended):
- **Free Tier**: 100 emails/day forever
- **Essentials**: $19.95/mo for 50,000 emails
- **Pro**: $89.95/mo for 100,000 emails

### Firebase Extensions:
- **Trigger Email**: Free extension
- **SMTP Provider**: Depends on provider (SendGrid, Mailgun, etc.)

### Estimated Monthly Cost (1,000 orders/month):
- Verification emails: ~100/month
- Order confirmations: ~1,000/month
- **Total**: ~1,100 emails/month (well within free tier)

---

## Security Considerations

1. **Email Rate Limiting**: Prevent spam by limiting verification email resends
2. **Unsubscribe Links**: Required for promotional emails
3. **DKIM/SPF**: Configure for better deliverability
4. **Bounce Handling**: Monitor and handle bounced emails
5. **Privacy**: Never include sensitive data in emails

---

## Next Steps

1. **Choose Path**:
   - Quick Start: Firebase Extension (easier)
   - Production: SendGrid (more control)

2. **Enable Email Verification**:
   - Update registration flow
   - Create verification page
   - Test with real email

3. **Implement Order Emails**:
   - Set up SendGrid account
   - Create templates
   - Deploy Cloud Functions

---

**Prepared By**: Shahbaz + AI Development Team  
**Status**: Ready for Implementation
