# Backup & Restore Procedures

**Last Updated**: 2026-05-06  
**Status**: Production-Ready  
**Project**: Spendigo SmartCart (`spendigo-8540c`)

This document outlines the data protection strategy, backup schedules, and recovery protocols for the Spendigo platform.

---

## 1. Data Protection Strategy

Spendigo utilizes a multi-layered approach to data protection:
- **Scheduled Firestore Exports**: Full and partial database snapshots stored in Cloud Storage.
- **Point-In-Time Recovery (PITR)**: Nanosecond-granularity recovery within a 7-day window.
- **Auth User Exports**: Nightly dumps of user identities and custom claims.
- **Tamper-Evident Audit Ledger**: Cryptographic chaining to ensure data integrity.

---

## 2. Backup Schedules

### 2.1 Firestore Scheduled Exports
| Export Type | Schedule | Collections Included | Destination Path |
| :--- | :--- | :--- | :--- |
| **Critical** | Daily 02:00 UTC | `orders`, `audit_logs`, `payments`, `users`, `stores` | `gs://spendigo-8540c-firestore-backups/daily/YYYY-MM-DD/critical/` |
| **High-Value**| Daily 02:00 UTC | `merchant_products`, `master_products` | `gs://spendigo-8540c-firestore-backups/daily/YYYY-MM-DD/high-value/` |

### 2.2 Auth User Exports
| Frequency | Schedule | Format | Destination Path |
| :--- | :--- | :--- | :--- |
| **Daily** | Daily 03:00 UTC | NDJSON | `gs://spendigo-8540c-firestore-backups/auth-exports/auth_users_YYYY-MM-DD.ndjson` |

---

## 3. Manual Exports

Manual exports can be triggered via the **Admin Dashboard** (`/admin/health`) or the `gcloud` CLI. Manual exports always target the **Critical** collection set.

**CLI Trigger**:
```bash
gcloud firestore export gs://spendigo-8540c-firestore-backups/manual/$(date +%Y-%m-%d-%H%M%S)/critical \
  --collection-ids=orders,audit_logs,payments,users,stores \
  --project=spendigo-8540c
```

---

## 4. Point-In-Time Recovery (PITR)

PITR is enabled for the `spendigo-8540c` project. It allows for recovery of data to any specific point in time within the last **7 days**.

**Restore via PITR**:
```bash
gcloud firestore databases restore \
  --source-time="YYYY-MM-DDTHH:MM:SSZ" \
  --destination-database='(default)' \
  --project=spendigo-8540c
```
*Note: This command will overwrite the current database state for the specified time.*

---

## 5. Restoration Procedures

### 5.1 Full Collection Restore
To restore all collections from a specific daily backup:
```bash
gcloud firestore import \
  gs://spendigo-8540c-firestore-backups/daily/YYYY-MM-DD/critical \
  --project=spendigo-8540c
```

### 5.2 Single Collection Restore
To restore a single collection (e.g., `orders`):
```bash
gcloud firestore import \
  gs://spendigo-8540c-firestore-backups/daily/YYYY-MM-DD/critical \
  --collection-ids=orders \
  --project=spendigo-8540c
```

---

## 6. Critical Caveats & Best Practices

### ⚠️ Import Merging
The `firestore import` command **merges** data; it does not perform a "wipe and replace."
- Existing documents with matching IDs are **overwritten**.
- New documents are added.
- Documents that exist in the live database but NOT in the backup are **retained**.
- **Best Practice**: To perform a clean restore, delete the target collection(s) before importing.

### 🔗 Audit Log Integrity
The `audit_logs` collection uses a SHA-256 hash chain. Restoring old entries directly into the live collection will **break the chain** for any entries added after the backup was taken.
- **Best Practice**: Restore `audit_logs` to a shadow collection (e.g., `audit_logs_restored_2026_05_06`) for forensic review instead of overwriting the live chain.

### 🔑 Auth Password Limitations
Firebase Auth password hashes are inaccessible via the Admin SDK for security reasons.
- **Impact**: After an Auth restore, users who sign in via Email/Password must trigger a password reset.
- **SSO**: Users using Google or Apple SSO will reconnect automatically upon their next sign-in.

---

## 7. Storage Management
- **Retention**: Backups are retained in the `northamerica-northeast1` region for **90 days** via GCS lifecycle policies.
- **Access**: Requires `Cloud Datastore Import Export Admin` and `Storage Object Creator` IAM roles.

**Browse Backups**: [Google Cloud Storage Console](https://console.cloud.google.com/storage/browser/spendigo-8540c-firestore-backups)
