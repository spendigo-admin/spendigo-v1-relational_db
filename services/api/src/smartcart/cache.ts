import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import { SmartCartOptimizeResponse } from './types';

const db = admin.firestore();
const CACHE_COLLECTION = 'smartcart_optimizer_cache';
const CACHE_TTL_MS = 10 * 60 * 1000;

interface SmartCartCacheDocument {
    cacheKey: string;
    dataSignature: string;
    response: SmartCartOptimizeResponse;
    expiresAt: FirebaseFirestore.Timestamp;
    createdAt: FirebaseFirestore.Timestamp;
}

export function buildSmartCartCacheKey(
    shoppingList: string[],
    storeIds: string[] | null,
): string {
    const normalizedShoppingList = [...shoppingList].sort();
    const normalizedStoreIds = storeIds ? [...storeIds].sort() : ['ALL_STORES'];
    const payload = JSON.stringify({
        shopping_list: normalizedShoppingList,
        store_ids: normalizedStoreIds,
    });

    return createHash('sha256').update(payload).digest('hex');
}

export async function getCachedOptimizationResult(
    cacheKey: string,
    dataSignature: string,
): Promise<SmartCartOptimizeResponse | null> {
    const snapshot = await db.collection(CACHE_COLLECTION).doc(cacheKey).get();

    if (!snapshot.exists) {
        return null;
    }

    const data = snapshot.data() as SmartCartCacheDocument | undefined;

    if (!data) {
        return null;
    }

    const isExpired = data.expiresAt.toMillis() <= Date.now();

    if (isExpired || data.dataSignature !== dataSignature) {
        return null;
    }

    return data.response;
}

export async function setCachedOptimizationResult(
    cacheKey: string,
    dataSignature: string,
    response: SmartCartOptimizeResponse,
): Promise<void> {
    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + CACHE_TTL_MS);

    const document: SmartCartCacheDocument = {
        cacheKey,
        dataSignature,
        response,
        createdAt: now,
        expiresAt,
    };

    await db.collection(CACHE_COLLECTION).doc(cacheKey).set(document);
}
