"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onMerchantProductPriceChange = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const fcm_1 = require("../utils/fcm");
const db = admin.firestore();
/**
 * Captures price changes on merchant_products updates into a price_history subcollection.
 * Stores one snapshot per day per product — lightweight for trend indicators.
 */
/**
 * Calculates the Haversine distance between two points in km
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function deg2rad(deg) {
    return deg * (Math.PI / 180);
}
/**
 * Captures price changes and sends proximity alerts.
 */
exports.onMerchantProductPriceChange = functions.firestore
    .document('merchant_products/{productId}')
    .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;
    const productId = context.params.productId;
    if (!after)
        return; // Delete operation
    const oldPrice = (before === null || before === void 0 ? void 0 : before.price) || 0;
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
    functions.logger.info(`[NotificationTrigger] Item: ${after.name}, isNew: ${isNew}, Price: ${newPrice}, Old: ${oldPrice}, isSale: ${isSale}, isPriceDrop: ${isPriceDrop}`);
    if (isPriceDrop || (isNew && isSale)) {
        functions.logger.info(`[NotificationTrigger] Deal detected for ${after.name}. ID: ${productId}`);
        // Get Merchant Data
        const merchantSnap = await db.collection('stores').doc(after.merchant_id).get();
        const merchant = merchantSnap.data();
        if (!merchant || !merchant.coordinates) {
            functions.logger.info(`[NotificationTrigger] Merchant ${after.merchant_id} coordinates missing. Skipping alert.`);
            return;
        }
        const merchantLat = merchant.coordinates.lat;
        const merchantLng = merchant.coordinates.lng;
        functions.logger.info(`[NotificationTrigger] Merchant Location: ${merchantLat}, ${merchantLng}`);
        // Query all users — filtering by fcmTokens array inequality is unreliable in Firestore.
        // Users without tokens are cheaply skipped below.
        const notifications = [];
        const matchedUsers = [];
        let lastDoc;
        let hasMore = true;
        let totalChecked = 0;
        while (hasMore) {
            let usersQuery = db.collection('users').limit(500);
            if (lastDoc)
                usersQuery = usersQuery.startAfter(lastDoc);
            const usersSnap = await usersQuery.get();
            totalChecked += usersSnap.size;
            if (usersSnap.empty || usersSnap.size < 500)
                hasMore = false;
            if (!usersSnap.empty)
                lastDoc = usersSnap.docs[usersSnap.docs.length - 1];
            usersSnap.forEach(userDoc => {
                var _a, _b, _c, _d;
                const userData = userDoc.data();
                const userId = userDoc.id;
                const prefs = userData.notificationPreferences || {};
                // Skip users who haven't opted in for this specific event type.
                // isPriceDrop events require priceDrop preference; sale/promo events require promotions.
                const wantsPriceDrop = prefs.priceDrop !== false;
                const wantsPromotions = prefs.promotions !== false;
                const isRelevant = isPriceDrop ? wantsPriceDrop : wantsPromotions;
                if (!isRelevant) {
                    functions.logger.info(`[NotificationTrigger] User ${userId} has this alert type disabled.`);
                    return;
                }
                const maxDist = prefs.maxDistance || 10;
                const addresses = userData.addresses || [];
                const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
                // Prefer geocoded address coords; fall back to flat coordinates set at registration
                const userLat = (_a = defaultAddr === null || defaultAddr === void 0 ? void 0 : defaultAddr.lat) !== null && _a !== void 0 ? _a : (_b = userData.coordinates) === null || _b === void 0 ? void 0 : _b.lat;
                const userLng = (_c = defaultAddr === null || defaultAddr === void 0 ? void 0 : defaultAddr.lng) !== null && _c !== void 0 ? _c : (_d = userData.coordinates) === null || _d === void 0 ? void 0 : _d.lng;
                if (userLat && userLng) {
                    const dist = calculateDistance(merchantLat, merchantLng, userLat, userLng);
                    functions.logger.info(`[NotificationTrigger] User ${userId} is ${dist.toFixed(2)}km away. (Max: ${maxDist}km)`);
                    if (dist <= maxDist) {
                        const notifTitle = isPriceDrop ? 'Price Drop! 📉' : 'New Deal Alert! ✨';
                        const notifBody = `${after.name} is now $${newPrice} at ${merchant.name} (${dist.toFixed(1)}km away).`;
                        matchedUsers.push({ uid: userId, title: notifTitle, body: notifBody });
                        const tokenList = userData.fcmTokens || [];
                        if (tokenList.length === 0)
                            return;
                        functions.logger.info(`[NotificationTrigger] User ${userId} MATCHED! Sending to ${tokenList.length} tokens.`);
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
                        notifications.push(admin.messaging().sendEachForMulticast(message).then(async (res) => {
                            functions.logger.info(`[NotificationTrigger] FCM Result for ${userId}: SUCCESS: ${res.successCount}, FAIL: ${res.failureCount}`);
                            if (res.failureCount > 0) {
                                await (0, fcm_1.removeStaleTokens)(userId, tokenList, res.responses);
                            }
                            return res;
                        }).catch(err => {
                            functions.logger.error(`[NotificationTrigger] FCM Error for ${userId}:`, err);
                        }));
                    }
                }
                else {
                    functions.logger.info(`[NotificationTrigger] User ${userId} missing coordinates in default address.`);
                }
            });
        }
        functions.logger.info(`[NotificationTrigger] Checked ${totalChecked} users for proximity.`);
        if (notifications.length > 0) {
            await Promise.all(notifications);
            functions.logger.info(`[NotificationTrigger] Finished processing proximity alerts.`);
        }
        else {
            functions.logger.info('[NotificationTrigger] No matching users found in proximity.');
        }
        // Write in-app inbox notification for every matched user (with or without FCM token)
        if (matchedUsers.length > 0) {
            const now = new Date().toISOString();
            const BATCH_SIZE = 500;
            for (let i = 0; i < matchedUsers.length; i += BATCH_SIZE) {
                const batch = db.batch();
                matchedUsers.slice(i, i + BATCH_SIZE).forEach(({ uid, title, body }) => {
                    const ref = db.collection('users').doc(uid).collection('notifications').doc();
                    batch.set(ref, {
                        id: ref.id,
                        type: isPriceDrop ? 'price_drop' : 'promo',
                        title,
                        message: body,
                        productId,
                        storeId: after.merchant_id,
                        link: `/store/${after.merchant_id}`,
                        timestamp: now,
                        read: false,
                    });
                });
                await batch.commit();
            }
            functions.logger.info(`[NotificationTrigger] Wrote ${matchedUsers.length} inbox notifications.`);
        }
    }
    else {
        functions.logger.info(`[NotificationTrigger] No deal criteria met for ${after.name}.`);
    }
});
//# sourceMappingURL=priceHistoryTrigger.js.map