import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const FLYERS_URL = 'https://flyers-ng.flippback.com/api/flipp/data?locale=en&postal_code={}&sid={}';
const FLYER_ITEMS_URL = 'https://flyers-ng.flippback.com/api/flipp/flyers/{}/flyer_items?locale=en&sid={}';
const GROCERY_STORES = new Set([
    'No Frills', 'FreshCo', 'Walmart', 'Loblaws', 'Real Canadian Superstore', 'Sobeys', 'Metro', 'Food Basics', 'Your Independent Grocer', 'Independent Grocers'
]);

function generateSid(): string {
    return Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join('');
}

// Helper to chunk arrays
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunked_arr = [];
    let index = 0;
    while (index < array.length) {
        chunked_arr.push(array.slice(index, size + index));
        index += size;
    }
    return chunked_arr;
}

export const scrapeFlyer = functions.https.onCall(async (data, context) => {
    // Basic Authentication Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    
    // Check Admin Role
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    if (userDoc.data()?.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can trigger ingestion.');
    }

    const { postalCode } = data;
    if (!postalCode || typeof postalCode !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Valid postal code is required.');
    }

    const cleanPostalCode = postalCode.replace(/\s+/g, '').toUpperCase();
    
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
            return GROCERY_STORES.has(merchant) && categories.includes('Groceries');
        });

        if (groceryFlyers.length === 0) {
             return { success: true, processedFlyers: 0, totalDealsSaved: 0, summaryData: [] };
        }

        let totalDealsSaved = 0;
        let processedFlyers = 0;
        const summaryData: any[] = [];

        // Iterate through all matched grocery flyers
        for (const flyer of groceryFlyers) {
            const flyerId = flyer.id.toString();
            
            const itemsUrl = FLYER_ITEMS_URL.replace('{}', flyerId).replace('{}', generateSid());
            const itemsResponse = await fetch(itemsUrl);
            
            if (!itemsResponse.ok) {
                console.warn(`Failed to fetch items for flyer ${flyerId}`);
                continue;
            }
            
            const itemsData = await itemsResponse.json();
            
            // Build Flyer Metadata
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

            // Prepare Deals data
            const dealsToWrite = itemsData
                .filter((item: any) => item.name) // Ensure it has a name
                .map((item: any) => {
                    const dealId = item.id ? item.id.toString() : Math.random().toString(36).substring(7);
                    const dealRef = flyerRef.collection('deals').doc(dealId);
                    return {
                        ref: dealRef,
                        data: {
                            id: dealId,
                            flyerId: flyerId,
                            retailer: flyer.merchant,
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

            // Write to Firestore in chunks (max 400 operations per batch to be safe)
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
            
            summaryData.push({
                retailer: flyer.merchant,
                dealsCount: dealsToWrite.length
            });
        }

        return {
            success: true,
            processedFlyers,
            totalDealsSaved,
            summaryData
        };

    } catch (error: any) {
        console.error('Error fetching flyers:', error);
        throw new functions.https.HttpsError('internal', 'Failed to fetch flyers: ' + error.message);
    }
});
