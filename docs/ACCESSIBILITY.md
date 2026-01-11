# Accessibility Compliance Statement (WCAG 2.1 AA)

**Project:** Spendigo SmartCart
**Target Standard:** WCAG 2.1 Level AA

## 1. Compliance Summary
Spendigo is committed to ensuring digital accessibility for people with disabilities. We are continually improving the user experience for everyone and applying the relevant accessibility standards.

## 2. Technical Measurements

### Color Contrast
Our visual design system uses a high-contrast theme:
- **Text Main**: `#FFFFFF` (White) on **Background**: `#0F0F0F` (Dark Grey).
  - **Ratio**: 15.68:1 (Passes AAA).
- **Brand Primary**: `#00D26A` (Emerald) on Black.
  - **Ratio**: 6.2:1 (Passes AA).

### Semantic HTML
- All interactive elements use standard HTML5 `<button>`, `<a>`, and `<input>` tags.
- ARIA labels are provided for icon-only buttons (e.g., "Add to Cart").
- Headings (`h1` through `h6`) strictly follow hierarchy.

### Keyboard Navigation
- Focus indicators are explicitly defined in `index.css` (`outline: 2px solid var(--brand-primary)`).
- Skip-to-content links are implemented in the main layout.
- **SmartCart Controls**: The substitution preference toggles are fully keyboard accessible (Tab + Space).

## 3. Known Limitations
- The **Flyer OCR Canvas** tool is inherently visual and provides a text-table alternative for screen readers, but the bounding box interaction requires mouse input. We are working on a keyboard-based coordinate entry system for Phase 3.

## 4. Feedback
We welcome your feedback on the accessibility of Spendigo. Please contact our Diversity & Inclusion Officer at `accessibility@spendigo.ca`.
