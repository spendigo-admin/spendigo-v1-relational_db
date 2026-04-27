const admin = require('firebase-admin');
admin.initializeApp({
  projectId: 'spendigo-8540c',
  storageBucket: 'spendigo-8540c.firebasestorage.app'
});
async function run() {
  const file = admin.storage().bucket().file('public/active_deals.json');
  const [exists] = await file.exists();
  console.log('File exists:', exists);
}
run().catch(console.error);
