# Payment Strategy Verification Walkthrough

This walkthrough outlines the steps to verify the new "Direct-to-Merchant" payment implementation.

## Prerequisites
- Server running (`npm run dev` in `apps/web`).
- Ensure you have items in your cart.

## Verification Steps

### 1. Consumer Checkout
- **Action**: Go to your Cart and proceed to Checkout.
- **Check**: Verify the "Service Fee" line item is **GONE** from the summary.
- **Check**: Observe the new "Payment Method" section.
    - [ ] Select **Pay at Store / Door**.
        - Verify text: "Pay directly to the merchant... Save on card fees!"
    - [ ] Select **Pay Online Now**.
        - Verify text: "Secure payment processed... via Stripe."
- **Action**: Select "Pay at Store" and click "Place Order".
- **Check**: Verify success screen says "Please pay directly at the store".

### 2. Merchant Order View
- **Action**: Switch to the Merchant Portal (`/merchant/orders`) for the store you ordered from.
- **Check**: Find your new order in the "Placed" column (Kanban) or List.
- **Kanban View Check**:
    - [ ] Verify the card shows an orange **"Pay Pending"** badge.
    - [ ] Verify the total amount matches the checkout total.
- **List View Check**:
    - [ ] Verify the "Payment" column (or status area) shows **"Pay at Store"** with a cash icon.
    - [ ] Verify the "Collect Payment" badge appears if status is pending.

### 3. Online Payment Flow (Mock)
- **Action**: Place another order, but select **Pay Online Now**.
- **Action**: Click "Pay & Place Order" (wait for mock processing).
- **Check**: Success screen says "Your payment has been processed".
- **Merchant View**:
    - [ ] Verify order shows a green **"Paid"** badge.
    - [ ] Verify List View shows **"Paid Online"** with a card icon.
