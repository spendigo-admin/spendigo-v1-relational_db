# Verification: Order Routing Fix

We have implemented a dual-write mechanism to ensure that when a consumer places an order, it is correctly routed to the store's "inbox" and visible in the Merchant Portal.

## What Changed
-   **OrderContext**: Now writes new orders to `spendigo_store_orders_STOREID` (Merchant Inbox) in addition to `spendigo_orders_USERID` (Consumer History).
-   **Order Interface**: Added `customerName` to ensure merchants know who placed the order.
-   **MerchantOrders**: Updated to read from the live store inbox instead of static mock data.

## 1. Verify Consumer Flow (Simulated)
Since we are testing in a single browser, we can simulate a consumer placing an order.

1.  Open the App as a **Consumer** (or use the "Simulate Order" button if available in verified components).
2.  Add items to your cart from "FreshMart" (Store ID: 1).
3.  Proceed to Checkout and **Place Order**.
4.  Verify the order appears in "My Orders".

## 2. Verify Merchant Flow
1.  **Logout** as Consumer.
2.  **Login** as the Merchant:
    -   **Email**: `owner@freshmart.ca` (or any account with `storeId: '1'`)
    -   **Role**: Merchant
3.  Navigate to the **Orders** tab.
4.  **Confirm**:
    -   [ ] The new order appears in the "New Orders" column (Kanban) or list.
    -   [ ] The customer name is displayed correctly.
    -   [ ] You can move the order status (Accept -> Ready -> Complete).

## 3. Verify Isolation
1.  Login as a different Store Owner (e.g., storeId: '2').
2.  Confirm the order from Store 1 **does NOT** appear in Store 2's portal.

## Automated Verification (Console)
You can also run this snippet in your browser console to verify the data is being saved:

```javascript
// Check Store 1's Inbox
JSON.parse(localStorage.getItem('spendigo_store_orders_1'))
```
