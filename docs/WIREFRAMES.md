# Spendigo SmartCart — UI Wireframes

## 1. Core User Flows

### 1.1 Guest Checkout Flow
*Optimized for speed and conversion.*
```mermaid
graph LR
    A[Cart/View] -->|Proceed to Checkout| B(Email Entry / Lookup)
    B -->|New User| C{Phone Verified?}
    B -->|Returning| D[Auth Challenge (MFA)]
    C -->|No| E[SMS OTP Entry]
    C -->|Yes| F[Delivery Address & Instructions]
    E --> F
    F --> G[Split Payment Review]
    G -->|Pay Now| H[Stripe Payment Sheet]
    H --> I[Order Confirmation]
```

### 1.2 Merchant Onboarding
*Stripe Connect Express Integration.*
```mermaid
graph TD
    Start[Landing Page] -->|Start Selling| SignUp[Create Account]
    SignUp --> Verify[Email Verification]
    Verify --> Profile[Store Profile Setup]
    Profile --> Connect[Link Bank Account (Stripe)]
    Connect -->|Redirect| Stripe[Stripe Hosted Onboarding]
    Stripe -->|Success| Dashboard[Merchant Dashboard]
    Stripe -->|Fail/Restricted| Support[Contact Support]
```

## 2. Key Screen Mockups (Descriptions)

### 2.1 Home / Store List
- **Header**: Glassmorphic sticky nav. Logo (Left), "Your Location" (Center), Cart icon with badge (Right).
- **Hero**: "Shop Local, Optimize Savings". Dynamic wavy gradient background.
- **Store Cards**:
  - Horizontal scroll container.
  - Card: Store Image (Top), Store Logo (Avatar overlap), Name (Bold), "0.5km away" (Subtext).
  - Badge: "Open" (Green dot).

### 2.2 Product Detail Page
- **Breadcrumbs**: Home > Store Name > Category > Item.
- **Image**: Large, square, swipeable gallery.
- **Info**:
  - Price (Huge font).
  - "**Sold by: [Store Legal Name]**" (Mandatory Disclosure - Regulatory).
  - Address: Clickable map link.
- **Actions**:
  - "Add to Cart" (Floating sticky button on mobile).
  - Quantity stepper.

### 2.3 Cart (SmartCart View)
- **Top Summary**: "Total: $45.50 (2 Stores)".
- **Grouped List**:
  - **Store A** (Header with Logo)
    - Item 1
    - Item 2
  - **Store B** (Header with Logo)
    - Item 3
- **Smart Optimizer Banner**: "You saved $4.20 by splitting this order!" (Green gradient background).
- **Checkout Button**: Fixed at bottom.

### 2.4 Checkout (Split Payment)
- **Order Summary Breakdown**:
  - Store A Subtotal: $20.00
  - Store B Subtotal: $25.50
  - Service Fee: $2.00
  - GST/HST: $5.91
- **Payment**:
  - Single "Pay $53.41" button.
  - Disclaimer: "Your statement will show separate charges for Store A and Store B." (Transparency).
