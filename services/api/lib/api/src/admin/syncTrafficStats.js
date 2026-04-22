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
exports.syncTrafficStats = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const data_1 = require("@google-analytics/data");
const analyticsDataClient = new data_1.BetaAnalyticsDataClient();
/**
 * Cloud Function to sync GA4 statistics into Firestore.
 * This bridge pulls 'True' traffic stats from Google and caches them
 * for the Admin Dashboard to display without latency or quota issues.
 */
exports.syncTrafficStats = functions.https.onCall(async (data, context) => {
    var _a, _b;
    // Auth Check: Admin only
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    if (!context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists || ((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can sync traffic stats.');
    }
    const propertyId = '526090559'; // Provided by user
    try {
        // 1. Run the report for Today and Yesterday
        const [response] = await analyticsDataClient.runReport({
            property: `properties/${propertyId}`,
            dateRanges: [
                { startDate: 'yesterday', endDate: 'today' },
                { startDate: '30daysAgo', endDate: 'today' }
            ],
            dimensions: [{ name: 'date' }],
            metrics: [
                { name: 'activeUsers' },
                { name: 'screenPageViews' }
            ],
        });
        const dailyVisits = {};
        // 2. Parse the response
        // Note: Response contains rows for each date/metric combo
        (_b = response.rows) === null || _b === void 0 ? void 0 : _b.forEach(row => {
            var _a, _b;
            const dateStrRaw = (_a = row.dimensionValues) === null || _a === void 0 ? void 0 : _a[0].value; // YYYYMMDD
            if (!dateStrRaw)
                return;
            // Format to YYYY-MM-DD for consistency with our app
            const dateStr = `${dateStrRaw.substring(0, 4)}-${dateStrRaw.substring(4, 6)}-${dateStrRaw.substring(6, 8)}`;
            const activeUsers = parseInt(((_b = row.metricValues) === null || _b === void 0 ? void 0 : _b[0].value) || '0');
            dailyVisits[dateStr] = activeUsers;
        });
        // 3. Update Firestore
        const statsRef = admin.firestore().doc('stats/traffic');
        await statsRef.set({
            daily_visits: dailyVisits,
            last_synced: admin.firestore.FieldValue.serverTimestamp(),
            source: 'Google Analytics'
        }, { merge: true });
        console.log(`[Admin] Successfully synced GA4 stats for property ${propertyId}`);
        return {
            success: true,
            message: 'Dashboard stats updated from Google Analytics.',
            synced_dates: Object.keys(dailyVisits)
        };
    }
    catch (error) {
        console.error(`[Admin] GA4 Sync Error: ${error.message}`);
        throw new functions.https.HttpsError('internal', `Failed to sync from Google Analytics: ${error.message}`);
    }
});
//# sourceMappingURL=syncTrafficStats.js.map