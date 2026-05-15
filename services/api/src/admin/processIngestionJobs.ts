import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { runIngestion } from '../utils/flippScraper';

export const processIngestionJobs = functions.pubsub.schedule('every 10 minutes').onRun(async (_context) => {
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

    const jobsToRun: admin.firestore.QueryDocumentSnapshot[] = [...pendingOneTimeSnap.docs];

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
            const updateData: any = {
                startedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastRunAt: admin.firestore.FieldValue.serverTimestamp()
            };
            
            if (!isRecurring) {
                updateData.status = 'processing';
            }

            await jobDoc.ref.update(updateData);

            functions.logger.info(`Running ${jobData.type} job for ${jobData.postalCode} (reset=${jobData.shouldReset})...`);
            
            const result = await runIngestion(jobData.postalCode, !!jobData.shouldReset);

            // Final Update
            const finalUpdate: any = {
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

        } catch (error: any) {
            functions.logger.error(`Error processing job ${jobDoc.id}:`, error);
            
            const errorUpdate: any = {
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
