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
exports.processIngestionJobs = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const flippScraper_1 = require("../utils/flippScraper");
exports.processIngestionJobs = functions.pubsub.schedule('every 10 minutes').onRun(async (_context) => {
    const db = admin.firestore();
    const now = new Date();
    const currentDay = now.getDay(); // 0-6
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    // 1. Process One-time jobs (status == 'pending')
    const pendingOneTimeSnap = await db.collection('scheduled_ingestion')
        .where('type', '==', 'one-time')
        .where('status', '==', 'pending')
        .where('scheduledAt', '<=', now.getTime())
        .get();
    // 2. Process Recurring jobs (status == 'active')
    const activeRecurringSnap = await db.collection('scheduled_ingestion')
        .where('type', '==', 'recurring')
        .where('status', '==', 'active')
        .get();
    const jobsToRun = [...pendingOneTimeSnap.docs];
    // Filter recurring jobs that are due today and at/after the scheduled time
    activeRecurringSnap.forEach(doc => {
        const data = doc.data();
        if (data.days.includes(currentDay)) {
            // Check if time is reached
            if (currentTimeStr >= data.time) {
                // Check if already run today
                const lastRun = data.lastRunAt ? data.lastRunAt.toDate() : null;
                const isAlreadyRunToday = lastRun && lastRun.toDateString() === now.toDateString();
                if (!isAlreadyRunToday) {
                    jobsToRun.push(doc);
                }
            }
        }
    });
    if (jobsToRun.length === 0) {
        functions.logger.info("No ingestion jobs due at this time.");
        return null;
    }
    functions.logger.info(`Processing ${jobsToRun.length} due ingestion jobs...`);
    for (const jobDoc of jobsToRun) {
        const jobData = jobDoc.data();
        const isRecurring = jobData.type === 'recurring';
        try {
            // For one-time, update status to processing
            // For recurring, we just mark startedAt and lastRunAt
            const updateData = {
                startedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastRunAt: admin.firestore.FieldValue.serverTimestamp()
            };
            if (!isRecurring) {
                updateData.status = 'processing';
            }
            await jobDoc.ref.update(updateData);
            functions.logger.info(`Running ${jobData.type} job for ${jobData.postalCode} (reset=${jobData.shouldReset})...`);
            const result = await (0, flippScraper_1.runIngestion)(jobData.postalCode, !!jobData.shouldReset);
            // Final Update
            const finalUpdate = {
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
                result: {
                    processedFlyers: result.processedFlyers,
                    totalDealsSaved: result.totalDealsSaved,
                    summaryData: result.summaryData
                }
            };
            if (!isRecurring) {
                finalUpdate.status = 'completed';
            }
            await jobDoc.ref.update(finalUpdate);
            functions.logger.info(`Job for ${jobData.postalCode} finished successfully.`);
        }
        catch (error) {
            functions.logger.error(`Error processing job ${jobDoc.id}:`, error);
            const errorUpdate = {
                error: error.message || 'Unknown error',
                failedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            if (!isRecurring) {
                errorUpdate.status = 'failed';
            }
            await jobDoc.ref.update(errorUpdate);
        }
    }
    return null;
});
//# sourceMappingURL=processIngestionJobs.js.map