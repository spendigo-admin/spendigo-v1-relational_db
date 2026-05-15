import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions/v1';

/**
 * Normalize a product name to a canonical token-sorted key for cross-retailer matching.
 * "Natrel Milk 2% 2L" and "2% Milk Natrel 2L" both produce "2%_2l_milk_natrel".
 *
 * CRITICAL: This function must produce identical output to the normalizeProductName
 * function in apps/web/src/hooks/useDealQuality.ts. Keep them in sync.
 */
export function normalizeProductName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s%]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(t => t.length > 0)
        .sort()
        .join('_');
}

function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Indexes all deals from a just-ingested flyer into the flat flyer_deal_index collection.
 * This enables time-series queries like "all prices for 'Natrel 2% Milk' at No Frills over 52 weeks"
 * without scanning every flyer's subcollection.
 *
 * Called fire-and-forget from runIngestion() — errors are logged but don't fail the parent job.
 * Idempotent: uses set({ merge: true }) so re-indexing the same flyer is safe.
 */
export async function indexFlyerDeals(flyerId: string): Promise<void> {
    const db = admin.firestore();
    const dealsSnap = await db
        .collection('public_flyers')
        .doc(flyerId)
        .collection('deals')
        .get();

    if (dealsSnap.empty) return;

    const now = new Date();
    const isoWeek = getISOWeek(now);
    const year = now.getFullYear();

    const CHUNK_SIZE = 400;
    const docs = dealsSnap.docs;

    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const chunk = docs.slice(i, i + CHUNK_SIZE);
        const batch = db.batch();

        for (const dealDoc of chunk) {
            const deal = dealDoc.data();
            // Skip deals with no name or price — unusable for analytics
            if (!deal.name || deal.currentPrice == null) continue;

            const normalizedKey = normalizeProductName(deal.name);
            // Doc ID: {flyerId}_{dealId} prevents duplicates on re-index
            const docId = `${flyerId}_${deal.id}`;

            batch.set(
                db.collection('flyer_deal_index').doc(docId),
                {
                    ...deal,
                    normalizedKey,
                    isoWeek,
                    year,
                    flyerId,
                },
                { merge: true }
            );
        }

        await batch.commit();
    }

    logger.info(`[indexFlyerDeals] Indexed ${docs.length} deals for flyer ${flyerId}`);
}
