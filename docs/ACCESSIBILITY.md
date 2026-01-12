# Accessibility Compliance Statement (WCAG 2.1 AA)

**Project:** Spendigo SmartCart
**Target Standard:** WCAG 2.1 Level AA
**Last Updated:** January 2026

## 1. Compliance Summary
Spendigo is committed to ensuring digital accessibility for people with disabilities. We are continually improving the user experience for everyone and rigorously applying the relevant accessibility standards. Our platform is built with a "mobile-first, inclusive-first" design philosophy.

## 2. Technical Measurements

### Color Contrast & Visual Design
Our design system uses a high-contrast "Bright White & Blue" theme optimized for readability:

- **Text Main**: `hsl(210, 20%, 15%)` (Dark Grey) on **Background**: `hsl(0, 0%, 100%)` (Pure White).
  - **Ratio**: ~15:1 (Exceeds AAA requirements).
- **Brand Primary**: `hsl(212, 100%, 47%)` (Vibrant Blue). used for primary actions and focus states.
  - **Ratio**: ~3.5:1 against white (Passes AA for Large Text/UI Components). Note: We ensure text on primary buttons is White (`#FFFFFF`) which creates a decent ratio.
- **Brand Secondary**: `hsl(145, 63%, 42%)` (Emerald Green) used for success states and savings.

### Semantic HTML & Structure
- **Landmarks**: The application uses proper `<main>`, `<nav>`, `<header>`, and `<footer>` landmarks.
- **Headings**: A strict `h1` through `h6` hierarchy is enforced. The SmartCart Optimizer uses clear `h2` and `h3` tags for item grouping.
- **Interactive Elements**: All custom controls (like the Trip Optimizer cards and Wishlist items) use standard HTML5 `<button>` tags to ensure native keyboard focusability.

### Keyboard Navigation & Focus Management
- **Focus Indicators**: A custom, high-visibility focus ring (`outline: 2px solid var(--brand-primary)`) is applied globally to all interactive elements via `:focus-visible`.
- **SmartCart Optimizer**:
  - Users can navigate the entire wishlist using `Tab` and `Shift+Tab`.
  - "Add Item" inputs and "Remove" buttons are keyboard accessible.
  - The "Smart Insights" panel is readable by screen readers.
  - Quick Add chips/tags are implemented as buttons.

### Zoom & reflow
- The layout is responsive and supports 200% text zoom without loss of content or functionality.
- We rely on `rem` units for spacing and typography to respect user browser preferences.

## 3. Assistive Technology Support
We test our application with the following tools:
- **Screen Readers**: VoiceOver (macOS/iOS).
- **Parsers**: Automated linting for ARIA attributes.

## 4. Known Limitations
- **Charts & Graphs**: Some data visualizations in the Merchant Dashboard currently rely heavily on visual perception. We are working on providing data-table alternatives.
- **Complex Interactivity**: The drag-and-drop features (if any future sorting is added) currently rely on mouse pointers. We plan to add keyboard-based reordering.

## 5. Feedback & Contact
We welcome your feedback on the accessibility of Spendigo. Please let us know if you encounter accessibility barriers on Spendigo:

- **Email**: accessibility@spendigo.ca
- **Response Time**: We aim to respond to accessibility feedback within 2 business days.
