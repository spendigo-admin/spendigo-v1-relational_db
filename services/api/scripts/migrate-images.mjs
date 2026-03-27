import admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';
import { getDownloadURL } from 'firebase-admin/storage';

// This is a standalone script that runs locally with Firebase Admin
// It expects FIREBASE_SERVICE_ACCOUNT or similar env, or works locally if authenticated
// and initialized with the correct project credentials.

// Standard local initialization for Spendigo mono-repo scripts
// Ensure we're running from project root or apps/api context.
if (!admin.apps.length) {
    admin.initializeApp({
        storageBucket: 'spendigo-8540c.firebasestorage.app'
    });
}

const db = admin.firestore();
const storage = admin.storage();

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    console.log("Starting Master Product Image Migration...");
    
    // We are looking for any products that have openfoodfacts in their URL
    // Since firestore doesn't support 'contains' string searches easily dynamically, 
    // we fetch them all or chunk them if dataset is huge.
    // For Beta scale, we can fetch all or a large chunk
    const limitCount = 500;
    
    console.log(`Fetching up to ${limitCount} master products...`);
    const snapshot = await db.collection('master_products')
        // We only want ones with external URLs: openfoodfacts is the key one. 
        // We'll iterate manually to find them.
        .limit(limitCount) 
        .get();

    let migrated = 0;
    let errors = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const imageUrl = data.primary_image_url;

        const isExternal = imageUrl && imageUrl.startsWith('http') && !imageUrl.includes('firebasestorage.googleapis.com') && !imageUrl.includes(storage.bucket().name);
        const isMissingToken = imageUrl && imageUrl.includes('firebasestorage.googleapis.com') && !imageUrl.includes('&token=');

        if (isExternal || isMissingToken) {
            console.log(`[${doc.id}] Processing image fix...`);
            
            try {
                let publicUrl;
                const bucket = storage.bucket();

                if (isMissingToken) {
                    // Extract file path from URL and just generate token
                    const urlObj = new URL(imageUrl);
                    const match = urlObj.pathname.match(/\/o\/(.+)$/);
                    if (match) {
                        const filePath = decodeURIComponent(match[1]);
                        publicUrl = await getDownloadURL(bucket.file(filePath));
                    }
                }

                if (!publicUrl) {
                    const sourceUrl = isMissingToken ? data.original_image_url : imageUrl;
                    if (!sourceUrl) throw new Error("No source URL to download");

                    const response = await fetch(sourceUrl);
                    if (!response.ok) {
                        throw new Error(`HTTP Error: ${response.status}`);
                    }

                    const buffer = await response.arrayBuffer();
                    
                    const urlPath = new URL(sourceUrl).pathname;
                    const extensionMatch = urlPath.match(/\.([^.]+)$/);
                    const ext = extensionMatch ? extensionMatch[1] : 'jpg';

                    const filePath = `products/${doc.id}.${ext}`;
                    const file = bucket.file(filePath);

                    const contentType = response.headers.get('content-type') || 'image/jpeg';

                    await file.save(Buffer.from(buffer), {
                        metadata: {
                            contentType: contentType,
                            cacheControl: 'public, max-age=31536000',
                        },
                    });

                    publicUrl = await getDownloadURL(file);
                }

                await doc.ref.update({
                    primary_image_url: publicUrl,
                    original_image_url: isExternal ? imageUrl : data.original_image_url,
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                });

                console.log(`[${doc.id}] Successfully migrated to Firebase Storage.`);
                migrated++;

                // Small delay to prevent rate-limiting on OpenFoodFacts
                await delay(300);

            } catch (err) {
                console.error(`[${doc.id}] Failed to migrate image:`, err.message);
                errors++;
            }
        }
    }

    console.log(`\nMigration Complete: Migrated ${migrated} images. Errors: ${errors}`);
    process.exit(0);
}

run().catch(console.error);
