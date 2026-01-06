---
description: Implement Merchant Stripe Integration (Frontend)
---

# Stripe Integration (Merchant Payouts)

Enable merchants to connect their Stripe accounts to receive payouts.

## 1. Update Store Schema
- [ ] Add `stripeAccountId` (string) and `stripeOnboardingStatus` (string) to `stores` collection.
- [ ] Update `useMarketplace` or `useStore` to expose these fields.

## 2. Create Payment Settings UI
- [ ] Add "Payments" tab to `MerchantSettings.tsx` (or new page).
- [ ] **State: Not Connected**: Show "Connect with Stripe" button.
- [ ] **State: Connected**: Show "Stripe Account Connected" with ID (masked) and "View Dashboard" button.

## 3. Mock Onboarding Flow
- [ ] Since we lack a live backend/Stripe keys, simulate the OAuth flow:
    - [ ] Button Click -> Simulates API call -> Updates Store Doc with `stripeAccountId`.
    - [ ] Show success notification.

## 4. Consumer Checkout Update (Preparation)
- [ ] Ensure Checkout page checks if the store has a connected Stripe account.
- [ ] If not connected, show warning (or disable checkout).
