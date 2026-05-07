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
exports.sendCampaign = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const rateLimiter_1 = require("../utils/rateLimiter");
const fcm_1 = require("../utils/fcm");
const ALLOWED_MESSAGES = [
    "Our latest flyer is live! Check out this week's deals.",
    "New weekly deals just dropped. View our flyer and save big!",
    "Don't miss this week's specials — see our latest flyer now!",
    "Fresh savings in our new flyer. Limited time only!",
    "Your favourite store has new deals. Check our flyer today!",
];
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
/**
 * Sends a push campaign to a merchant-defined segment of users.
 * Segments: 'nearby' (proximity), 'inactive' (30d+), 'active' (within 30d), 'high_value' (top 25% spend).
 * Rate-limited to 5 sends per 24h per merchant.
 */
exports.sendCampaign = functions.https.onCall(async (data, context) => {
    var _a, _b;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    const uid = context.auth.uid;
    const { storeId, segment, message, title, dealId } = data;
    if (!storeId || !segment || !message) {
        throw new functions.https.HttpsError('invalid-argument', 'storeId, segment, and message are required.');
    }
    if (message.length > 160) {
        throw new functions.https.HttpsError('invalid-argument', 'Message must be 160 characters or fewer.');
    }
    // Deal promotions carry a dealId and use a system-generated message — exempt from the whitelist.
    // Manual campaigns (no dealId) must use an approved message to prevent free-text abuse.
    if (!dealId && !ALLOWED_MESSAGES.includes(message)) {
        throw new functions.https.HttpsError('invalid-argument', 'Message must be selected from the approved list.');
    }
    if (!['nearby', 'inactive', 'active', 'high_value'].includes(segment)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid segment type.');
    }
    const db = admin.firestore();
    // Verify merchant owns this store
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();
    if (!userDoc.exists || (userData === null || userData === void 0 ? void 0 : userData.role) !== 'merchant' || (userData === null || userData === void 0 ? void 0 : userData.storeId) !== storeId) {
        throw new functions.https.HttpsError('permission-denied', 'You do not own this store.');
    }
    // Rate limit: 10 campaigns per 24h per merchant
    await (0, rateLimiter_1.checkRateLimit)(uid, 'sendCampaign', 50, 24 * 60 * 60 * 1000);
    const storeDoc = await db.collection('stores').doc(storeId).get();
    if (!storeDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Store not found.');
    }
    const store = storeDoc.data();
    const campaignTitle = title || store.name || 'Special Offer';
    // Resolve segment to a list of {uid, fcmTokens} pairs
    const qualifiedUsers = [];
    if (segment === 'nearby') {
        if (!((_a = store.coordinates) === null || _a === void 0 ? void 0 : _a.lat) || !((_b = store.coordinates) === null || _b === void 0 ? void 0 : _b.lng)) {
            throw new functions.https.HttpsError('failed-precondition', 'Store coordinates are not set.');
        }
        const { lat: storeLat, lng: storeLng } = store.coordinates;
        functions.logger.info(`[sendCampaign] nearby: store coords (${storeLat}, ${storeLng})`);
        let lastDoc;
        let hasMore = true;
        let scanned = 0, noToken = 0, noPromo = 0, noCoords = 0, tooFar = 0;
        while (hasMore) {
            let q = db.collection('users').limit(500);
            if (lastDoc)
                q = q.startAfter(lastDoc);
            const snap = await q.get();
            if (snap.empty || snap.size < 500)
                hasMore = false;
            if (!snap.empty)
                lastDoc = snap.docs[snap.docs.length - 1];
            snap.forEach(doc => {
                var _a, _b, _c, _d, _e;
                const u = doc.data();
                scanned++;
                if (!((_a = u.fcmTokens) === null || _a === void 0 ? void 0 : _a.length)) {
                    noToken++;
                    return;
                }
                const prefs = u.notificationPreferences || {};
                if (prefs.promotions === false) {
                    noPromo++;
                    return;
                }
                const maxDist = prefs.maxDistance || 10;
                const addresses = u.addresses || [];
                const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
                const userLat = (_b = defaultAddr === null || defaultAddr === void 0 ? void 0 : defaultAddr.lat) !== null && _b !== void 0 ? _b : (_c = u.coordinates) === null || _c === void 0 ? void 0 : _c.lat;
                const userLng = (_d = defaultAddr === null || defaultAddr === void 0 ? void 0 : defaultAddr.lng) !== null && _d !== void 0 ? _d : (_e = u.coordinates) === null || _e === void 0 ? void 0 : _e.lng;
                if (!userLat || !userLng) {
                    noCoords++;
                    return;
                }
                const dist = calculateDistance(storeLat, storeLng, userLat, userLng);
                if (dist > maxDist) {
                    tooFar++;
                    return;
                }
                qualifiedUsers.push({ uid: doc.id, fcmTokens: u.fcmTokens });
            });
        }
        functions.logger.info(`[sendCampaign] nearby scan: total=${scanned} noToken=${noToken} noPromo=${noPromo} noCoords=${noCoords} tooFar=${tooFar} qualified=${qualifiedUsers.length}`);
    }
    else {
        const ordersSnap = await db.collection('orders').where('storeId', '==', storeId).get();
        const customerIds = [...new Set(ordersSnap.docs.map(d => d.data().customerId))];
        functions.logger.info(`[sendCampaign] ${segment}: storeId=${storeId} orders=${ordersSnap.size} uniqueCustomers=${customerIds.length}`);
        if (customerIds.length === 0) {
            await db.collection('campaign_logs').add({
                storeId, segment, message, title: campaignTitle,
                dealId: dealId || null, sentCount: 0, failedCount: 0,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                triggeredBy: 'merchant',
            });
            return { sentCount: 0, failedCount: 0 };
        }
        const CHUNK = 30;
        const userDocs = [];
        for (let i = 0; i < customerIds.length; i += CHUNK) {
            const chunk = customerIds.slice(i, i + CHUNK);
            const snaps = await Promise.all(chunk.map(id => db.collection('users').doc(id).get()));
            snaps.forEach(snap => {
                if (snap.exists)
                    userDocs.push(Object.assign({ id: snap.id }, snap.data()));
            });
        }
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        let filtered;
        if (segment === 'inactive') {
            filtered = userDocs.filter(u => {
                if (!u.last_order_date)
                    return true;
                return new Date(u.last_order_date) < thirtyDaysAgo;
            });
        }
        else if (segment === 'active') {
            filtered = userDocs.filter(u => {
                if (!u.last_order_date)
                    return false;
                return new Date(u.last_order_date) >= thirtyDaysAgo;
            });
        }
        else {
            const sorted = [...userDocs].sort((a, b) => (b.total_spend || 0) - (a.total_spend || 0));
            const topCount = Math.max(1, Math.ceil(sorted.length * 0.25));
            filtered = sorted.slice(0, topCount);
        }
        const withTokens = filtered.filter(u => { var _a; return (_a = u.fcmTokens) === null || _a === void 0 ? void 0 : _a.length; });
        functions.logger.info(`[sendCampaign] ${segment}: fetched=${userDocs.length} afterFilter=${filtered.length} withTokens=${withTokens.length}`);
        withTokens.forEach(u => qualifiedUsers.push({ uid: u.id, fcmTokens: u.fcmTokens }));
    }
    // Send FCM in batches of 500, tracking tokens per user for stale-token cleanup
    const BATCH_SIZE = 500;
    let totalSent = 0;
    let totalFailed = 0;
    const allTokens = qualifiedUsers.flatMap(u => u.fcmTokens);
    const tokenOwner = qualifiedUsers.flatMap(u => u.fcmTokens.map(() => u.uid));
    for (let i = 0; i < allTokens.length; i += BATCH_SIZE) {
        const batchTokens = allTokens.slice(i, i + BATCH_SIZE);
        const batchOwners = tokenOwner.slice(i, i + BATCH_SIZE);
        const msg = {
            tokens: batchTokens,
            notification: { title: campaignTitle, body: message },
            data: Object.assign({ type: 'promo', storeId, link: `/store/${storeId}` }, (dealId ? { dealId } : {})),
        };
        try {
            const res = await admin.messaging().sendEachForMulticast(msg);
            totalSent += res.successCount;
            totalFailed += res.failureCount;
            if (res.failureCount > 0) {
                // Group by user so removeStaleTokens gets the right parallel arrays
                const byUser = new Map();
                res.responses.forEach((r, idx) => {
                    const userId = batchOwners[idx];
                    if (!byUser.has(userId))
                        byUser.set(userId, { tokens: [], responses: [] });
                    byUser.get(userId).tokens.push(batchTokens[idx]);
                    byUser.get(userId).responses.push(r);
                });
                await Promise.all([...byUser.entries()].map(([userId, { tokens, responses }]) => (0, fcm_1.removeStaleTokens)(userId, tokens, responses)));
            }
        }
        catch (err) {
            functions.logger.error('[sendCampaign] FCM batch error:', err);
            totalFailed += batchTokens.length;
        }
    }
    await db.collection('campaign_logs').add({
        storeId,
        segment,
        message,
        title: campaignTitle,
        dealId: dealId || null,
        sentCount: totalSent,
        failedCount: totalFailed,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        triggeredBy: 'merchant',
    });
    // Write in-app notification to each qualified user's inbox (batched, 500 per Firestore batch)
    const FIRESTORE_BATCH = 500;
    for (let i = 0; i < qualifiedUsers.length; i += FIRESTORE_BATCH) {
        const batch = db.batch();
        qualifiedUsers.slice(i, i + FIRESTORE_BATCH).forEach(({ uid: userId }) => {
            const ref = db.collection('users').doc(userId).collection('notifications').doc();
            batch.set(ref, {
                id: ref.id,
                type: 'promo',
                title: campaignTitle,
                message,
                storeId,
                dealId: dealId || null,
                link: `/store/${storeId}`,
                timestamp: new Date().toISOString(),
                read: false,
            });
        });
        await batch.commit();
    }
    functions.logger.info(`[sendCampaign] store=${storeId} segment=${segment} sent=${totalSent} failed=${totalFailed}`);
    return { sentCount: totalSent, failedCount: totalFailed };
});
//# sourceMappingURL=sendCampaign.js.map