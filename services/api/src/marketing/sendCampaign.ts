import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { checkRateLimit } from '../utils/rateLimiter';
import { removeStaleTokens } from '../utils/fcm';

type Segment = 'nearby' | 'inactive' | 'active' | 'high_value';

const ALLOWED_MESSAGES = [
    "Our latest flyer is live! Check out this week's deals.",
    "New weekly deals just dropped. View our flyer and save big!",
    "Don't miss this week's specials — see our latest flyer now!",
    "Fresh savings in our new flyer. Limited time only!",
    "Your favourite store has new deals. Check our flyer today!",
];

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Sends a push campaign to a merchant-defined segment of users.
 * Segments: 'nearby' (proximity), 'inactive' (30d+), 'active' (within 30d), 'high_value' (top 25% spend).
 * Rate-limited to 5 sends per 24h per merchant.
 */
export const sendCampaign = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        functions.logger.warn('[sendCampaign] App Check token missing — verify reCAPTCHA Enterprise config', { uid: context.auth.uid });
    }

    const uid = context.auth.uid;
    const { storeId, segment, message, title, dealId } = data as {
        storeId: string;
        segment: Segment;
        message: string;
        title?: string;
        dealId?: string;
    };

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
    if (!userDoc.exists || userData?.role !== 'merchant' || userData?.storeId !== storeId) {
        throw new functions.https.HttpsError('permission-denied', 'You do not own this store.');
    }

    // Rate limit: 10 campaigns per 24h per merchant
    await checkRateLimit(uid, 'sendCampaign', 50, 24 * 60 * 60 * 1000);

    const storeDoc = await db.collection('stores').doc(storeId).get();
    if (!storeDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Store not found.');
    }
    const store = storeDoc.data()!;
    const campaignTitle = title || store.name || 'Special Offer';

    // Resolve segment to a list of {uid, fcmTokens} pairs
    const qualifiedUsers: { uid: string; fcmTokens: string[] }[] = [];

    if (segment === 'nearby') {
        if (!store.coordinates?.lat || !store.coordinates?.lng) {
            throw new functions.https.HttpsError('failed-precondition', 'Store coordinates are not set.');
        }
        const { lat: storeLat, lng: storeLng } = store.coordinates;
        functions.logger.info(`[sendCampaign] nearby: store coords (${storeLat}, ${storeLng})`);

        let lastDoc: admin.firestore.QueryDocumentSnapshot | undefined;
        let hasMore = true;
        let scanned = 0, noToken = 0, noPromo = 0, noCoords = 0, tooFar = 0;

        while (hasMore) {
            let q: admin.firestore.Query = db.collection('users').limit(500);
            if (lastDoc) q = q.startAfter(lastDoc);

            const snap = await q.get();
            if (snap.empty || snap.size < 500) hasMore = false;
            if (!snap.empty) lastDoc = snap.docs[snap.docs.length - 1];

            snap.forEach(doc => {
                const u = doc.data();
                scanned++;
                if (!u.fcmTokens?.length) { noToken++; return; }

                const prefs = u.notificationPreferences || {};
                if (prefs.promotions === false) { noPromo++; return; }

                const maxDist = prefs.maxDistance || 10;
                const addresses = u.addresses || [];
                const defaultAddr = addresses.find((a: any) => a.isDefault) || addresses[0];
                const userLat: number | undefined = defaultAddr?.lat ?? u.coordinates?.lat;
                const userLng: number | undefined = defaultAddr?.lng ?? u.coordinates?.lng;
                if (!userLat || !userLng) { noCoords++; return; }

                const dist = calculateDistance(storeLat, storeLng, userLat, userLng);
                if (dist > maxDist) { tooFar++; return; }

                qualifiedUsers.push({ uid: doc.id, fcmTokens: u.fcmTokens });
            });
        }

        functions.logger.info(
            `[sendCampaign] nearby scan: total=${scanned} noToken=${noToken} noPromo=${noPromo} noCoords=${noCoords} tooFar=${tooFar} qualified=${qualifiedUsers.length}`
        );
    } else {
        const ordersSnap = await db.collection('orders').where('storeId', '==', storeId).get();
        const customerIds = [...new Set(ordersSnap.docs.map(d => d.data().customerId as string))];
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
        const userDocs: (admin.firestore.DocumentData & { id: string })[] = [];
        for (let i = 0; i < customerIds.length; i += CHUNK) {
            const chunk = customerIds.slice(i, i + CHUNK);
            const snaps = await Promise.all(chunk.map(id => db.collection('users').doc(id).get()));
            snaps.forEach(snap => {
                if (snap.exists) userDocs.push({ id: snap.id, ...snap.data() });
            });
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let filtered: typeof userDocs;
        if (segment === 'inactive') {
            filtered = userDocs.filter(u => {
                if (!u.last_order_date) return true;
                return new Date(u.last_order_date) < thirtyDaysAgo;
            });
        } else if (segment === 'active') {
            filtered = userDocs.filter(u => {
                if (!u.last_order_date) return false;
                return new Date(u.last_order_date) >= thirtyDaysAgo;
            });
        } else {
            const sorted = [...userDocs].sort((a, b) => (b.total_spend || 0) - (a.total_spend || 0));
            const topCount = Math.max(1, Math.ceil(sorted.length * 0.25));
            filtered = sorted.slice(0, topCount);
        }

        const withTokens = filtered.filter(u => u.fcmTokens?.length);
        functions.logger.info(
            `[sendCampaign] ${segment}: fetched=${userDocs.length} afterFilter=${filtered.length} withTokens=${withTokens.length}`
        );
        withTokens.forEach(u => qualifiedUsers.push({ uid: u.id, fcmTokens: u.fcmTokens }));
    }

    // Send FCM in batches of 500, tracking tokens per user for stale-token cleanup
    const BATCH_SIZE = 500;
    let totalSent = 0;
    let totalFailed = 0;

    const allTokens = qualifiedUsers.flatMap(u => u.fcmTokens);
    const tokenOwner: string[] = qualifiedUsers.flatMap(u => u.fcmTokens.map(() => u.uid));

    for (let i = 0; i < allTokens.length; i += BATCH_SIZE) {
        const batchTokens = allTokens.slice(i, i + BATCH_SIZE);
        const batchOwners = tokenOwner.slice(i, i + BATCH_SIZE);

        const msg: admin.messaging.MulticastMessage = {
            tokens: batchTokens,
            notification: { title: campaignTitle, body: message },
            data: {
                type: 'promo',
                storeId,
                link: `/store/${storeId}`,
                ...(dealId ? { dealId } : {}),
            },
        };

        try {
            const res = await admin.messaging().sendEachForMulticast(msg);
            totalSent += res.successCount;
            totalFailed += res.failureCount;

            if (res.failureCount > 0) {
                // Group by user so removeStaleTokens gets the right parallel arrays
                const byUser = new Map<string, { tokens: string[]; responses: admin.messaging.SendResponse[] }>();
                res.responses.forEach((r, idx) => {
                    const userId = batchOwners[idx];
                    if (!byUser.has(userId)) byUser.set(userId, { tokens: [], responses: [] });
                    byUser.get(userId)!.tokens.push(batchTokens[idx]);
                    byUser.get(userId)!.responses.push(r);
                });
                await Promise.all(
                    [...byUser.entries()].map(([userId, { tokens, responses }]) =>
                        removeStaleTokens(userId, tokens, responses)
                    )
                );
            }
        } catch (err) {
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
