
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

const analyticsDataClient = new BetaAnalyticsDataClient();

/**
 * Cloud Function to sync GA4 statistics into Firestore.
 * This bridge pulls 'True' traffic stats from Google and caches them
 * for the Admin Dashboard to display without latency or quota issues.
 */
export const syncTrafficStats = functions.https.onCall(async (data, context) => {
    // Auth Check: Admin only
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    if (!context.auth || context.auth.token.role !== 'admin') {
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

        const dailyVisits: Record<string, number> = {};

        // 2. Parse the response
        // Note: Response contains rows for each date/metric combo
        response.rows?.forEach(row => {
            const dateStrRaw = row.dimensionValues?.[0].value; // YYYYMMDD
            if (!dateStrRaw) return;
            
            // Format to YYYY-MM-DD for consistency with our app
            const dateStr = `${dateStrRaw.substring(0, 4)}-${dateStrRaw.substring(4, 6)}-${dateStrRaw.substring(6, 8)}`;
            const activeUsers = parseInt(row.metricValues?.[0].value || '0');
            
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
    } catch (error: any) {
        console.error(`[Admin] GA4 Sync Error: ${error.message}`);
        throw new functions.https.HttpsError('internal', `Failed to sync from Google Analytics: ${error.message}`);
    }
});
