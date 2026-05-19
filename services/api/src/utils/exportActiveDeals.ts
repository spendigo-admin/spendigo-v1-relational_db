import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions/v1';

export async function exportActiveDeals(): Promise<void> {
    const db = admin.firestore();
    const flyersSnapshot = await db.collection('public_flyers').get();
    const allDeals: admin.firestore.DocumentData[] = [];

    for (const flyerDoc of flyersSnapshot.docs) {
        const dealsSnapshot = await flyerDoc.ref.collection('deals').get();
        dealsSnapshot.forEach(doc => {
            allDeals.push({ ...doc.data(), flyerId: flyerDoc.id });
        });
    }

    const bucket = admin.storage().bucket('spendigo-8540c.firebasestorage.app');
    const file = bucket.file('public/active_deals.json');
    await file.save(JSON.stringify(allDeals), {
        contentType: 'application/json',
        metadata: { cacheControl: 'public, max-age=60' },
    });
    await file.makePublic();
    logger.info(`[exportActiveDeals] Exported ${allDeals.length} deals to Storage.`);
}
