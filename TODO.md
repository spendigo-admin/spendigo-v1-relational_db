# Project TODOs & Backlog

## 1. Pre-Launch Blockers (v1.0 GA Target)
- [ ] **Staging Environment**: Provision an isolated `spendigo-staging` Firebase project (or Preview Channels) for Q&A.
- [ ] **Merchant KYB Storage Rules**: Deploy path-restricted Firebase Storage rules (`/stores/{storeId}/`) for secure business license uploads.
- [ ] **Careers Portal Validation**: Validate the CV upload workflow and integrate email notification triggers.
- [ ] **Master Catalog Seeding**: Expand the verified Master Catalog from the ~50 SKU baseline to 500+ SKUs prior to public launch.

---

## 2. Future Enhancements (v1.1+)
- [ ] **AI Auto-Moderation**: Implement Gemini-powered initial moderation for "Pending Products" submissions to reduce Admin manual workload.
- [ ] **Historical Personalization**: Develop Algolia search boosting logic based on localized user purchase history.

---

## 3. Backlog & Technical Investigations

### Feature: Cloud Storage Image Mirroring for Public Flyers

**Status**: Proposed / Backlog
**Description**: 
Currently, the public flyer ingestion relies on hotlinking images directly from the Flipp CDN. This carries a risk of broken images if Flipp changes URLs, blocks hotlinking, or deletes old assets. This feature proposes downloading these images to our own Firebase Storage bucket during/after ingestion.

**Proposed Architecture**:
1. **Asynchronous Processing**: Do not block the main `runIngestion` Cloud Function, as downloading 1,500+ images will cause a function timeout (60s+ limit). Instead, save the deals with the original Flipp URLs first.
2. **Background Queue**: After ingestion, trigger a background worker (e.g., via Google Cloud Tasks or Pub/Sub) to process the images asynchronously.
3. **Image Deduplication**: Because grocery flyers repeat the exact same products week over week, we must deduplicate to save Firebase Storage and egress costs. 
   - Hash the original Flipp Image URL (e.g., `md5(flippUrl).jpg`).
   - Check if `bucket.file(hash).exists()` before downloading.
   - If it exists, skip the download. If not, download and upload it.
4. **Data Update**: Once the image is uploaded to Firebase Storage, update the corresponding deal document in Firestore with the new `spendigo-8540c.firebasestorage.app` URL.

**Pros**: 100% control over images, fast CDN delivery, prevents UI breaking if third-party links die.
**Cons**: Increases Firebase Storage costs, requires handling background workers and download failure states.
