# Forensic Audit Implementation

**Last Updated**: 2026-05-01
**Security Status**: Forensic Chains Active (v1.0)
**Integrity Standard**: SHA-256 HMAC-Equivalent Chaining

---

## 1. Professional Overview
Spendigo maintains a **Forensic Security Ledger** to provide absolute transparency and legal defensibility for all critical platform operations. Every action—from administrative store approvals to shopper cart optimizations—is cryptographically recorded in an append-only, tamper-evident sequence.

---

## 2. Forensic Chain Architecture

### 2.1 Tamper-Evident Chaining
Each log entry in the `/audit_logs` collection contains a `prevHash` field. This field stores the `hash` of the immediately preceding log entry, creating a cryptographic "chain" of responsibility.
- **Genesis Block**: The first entry in the system uses a standard null-hash: `0000000000000000000000000000000000000000000000000000000000000000`.
- **Validation**: Any alteration of a historical log entry (e.g., changing an IP address or timestamp) will break the chain, as the subsequent entry's `prevHash` will no longer match the altered entry's re-calculated `hash`.

### 2.2 Canonicalization Engine
To ensure hash stability, the system uses a **Deterministic Key Sorting** algorithm before stringification. This prevents "false positives" in tamper detection caused by non-deterministic JSON key ordering.
- **Excluded Fields**: The `hash` field itself is excluded during the calculation of that entry's hash.
- **Null Handling**: All `undefined` fields are stripped, and `null` values are normalized to a literal string `'null'`.

---

## 3. Data Integrity Schema (`/audit_logs`)

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique transaction ID (format: `txn_[timestamp]_[salt]`). |
| `timestamp` | `string` | ISO-8601 UTC timestamp of the event. |
| `actor` | `object` | Identity of the user (`id`, `email`, `ip`). |
| `action` | `string` | Standardized event identifier (e.g., `STORE_SUSPENDED`). |
| `resource` | `string` | The ID of the affected resource (Store, Order, Ad). |
| `metadata` | `object` | Contextual payload (e.g., suspension reason, refund amount). |
| `prevHash` | `string` | The SHA-256 hash of the previous block in the chain. |
| `hash` | `string` | The SHA-256 hash of the current canonicalized log entry. |

---

## 4. Integration Layer

### 4.1 Cloud Utility (`logEvent`)
Critical backend operations (Stripe webhooks, order placement, merchant onboarding) utilize the `logEvent` utility in `services/api/src/utils/audit.ts`.
- **Atomic Commits**: Logging is executed within Firestore **Transactions** to ensure that an operation and its audit record are committed simultaneously or not at all.
- **Tie-Breaker Logic**: In the event of concurrent logs within the same millisecond, the system uses an ID-based tie-breaker to maintain a deterministic chain sequence.

### 4.2 Callable API (`recordAuditEvent`)
Frontend-driven security events (login failures, MFA triggers, suspicious navigation) are recorded via the `recordAuditEvent` HTTPS callable function.
- **App Check Enforcement**: This endpoint requires a valid **Firebase App Check** token to prevent non-authorized traffic from polluting the audit ledger.
- **Unauthenticated Gating**: Only specific security-related actions (e.g., `AUTH_LOGIN_FAILURE`) are permitted for unauthenticated users.

---

## 5. Security Posture
The Spendigo audit ledger is designed to be **Forensic-Ready**. In the event of a dispute or security incident, the ledger can be exported and verified against the cryptographic chain to prove that no logs were deleted or altered after the fact.

---

## 6. Audit Triggers Matrix

| Action | Source | Significance |
| :--- | :--- | :--- |
| `STORE_SUSPENDED` | Admin | Compliance & Governance |
| `STRIPE_WEBHOOK_RECEIVED` | Stripe | Financial Reconciliation |
| `ORDER_PLACED` | Shopper | Revenue Recognition |
| `AUTH_LOGIN_FAILURE` | System | Security Monitoring |
| `MERCHANT_INVITED` | Merchant | Workforce Governance |
