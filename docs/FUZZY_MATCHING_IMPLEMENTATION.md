# 🔍 Spendigo SmartCart — Fuzzy Matching Implementation

**Last Updated**: 2026-05-01
**Status**: Production-Ready (v1.0)
**Engine**: Hybrid Levenshtein + Token Weighting

---

## 🏗️ Architecture Overview
The Fuzzy Matching engine handles the transition from a consumer's "wishlist" (generic names like "Milk") to a merchant's "inventory" (specific SKUs like "Dairyland 2% Milk 2L").

### Matching Tiers
| Tier | Confidence | Logic | UI Representation |
| :--- | :--- | :--- | :--- |
| **Exact Match** | 100% | Exact name string match. | Green Badge (Verified) |
| **Partial Match** | 70-90% | Brand overlap or >= 50% token match. | Blue Badge (Matched) |
| **Fuzzy Match** | 40-65% | Levenshtein similarity above threshold. | Orange Badge (Partial) |
| **Typo Correction**| +10 points | High similarity on short strings. | Gray Badge (Fuzzy) |

---

## 🧠 Core Algorithm: `fuzzy-search.ts`

### 1. Scoring Hierarchy
Instead of simple character matching, Spendigo uses a point-based hierarchy:
- **Exact Match**: 100 points.
- **Brand Match**: 85 points (when brand includes the query).
- **Token Overlap**: 70-90 points (scaled by match percentage).
- **Levenshtein Fallback**: 40-65 points (scaled by similarity ratio).

### 2. Levenshtein Distance (Threshold: 65%)
For query strings with < 10 characters, the engine allows up to 2 character edits. For > 10 characters, it allows up to 35% edit distance.

```typescript
// Normalized normalization
const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
```

---

## 📦 Integration Points

### 1. SmartCart Optimizer
The optimizer runs fuzzy matching iteratively across all available stores in the shopper's radius. It filters out any matches below the **65% confidence floor** to prevent invalid trip recommendations.

### 2. Substitution Engine
Matches within the same `substitution_group_id` are automatically ranked higher. If the shopper's "preferred" item is missing, the engine looks for the highest-scoring fuzzy match in the same category.

### 3. Algolia v5 Hybridization
While the client-side `fuzzy-search.ts` handles the wishlist processing, **Algolia** handles the initial discovery phase. The 두 strategies are synchronized to ensure that "Milk" typed in search and "Milk" in the wishlist yield the same primary candidate.

---

## 🧪 Performance & Caching
Given that optimization can involve 1,000+ candidate products, the engine utilizes:
- **Memoization Cache**: Results for specific query/candidate pairs are cached via `performCachedSearch` with a 60-second TTL.
- **Token Pre-computation**: Product tokens are generated once upon catalog load and stored in memory.

---

## 🔮 Future Intelligence
- **Synonym Dictionary**: Mapping "Soda" -> "Pop" and "Facial Tissue" -> "Kleenex".
- **AI-Enriched Weights**: Adjusting token weights based on consumer selection history (e.g., if a user always picks "Organic", boost "Organic" tokens to 40%).
