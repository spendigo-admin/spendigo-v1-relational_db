import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Test Email Function
 * Writes a document to the 'mail' collection to test the Trigger Email Extension.
 */
export const sendTestEmail = functions.https.onRequest(async (req, res) => {
    const targetEmail = req.query.email as string;

    if (!targetEmail) {
        res.status(400).send('Missing email query parameter');
        return;
    }

    try {
        await admin.firestore().collection('mail').add({
            to: [targetEmail],
            message: {
                subject: 'Spendigo Email System Test',
                html: '<h1>It Works!</h1><p>The email system (Firestore -> Trigger Email Extension) is connected correctly.</p>'
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(200).json({ success: true, message: `Test email queued for ${targetEmail}. Check your inbox.` });
    } catch (error: any) {
        console.error('Test email failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
