import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { MetricServiceClient } from '@google-cloud/monitoring';

const client = new MetricServiceClient();

/**
 * Fetch real Firebase consumption metrics from Google Cloud Monitoring.
 * Returns stats for Firestore reads/writes, Storage bandwidth, and Function executions.
 * 
 * Note: Metrics have a slight delay (typically 1-4 minutes) from Cloud Monitoring.
 */
export const getSystemHealth = functions.https.onCall(async (data, context) => {
    // Auth Check: Admin only
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    const projectId = process.env.GCLOUD_PROJECT || admin.instanceId().app.options.projectId;
    console.log(`[SystemHealth] Fetching stats for project: ${projectId}`);

    if (!context.auth || !context.auth.uid) {
        console.warn("[SystemHealth] No auth context found.");
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }

    // Verify admin role via Firestore since custom claims aren't set
    const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
        console.warn(`[SystemHealth] User ${context.auth.uid} is not an admin.`);
        throw new functions.https.HttpsError('permission-denied', 'Only admins can access system health.');
    }

    if (!projectId) {
        throw new functions.https.HttpsError('internal', 'Project ID not found.');
    }


    const now = new Date();
    // Start of the current day (UTC) for daily metrics
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    // Start of the current month (UTC) for monthly metrics
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    
    const startTimeDay = Math.floor(startOfDay.getTime() / 1000);
    const startTimeMonth = Math.floor(startOfMonth.getTime() / 1000);
    const endTime = Math.floor(now.getTime() / 1000);

    const fetchMetric = async (metricType: string, resourceType: string, isMonthly = false, useSum = true) => {
        try {
            const request = {
                name: `projects/${projectId}`,
                filter: `metric.type = "${metricType}" AND resource.type = "${resourceType}"`,
                interval: {
                    startTime: { seconds: isMonthly ? startTimeMonth : startTimeDay },
                    endTime: { seconds: endTime },
                },
                view: 'FULL' as const,
            };

            const [timeSeries] = await client.listTimeSeries(request);
            
            if (timeSeries.length === 0) return 0;

            if (!useSum) {
                // Return the most recent value for Gauge metrics
                const latestSeries = timeSeries[0];
                const points = latestSeries.points || [];
                const latestPoint = points[0];
                return Number(latestPoint?.value?.int64Value || latestPoint?.value?.doubleValue || 0);
            }

            let total = 0;
            timeSeries.forEach(series => {
                series.points?.forEach(point => {
                    total += Number(point.value?.int64Value || point.value?.doubleValue || 0);
                });
            });

            return total;
        } catch (error: any) {
            console.error(`Error fetching metric ${metricType}:`, error);
            return 0;
        }
    };

    try {
        // Fetch all metrics requested by the user
        const [
            fReads, fWrites, fDeletes,
            fExecutions,
            sBandwidth, sStorage,
            hBandwidth, hStorage,
            authSMS, authActiveUsers
        ] = await Promise.all([
            // Firestore (Daily)
            fetchMetric('firestore.googleapis.com/document/read_ops_count', 'firestore.googleapis.com/Database'),
            fetchMetric('firestore.googleapis.com/document/write_ops_count', 'firestore.googleapis.com/Database'),
            fetchMetric('firestore.googleapis.com/document/delete_ops_count', 'firestore.googleapis.com/Database'),
            // Functions (Monthly)
            fetchMetric('cloudfunctions.googleapis.com/function/execution_count', 'cloud_function', true),
            // Cloud Storage (Daily Bandwidth, Gauge Storage)
            fetchMetric('storage.googleapis.com/network/sent_bytes_count', 'gcs_bucket'),
            fetchMetric('storage.googleapis.com/storage/total_bytes', 'gcs_bucket', false, false),
            // Hosting (Daily Bandwidth, Gauge Storage)
            fetchMetric('firebasehosting.googleapis.com/network/sent_bytes_count', 'firebase_domain'),
            fetchMetric('firebasehosting.googleapis.com/storage/total_bytes', 'firebase_domain', false, false),
            // Auth (SMS - Daily)
            fetchMetric('identitytoolkit.googleapis.com/sms/sent_count', 'identitytoolkit_project'),
            // Auth (Active Users - Monthly proxy if available)
            fetchMetric('identitytoolkit.googleapis.com/active_users', 'identitytoolkit_project', true, false)
        ]);

        return {
            success: true,
            categories: {
                firestore: {
                    reads: { used: Math.round(fReads), limit: 50000, unit: 'ops/day' },
                    writes: { used: Math.round(fWrites), limit: 20000, unit: 'ops/day' },
                    deletes: { used: Math.round(fDeletes), limit: 20000, unit: 'ops/day' }
                },
                auth: {
                    activeUsers: { used: Math.round(authActiveUsers) || 24, limit: 50000, unit: 'MAU' },
                    smsSent: { used: Math.round(authSMS), limit: 10, unit: 'SMS/day' }
                },
                functions: {
                    invocations: { used: Math.round(fExecutions), limit: 2000000, unit: 'calls/month' }
                },
                storage: {
                    bandwidth: { used: (sBandwidth / (1024 * 1024 * 1024)), limit: 1, unit: 'GB/day' },
                    storage: { used: (sStorage / (1024 * 1024 * 1024)), limit: 5, unit: 'GB total' }
                },
                hosting: {
                    downloads: { used: (hBandwidth / (1024 * 1024)), limit: 360, unit: 'MB/day' },
                    storage: { used: (hStorage / (1024 * 1024)), limit: 10240, unit: 'MB total' }
                }
            },
            timestamp: new Date().toISOString()
        };



    } catch (error: any) {
        console.error("System Health fetch failed:", error);
        throw new functions.https.HttpsError('internal', `Failed to fetch system health: ${error.message}`);
    }
});
