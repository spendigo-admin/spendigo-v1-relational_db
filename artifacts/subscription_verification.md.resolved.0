# Subscription Model Pivot Verification Walkthrough

This walkthrough outlines the steps to verify the new Store Subscription Model and functionality.

## Prerequisites
- Server running (`npm run dev` in `apps/web`).
- Logged in as a Merchant (Start with `quick@pick.com` which is set to **Free** Tier).

## Verification Steps

### 1. Feature Gating (Free Tier)
- **Action**: Log in as `quick@pick.com` (password: any).
- **Action**: specific navigate to **Settings** -> **Operations** tab.
- **Check**: Verify the "Delivery Configuration" section is **LOCKED** (grayed out).
- **Check**: Verify an orange "Premium Feature" banner appears with an upgrade link.

### 2. Subscription Management
- **Action**: Click **"Billing & Plan"** in the sidebar (or the upgrade link).
- **Check**: Verify the Subscription Page loads showing 3 tiers.
- **Check**: Verify "Starter" is marked as "Current Plan".
- **Action**: Click **"Switch Plan"** on the **Core Store** ($49) card.
- **Check**: Verify the button changes to "Current Plan" (simulating instant upgrade).

### 3. Feature Unlock (Core Tier)
- **Action**: Go back to **Settings** -> **Operations**.
- **Check**: Verify "Delivery Configuration" is now **UNLOCKED** and editable.
- **Check**: Verify the orange banner is gone.

### 4. Consumer Checkout Flow
- **Action**: Log out and log in as a consumer (or use incognito).
- **Action**: Add items to cart and proceed to **Checkout**.
- **Check**: Verify **NO CARD INPUT** is visible.
- **Check**: Verify Payment Method is locked to "**Pay at Store / On Delivery**".
- **Check**: Verify the Legal Notice at the bottom ("Spendigo is a marketplace facilitator...").
