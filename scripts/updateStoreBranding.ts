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
        logo: '/defaults/branding/grocery_logo.png?v=6',
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
    'Ethnic Speciality Grocery': {
        logo: '/defaults/branding/ethnic_logo.png?v=5',
        cover: '/defaults/branding/ethnic_cover.png?v=5'
    },
    'Asian Grocers': {
        logo: '/defaults/branding/asian_logo.jpg?v=5',
        cover: '/defaults/branding/asian_cover.jpg?v=5'
    },
    'Indo-Pak / Desi Grocery': {
        logo: '/defaults/branding/desi_logo.jpg?v=5',
        cover: '/defaults/branding/desi_cover.jpg?v=5'
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
        logo: '/defaults/branding/seafood_logo.png?v=5',
        cover: '/defaults/branding/seafood_cover.png?v=5'
    },
    'Deli / Prepared Foods': {
        logo: '/defaults/branding/deli_logo.png?v=5',
        cover: '/defaults/branding/deli_cover.png?v=5'
    },
    'Restaurant': {
        logo: '/defaults/branding/restaurant_logo.png?v=5',
        cover: '/defaults/branding/restaurant_cover.png?v=5'
    },
    'Local Café / Coffee Shop': {
        logo: '/defaults/branding/cafe_logo.png?v=5',
        cover: '/defaults/branding/cafe_cover.png?v=5'
    },
    'Dessert & Sweets Shop': {
        logo: '/defaults/branding/sweets_logo.png?v=5',
        cover: '/defaults/branding/sweets_cover.png?v=5'
    },
    'Meal Prep / Tiffin Service': {
        logo: '/defaults/branding/tiffin_logo.png?v=5',
        cover: '/defaults/branding/tiffin_cover.png?v=5'
    },
    'Pharmacy / Health Store': {
        logo: '/defaults/branding/pharmacy_logo.png?v=5',
        cover: '/defaults/branding/pharmacy_cover.png?v=5'
    },
    'Pet Store': {
        logo: '/defaults/branding/pet_logo.png?v=5',
        cover: '/defaults/branding/pet_cover.png?v=5'
    },
    'Florist': {
        logo: '/defaults/branding/florist_logo.png?v=5',
        cover: '/defaults/branding/florist_cover.png?v=5'
    },
    'Home & Garden Store': {
        logo: '/defaults/branding/home_garden_logo.png?v=5',
        cover: '/defaults/branding/home_garden_cover.png?v=5'
    },
    'Hardware Store': {
        logo: '/defaults/branding/hardware_logo.png?v=5',
        cover: '/defaults/branding/hardware_cover.png?v=5'
    },
    'Bookstore / Stationery': {
        logo: '/defaults/branding/books_logo.png?v=5',
        cover: '/defaults/branding/books_cover.png?v=5'
    },
    'Craft / Handmade Goods Store': {
        logo: '/defaults/branding/craft_logo.png?v=5',
        cover: '/defaults/branding/craft_cover.png?v=5'
    },
    'Clothing / Boutique': {
        logo: '/defaults/branding/clothing_logo.png?v=5',
        cover: '/defaults/branding/clothing_cover.png?v=5'
    },
    'Toy & Gift Store': {
        logo: '/defaults/branding/toys_logo.png?v=5',
        cover: '/defaults/branding/toys_cover.png?v=5'
    },
    'Electronics / Mobile Accessories': {
        logo: '/defaults/branding/electronics_logo.png?v=5',
        cover: '/defaults/branding/electronics_cover.png?v=5'
    },
    'Thrift / Second-Hand Store': {
        logo: '/defaults/branding/thrift_logo.png?v=5',
        cover: '/defaults/branding/thrift_cover.png?v=5'
    },
    'General Retail': {
        logo: '/defaults/branding/general_logo.png?v=5',
        cover: '/defaults/branding/general_cover.png?v=5'
    },
    'Specialty Retail': {
        logo: '/defaults/branding/specialty_logo.png?v=5',
        cover: '/defaults/branding/specialty_cover.png?v=5'
    }
};

async function checkStores() {
  console.log('Checking stores for default branding paths...');
  const storesSnapshot = await db.collection('stores').get();
  
  let updateCount = 0;

  for (const doc of storesSnapshot.docs) {
    const data = doc.data();
    
    // Determine category: use businessType, fallback to business_type, or infer from store name
    let category = (data.businessType || data.business_type) as string;
    if (!category && data.name) {
      const nameLower = data.name.toLowerCase();
      if (nameLower.includes('fresh') || nameLower.includes('metro') || nameLower.includes('costco') || nameLower.includes('market') || nameLower.includes('grocer')) {
        category = 'Grocery Store';
      } else if (nameLower.includes('pick') || nameLower.includes('corner') || nameLower.includes('mart') || nameLower.includes('convenience')) {
        category = 'Convenience Store';
      }
    }
    
    // Default fallback if still unresolved
    if (!category) {
      category = 'Grocery Store';
    }

    if (categoriesToUpdate[category]) {
      const updates: any = {};
      const branding = categoriesToUpdate[category];
      const newLogo = branding.logo;
      const newCover = branding.cover;

      // Update logoUrl if it's missing, is an emoji, is a placeholder, or is not set to the new premium logo
      const isDefaultLogo = !data.logoUrl || 
                            (typeof data.logoUrl === 'string' && 
                             (data.logoUrl.includes('/defaults/branding/') || 
                              data.logoUrl.length <= 2 || 
                              data.logoUrl.includes('placeholder') ||
                              data.logoUrl === '🥬' || data.logoUrl === '🏪' || data.logoUrl === '🛒' || data.logoUrl === '📦'));
      
      // Update cover image if it's missing, is a placeholder, or is a legacy default
      const isDefaultCover = !data.image || 
                             (typeof data.image === 'string' && 
                              (data.image.includes('/defaults/branding/') || 
                               data.image.length <= 2 || 
                               data.image.includes('placeholder')));

      if (isDefaultLogo && data.logoUrl !== newLogo) {
        updates.logoUrl = newLogo;
        updates.logo = newLogo; // Keep logo in sync
      }
      if (isDefaultCover && newCover && data.image !== newCover) {
        updates.image = newCover;
      }
      
      // Set the businessType if it was missing or misconfigured
      if (!data.businessType) {
        updates.businessType = category;
      }

      if (Object.keys(updates).length > 0) {
        console.log(`Updating store ${doc.id} (${data.name}) - Resolved Category: ${category}`);
        console.log(`  -> Updates:`, JSON.stringify(updates));
        await doc.ref.update(updates);
        updateCount++;
      }
    }
  }

  console.log(`Finished. Updated ${updateCount} stores.`);
}

checkStores().catch(console.error);
