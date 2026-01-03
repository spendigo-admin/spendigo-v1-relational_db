# Task: Mobile Expansion & System Cleanup

## 1. Cleanup & Linting
- [x] Resolve "Unknown at rule @tailwind" lint warnings in `design-system.css`
- [x] Verify no other build or lint errors exist

## 2. Mobile Expansion (Capacitor)
- [ ] Check Firebase environment variables configuration for native platforms
- [ ] Run `npx cap sync` and verify assets are correctly applied
- [ ] Attempt CocoaPods installation and sync for iOS (if possible)

## 3. Product & Cart Fixes
- [x] Investigate and fix broken image icons in `SmartCartWishlist.tsx`
- [x] Resolve broken image links in `SmartCartWishlist` component
- [x] **SmartCart Layout & Savings Refactor**
    - [x] Implement responsive side-by-side grid layout
    - [x] Fix sticky summary card
    - [x] Update savings calculation to use real price comparisons
    - [x] Fix optimizer selection bug (cheapest store logic)
- [x] **Product Search**
    - [x] Enable Header Search Bar
    - [x] Implement Search Page with dynamic data
- [x] Audit `StoreDetail.tsx` and other data files for broken image URLs (Refactored `ProductDetail.tsx` to use real data)

## 4. System Admin Dashboard
- [x] Implement System Admin Dashboard (`/admin`)
- [x] Extend System Admin Dashboard
    - [x] Implement Audit Logs route
    - [x] Implement Flyer Moderation routed (`/admin`)
    - [x] Implement Store Management (`/admin/stores`)
        - [x] **New:** Subscription Status Sync & Email One-Click Fix
    - [x] Implement Admin Settings (`/admin/settings`)
- [x] **Merchant Team Management**
    - [x] Real-time Team List (Active/Pending)
    - [x] Secure "Remove Member" Function
    - [x] Auto-activation on Login
- [x] Add basic stats, user management, and store management views
- [x] Add navigation to Admin Dashboard in the footer or profile menu

## 5. Verification
- [ ] Run `npm run build` to ensure no regressions
- [ ] Verify UI on mobile-simulated views (browser)
- [ ] Verify Admin Dashboard functionality

## 6. Architectural Review & Remediation
- [x] **Data Isolation (RBAC & Multi-Tenancy)**
    - [x] Isolate `CartContext` (User-specific storage)
    - [x] Isolate `NotificationContext` (User-specific storage)
    - [x] Isolate `WishlistContext` (User-specific storage)
- [ ] **Mobile & Performance Polish**
    - [x] Verify `capacitor.config.ts` settings applied correctly
- [ ] Ensure all mock data is dynamic/reloadable

## 7. Order Routing Fix (Consumer -> Merchant)
- [x] **Dual-Write Architecture (OrderContext)**
    - [x] Update `addOrder` to write to `spendigo_store_orders_STOREID` in addition to user history.
- [x] **Merchant Portal Integration**
    - [x] Update `MerchantOrders` to read from `spendigo_store_orders_STOREID`.
- [x] **Merchant Portal Integration**
    - [x] Update `MerchantOrders` to read from `spendigo_store_orders_STOREID`.
    - [x] Unify `Order` TypeScript interfaces between context and page.

## 8. Merchant Analytics
- [x] **Revenue & Order Tracking**
    - [x] Implement `calculateRevenueStats` utility.
    - [x] Update `MerchantDashboard` to display real Daily/Weekly/Monthly stats.
    - [x] Add time-period selector.

