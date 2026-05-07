import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./scripts/service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

interface Branding {
    logo: string;
    cover?: string;
}

const categoriesToUpdate: Record<string, Branding> = {
    'Grocery Store': {
        logo: '/defaults/branding/grocery_logo.png?v=5',
        cover: '/defaults/branding/grocery_cover.png?v=5'
    },
    'Convenience Store': {
        logo: '/defaults/branding/convenience_logo.png?v=5',
        cover: '/defaults/branding/convenience_cover.png?v=5'
    },
    'Discount / Dollar Store': {
        logo: '/defaults/branding/discount_logo.png?v=5',
        cover: '/defaults/branding/discount_cover.png?v=5'
    },
    'Ethnic / Specialty Grocery': {
        logo: '/defaults/branding/ethnic_logo.png?v=5',
        cover: '/defaults/branding/ethnic_cover.png?v=5'
    },
    'Farmers Market Vendor': {
        logo: '/defaults/branding/farmers_logo.png?v=5',
        cover: '/defaults/branding/farmers_cover.png?v=5'
    },
    'Organic / Health Food Store': {
        logo: '/defaults/branding/organic_logo.png?v=5',
        cover: '/defaults/branding/organic_cover.png?v=5'
    },
    'Artisan Bakery': {
        logo: '/defaults/branding/bakery_logo.png?v=5',
        cover: '/defaults/branding/bakery_cover.png?v=5'
    },
    'Butcher Shop': {
        logo: '/defaults/branding/butcher_logo.png?v=5',
        cover: '/defaults/branding/butcher_cover.png?v=5'
    },
    'Fishmonger / Seafood Shop': {
        logo: '/defaults/branding/seafood_logo.png?v=5'
    }
};

async function checkStores() {
  console.log('Checking stores for default branding paths...');
  const storesSnapshot = await db.collection('stores').get();
  
  let updateCount = 0;

  for (const doc of storesSnapshot.docs) {
    const data = doc.data();
    const category = data.businessType as string;
    
    if (category && categoriesToUpdate[category]) {
      const updates: any = {};
      const branding = categoriesToUpdate[category];
      const newLogo = branding.logo;
      const newCover = branding.cover;

      // Only update if it looks like a default path (not a custom firebase storage URL)
      if (data.logoUrl && data.logoUrl.includes('/defaults/branding/') && data.logoUrl !== newLogo) {
        updates.logoUrl = newLogo;
      }
      if (data.image && data.image.includes('/defaults/branding/') && newCover && data.image !== newCover) {
        updates.image = newCover;
      }

      if (Object.keys(updates).length > 0) {
        console.log(`Updating store ${doc.id} (${data.name}) - Category: ${category}`);
        await doc.ref.update(updates);
        updateCount++;
      }
    }
  }

  console.log(`Finished. Updated ${updateCount} stores.`);
}

checkStores().catch(console.error);
