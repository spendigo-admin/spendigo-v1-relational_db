import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions/v1';
import { indexFlyerDeals } from '../admin/indexFlyerDeals';
import { exportActiveDeals } from './exportActiveDeals';

const FLYERS_URL = 'https://flyers-ng.flippback.com/api/flipp/data?locale=en&postal_code={}&sid={}';
const FLYER_ITEMS_URL = 'https://flyers-ng.flippback.com/api/flipp/flyers/{}/flyer_items?locale=en&sid={}';
// Stores to ingest per Flipp category. Add new categories here as they become active.
// Only 'Groceries' is active for analytics today; other categories are ready to enable.
const CATEGORY_STORES: Record<string, string[]> = {
    'Groceries': [
        'No Frills', 'FreshCo', 'Walmart', 'Loblaws', 'Real Canadian Superstore',
        'Sobeys', 'Metro', 'Food Basics', 'Your Independent Grocer', 'Independent Grocers',
        'Giant Tiger', 'Farm Boy', 'Wholesale Club',
    ],
    // 'Home & Garden': ['Canadian Tire', 'Home Depot', 'Rona', 'Home Hardware', 'IKEA'],
    // 'Electronics':   ['Best Buy', 'Staples', 'The Source', 'London Drugs'],
    // 'Pets':          ['PetSmart', 'Pet Valu', "Ren's Pets"],
    // 'Fashion':       ["Mark's", 'Sport Chek', 'Old Navy', 'H&M', 'Gap'],
};

// Derived lookup: store name → which category it belongs to (for tagging ingested deals)
const STORE_TO_CATEGORY = new Map<string, string>(
    Object.entries(CATEGORY_STORES).flatMap(([cat, stores]) =>
        stores.map(s => [s, cat] as [string, string])
    )
);

function generateSid(): string {
    return Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join('');
}

function chunkArray<T>(array: T[], size: number): T[][] {
    const chunked_arr = [];
    let index = 0;
    while (index < array.length) {
        chunked_arr.push(array.slice(index, size + index));
        index += size;
    }
    return chunked_arr;
}

/**
 * Recursively deletes a collection and its subcollections (limited for flyers)
 */
async function clearFlyerData(db: admin.firestore.Firestore) {
    const flyersSnap = await db.collection('public_flyers').get();
    
    for (const doc of flyersSnap.docs) {
        // Delete deals subcollection first
        const dealsSnap = await doc.ref.collection('deals').get();
        const dealChunks = chunkArray(dealsSnap.docs, 400);
        for (const chunk of dealChunks) {
            const batch = db.batch();
            chunk.forEach(deal => batch.delete(deal.ref));
            await batch.commit();
        }
        // Delete the flyer doc
        await doc.ref.delete();
    }
}

export async function runIngestion(postalCode: string, resetData: boolean = false) {
    const db = admin.firestore();
    const cleanPostalCode = postalCode.replace(/\s+/g, '').toUpperCase();

    if (resetData) {
        logger.info("Resetting existing flyer data...");
        await clearFlyerData(db);
    }

    try {
        const sid = generateSid();
        const url = FLYERS_URL.replace('{}', cleanPostalCode).replace('{}', sid);
        
        const response = await fetch(url);
        if (!response.ok) {
             throw new Error(`Flipp API Error: ${response.statusText}`);
        }
        const jsonResponse = await response.json();

        if (!jsonResponse.flyers) {
             return { success: true, processedFlyers: 0, totalDealsSaved: 0, summaryData: [] };
        }

        const groceryFlyers = jsonResponse.flyers.filter((flyer: any) => {
            const merchant = flyer.merchant;
            let categories = flyer.categories || [];
            if (typeof categories === 'string') {
                categories = categories.split(',').map((c: string) => c.trim());
            }
            const assignedCategory = STORE_TO_CATEGORY.get(merchant);
            return assignedCategory !== undefined && categories.includes(assignedCategory);
        });

        if (groceryFlyers.length === 0) {
             return { success: true, processedFlyers: 0, totalDealsSaved: 0, summaryData: [] };
        }

        let totalDealsSaved = 0;
        let processedFlyers = 0;
        const summaryData: any[] = [];

        for (const flyer of groceryFlyers) {
            const flyerId = flyer.id.toString();
            const itemsUrl = FLYER_ITEMS_URL.replace('{}', flyerId).replace('{}', generateSid());
            const itemsResponse = await fetch(itemsUrl);
            
            if (!itemsResponse.ok) {
                logger.warn(`Failed to fetch items for flyer ${flyerId}`);
                continue;
            }
            
            const itemsData = await itemsResponse.json();
            const flyerRef = db.collection('public_flyers').doc(flyerId);
            
            const flyerMetadata = {
                id: flyerId,
                title: flyer.name || 'Weekly Savings',
                retailer: flyer.merchant,
                validFrom: flyer.valid_from ? flyer.valid_from.split('T')[0] : null,
                validTo: flyer.valid_to ? flyer.valid_to.split('T')[0] : null,
                pages: flyer.pages || 0,
                dealsCount: itemsData.length,
                ingestedAt: admin.firestore.FieldValue.serverTimestamp(),
                postalCode: cleanPostalCode
            };

            const dealsToWrite = itemsData
                .filter((item: any) => item.name)
                .map((item: any) => {
                    const dealId = item.id ? item.id.toString() : Math.random().toString(36).substring(7);
                    const dealRef = flyerRef.collection('deals').doc(dealId);
                    return {
                        ref: dealRef,
                        data: {
                            id: dealId,
                            flyerId: flyerId,
                            retailer: flyer.merchant,
                            category: STORE_TO_CATEGORY.get(flyer.merchant) ?? 'Groceries',
                            name: item.name,
                            description: item.description || null,
                            brand: item.brand || null,
                            currentPrice: item.price || item.current_price || null,
                            originalPrice: item.original_price || null,
                            prePriceText: item.pre_price_text || null,
                            postPriceText: item.post_price_text || null,
                            priceText: item.price_text || null,
                            validFrom: item.valid_from || flyer.valid_from,
                            validTo: item.valid_to || flyer.valid_to,
                            imageUrl: item.cutout_image_url || null,
                            ingestedAt: admin.firestore.FieldValue.serverTimestamp()
                        }
                    };
                });

            const operations = [{ ref: flyerRef, data: flyerMetadata }, ...dealsToWrite];
            const chunks = chunkArray(operations, 400);
            for (const chunk of chunks) {
                const batch = db.batch();
                for (const op of chunk) {
                    batch.set(op.ref as admin.firestore.DocumentReference, op.data, { merge: true });
                }
                await batch.commit();
            }

            processedFlyers++;
            totalDealsSaved += dealsToWrite.length;
            summaryData.push({ retailer: flyer.merchant, dealsCount: dealsToWrite.length });

            // Fire-and-forget: index deals into flat time-series collection for predictive analytics
            indexFlyerDeals(flyerId).catch(err =>
                logger.error(`[indexFlyerDeals] Failed for flyer ${flyerId}:`, err)
            );
        }

        // Generate static JSON export of all active deals for zero-read client comparison
        try {
            await exportActiveDeals();
        } catch (storageError) {
            logger.error("Failed to upload active_deals.json to storage:", storageError);
            // Non-fatal: ingestion is still considered successful
        }

        return {
            success: true,
            processedFlyers,
            totalDealsSaved,
            summaryData
        };

    } catch (error: any) {
        logger.error('Error in runIngestion:', error);
        throw error;
    }
}
