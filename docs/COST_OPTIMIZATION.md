# Cost Optimization Strategy (Production v1.0)

**Last Updated**: 2026-04-20
**Target Operating Budget**: < $50 CAD / month (excluding transaction fees)
**Status**: Active Production Governance

---

## 1. Architectural Efficiency

### 1.1 Edge-First Optimization
Spendigo prioritizes client-side execution to eliminate server overhead.
- **SmartCart Optimizer**: The complex 10-stage optimization engine runs entirely on the shopper's device. This avoids high-CPU billing on Cloud Functions for millions of potential store-item combinations.
- **Trip Consolidation**: Decisions on multi-store splits are calculated using client-side logic + proximity data, requiring zero server round-trips.

### 1.2 Gemini 2.5 Intelligence
- **Model Choice**: Utilizing **Gemini 2.5 Flash** instead of Pro to reduce token costs while maintaining high-speed insight generation.
- **Prompt Batching**: Insights are generated once per "Optimized Cart" payload and cached in `sessionStorage` to prevent redundant API calls during UI navigation.

---

## 2. Infrastructure Controls

### 2.1 Firestore (Database)
- **Denormalization**: Store metadata (Name, Logo, Commission) is embedded in `order` snapshots. This prevents expensive O(n) joins/reads across collections during historical analytics.
- **Write Aggregation**: Master Catalog metrics (popularity) are updated via debounced batch operations to stay within the 20k daily free-tier write limit.

### 2.2 Algolia v5 (Discovery)
- **Search Debounce**: Global search is gated by an **800ms debounce** and a **3-character minimum** to prevent accidental API consumption.
- **Index Scoping**: Only `master_products` and active `merchant_products` are indexed. Expired flyers or draft products are excluded to minimize record counts.

### 2.3 Forensic Audit Logging
- **Calculated Integrity**: SHA-256 hashes are computed using a deterministic "Canonical JSON" approach. This ensures that only meaningful data changes trigger a re-hash, preventing log bloat.
- **Storage Tiering**: While the audit ledger is permanent, older logs (1yr+) are candidates for migration to Cold Storage (Firebase Archive) to minimize monthly storage costs.

---

## 3. Monitoring & Sentry
- **Error Sampling**: Sentry error reporting is set to 100% (critical for v1.0), but **Performance Tracing** (Transaction sampling) is limited to 10% to stay within the free-tier event limit.
- **Log Retention**: Cloud Logging retention is capped at 30 days for generic INFO logs; only CRITICAL/AUDIT logs are retained indefinitely.

---

## 4. Estimated Operating Cost (Monthly)

| Component | Logic | Estimated Cost |
| :--- | :--- | :--- |
| **Compute** | Functions (Scale-to-zero) | ~$2.00 |
| **Database** | Firestore (Reads/Writes) | ~$5.00 |
| **AI Insights** | Gemini 2.5 Flash | ~$0.00 (Free Tier) |
| **Search** | Algolia v5 (Build Plan) | ~$1.00 (Overages) |
| **Audit/Logs** | Cloud Storage | ~$3.00 |
| **Monitoring** | Sentry (Developer Plan) | ~$0.00 |
| **Domains** | `spendigo.ca` (GoDaddy) | ~$1.50 |
| **TOTAL** | | **~$12.50 / month** |

---

## 5. Cost Containment (Kill-Switches)
If projected spend exceeds **$45.00 CAD**:
1. **Gemini**: Throttle insight generation to "Manual Trigger" only.
2. **Algolia**: Disable real-time sync for non-revenue stores (Starter Tier).
3. **Audit**: Switch from per-action hashing to per-batch hashing for non-sensitive UI events.
