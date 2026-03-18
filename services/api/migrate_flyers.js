const admin = require('firebase-admin');

// Initialize Firebase Admin with application default credentials
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'spendigo-8540c'
  });
}

const db = admin.firestore();

async function migrate() {
  console.log('Starting migration...');
  const stores = await db.collection('stores').get();
  let count = 0;
  
  for (const doc of stores.docs) {
    const data = doc.data();
    if (data.flyer && data.flyer.image && data.flyer.image.includes('.gemini/antigravity/brain')) {
      console.log('Migrating store:', data.name);
      let newImage = data.flyer.image;
      if (newImage.includes('produce')) newImage = '/assets/flyers/fresh_produce.png';
      else if (newImage.includes('meat')) newImage = '/assets/flyers/meat_bbq.png';
      else if (newImage.includes('bakery')) newImage = '/assets/flyers/bakery_breakfast.png';
      else if (newImage.includes('deals')) newImage = '/assets/flyers/weekly_deals.png';
      else if (newImage.includes('spices')) newImage = '/assets/flyers/ethnic_spices.png';
      
      await doc.ref.update({
        'flyer.image': newImage
      });
      console.log('Updated to:', newImage);
      count++;
    }
  }
  console.log(`Migration complete. Updated ${count} stores.`);
}

migrate().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
