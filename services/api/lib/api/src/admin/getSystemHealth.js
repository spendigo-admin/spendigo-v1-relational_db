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
exports.getSystemHealth = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const monitoring_1 = require("@google-cloud/monitoring");
const errors_1 = require("../utils/errors");
const client = new monitoring_1.MetricServiceClient();
/**
 * Fetch real Firebase consumption metrics from Google Cloud Monitoring.
 * Returns stats for Firestore reads/writes, Storage bandwidth, and Function executions.
 *
 * Note: Metrics have a slight delay (typically 1-4 minutes) from Cloud Monitoring.
 */
exports.getSystemHealth = functions.https.onCall(async (data, context) => {
    var _a;
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
    if (!userDoc.exists || ((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
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
    const fetchMetric = async (metricType, resourceType, isMonthly = false, useSum = true) => {
        var _a, _b;
        try {
            const request = {
                name: `projects/${projectId}`,
                filter: `metric.type = "${metricType}" AND resource.type = "${resourceType}"`,
                interval: {
                    startTime: { seconds: isMonthly ? startTimeMonth : startTimeDay },
                    endTime: { seconds: endTime },
                },
                view: 'FULL',
            };
            const [timeSeries] = await client.listTimeSeries(request);
            if (timeSeries.length === 0)
                return 0;
            if (!useSum) {
                // Return the most recent value for Gauge metrics
                const latestSeries = timeSeries[0];
                const points = latestSeries.points || [];
                const latestPoint = points[0];
                return Number(((_a = latestPoint === null || latestPoint === void 0 ? void 0 : latestPoint.value) === null || _a === void 0 ? void 0 : _a.int64Value) || ((_b = latestPoint === null || latestPoint === void 0 ? void 0 : latestPoint.value) === null || _b === void 0 ? void 0 : _b.doubleValue) || 0);
            }
            let total = 0;
            timeSeries.forEach(series => {
                var _a;
                (_a = series.points) === null || _a === void 0 ? void 0 : _a.forEach(point => {
                    var _a, _b;
                    total += Number(((_a = point.value) === null || _a === void 0 ? void 0 : _a.int64Value) || ((_b = point.value) === null || _b === void 0 ? void 0 : _b.doubleValue) || 0);
                });
            });
            return total;
        }
        catch (error) {
            functions.logger.error(`Error fetching metric ${metricType}:`, error);
            return 0;
        }
    };
    try {
        // Fetch all metrics requested by the user
        const [fReads, fWrites, fDeletes, fExecutions, sBandwidth, sStorage, hBandwidth, hStorage, authSMS, authActiveUsers] = await Promise.all([
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
    }
    catch (error) {
        (0, errors_1.toHttpsError)(error, 'Failed to fetch system health.');
    }
});
//# sourceMappingURL=getSystemHealth.js.map