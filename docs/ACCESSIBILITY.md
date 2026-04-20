# Accessibility Compliance Statement (WCAG 2.1 AA)

**Last Updated**: 2026-04-20
**Status**: Production-Ready (v1.0)
**Standard**: WCAG 2.1 Level AA

---

## 1. Professional Commitment
Spendigo is dedicated to providing an inclusive marketplace for all Canadians. Our platform is engineered with a **"Common Interface, Diverse Access"** philosophy, ensuring that shoppers, merchants, and administrators can navigate the platform regardless of their assistive technology.

---

## 2. Technical Implementation

### 2.1 Color & Contrast (v1.0 Retail Design)
Following our v1.0 brand refresh, we have optimized our semantic color palette for maximum readability:
- **Primary Canvas**: Pure White (`#FFFFFF`) / Dark Slate (`hsl(222, 47%, 11%)`).
- **Brand Primary**: Cobalt Blue (`hsl(221, 83%, 53%)`) used for interactive leads.
- **Brand Success**: Emerald Green (`hsl(142, 71%, 45%)`) used for savings and confirmations.
- **Contrast Ratios**: All text-to-background combinations maintain a minimum **4.5:1 ratio**, with primary body text exceeding **7:1** for AAA-tier clarity.

### 2.2 Semantic Navigation
- **Structure**: Uses standard HTML5 `<header>`, `<main>`, `<nav>`, and `<section>` landmarks to enable fast keyboard navigation via "Skip to Content" links.
- **Headings**: Logical `<h1>` through `<h5>` hierarchy is strictly enforced across the SmartCart Optimizer and Merchant Dashboards.
- **ARIA Live Regions**: The `NotificationContext` utilizes `aria-live="polite"` to announce status changes (e.g., "Item Added to Cart") to screen readers without interrupting the user's flow.

### 2.3 Interaction Model
- **Keyboard Optimization**: High-visibility **Black-Highlight** hover effects and focused outlines allow for 100% keyboard-only operation of the marketplace.
- **Touch Targets**: Mobile components within the Capacitor native shell maintain a minimum **44x44px** hit area to accommodate mobility-impaired users.
- **Haptic Feedback**: Subtle vibration cues (via Capacitor Haptics) provide non-visual confirmation for critical actions on mobile devices.

### 2.4 Data Transparency (Forensic Audit)
The **Forensic Audit Ledger** is presented via a standard, accessible data table, allowing assistive technologies to navigate complex cryptographic hash chains and event metadata predictably.

---

## 3. Assistive Technology Testing
Spendigo is validated against:
- **VoiceOver** (Apple macOS/iOS)
- **TalkBack** (Android)
- **Lighthouse Accessibility Audit** (Goal: 95+ score)
- **WAVE** (Web Accessibility Evaluation Tool)

---

## 4. Known Improvements
- **Interactive Maps**: While store lists are fully accessible, the Leaflet-based Map view is best experienced via the "List View" alternative for screen reader users.
- **Complex Charts**: Merchant analytics charts offer a "Download Data" (CSV) fallback to ensure numerical transparency.

---

## 5. Contact & Support
If you encounter any accessibility barriers, please contact our team:
- **Email**: accessibility@spendigo.ca
- **Portal**: High-priority support is available to all users via the Help Center.
