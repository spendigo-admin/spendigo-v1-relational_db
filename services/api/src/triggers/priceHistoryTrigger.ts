import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Captures price changes on merchant_products updates into a price_history subcollection.
 * Stores one snapshot per day per product — lightweight for trend indicators.
 */
/**
 * Calculates the Haversine distance between two points in km
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}

/**
 * Captures price changes and sends proximity alerts.
 */
export const onMerchantProductPriceChange = functions.firestore
    .document('merchant_products/{productId}')
    .onWrite(async (change, context) => {
        const before = change.before.exists ? change.before.data() : null;
        const after = change.after.exists ? change.after.data() : null;
        const productId = context.params.productId;

        if (!after) return; // Delete operation

        const oldPrice = before?.price || 0;
        const newPrice = after.price;
        const isNew = !before;

        // 1. Log Price History (if updated)
        if (!isNew && oldPrice !== newPrice && typeof newPrice === 'number' && newPrice > 0) {
            const today = new Date().toISOString().split('T')[0];
            await db.collection('merchant_products').doc(productId).collection('price_history').doc(today).set({
                price: newPrice,
                previousPrice: oldPrice,
                date: today,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                merchant_id: after.merchant_id,
            }, { merge: true });
        }

        // 2. Check for "Deal" (Price drop or new sale item)
        const isPriceDrop = !isNew && newPrice < oldPrice;
        const isSale = after.on_sale === true || 
                       (after.sale_price && after.sale_price < after.price) ||
                       (after.original_price && after.original_price > after.price);
        
        console.log(`[NotificationTrigger] Item: ${after.name}, isNew: ${isNew}, Price: ${newPrice}, Old: ${oldPrice}, isSale: ${isSale}, isPriceDrop: ${isPriceDrop}`);

        if (isPriceDrop || (isNew && isSale)) {
            console.log(`[NotificationTrigger] Deal detected for ${after.name}. ID: ${productId}`);
            
            // Get Merchant Data
            const merchantSnap = await db.collection('stores').doc(after.merchant_id).get();
            const merchant = merchantSnap.data();
            if (!merchant || !merchant.coordinates) {
                console.log(`[NotificationTrigger] Merchant ${after.merchant_id} coordinates missing. Skipping alert.`);
                return;
            }

            const merchantLat = merchant.coordinates.lat;
            const merchantLng = merchant.coordinates.lng;
            console.log(`[NotificationTrigger] Merchant Location: ${merchantLat}, ${merchantLng}`);

            // Query all users — filtering by fcmTokens array inequality is unreliable in Firestore.
            // Users without tokens are cheaply skipped below.
            const usersSnap = await db.collection('users')
                .limit(500)
                .get();

            console.log(`[NotificationTrigger] Found ${usersSnap.size} users with FCM tokens to check.`);

            const notifications: Promise<any>[] = [];

            usersSnap.forEach(userDoc => {
                const userData = userDoc.data();
                const userId = userDoc.id;
                const prefs = userData.notificationPreferences || {};
                
                // Skip users who haven't opted in for this specific event type.
                // isPriceDrop events require priceDrop preference; sale/promo events require promotions.
                const wantsPriceDrop = prefs.priceDrop !== false;
                const wantsPromotions = prefs.promotions !== false;
                const isRelevant = isPriceDrop ? wantsPriceDrop : wantsPromotions;
                if (!isRelevant) {
                    console.log(`[NotificationTrigger] User ${userId} has this alert type disabled.`);
                    return;
                }

                const maxDist = prefs.maxDistance || 10;
                const addresses = userData.addresses || [];
                const defaultAddr = addresses.find((a: any) => a.isDefault) || addresses[0];

                if (defaultAddr && defaultAddr.lat && defaultAddr.lng) {
                    const dist = calculateDistance(merchantLat, merchantLng, defaultAddr.lat, defaultAddr.lng);
                    console.log(`[NotificationTrigger] User ${userId} is ${dist.toFixed(2)}km away. (Max: ${maxDist}km)`);
                    
                    if (dist <= maxDist) {
                        const tokenList = userData.fcmTokens || [];
                        if (tokenList.length === 0) return;

                        console.log(`[NotificationTrigger] User ${userId} MATCHED! Sending to ${tokenList.length} tokens.`);

                        const message = {
                            notification: {
                                title: isPriceDrop ? 'Price Drop! 📉' : 'New Deal Alert! ✨',
                                body: `${after.name} is now $${newPrice} at ${merchant.name} (${dist.toFixed(1)}km away).`
                            },
                            data: {
                                type: 'price_drop',
                                productId: productId,
                                merchantId: after.merchant_id,
                                link: `/store/${after.merchant_id}`
                            },
                            tokens: tokenList
                        };

                        notifications.push(admin.messaging().sendEachForMulticast(message).then(res => {
                            console.log(`[NotificationTrigger] FCM Result for ${userId}: SUCCESS: ${res.successCount}, FAIL: ${res.failureCount}`);
                            return res;
                        }).catch(err => {
                            console.error(`[NotificationTrigger] FCM Error for ${userId}:`, err);
                        }));
                    }
                } else {
                    console.log(`[NotificationTrigger] User ${userId} missing coordinates in default address.`);
                }
            });

            if (notifications.length > 0) {
                await Promise.all(notifications);
                console.log(`[NotificationTrigger] Finished processing proximity alerts.`);
            } else {
                console.log('[NotificationTrigger] No matching users found in proximity.');
            }
        } else {
            console.log(`[NotificationTrigger] No deal criteria met for ${after.name}.`);
        }
    });

