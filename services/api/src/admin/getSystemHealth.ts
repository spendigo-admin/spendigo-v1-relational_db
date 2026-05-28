import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { MetricServiceClient } from '@google-cloud/monitoring';
import { toHttpsError } from '../utils/errors';
import { getDb } from '../db/client';
import { sql } from 'drizzle-orm';

const client = new MetricServiceClient();

/**
 * Fetch real Firebase consumption metrics from Google Cloud Monitoring.
 * Returns stats for Firestore reads/writes, Storage bandwidth, and Function executions.
 * 
 * Note: Metrics have a slight delay (typically 1-4 minutes) from Cloud Monitoring.
 */
export const getSystemHealth = functions
    .runWith({ secrets: ['DATABASE_URL'] })
    .https.onCall(async (data, context) => {
    // Auth Check: Admin only
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    const projectId = process.env.GCLOUD_PROJECT || admin.instanceId().app.options.projectId;
    functions.logger.info(`[SystemHealth] Fetching stats for project: ${projectId}`);

    if (!context.auth || !context.auth.uid) {
        functions.logger.warn("[SystemHealth] No auth context found.");
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }

    // Verify admin role via Firestore since custom claims aren't set
    const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
        functions.logger.warn(`[SystemHealth] User ${context.auth.uid} is not an admin.`);
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
            functions.logger.error(`Error fetching metric ${metricType}:`, error);
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

        let postgresStatus = {
            configured: false,
            connected: false,
            stats: null as any,
            perf: null as any,
            error: null as string | null
        };

        const dbUrl = process.env.DATABASE_URL;
        if (dbUrl) {
            postgresStatus.configured = true;
            try {
                const sqlDb = getDb();
                
                // Query all table row counts in a single atomic database query
                // to eliminate connection pool contention and prevent timeout limits.
                const countQuery = await sqlDb.execute(sql`
                    SELECT 
                        (SELECT COUNT(*) FROM users) as users_count,
                        (SELECT COUNT(*) FROM stores) as stores_count,
                        (SELECT COUNT(*) FROM merchant_products) as merchant_products_count,
                        (SELECT COUNT(*) FROM master_products) as master_products_count,
                        (SELECT COUNT(*) FROM orders) as orders_count
                `);

                const perfQuery = await sqlDb.execute(sql`
                    SELECT 
                        pg_size_pretty(pg_database_size(current_database())) as db_size,
                        (SELECT COUNT(*) FROM pg_stat_activity) as active_connections,
                        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
                        COALESCE(ROUND((100.0 * blks_hit / NULLIF(blks_read + blks_hit, 0)), 2), 100.00) as cache_hit_ratio,
                        (xact_commit + xact_rollback) as transactions_total
                    FROM pg_stat_database 
                    WHERE datname = current_database()
                `);

                postgresStatus.connected = true;
                const row = countQuery.rows[0] || {};
                postgresStatus.stats = {
                    users: Number(row.users_count || 0),
                    stores: Number(row.stores_count || 0),
                    merchantProducts: Number(row.merchant_products_count || 0),
                    masterProducts: Number(row.master_products_count || 0),
                    orders: Number(row.orders_count || 0)
                };

                const perfRow = perfQuery.rows[0] || {};
                postgresStatus.perf = {
                    dbSize: String(perfRow.db_size || '0 bytes'),
                    activeConnections: Number(perfRow.active_connections || 0),
                    maxConnections: Number(perfRow.max_connections || 100),
                    cacheHitRatio: Number(perfRow.cache_hit_ratio || 100.00),
                    transactionsTotal: Number(perfRow.transactions_total || 0)
                };
            } catch (err: any) {
                functions.logger.error("Failed to query PostgreSQL stats for system health:", err, {
                    cause: err.cause ? {
                        message: err.cause.message,
                        code: err.cause.code,
                        stack: err.cause.stack
                    } : null
                });
                postgresStatus.connected = false;
                postgresStatus.error = err.cause?.message || err.message || "Failed to query relational database.";
            }
        }

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
            postgres: postgresStatus,
            timestamp: new Date().toISOString()
        };



    } catch (error: any) {
        toHttpsError(error, 'Failed to fetch system health.');
    }
});
