# Walkthrough: Consumer Registration Options

I have implemented the requested consumer registration options, allowing users to sign up using Google or Facebook in addition to the standard email flow.

## Changes

### 1. Updated Authentication Context
I extended the `AuthContext` to include mock SSO methods that simulate a successful login from third-party providers.

**Key Features:**
- `loginWithGoogle` and `loginWithFacebook` methods added.
- These methods automatically assign the `role: 'consumer'` to the new user.
- Mock user profiles are created with placeholder avatars.

### 2. Enhanced Registration UI
I updated the Consumer Registration page to include the new SSO options.

**Key Features:**
- **Dedicated Buttons:** Added "Sign up with Google" and "Sign up with Facebook" buttons.
- **Conditional Rendering:** These buttons ONLY appear when the "Shopper" (Consumer) role is selected. They are hidden for "Merchant" registration.
- **Visual Separation:** Added a clear "Or continue with email" divider.
- **Seamless Flow:** Clicking these buttons immediately logs the user in and redirects to the home page.

## Verification

I manually verified the following flows using a browser simulation:

1.  **Google Sign-Up:**
    *   Navigated to `/register`.
    *   Clicked "Sign up with Google".
    *   **Result:** Redirected to Home, User logged in as "Google User" (Consumer).

2.  **Facebook Sign-Up:**
    *   Navigated to `/register`.
    *   Clicked "Sign up with Facebook".
    *   **Result:** Redirected to Home, User logged in as "Facebook User" (Consumer).

3.  **Merchant Isolation:**
    *   Switched to "Merchant" tab.
    *   **Result:** SSO buttons disappeared, ensuring merchants follow the standard onboarding flow.

## Screenshots

*(See the attached browser recording for the full verification flow)*

## Next Steps
- This implementation uses **Mock Data**. To go to production, these methods in `AuthContext.tsx` need to be replaced with real Firebase/Supabase calls.
