import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { getDownloadURL } from 'firebase-admin/storage';
import { getDb } from '../db/client';
import * as schema from '../db/schema';
import { eq, and } from 'drizzle-orm';

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

/**
 * Helper to replicate master catalog details directly to PostgreSQL.
 */
async function syncMasterProductToPostgres(productId: string, data: any) {
  const sqlDb = getDb();
  const categoryId = data.category_id ? data.category_id.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'other';
  
  const suggestedRetailPriceCents = (() => {
    if (data.suggested_retail_price === undefined || data.suggested_retail_price === null) return null;
    const s = parseFloat(data.suggested_retail_price);
    return isNaN(s) ? null : Math.round(s * 100);
  })();

  try {
    await sqlDb.insert(schema.masterProducts).values({
      id: productId,
      productName: data.product_name || 'Product',
      brandName: data.brand_name || null,
      upcGtin: data.upc_gtin || null,
      isSoldByWeight: data.is_sold_by_weight ?? false,
      netQuantityValue: data.net_quantity_value != null ? parseFloat(data.net_quantity_value) : null,
      netQuantityUnit: data.net_quantity_unit || null,
      packageCount: data.package_count || 1,
      primaryImageUrl: data.primary_image_url || null,
      secondaryImageUrls: data.secondary_image_urls || [],
      categoryId: categoryId,
      productType: data.product_type || null,
      storageType: data.storage_type || null,
      taxCategoryId: data.tax_category_id || null,
      suggestedRetailPrice: suggestedRetailPriceCents,
      substitutionGroupId: data.substitution_group_id || null,
      ageRestricted: data.age_restricted ?? false,
      isCanadianLocal: data.is_canadian_local ?? false,
      status: ['active', 'deprecated', 'blocked'].includes(data.status) ? data.status as any : 'active',
      verificationStatus: ['unverified', 'verified', 'manufacturer_verified'].includes(data.verification_status) ? data.verification_status as any : 'unverified',
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: schema.masterProducts.id,
      set: {
        productName: data.product_name || 'Product',
        brandName: data.brand_name || null,
        upcGtin: data.upc_gtin || null,
        isSoldByWeight: data.is_sold_by_weight ?? false,
        netQuantityValue: data.net_quantity_value != null ? parseFloat(data.net_quantity_value) : null,
        netQuantityUnit: data.net_quantity_unit || null,
        packageCount: data.package_count || 1,
        primaryImageUrl: data.primary_image_url || null,
        secondaryImageUrls: data.secondary_image_urls || [],
        categoryId: categoryId,
        productType: data.product_type || null,
        storageType: data.storage_type || null,
        taxCategoryId: data.tax_category_id || null,
        suggestedRetailPrice: suggestedRetailPriceCents,
        substitutionGroupId: data.substitution_group_id || null,
        ageRestricted: data.age_restricted ?? false,
        isCanadianLocal: data.is_canadian_local ?? false,
        status: ['active', 'deprecated', 'blocked'].includes(data.status) ? data.status as any : 'active',
        verificationStatus: ['unverified', 'verified', 'manufacturer_verified'].includes(data.verification_status) ? data.verification_status as any : 'unverified',
        updatedAt: new Date(),
      }
    });
    functions.logger.info(`[Dual-Write] Replicated master product ${productId} to PostgreSQL.`);
  } catch (pgError: any) {
    functions.logger.error(`[Dual-Write] PostgreSQL Master Product replication failed for ${productId}:`, pgError.message);
  }
}

/**
 * TRIGGER: onMasterProductWrite
 * Mirrors external product images to Google Cloud Storage and replicates details to PostgreSQL.
 */
export const onMasterProductWrite = functions.runWith({ secrets: ['DATABASE_URL'] }).firestore
  .document('master_products/{productId}')
  .onWrite(async (change, context) => {
    const productId = context.params.productId;

    // Handle document deletion
    if (!change.after.exists) {
      try {
        const sqlDb = getDb();
        await sqlDb.delete(schema.masterProducts).where(eq(schema.masterProducts.id, productId));
        functions.logger.info(`[Dual-Write] Replicated master product deletion for ${productId} to PostgreSQL.`);
      } catch (pgError: any) {
        functions.logger.error(`[Dual-Write] PostgreSQL Master Product deletion failed:`, pgError.message);
      }
      return null;
    }

    const data = change.after.data();
    
    // Trigger replication to PostgreSQL
    await syncMasterProductToPostgres(productId, data);

    const previousData = change.before.exists ? change.before.data() : null;
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

/**
 * TRIGGER: onMerchantProductWrite
 * Replicates active store inventory additions, changes, and stock updates directly to PostgreSQL.
 */
export const onMerchantProductWrite = functions.runWith({ secrets: ['DATABASE_URL'] }).firestore
  .document('merchant_products/{merchantProductId}')
  .onWrite(async (change, context) => {
    const { merchantProductId } = context.params;

    // Handle document deletion
    if (!change.after.exists) {
      if (merchantProductId.includes('_')) {
        const [storeId, masterProductId] = merchantProductId.split('_');
        try {
          const sqlDb = getDb();
          await sqlDb.delete(schema.merchantProducts)
            .where(and(
              eq(schema.merchantProducts.storeId, storeId),
              eq(schema.merchantProducts.masterProductId, masterProductId)
            ));
          functions.logger.info(`[Dual-Write] Replicated merchant product deletion for ${merchantProductId} to PostgreSQL.`);
        } catch (pgError: any) {
          functions.logger.error(`[Dual-Write] PostgreSQL Merchant Product deletion failed:`, pgError.message);
        }
      }
      return null;
    }

    const data = change.after.data();
    if (!data?.merchant_id || !data?.master_product_id) {
      functions.logger.warn(`Missing merchant_id or master_product_id for ${merchantProductId}`);
      return null;
    }

    const sqlDb = getDb();
    
    // Ensure store exists in PostgreSQL
    const storeExists = await sqlDb.select().from(schema.stores).where(eq(schema.stores.id, data.merchant_id)).limit(1);
    if (storeExists.length === 0) {
      functions.logger.warn(`Skipping replication of merchant product ${merchantProductId}: Store ${data.merchant_id} not in PostgreSQL.`);
      return null;
    }

    // Ensure master product exists in PostgreSQL
    const masterExists = await sqlDb.select().from(schema.masterProducts).where(eq(schema.masterProducts.id, data.master_product_id)).limit(1);
    if (masterExists.length === 0) {
      functions.logger.warn(`Skipping replication of merchant product ${merchantProductId}: Master product ${data.master_product_id} not in PostgreSQL.`);
      return null;
    }

    // Convert prices to integer cents
    const priceCents = (() => {
      const p = parseFloat(data.price);
      return isNaN(p) ? 0 : Math.round(p * 100);
    })();

    const originalPriceCents = (() => {
      if (data.original_price === undefined || data.original_price === null) return null;
      const op = parseFloat(data.original_price);
      return isNaN(op) ? null : Math.round(op * 100);
    })();

    try {
      await sqlDb.insert(schema.merchantProducts).values({
        storeId: data.merchant_id,
        masterProductId: data.master_product_id,
        price: priceCents,
        currency: data.currency || 'CAD',
        availableQuantity: typeof data.available_quantity === 'number' ? data.available_quantity : parseInt(data.available_quantity) || 0,
        merchantSku: data.merchant_sku || null,
        originalPrice: originalPriceCents,
        discountLabel: data.discount_label || null,
        discountValidUntil: data.discount_valid_until ? new Date(data.discount_valid_until) : null,
        isActive: data.is_active ?? true,
        isCanadianLocal: data.is_canadian_local ?? false,
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: [schema.merchantProducts.storeId, schema.merchantProducts.masterProductId],
        set: {
          price: priceCents,
          currency: data.currency || 'CAD',
          availableQuantity: typeof data.available_quantity === 'number' ? data.available_quantity : parseInt(data.available_quantity) || 0,
          merchantSku: data.merchant_sku || null,
          originalPrice: originalPriceCents,
          discountLabel: data.discount_label || null,
          discountValidUntil: data.discount_valid_until ? new Date(data.discount_valid_until) : null,
          isActive: data.is_active ?? true,
          isCanadianLocal: data.is_canadian_local ?? false,
          updatedAt: new Date(),
        }
      });
      functions.logger.info(`[Dual-Write] Replicated merchant product ${merchantProductId} to PostgreSQL.`);
    } catch (pgError: any) {
      functions.logger.error(`[Dual-Write] PostgreSQL Merchant Product replication failed for ${merchantProductId}:`, pgError.message);
    }

    return null;
  });
