import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { runIngestion } from '../utils/flippScraper';
import { toHttpsError } from '../utils/errors';

export const scrapeFlyer = functions.https.onCall(async (data, context) => {
    // Basic Authentication Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    
    // Check Admin Role
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    if (userDoc.data()?.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can trigger ingestion.');
    }

    const { postalCode, resetData } = data;
    if (!postalCode || typeof postalCode !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Valid postal code is required.');
    }

    try {
        const result = await runIngestion(postalCode, !!resetData);
        return result;
    } catch (error: any) {
        toHttpsError(error, 'Failed to fetch flyers.');
    }
});
