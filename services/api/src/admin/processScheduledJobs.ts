import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { runIngestion } from '../utils/flippScraper';

export const processScheduledJobs = functions.pubsub.schedule('every 10 minutes').onRun(async (context) => {
    const db = admin.firestore();
    const now = Date.now();

    const pendingJobsSnap = await db.collection('scheduled_ingestion')
        .where('status', '==', 'pending')
        .where('scheduledAt', '<=', now)
        .get();

    if (pendingJobsSnap.empty) {
        console.log("No pending ingestion jobs found.");
        return null;
    }

    console.log(`Processing ${pendingJobsSnap.size} scheduled ingestion jobs...`);

    for (const jobDoc of pendingJobsSnap.docs) {
        const jobData = jobDoc.data();
        
        try {
            // Update status to processing
            await jobDoc.ref.update({
                status: 'processing',
                startedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`Running scheduled job for ${jobData.postalCode} (reset=${jobData.shouldReset})...`);
            
            const result = await runIngestion(jobData.postalCode, !!jobData.shouldReset);

            // Update status to completed
            await jobDoc.ref.update({
                status: 'completed',
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
                result: {
                    processedFlyers: result.processedFlyers,
                    totalDealsSaved: result.totalDealsSaved,
                    summaryData: result.summaryData
                }
            });

            console.log(`Job for ${jobData.postalCode} completed successfully.`);

        } catch (error: any) {
            console.error(`Error processing scheduled job ${jobDoc.id}:`, error);
            
            await jobDoc.ref.update({
                status: 'failed',
                error: error.message || 'Unknown error',
                failedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    }

    return null;
});
