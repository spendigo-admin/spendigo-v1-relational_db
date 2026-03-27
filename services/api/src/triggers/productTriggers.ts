import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { getDownloadURL } from 'firebase-admin/storage';

const storage = admin.storage();

export const onMasterProductWrite = functions.firestore
  .document('master_products/{productId}')
  .onWrite(async (change, context) => {
    // If deleted, do nothing
    if (!change.after.exists) return null;

    const data = change.after.data();
    const previousData = change.before.exists ? change.before.data() : null;

    const imageUrl = data?.primary_image_url;
    const productId = context.params.productId;

    // We only care if the image URL is an external web URL
    if (
      !imageUrl ||
      !imageUrl.startsWith('http') ||
      imageUrl.includes('firebasestorage.googleapis.com') ||
      imageUrl.includes(storage.bucket().name)
    ) {
      return null;
    }

    // Only process if the imageUrl is newly added or changed
    if (previousData && previousData.primary_image_url === imageUrl) {
       return null;
    }

    try {
      functions.logger.info(`Downloading external image for ${productId}: ${imageUrl}`);
      
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const bucket = storage.bucket();
      
      const urlPath = new URL(imageUrl).pathname;
      const extensionMatch = urlPath.match(/\.([^.]+)$/);
      const ext = extensionMatch ? extensionMatch[1] : 'jpg';

      const filePath = `products/${productId}.${ext}`;
      const file = bucket.file(filePath);

      const contentType = response.headers.get('content-type') || 'image/jpeg';

      await file.save(Buffer.from(buffer), {
        metadata: {
          contentType: contentType,
          cacheControl: 'public, max-age=31536000',
        },
      });

      // Generate a persistent Firebase Storage download URL that bypasses App Check via token
      const publicUrl = await getDownloadURL(file);
      
      functions.logger.info(`Successfully uploaded image to ${publicUrl}. Updating document...`);

      // Update the Firestore document
      await change.after.ref.update({
        primary_image_url: publicUrl,
        original_image_url: imageUrl, 
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

      return null;
    } catch (error) {
      functions.logger.error(`Error processing image for ${productId}:`, error);
      return null;
    }
  });
