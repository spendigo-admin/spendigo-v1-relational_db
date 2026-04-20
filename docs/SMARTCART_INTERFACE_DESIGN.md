# SmartCart Optimizer Architecture & Design

**Last Updated**: 2026-04-20
**Status**: Production-Ready (v1.0 Implemented)

---

## 1. Goal
The SmartCart Optimizer is the core intelligence of Spendigo. Its goal is to analyze a shopper's wishlist across thousands of real-time merchant offers and determine the "Best Split" (multi-store) and "Best Single Store" fulfillment strategies to maximize savings.

## 2. Core Modules

### 🧠 Candidate Resolver (`useOptimizedWishlist.ts`)
Map user-requested items to live merchant inventory.
- **ID Resolution**: Preference for Master Product IDs (Direct Link).
- **Fuzzy Fallback**: Uses `performFuzzySearch` for custom/generic entries with a 65%+ confidence threshold.
- **Distance Guard**: Filters candidates based on user GPS coordinates or FSA (Postal Code) fallback to ensure physical accessibility.

### 📊 Price Matrix Engine (`smartcart_price_matrix.ts`)
Constructs a N x M grid of shopping list items vs. available stores.
- **Normalization**: Standardizes "Each", "lb", "kg", "ml" into a unified comparison unit.
- **Effective Price**: Calculates real-time totals by incorporating:
  - Base merchant price
  - Flash Deals / One Day Offers
  - Standard Sale flyers
  - Multi-buy logic (e.g., "3 for $5")
  - BOGO (Buy One Get One) effective unit pricing.

### ⚙️ Optimization Engine (`smartcart_optimizer.ts`)
The decision-making logic for cart selection.
- **Lowest Price First**: Selects the absolute cheapest fulfilled offer for every item.
- **Preference Bias**: Optional weighting for a "Preferred Store" if prices are within a small threshold.
- **Availability Guard**: Ensures the selected store actually has the `available_quantity` to fulfill the request.

### ⚖️ Comparison Engine (`smartcart_comparison_engine.ts`)
Computes the baseline "Best Single Store" fulfillment.
- **Single Store Simulation**: Identifies which single merchant can fulfill the largest % of the list with the lowest aggregate total.
- **Saving Logic**: Calculates `Total Split Cost` vs `Total Single Store Cost`, including delivery fees for each store in the split.

### 🧪 Substitution & Upsell Engine
Surfaces high-impact value opportunities.
- **Substitutions**: Recommends identical items in a different brand using `substitution_group_id`.
- **Bulk Saving Hints**: Flags when a larger package size (e.g., 2kg vs 500g) at the same store has a better unit price.

---

## 3. Data Contracts (`types/smartCart.ts`)

### `SmartCartOptimizationResult`
The output consumed by the UI components.
- **items**: Array of `SmartCartItemDecision` (Store + Product ID + Line Total).
- **summary**: `SmartCartOptimizationSummary` (Total Cost, Best Single Store baseline, Net Savings).
- **explanations**: array of `SmartCartDecisionExplanation` for transparency.

### `SmartCartDecisionExplanation`
Human-readable rationale for machine choices:
- `lowest_price`: Selected based on direct price comparison.
- `only_available_option`: Selected as the sole fulfillment candidate.
- `matched_by_master_product`: Precision match via global catalog.

---

## 4. UI Integration
The optimizer is orchestrated via the `useOptimizedWishlist` hook, which provides:
- **`optimizerItems`**: The enriched wishlist with all fulfillment options.
- **`tripAnalysis`**: A high-level recommendation (e.g., "Best Split" or "Single Store Only").
- **`matrix`**: The raw data for the standard comparison grid.

### Design Principles in UI:
- **Transparency**: Every substitution must be explicitly labeled.
- **Autonomy**: Users can manually "Pin" a specific store result to override the optimizer.
- **Simplicity**: Complex logic (normalization, multibuy) is abstracted behind a single "Effective Price".

---

## 5. Decision Ethics
1. **No Shadow Ads**: Sponsored listings are treated as normal candidates; the engine will never select a more expensive sponsored item over a cheaper organic match.
2. **True Cost**: Delivery and service fees are incorporated into the comparison engine to ensure "Savings" are calculated on the final checkout total, not just subtotal.
