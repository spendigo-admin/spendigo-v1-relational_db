import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { getDownloadURL } from 'firebase-admin/storage';

const storage = admin.storage();

function isExternalUrl(url: string): boolean {
    return url.startsWith('http') &&
        !url.includes('firebasestorage.googleapis.com') &&
        !url.includes(storage.bucket().name);
}

async function mirrorExternalImage(url: string, storagePath: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    const buffer = await response.arrayBuffer();
    const bucket = storage.bucket();
    const urlPath = new URL(url).pathname;
    const extensionMatch = urlPath.match(/\.([^.]+)$/);
    const ext = extensionMatch ? extensionMatch[1] : 'jpg';
    const file = bucket.file(`${storagePath}.${ext}`);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    await file.save(Buffer.from(buffer), {
        metadata: { contentType, cacheControl: 'public, max-age=31536000' },
    });
    return getDownloadURL(file);
}

export const onMasterProductWrite = functions.firestore
  .document('master_products/{productId}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) return null;

    const data = change.after.data();
    const previousData = change.before.exists ? change.before.data() : null;
    const productId = context.params.productId;

    const updates: Record<string, unknown> = {};

    // --- Primary image ---
    const primaryUrl = data?.primary_image_url;
    if (
      primaryUrl &&
      isExternalUrl(primaryUrl) &&
      primaryUrl !== previousData?.primary_image_url
    ) {
      try {
        functions.logger.info(`Mirroring primary image for ${productId}: ${primaryUrl}`);
        const publicUrl = await mirrorExternalImage(primaryUrl, `products/${productId}`);
        updates.primary_image_url = publicUrl;
        updates.original_image_url = primaryUrl;
        functions.logger.info(`Primary image mirrored to ${publicUrl}`);
      } catch (error) {
        functions.logger.error(`Error mirroring primary image for ${productId}:`, error);
      }
    }

    // --- Secondary images ---
    const oldSecondary: string[] = previousData?.secondary_image_urls ?? [];
    const newSecondary: string[] = data?.secondary_image_urls ?? [];

    if (newSecondary.length > 0) {
      const mirrored = [...newSecondary];
      let anyMirrored = false;

      await Promise.all(
        newSecondary.map(async (url, i) => {
          if (!url || !isExternalUrl(url) || oldSecondary.includes(url)) return;
          try {
            functions.logger.info(`Mirroring secondary image [${i}] for ${productId}: ${url}`);
            const publicUrl = await mirrorExternalImage(url, `products/${productId}_${i}`);
            mirrored[i] = publicUrl;
            anyMirrored = true;
            functions.logger.info(`Secondary image [${i}] mirrored to ${publicUrl}`);
          } catch (error) {
            functions.logger.error(`Error mirroring secondary image [${i}] for ${productId}:`, error);
          }
        })
      );

      if (anyMirrored) {
        updates.secondary_image_urls = mirrored;
      }
    }

    if (Object.keys(updates).length === 0) return null;

    updates.updated_at = admin.firestore.FieldValue.serverTimestamp();
    await change.after.ref.update(updates);
    return null;
  });
