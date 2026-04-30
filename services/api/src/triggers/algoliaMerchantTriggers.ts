import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { algoliasearch } from 'algoliasearch';

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY;
// We now sync to a new index: merchant_products
const ALGOLIA_INDEX_NAME = process.env.ALGOLIA_MERCHANT_INDEX_NAME || 'merchant_products';

// Initialize Algolia client
const algoliaClient = (ALGOLIA_APP_ID && ALGOLIA_API_KEY) 
  ? algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY)
  : null;

export const syncMerchantProductToAlgolia = functions.firestore
  .document('merchant_products/{merchantProductId}')
  .onWrite(async (change, context) => {
    if (!algoliaClient) {
      functions.logger.warn('Algolia Sync skipped: ALGOLIA_APP_ID or ALGOLIA_API_KEY is not set.');
      return null;
    }

    const { merchantProductId } = context.params;

    // Handle document deletion
    if (!change.after.exists) {
      try {
        await algoliaClient.deleteObject({
          indexName: ALGOLIA_INDEX_NAME, 
          objectID: merchantProductId
        });
        functions.logger.info(`Deleted ${merchantProductId} from Algolia index ${ALGOLIA_INDEX_NAME}.`);
      } catch (error) {
        functions.logger.error(`Error deleting ${merchantProductId} from Algolia:`, error);
      }
      return null;
    }

    const data = change.after.data();
    
    // If it's no longer active, remove it from search
    if (data?.is_active === false || data?.available_quantity <= 0) {
      try {
        await algoliaClient.deleteObject({
          indexName: ALGOLIA_INDEX_NAME, 
          objectID: merchantProductId
        });
        functions.logger.info(`Removed inactive/out-of-stock ${merchantProductId} from Algolia index ${ALGOLIA_INDEX_NAME}.`);
      } catch (error) {
        functions.logger.error(`Error removing ${merchantProductId} from Algolia:`, error);
      }
      return null;
    }

    // We only proceed if we have valid references
    if (!data?.merchant_id || !data?.master_product_id) {
       functions.logger.warn(`Missing merchant_id or master_product_id for ${merchantProductId}`);
       return null;
    }

    try {
      const db = admin.firestore();
      
      // Fetch the Master Product and Store concurrently
      const [masterDoc, storeDoc] = await Promise.all([
        db.collection('master_products').doc(data.master_product_id).get(),
        db.collection('stores').doc(data.merchant_id).get()
      ]);

      if (!masterDoc.exists || !storeDoc.exists) {
        functions.logger.warn(`Could not sync ${merchantProductId}: Missing Master Product or Store document.`);
        return null;
      }

      const masterData = masterDoc.data();
      const storeData = storeDoc.data();

      // Only add GPS data if store has location coordinates
      let geoloc = null;
      if (storeData?.coordinates?.lat && storeData?.coordinates?.lng) {
        geoloc = {
          lat: storeData.coordinates.lat,
          lng: storeData.coordinates.lng
        };
      } else if (storeData?.location?.lat && storeData?.location?.lng) {
        geoloc = {
          lat: storeData.location.lat,
          lng: storeData.location.lng
        };
      } else if (storeData?.geoloc?.latitude && storeData?.geoloc?.longitude) {
         // Some schemas use .latitude instead of .lat
        geoloc = {
          lat: storeData.geoloc.latitude,
          lng: storeData.geoloc.longitude
        };
      }
      
      let displayPrice = Number(data.price || 0);
      let discountLabel = data.discount_label;
      const validUntil = data.discount_valid_until;
      
      if (validUntil && new Date(validUntil) < new Date()) {
        // Revert to original_price if expired
        if (data.original_price && Number(data.original_price) > 0) {
            displayPrice = Number(data.original_price);
            discountLabel = null;
        }
      }

      const algoliaPayload = {
        objectID: merchantProductId,
        merchant_product_id: merchantProductId,
        merchant_id: data.merchant_id,
        master_product_id: data.master_product_id,
        // Merchant Specific Data
        price: displayPrice,
        original_price: displayPrice < Number(data.original_price || 0) ? data.original_price : null,
        available_quantity: data.available_quantity || 0,
        merchant_sku: data.merchant_sku || '',
        discount_label: discountLabel || '',
        discount_valid_until: validUntil || null,
        
        // Master Catalog Normalized Data
        product_name: masterData?.product_name || '',
        brand_name: masterData?.brand_name || '',
        short_description: masterData?.short_description || '',
        category_id: masterData?.category_id || '',
        dietary_tags: masterData?.dietary_tags || [],
        upc_gtin: masterData?.upc_gtin || '',
        barcode: masterData?.barcode || '',
        primary_image_url: masterData?.primary_image_url || '',
        
        // Geo-Spatial Data
        _geoloc: geoloc,

        // Highlighting
        is_canadian_local: data?.is_canadian_local ?? masterData?.is_canadian_local ?? false,

        // Meta
        updated_at: Date.now()
      };

      await algoliaClient.saveObject({
        indexName: ALGOLIA_INDEX_NAME,
        body: algoliaPayload
      });
      functions.logger.info(`Saved ${merchantProductId} to Algolia index ${ALGOLIA_INDEX_NAME} with Geoloc.`);
      
    } catch (error) {
      functions.logger.error(`Error saving ${merchantProductId} to Algolia:`, error);
    }

    return null;
  });
