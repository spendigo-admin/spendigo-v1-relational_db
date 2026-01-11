# Cost Optimization Strategy (Pre-Revenue)

**Status**: Active / Enforced
**Last Updated**: 2026-01-11

## 1. Hard Constraint
**Total Budget: $0 - $25 CAD / month**

## 2. Cost Breakdown & Controls

### 2.1 Compute (Serverless)
- **Strategy**: Scale-to-zero. No running containers or instances when idle.
- **Service**: Google Cloud Functions.
- **Free Tier**: 2M invocations/month (GCP Free Tier).
- **Risk**: Infinite loops or DDOS.
- **Mitigation**:
  - Set `max_instances` to 10 for non-critical functions.
  - Set execution timeouts (e.g., 5s).

### 2.2 Database
- **Strategy**: Firestore (NoSQL).
- **Service**: Firebase Firestore.
- **Free Tier**: 50k reads, 20k writes per day.
- **Risk**: High read volume from inefficient queries.
- **Mitigation**:
  - Aggressive client-side caching (React Query / Context).
  - Denormalization of "Store Name" and "Product Price" to avoid joins.

### 2.3 Storage (Assets & Logs)
- **Strategy**: Hot/Cold lifecycle.
- **Service**: Firebase Storage (Google Cloud Storage).
- **Risk**: Bandwidth/Egress costs.
- **Mitigation**:
  - Cache-Control headers (`public, max-age=31536000`) for immutable assets.
  - Resize user uploads (avatars/products) on the client before upload.

### 2.4 Monitoring & Logging
- **Strategy**: Sampling and Retention reduction.
- **Service**: Google Cloud Logging.
- **Risk**: High ingestion costs.
- **Mitigation**:
  - Log level: `INFO` default, `ERROR` only for high volume.
  - Retention: Default 30 days is free for reasonable volume.

### 2.5 Maps & Geolocation
- **Strategy**: Cache-first, Open Source.
- **Service**: OpenStreetMap / Nominatim (Free) + Leaflet.
- **Risk**: API Rate Limits.
- **Mitigation**:
  - Do NOT auto-load map on homepage (List view default).
  - Cache geocoded results for stores in Firestore.

## 3. Kill-Switches
If projected cost > $20 CAD:
1. **Alert**: SMS/Email to Admin.
2. **Action 1**: Disable "Image Upload" feature.
3. **Action 2**: Switch Maps to "List Only" mode.
4. **Action 3**: Pause new Sign-ups.

## 4. Monthly Estimated Bill
| Component | Usage | Est. Cost |
| :--- | :--- | :--- |
| Compute | < 1M reqs | $0.00 |
| DB | < 50k reads/day | $0.00 |
| Storage | < 5GB | $0.00 |
| Stripe | Transaction Based | Net Positive |
| Domain/DNS | 1 Domain | $15.00/yr |
| **Total** | | **~$1.25/mo** |
