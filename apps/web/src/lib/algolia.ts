import { liteClient as algoliasearch } from 'algoliasearch/lite';

// Environment variables must be set in .env.local
// VITE_ALGOLIA_APP_ID
// VITE_ALGOLIA_SEARCH_KEY
// VITE_ALGOLIA_INDEX_NAME (optional, defaults to 'master_products')

const APP_ID = import.meta.env.VITE_ALGOLIA_APP_ID;
const SEARCH_KEY = import.meta.env.VITE_ALGOLIA_SEARCH_KEY;

export const ALGOLIA_INDEX_NAME = import.meta.env.VITE_ALGOLIA_INDEX_NAME || 'master_products';

export const searchClient = (APP_ID && SEARCH_KEY)
    ? algoliasearch(APP_ID, SEARCH_KEY)
    : null;
