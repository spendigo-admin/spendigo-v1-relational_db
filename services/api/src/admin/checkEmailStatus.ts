import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Check Email Status
 * Returns the last 5 email attempts from the 'mail' collection to diagnose Extension errors.
 */
export const checkEmailStatus = functions.https.onRequest(async (req, res) => {
    try {
        const snapshot = await admin.firestore().collection('mail')
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();

        const logs = snapshot.docs.map(doc => ({
            id: doc.id,
            to: doc.data().to,
            createdAt: doc.data().createdAt?.toDate(),
            // The Extension typically writes delivery status here
            delivery: doc.data().delivery
        }));

        res.status(200).json({
            success: true,
            logs: logs,
            instructions: "If 'delivery.state' is 'ERROR', check 'delivery.error' for details."
        });
    } catch (error: any) {
        console.error('Check status failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
