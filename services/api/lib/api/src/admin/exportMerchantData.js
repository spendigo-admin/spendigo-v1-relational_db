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
exports.exportMerchantData = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const rateLimiter_1 = require("../utils/rateLimiter");
const audit_1 = require("../utils/audit");
exports.exportMerchantData = functions
    .runWith({ timeoutSeconds: 300, memory: '512MB' })
    .https.onCall(async (_data, context) => {
    var _a;
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'App Check required.');
    }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated.');
    }
    // 3 exports/hour — prevents abuse of the large parallel fetch
    await (0, rateLimiter_1.checkRateLimit)(context.auth.uid, 'merchantDataExport', 3, 60 * 60 * 1000);
    const db = admin.firestore();
    const uid = context.auth.uid;
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();
    if (!(userData === null || userData === void 0 ? void 0 : userData.storeId)) {
        throw new functions.https.HttpsError('not-found', 'No store associated with this account.');
    }
    const storeId = userData.storeId;
    // Only OWNER role can export the full dataset
    if (userData.merchantRole && userData.merchantRole !== 'OWNER') {
        throw new functions.https.HttpsError('permission-denied', 'Only store owners can export data.');
    }
    try {
        const [storeSnap, productsSnap, ordersSnap, dealsSnap, flyersSnap, teamSnap] = await Promise.all([
            db.collection('stores').doc(storeId).get(),
            db.collection('merchant_products').where('merchant_id', '==', storeId).get(),
            db.collection('orders').where('storeId', '==', storeId).get(),
            db.collection('stores').doc(storeId).collection('deals').get(),
            db.collection('stores').doc(storeId).collection('flyers').get(),
            db.collection('users').where('storeId', '==', storeId).get(),
        ]);
        // Collect price history subcollections in parallel across all products
        const priceHistory = {};
        await Promise.all(productsSnap.docs.map(async (productDoc) => {
            const historySnap = await productDoc.ref.collection('price_history').get();
            if (!historySnap.empty) {
                priceHistory[productDoc.id] = historySnap.docs.map(d => d.data());
            }
        }));
        const exportData = {
            store: Object.assign({ id: storeSnap.id }, storeSnap.data()),
            products: productsSnap.docs.map(d => (Object.assign({ id: d.id }, d.data()))),
            orders: ordersSnap.docs.map(d => (Object.assign(Object.assign({ id: d.id }, d.data()), { 
                // Customer PII is redacted — merchants should not export raw customer addresses
                customerEmail: '[redacted]', customerPhone: d.data().customerPhone ? '[redacted]' : undefined, deliveryAddress: d.data().deliveryAddress ? '[redacted]' : null }))),
            priceHistory,
            deals: dealsSnap.docs.map(d => (Object.assign({ id: d.id }, d.data()))),
            flyers: flyersSnap.docs.map(d => (Object.assign({ id: d.id }, d.data()))),
            team: teamSnap.docs.map(d => {
                var _a, _b, _c;
                return ({
                    id: d.id,
                    name: (_a = d.data().name) !== null && _a !== void 0 ? _a : '',
                    email: (_b = d.data().email) !== null && _b !== void 0 ? _b : '',
                    merchantRole: (_c = d.data().merchantRole) !== null && _c !== void 0 ? _c : '',
                });
            }),
            generatedAt: new Date().toISOString(),
            version: '1.0',
        };
        await (0, audit_1.logEvent)('MERCHANT_DATA_EXPORT', { id: uid, email: context.auth.token.email || '', ip: ((_a = context.rawRequest) === null || _a === void 0 ? void 0 : _a.ip) || '' }, { storeId, orderCount: exportData.orders.length, productCount: exportData.products.length }, `stores/${storeId}`);
        return { success: true, data: exportData };
    }
    catch (error) {
        functions.logger.error('[MerchantExport] Export failed:', error);
        throw new functions.https.HttpsError('internal', `Export failed: ${error.message}`);
    }
});
//# sourceMappingURL=exportMerchantData.js.map