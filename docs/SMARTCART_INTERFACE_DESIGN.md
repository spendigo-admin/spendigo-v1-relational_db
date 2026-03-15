# SmartCart Optimizer Interface Design

## Goal

Define stable interfaces and module boundaries for a future SmartCart optimizer without choosing or implementing the optimization algorithm yet.

## Design Principles

- Keep inputs algorithm-agnostic.
- Separate candidate resolution from optimization.
- Make decision transparency a first-class output.
- Support both split-cart and single-store comparisons.
- Keep pricing and store metadata explicit so fees and availability can be incorporated later.

## Core Data Contracts

Source: `apps/web/src/types/smartCart.ts`

- `SmartCartOptimizationInput`
  - `shoppingList`: normalized user demand
  - `stores`: store metadata needed for fulfillment and totals
  - `prices`: store-product offers with stock and optional promo price context
- `SmartCartCandidate`
  - a resolved purchasable option for a shopping-list item
  - captures match confidence and match reason so the UI can explain substitutions
- `SmartCartOptimizationResult`
  - `items`: selected store and product for each requested item
  - `summary`: total cart cost and savings vs. best single store
  - `bestSingleStore` and `singleStoreComparisons`: convenience baseline
  - `explanations`: human-readable decision trace

## Module Boundaries

### 1. Input Normalizer

**Responsibility**

Convert UI state into `SmartCartOptimizationInput`.

**Likely Sources**

- wishlist / shopping list items
- active stores from Firestore
- live `merchant_products`

**Suggested Boundary**

- `buildOptimizationInput(...) => SmartCartOptimizationInput`

### 2. Candidate Resolver

**Responsibility**

Map each requested list item to possible store offers.

**What it owns**

- direct master-product matches
- exact-name matching
- fuzzy fallback matching
- confidence scoring and match labels

**Interface**

- `SmartCartCandidateResolver`

### 3. Optimizer Engine

**Responsibility**

Choose one store-offer per requested item and compute aggregate totals.

**What it should not own**

- Firestore reads
- UI-specific formatting
- fuzzy search implementation details

**Interface**

- `SmartCartOptimizer`

### 4. Comparison Builder

**Responsibility**

Compute the single-store baseline used for `savingsVsSingleStore`.

**Output**

- `bestSingleStore`
- `singleStoreComparisons`

### 5. Decision Explainer

**Responsibility**

Translate machine decisions into user-facing rationale.

**Examples**

- "FreshMart selected because it has the lowest price for milk."
- "Budget Foods was the only store with this item in stock."
- "Split cart saves $6.42 vs the best single-store option."

**Interface**

- `SmartCartExplainer`

## Suggested Package Shape

```text
apps/web/src/smartcart/
  buildOptimizationInput.ts
  resolveCandidates.ts
  optimizeCart.ts
  buildSingleStoreComparisons.ts
  explainOptimization.ts
  types.ts
```

## UI Integration Boundary

Current hook:

- `apps/web/src/hooks/useOptimizedWishlist.ts`

Suggested future orchestration:

1. Build `SmartCartOptimizationInput`
2. Resolve candidates
3. Run optimizer
4. Generate explanations
5. Map result to existing cart UI

This keeps the current hook as a coordinator instead of the place where matching, optimization, totals, and explanation logic all live together.

## Minimal Flow

```text
shopping list
  -> input normalizer
  -> candidate resolver
  -> optimizer engine
  -> comparison builder
  -> explainer
  -> UI result
```

## Output Shape For UI

The UI should only need:

- selected store for each item
- total cart cost
- savings vs single store
- explanation strings / reason codes
- candidate counts and unavailable items for confidence messaging
# SmartCart Optimizer UI Walkthrough: AddItemsPanel Refactor

## 🎯 Objective
Fix UX/UI flaws in the SmartCart Optimizer (`AddItemsPanel.tsx`) where clicking "Quick Add Essentials" category chips mistakenly added generic items directly to the user's shopping cart instead of functioning as a category filter.

## 🐛 The Problem
Previously, the `AddItemsPanel` component tightly coupled the **category filtering state** with the **shopping cart (wishlist) state**. 
- Clicking a category chip (e.g., "Milk") instantly dispatched an action to add a generic "Milk" item to the user's cart.
- The matching product grid below was only visible if that generic item existed in the cart.
- If a user wanted to buy a specific brand of milk, they would click the "Milk" category and then select the specific product, ending up with *both* the generic "Milk" and the specific product in their list.

## 🛠️ Implementation Details

We refactored `apps/web/src/pages/consumer/components/AddItemsPanel.tsx` to completely decouple category selection from cart mutation.

**Key Changes:**
1. **Introduced Local UI State**: Added `const [selectedCategory, setSelectedCategory] = useState<string | null>(null);` to track the currently active category filter explicitly.
2. **Updated Chip Click Handlers**: The staple category chips now toggle the `selectedCategory` state (`setSelectedCategory(isSelected ? null : staple.name)`) instead of firing `addItem` or `removeItem` to the global wishlist context.
3. **Refactored Product Grid Filtering**: The matching product grid now reads from the local `selectedCategory` state to filter `AVAILABLE_ITEMS`, rather than extracting active filters from the user's cart shape.
4. **Preserved Custom Item Capabilities**: Created a dedicated `handleCustomAdd` function attached to the text input and 'Add' button. This ensures users can still type custom freeform items into their SmartCart without conflating it with the category browsing flow.
5. **UI Polish**: Added a clear active state for the selected chip label and a dedicated "Clear Filter" action above the matching products grid.

## ✅ Results
- **No Cart Clutter**: Browsing categories no longer pollutes the user's SmartCart wishlist with generic items.
- **Clearer UX**: The distinction between *filtering* the catalog and *adding* items to the list is explicitly defined.
- **Deployed**: Built and successfully deployed to Firebase Hosting.
