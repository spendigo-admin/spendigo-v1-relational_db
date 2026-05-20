import * as functions from 'firebase-functions/v1';
import { algoliasearch } from 'algoliasearch';

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY;
const ALGOLIA_INDEX_NAME = process.env.ALGOLIA_INDEX_NAME || 'master_products';

// Initialize Algolia client only if credentials are provided
const algoliaClient = (ALGOLIA_APP_ID && ALGOLIA_API_KEY) 
  ? algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY)
  : null;

export const syncMasterProductToAlgolia = functions
  .runWith({ secrets: ['ALGOLIA_API_KEY'] })
  .firestore
  .document('master_products/{productId}')
  .onWrite(async (change, context) => {
    if (!algoliaClient) {
      functions.logger.warn('Algolia Sync skipped: ALGOLIA_APP_ID or ALGOLIA_API_KEY is not set.');
      return null;
    }

    const { productId } = context.params;

    // Handle document deletion
    if (!change.after.exists) {
      try {
        await algoliaClient.deleteObject({
          indexName: ALGOLIA_INDEX_NAME, 
          objectID: productId
        });
        functions.logger.info(`Deleted ${productId} from Algolia index ${ALGOLIA_INDEX_NAME}.`);
      } catch (error) {
        functions.logger.error(`Error deleting ${productId} from Algolia:`, error);
      }
      return null;
    }

    // Handle document creation or update
    const data = change.after.data();

    // Select the fields we want to index
    const algoliaPayload = {
      objectID: productId,
      product_name: data?.product_name || '',
      brand: data?.brand || '',
      description: data?.description || '',
      category: data?.category || '',
      tags: data?.tags || [],
      barcode: data?.barcode || '',
      upc_gtin: data?.upc_gtin || '',
      primary_image_url: data?.primary_image_url || '',
      age_restricted: data?.age_restricted || false,
      is_canadian_local: data?.is_canadian_local || false,
      // Optional: Add a timestamp field for sorting
      updated_at: Date.now()
    };

    try {
      await algoliaClient.saveObject({
        indexName: ALGOLIA_INDEX_NAME,
        body: algoliaPayload
      });
      functions.logger.info(`Saved ${productId} to Algolia index ${ALGOLIA_INDEX_NAME}.`);
    } catch (error) {
      functions.logger.error(`Error saving ${productId} to Algolia:`, error);
    }

    return null;
  });
