const admin = require('firebase-admin');
admin.initializeApp({
  projectId: 'spendigo-8540c',
  storageBucket: 'spendigo-8540c.firebasestorage.app'
});

async function run() {
  const bucket = admin.storage().bucket();
  await bucket.setCorsConfiguration([
    {
      maxAgeSeconds: 3600,
      method: ['GET', 'OPTIONS'],
      origin: ['*'],
      responseHeader: ['Content-Type', 'Authorization'],
    },
  ]);
  console.log('CORS configuration successfully updated!');
}

run().catch(console.error);
