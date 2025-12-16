# Cost Optimization Strategy (Pre-Revenue)

## 1. Hard Constraint
**Total Budget: $0 - $25 CAD / month**

## 2. Cost Breakdown & Controls

### 2.1 Compute (Serverless)
- **Strategy**: Scale-to-zero. No running containers or instances when idle.
- **Service**: Google Cloud Functions / AWS Lambda.
- **Free Tier**: 2M invocations/month (AWS/GCP combined typically covers this).
- **Risk**: Infinite loops or DDOS.
- **Mitigation**:
  - Set `max_instances` to 5-10 for non-critical functions.
  - Set execution timeouts (e.g., 5s).

### 2.2 Database
- **Strategy**: Serverless Postgres.
- **Service**: Neon (Free: 0.5 vCPU, 512MB RAM, 3GB Storage).
- **Risk**: Storage growth.
- **Mitigation**: Regular pruning of logs. Store heavy headers (images, PDFs) in Object Storage, not DB.

### 2.3 Storage (Assets & Logs)
- **Strategy**: Hot/Cold lifecycle.
- **Service**: Cloudflare R2 (10GB Free, no egress fees) or AWS S3.
- **Risk**: Bandwidth/Egress costs.
- **Mitigation**:
  - Aggressive CDN caching (Cache-Control: public, max-age=31536000).
  - WebP conversion for all user uploads.

### 2.4 Monitoring & Logging
- **Strategy**: Sampling and Retention reduction.
- **Service**: Cloud Native (CloudWatch/Stackdriver).
- **Risk**: High ingestion costs.
- **Mitigation**:
  - Structured logging (JSON).
  - Log level: `INFO` default, `ERROR` only for high volume.
  - Retention: 3-7 days max for Dev/Staging.

### 2.5 Maps & Geolocation
- **Strategy**: Cache-first, Lazy-load.
- **Risk**: API call volume ($5+ per 1000 loads).
- **Mitigation**:
  - Do NOT auto-load map on homepage.
  - Use static maps where interactive is not needed.
  - Cache geocoded results for stores.

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
| DB | < 3GB | $0.00 |
| Stripe | Transaction Based | Net Positive |
| Domain/DNS | 1 Domain | $15.00/yr |
| **Total** | | **~$1.25/mo** |
