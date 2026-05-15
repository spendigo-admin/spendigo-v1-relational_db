import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { checkRateLimit } from '../utils/rateLimiter';
import { logEvent } from '../utils/audit';
import { toHttpsError } from '../utils/errors';

interface MerchantExportResult {
    store: Record<string, unknown>;
    products: Record<string, unknown>[];
    orders: Record<string, unknown>[];
    priceHistory: Record<string, Record<string, unknown>[]>;
    deals: Record<string, unknown>[];
    flyers: Record<string, unknown>[];
    team: { id: string; name: string; email: string; merchantRole: string }[];
    generatedAt: string;
    version: '1.0';
}

export const exportMerchantData = functions
    .runWith({ timeoutSeconds: 300, memory: '512MB' })
    .https.onCall(async (_data, context) => {
        if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
            throw new functions.https.HttpsError('failed-precondition', 'App Check required.');
        }
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated.');
        }

        // 3 exports/hour — prevents abuse of the large parallel fetch
        await checkRateLimit(context.auth.uid, 'merchantDataExport', 3, 60 * 60 * 1000);

        const db = admin.firestore();
        const uid = context.auth.uid;

        const userDoc = await db.collection('users').doc(uid).get();
        const userData = userDoc.data();
        if (!userData?.storeId) {
            throw new functions.https.HttpsError('not-found', 'No store associated with this account.');
        }

        const storeId: string = userData.storeId;

        // Only OWNER role can export the full dataset
        if (userData.merchantRole && userData.merchantRole !== 'OWNER') {
            throw new functions.https.HttpsError('permission-denied', 'Only store owners can export data.');
        }

        try {
            const [storeSnap, productsSnap, ordersSnap, dealsSnap, flyersSnap, teamSnap] =
                await Promise.all([
                    db.collection('stores').doc(storeId).get(),
                    db.collection('merchant_products').where('merchant_id', '==', storeId).get(),
                    db.collection('orders').where('storeId', '==', storeId).get(),
                    db.collection('stores').doc(storeId).collection('deals').get(),
                    db.collection('stores').doc(storeId).collection('flyers').get(),
                    db.collection('users').where('storeId', '==', storeId).get(),
                ]);

            // Collect price history subcollections in parallel across all products
            const priceHistory: Record<string, Record<string, unknown>[]> = {};
            await Promise.all(
                productsSnap.docs.map(async (productDoc) => {
                    const historySnap = await productDoc.ref.collection('price_history').get();
                    if (!historySnap.empty) {
                        priceHistory[productDoc.id] = historySnap.docs.map(d => d.data() as Record<string, unknown>);
                    }
                })
            );

            const exportData: MerchantExportResult = {
                store: { id: storeSnap.id, ...storeSnap.data() },
                products: productsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                orders: ordersSnap.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                    // Customer PII is redacted — merchants should not export raw customer addresses
                    customerEmail: '[redacted]',
                    customerPhone: d.data().customerPhone ? '[redacted]' : undefined,
                    deliveryAddress: d.data().deliveryAddress ? '[redacted]' : null,
                })),
                priceHistory,
                deals: dealsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                flyers: flyersSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                team: teamSnap.docs.map(d => ({
                    id: d.id,
                    name: d.data().name ?? '',
                    email: d.data().email ?? '',
                    merchantRole: d.data().merchantRole ?? '',
                })),
                generatedAt: new Date().toISOString(),
                version: '1.0',
            };

            await logEvent(
                'MERCHANT_DATA_EXPORT',
                { id: uid, email: context.auth.token.email || '', ip: context.rawRequest?.ip || '' },
                { storeId, orderCount: exportData.orders.length, productCount: exportData.products.length },
                `stores/${storeId}`
            );

            return { success: true, data: exportData };
        } catch (error: any) {
            toHttpsError(error, 'Export failed.');
        }
    });
