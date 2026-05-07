
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkStore() {
    const storeId = 'store-k0DiGoKYN9a8wBi7j1DC7FASxTn1';
    const doc = await db.collection('stores').doc(storeId).get();
    
    if (!doc.exists) {
        console.log('Store does not exist.');
        return;
    }
    
    const data = doc.data();
    console.log('Store Data:', JSON.stringify({
        id: doc.id,
        name: data.name,
        status: data.status,
        deletionApprovedAt: data.deletionApprovedAt ? data.deletionApprovedAt.toDate().toISOString() : 'MISSING',
        deletionRequest: data.deletionRequest
    }, null, 2));
}

checkStore().catch(console.error);
