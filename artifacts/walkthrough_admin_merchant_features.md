# Walkthrough: Admin Store & Merchant Team Management

This document details the enhancements made to the Admin Store Management panel and the Merchant Team settings, focusing on data accuracy, multi-owner support, and robust team management flows.

## 1. Admin Store Management Enhancements

The **[StoreManagement.tsx](/apps/web/src/pages/admin/StoreManagement.tsx)** page has been significantly upgraded to resolve data mismatches and improve visibility.

### Key Features:

*   **Real-time Subscription Status**:
    *   A new "Subscription" column now displays the live **Tier** (Free, Core, Growth), **Status** (Active, Expired), and **Expiration Date**.
    *   Data is fetched via a client-side join with the `users` collection, allowing us to see the subscription status of the store owner associated with the store.

*   **Multi-Owner Handling**:
    *   The system now correctly identifies stores with multiple associated users (e.g., "Mac's Corner").
    *   **Display Logic**: Currently prioritizes displaying the user with the `merchantRole: 'OWNER'`. If multiple owners exist, it attempts to match the store's contact email or defaults to the first owner found.

*   **Email Sync & Mismatch Resolution**:
    *   **Mismatch Detection**: If `store.merchantEmail` (static record) differs from the actual `user.email` (auth record) of the detected owner, a **"Mismatch"** warning is displayed.
    *   **Sync Button**: A "Sync" button allows Admins to one-click update the Store record to match the Owner's email, ensuring consistency across the platform.

## 2. Merchant Team Management

The **[Settings.tsx](/apps/web/src/pages/merchant/Settings.tsx)** (Team Tab) has been refactored to specific real-time database interactions.

### Key Features:

*   **Real-Time Team List**:
    *   The team list no longer relies on static arrays in the Store document.
    *   It now queries the `users` collection directly (`where storeId == currentStoreId`), ensuring that **everyone** who has access is actually listed.

*   **Status Visibility**:
    *   **Active**: Users who have logged in. Displays their "Last Login" date.
    *   **Pending Invite**: Users who have been invited via Cloud Function but have not yet logged in.

*   **Invite Flow**:
    *   Uses the `inviteTeamMember` Cloud Function to create a pre-verified Auth account and a Firestore user document with `status: pending_invite`.
    *   **Auto-Activation**: When the invited user logs in for the first time, `AuthContext` automatically updates their status to `active`.

*   **Remove Member**:
    *   A new **Remove** button (visible to Owners) calls the secure `removeTeamMember` Cloud Function.
    *   This unlinks the user from the store, revokes `merchant` role permissions, and reverts them to a `consumer` role immediately.

## 3. Data Integrity & Security

### Security Rules
*   **Listing Permission**: Updated `firestore.rules` to explicitly allow Merchants to `list` users **if and only if** those users belong to the same `storeId`. This enables the Team page to function without compromising data isolation.

### Data Fixes (Mac's Corner)
*   Resolved a split-brain issue where `macs.owner` and `macscorner.owner` were linked to different (or missing) store IDs.
*   Ran administrative scripts to align both users to Store ID `5`, ensuring they share the same dashboard and team view.
