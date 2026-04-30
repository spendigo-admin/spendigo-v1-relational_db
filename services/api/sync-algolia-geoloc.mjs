import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { liteClient } from 'algoliasearch/lite';

const app = initializeApp();
const db = getFirestore(app);

const algoliaClient = liteClient('G4YDI21FPH', '6cabd23827fa8fb10e3ca6d3c67e12ca');
const INDEX_NAME = 'merchant_products';

async function run() {
    console.log("Fetching all merchant_products...");
    const snapshot = await db.collection('merchant_products').get();
    console.log(`Found ${snapshot.size} merchant products.`);
    
    // Fetch all stores to map their coordinates
    const storeSnapshot = await db.collection('stores').get();
    const storeMap = new Map();
    storeSnapshot.forEach(doc => {
        storeMap.set(doc.id, doc.data());
    });
    
    const updates = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        const storeData = storeMap.get(data.merchant_id);
        
        let geoloc = null;
        if (storeData?.coordinates?.lat && storeData?.coordinates?.lng) {
            geoloc = {
                lat: storeData.coordinates.lat,
                lng: storeData.coordinates.lng
            };
        }
        
        if (geoloc) {
            updates.push({
                action: 'partialUpdateObject',
                body: {
                    objectID: doc.id,
                    _geoloc: geoloc
                }
            });
        }
    });
    
    console.log(`Prepared ${updates.length} updates for Algolia.`);
    
    if (updates.length > 0) {
        // Batch update
        const chunks = [];
        for (let i = 0; i < updates.length; i += 100) {
            chunks.push(updates.slice(i, i + 100));
        }
        
        for (const chunk of chunks) {
            try {
                await algoliaClient.batch({
                    indexName: INDEX_NAME,
                    batchWriteParams: { requests: chunk }
                });
                console.log(`Sent chunk of ${chunk.length} updates.`);
            } catch (err) {
                console.error("Batch error:", err);
            }
        }
    }
    console.log("Done.");
}

run().catch(console.error);
