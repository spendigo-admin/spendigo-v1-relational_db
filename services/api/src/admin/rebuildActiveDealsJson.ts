import * as functions from 'firebase-functions/v1';
import { exportActiveDeals } from '../utils/exportActiveDeals';

// Rebuilds active_deals.json from Firestore after onFlyerDealCreated triggers have had
// time to mirror all images. Runs every 30 minutes so the JSON reflects Firebase Storage
// URLs rather than Flipp CDN URLs.
export const rebuildActiveDealsJson = functions.pubsub
    .schedule('every 30 minutes')
    .onRun(async () => {
        await exportActiveDeals();
    });
