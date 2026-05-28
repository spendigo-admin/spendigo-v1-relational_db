import * as admin from 'firebase-admin';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from '../src/db/schema';
import * as fs from 'fs';
import * as path from 'path';

// Reference Constants defined locally to decouple from apps/web ESM workspace
const BUSINESS_TYPES: Record<string, { label: string; logo: string; cover: string; tagline: string }> = {
    'Grocery Store': {
        label: 'Groceries & Supermarkets',
        logo: '/defaults/branding/grocery_logo.png?v=6',
        cover: '/defaults/branding/grocery_cover.png?v=5',
        tagline: 'Fresh groceries and daily essentials.'
    },
    'Convenience Store': {
        label: 'Convenience Store',
        logo: '/defaults/branding/convenience_logo.png?v=5',
        cover: '/defaults/branding/convenience_cover.png?v=5',
        tagline: 'Quick stops for all your immediate needs.'
    },
    'Discount / Dollar Store': {
        label: 'Discount & Dollar Store',
        logo: '/defaults/branding/discount_logo.png?v=5',
        cover: '/defaults/branding/discount_cover.png?v=5',
        tagline: 'Great deals and everyday value.'
    },
    'Ethnic / Specialty Grocery': {
        label: 'International & Specialty Grocery',
        logo: '/defaults/branding/ethnic_logo.png?v=5',
        cover: '/defaults/branding/ethnic_cover.png?v=5',
        tagline: 'Authentic flavors, spices and traditional ingredients.'
    },
    'Ethnic Speciality Grocery': {
        label: 'International & Specialty Grocery',
        logo: '/defaults/branding/ethnic_logo.png?v=5',
        cover: '/defaults/branding/ethnic_cover.png?v=5',
        tagline: 'Authentic flavors, spices and traditional ingredients.'
    },
    'Asian Grocers': {
        label: 'Asian Grocery',
        logo: '/defaults/branding/asian_logo.jpg?v=5',
        cover: '/defaults/branding/asian_cover.jpg?v=5',
        tagline: 'Fresh Asian produce, spices, and specialty goods.'
    },
    'Indo-Pak / Desi Grocery': {
        label: 'South Asian & Halal Grocery',
        logo: '/defaults/branding/desi_logo.jpg?v=5',
        cover: '/defaults/branding/desi_cover.jpg?v=5',
        tagline: 'Authentic South Asian groceries and spices.'
    },
    'Farmers Market Vendor': {
        label: 'Farmers Market',
        logo: '/defaults/branding/farmers_logo.png?v=5',
        cover: '/defaults/branding/farmers_cover.png?v=5',
        tagline: 'Fresh, local, and direct from the farm.'
    },
    'Organic / Health Food Store': {
        label: 'Organic & Health Food',
        logo: '/defaults/branding/organic_logo.png?v=5',
        cover: '/defaults/branding/organic_cover.png?v=5',
        tagline: 'Healthy, organic, and locally sourced goodness.'
    },
    'Artisan Bakery': {
        label: 'Bakery & Desserts',
        logo: '/defaults/branding/bakery_logo.png?v=5',
        cover: '/defaults/branding/bakery_cover.png?v=5',
        tagline: 'Freshly baked breads and sweet treats daily.'
    },
    'Butcher Shop': {
        label: 'Butcher & Meat Shop',
        logo: '/defaults/branding/butcher_logo.png?v=5',
        cover: '/defaults/branding/butcher_cover.png?v=5',
        tagline: 'Quality cuts and fresh meats.'
    },
    'Fishmonger / Seafood Shop': {
        label: 'Seafood Market',
        logo: '/defaults/branding/seafood_logo.png?v=5',
        cover: '/defaults/branding/seafood_cover.png?v=5',
        tagline: 'Fresh catches from the sea.'
    },
    'Deli / Prepared Foods': {
        label: 'Deli & Prepared Meals',
        logo: '/defaults/branding/deli_logo.png?v=5',
        cover: '/defaults/branding/deli_cover.png?v=5',
        tagline: 'Ready-to-eat meals and deli meats.'
    },
    'Restaurant': {
        label: 'Restaurant',
        logo: '/defaults/branding/restaurant_logo.png?v=5',
        cover: '/defaults/branding/restaurant_cover.png?v=5',
        tagline: 'Delicious meals made to order.'
    },
    'Local Café / Coffee Shop': {
        label: 'Café & Coffee',
        logo: '/defaults/branding/cafe_logo.png?v=5',
        cover: '/defaults/branding/cafe_cover.png?v=5',
        tagline: 'Premium coffee and cozy vibes.'
    },
    'Dessert & Sweets Shop': {
        label: 'Sweets & Desserts',
        logo: '/defaults/branding/sweets_logo.png?v=5',
        cover: '/defaults/branding/sweets_cover.png?v=5',
        tagline: 'Treat yourself to something sweet.'
    },
    'Meal Prep / Tiffin Service': {
        label: 'Meal Prep & Catering',
        logo: '/defaults/branding/tiffin_logo.png?v=5',
        cover: '/defaults/branding/tiffin_cover.png?v=5',
        tagline: 'Home-cooked meals delivered fresh.'
    },
    'Pharmacy / Health Store': {
        label: 'Pharmacy & Wellness',
        logo: '/defaults/branding/pharmacy_logo.png?v=5',
        cover: '/defaults/branding/pharmacy_cover.png?v=5',
        tagline: 'Health, wellness, and prescriptions.'
    },
    'Pet Store': {
        label: 'Pet Supplies',
        logo: '/defaults/branding/pet_logo.png?v=5',
        cover: '/defaults/branding/pet_cover.png?v=5',
        tagline: 'Everything your furry friends need.'
    },
    'Florist': {
        label: 'Flowers & Florist',
        logo: '/defaults/branding/florist_logo.png?v=5',
        cover: '/defaults/branding/florist_cover.png?v=5',
        tagline: 'Beautiful blooms for every occasion.'
    },
    'Home & Garden Store': {
        label: 'Home & Garden',
        logo: '/defaults/branding/home_garden_logo.png?v=5',
        cover: '/defaults/branding/home_garden_cover.png?v=5',
        tagline: 'Everything to make your house a home.'
    },
    'Hardware Store': {
        label: 'Hardware & Tools',
        logo: '/defaults/branding/hardware_logo.png?v=5',
        cover: '/defaults/branding/hardware_cover.png?v=5',
        tagline: 'Tools and supplies for every project.'
    },
    'Bookstore / Stationery': {
        label: 'Books & Stationery',
        logo: '/defaults/branding/books_logo.png?v=5',
        cover: '/defaults/branding/books_cover.png?v=5',
        tagline: 'Books, supplies, and inspiration.'
    },
    'Craft / Handmade Goods Store': {
        label: 'Crafts & Gift Shop',
        logo: '/defaults/branding/craft_logo.png?v=5',
        cover: '/defaults/branding/craft_cover.png?v=5',
        tagline: 'Unique, handmade goods and crafts.'
    },
    'Clothing / Boutique': {
        label: 'Clothing & Fashion',
        logo: '/defaults/branding/clothing_logo.png?v=5',
        cover: '/defaults/branding/clothing_cover.png?v=5',
        tagline: 'Apparel and accessories for every style.'
    },
    'Toy & Gift Store': {
        label: 'Toys & Gifts',
        logo: '/defaults/branding/toys_logo.png?v=5',
        cover: '/defaults/branding/toys_cover.png?v=5',
        tagline: 'Fun toys and perfect gifts.'
    },
    'Electronics / Mobile Accessories': {
        label: 'Electronics & Mobile',
        logo: '/defaults/branding/electronics_logo.png?v=5',
        cover: '/defaults/branding/electronics_cover.png?v=5',
        tagline: 'Tech gadgets and accessories.'
    },
    'Thrift / Second-Hand Store': {
        label: 'Thrift & Consignment',
        logo: '/defaults/branding/thrift_logo.png?v=5',
        cover: '/defaults/branding/thrift_cover.png?v=5',
        tagline: 'Pre-loved goods and hidden treasures.'
    },
    'General Retail': {
        label: 'General Retail',
        logo: '/defaults/branding/general_logo.png?v=5',
        cover: '/defaults/branding/general_cover.png?v=5',
        tagline: 'Quality goods and services.'
    },
    'Specialty Retail': {
        label: 'Specialty Retail',
        logo: '/defaults/branding/specialty_logo.png?v=5',
        cover: '/defaults/branding/specialty_cover.png?v=5',
        tagline: 'Unique specialty items and goods.'
    }
};

const PRODUCT_CATEGORIES = [
    'Beverages',
    'Snacks',
    'Pantry',
    'Frozen',
    'Household',
    'Dairy & Eggs',
    'Meat & Seafood',
    'Produce',
    'Bakery',
    'International & Desi',
    'Halal',
    'Vegetarian',
    'Personal Care',
    'Health & Medicine',
    'Baby & Kids',
    'Pet Supplies',
    'Electronics',
    'Other'
];

// Load service account relative to services/api/scripts/backfillMigration.ts
const serviceAccountPath = path.join(__dirname, '../../../scripts/service-account.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error(`Error: Service account file not found at ${serviceAccountPath}`);
    process.exit(1);
}

const serviceAccount = require(serviceAccountPath);
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const firestore = admin.firestore();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/spendigo_dev',
});
const db = drizzle(pool, { schema });

// Helper to safely convert Firestore values to Javascript Date objects
function safeDate(val: any): Date {
    if (!val) return new Date();
    if (val.toDate && typeof val.toDate === 'function') {
        return val.toDate();
    }
    if (val.seconds) {
        return new Date(val.seconds * 1000);
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
}

function safeOptionalDate(val: any): Date | null {
    if (!val) return null;
    if (val.toDate && typeof val.toDate === 'function') {
        return val.toDate();
    }
    if (val.seconds) {
        return new Date(val.seconds * 1000);
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
}

async function migrate() {
    console.log("=== STARTING REFERENCE SEEDING & BACKFILL ===");

    // Clear all existing tables before migrating (enforces clean slate and wipes legacy stubs)
    console.log("Clearing existing tables in PostgreSQL...");
    await db.execute(sql`
      TRUNCATE TABLE 
        users, stores, master_products, merchant_products, orders, order_items, 
        staff, careers, job_applications, ads, surveys, survey_responses, 
        ref_business_types, ref_categories, ref_order_statuses, ref_payment_statuses 
      CASCADE;
    `);
    console.log("PostgreSQL tables successfully truncated.");

    // 1. Seed SSoT Reference Tables
    console.log("Seeding ref_business_types...");
    const businessTypeRecords = Object.entries(BUSINESS_TYPES).map(([id, val]) => ({
        id,
        label: val.label,
        logo: val.logo || null,
        cover: val.cover || null,
        tagline: val.tagline,
    }));
    await db.insert(schema.refBusinessTypes).values(businessTypeRecords).onConflictDoNothing();

    console.log("Seeding ref_categories...");
    const categoryRecords = PRODUCT_CATEGORIES.map(catName => ({
        id: catName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        name: catName,
    }));
    await db.insert(schema.refCategories).values(categoryRecords).onConflictDoNothing();

    console.log("Seeding ref_order_statuses...");
    const orderStatuses = ['placed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'].map(id => ({ id }));
    await db.insert(schema.refOrderStatuses).values(orderStatuses).onConflictDoNothing();

    console.log("Seeding ref_payment_statuses...");
    const paymentStatuses = ['paid', 'pending', 'unpaid', 'refunding', 'refunded', 'partially_refunded'].map(id => ({ id }));
    await db.insert(schema.refPaymentStatuses).values(paymentStatuses).onConflictDoNothing();

    // 2. Backfill Staff
    console.log("Backfilling staff...");
    const staffSnap = await firestore.collection('staff').get();
    const staffRecords: any[] = [];
    staffSnap.forEach(doc => {
        const data = doc.data();
        const email = doc.id.toLowerCase();
        staffRecords.push({
            email: email,
            name: data.name || 'Admin Staff',
            role: ['SUPER_ADMIN', 'SUPPORT', 'MODERATOR', 'AUDITOR'].includes(data.role) ? data.role : 'SUPPORT',
            status: data.status === 'inactive' ? 'inactive' : 'active',
            joinedAt: safeDate(data.joinedAt || data.joinedAt)
        });
    });
    if (staffRecords.length > 0) {
        await db.insert(schema.staff).values(staffRecords).onConflictDoNothing();
    }
    console.log(`Successfully backfilled ${staffRecords.length} staff members.`);

    // === RELATION COMPLIANCE: PREPARE LOOKUP VALIDATION SETS ===
    console.log("Preparing lookup validation sets to strictly filter orphan records...");
    
    // Get all Firestore collections to build validation maps
    const usersSnap = await firestore.collection('users').get();
    const storesSnap = await firestore.collection('stores').get();
    const mProdSnap = await firestore.collection('master_products').get();
    const merchantProductsSnap = await firestore.collection('merchant_products').get();
    const ordersSnap = await firestore.collection('orders').get();
    const adsSnap = await firestore.collection('ads').get();

    const validUserIds = new Set<string>();
    usersSnap.forEach(doc => validUserIds.add(doc.id));

    const validStoreIds = new Set<string>();
    storesSnap.forEach(doc => validStoreIds.add(doc.id));

    const validMasterProductIds = new Set<string>();
    mProdSnap.forEach(doc => validMasterProductIds.add(doc.id));

    // 3. Backfill Core Users
    console.log("Backfilling users...");
    const userRecords: any[] = [];
    usersSnap.forEach(doc => {
        const data = doc.data();
        userRecords.push({
            id: doc.id,
            email: data.email || `${doc.id}@unknown.com`,
            name: data.name || null,
            role: ['admin', 'merchant', 'consumer'].includes(data.role) ? data.role : 'consumer',
            adminRole: ['SUPER_ADMIN', 'SUPPORT', 'MODERATOR', 'AUDITOR'].includes(data.adminRole) ? data.adminRole : null,
            merchantRole: data.merchantRole || null,
            storeId: null, // Avoid circular key lock on insert
            status: data.status === 'pending_invite' ? 'pending_invite' : 'active',
            addresses: data.addresses || [],
            totalOrders: typeof data.total_orders === 'number' ? data.total_orders : parseInt(data.total_orders) || 0,
            totalSpend: (() => {
                const s = parseFloat(data.total_spend);
                return isNaN(s) ? 0 : Math.round(s * 100);
            })(),
            lastOrderDate: safeOptionalDate(data.last_order_date),
            createdAt: safeDate(data.createdAt),
            lastActive: safeDate(data.last_active),
        });
    });
    if (userRecords.length > 0) {
        await db.insert(schema.users).values(userRecords).onConflictDoNothing();
    }
    console.log(`Successfully backfilled ${userRecords.length} users.`);

    // 4. Backfill Stores
    console.log("Backfilling stores...");
    const storeRecords: any[] = [];
    const circularUpdates: Array<{ userId: string, storeId: string }> = [];

    storesSnap.forEach(doc => {
        const data = doc.data();
        storeRecords.push({
            id: doc.id,
            name: data.name,
            logo: data.logo || null,
            address: data.address || null,
            province: data.province || 'ON',
            postalCode: data.postalCode || null,
            latitude: data.location?.lat || null,
            longitude: data.location?.lng || null,
            deliveryFee: (() => {
                const f = parseFloat(data.deliveryFee);
                return isNaN(f) ? 0 : Math.round(f * 100);
            })(),
            freeDeliveryThreshold: (() => {
                if (data.freeDeliveryThreshold === undefined || data.freeDeliveryThreshold === null) return null;
                const t = parseFloat(data.freeDeliveryThreshold);
                return isNaN(t) ? null : Math.round(t * 100);
            })(),
            pickupEnabled: data.pickupEnabled ?? true,
            deliveryEnabled: data.deliveryEnabled ?? false,
            subscriptionTier: data.subscriptionTier || 'starter',
            status: ['active', 'pending', 'suspended', 'pending_deletion'].includes(data.status) ? data.status : 'pending',
            ownerId: data.ownerId && validUserIds.has(data.ownerId) ? data.ownerId : null,
            stripeAccountId: data.stripeAccountId || null,
            stripeOnboardingStatus: data.stripeOnboardingStatus || null,
            kybStatus: data.kybStatus || 'not_submitted',
            kybDocuments: data.kybDocuments || [],
        });
        if (data.ownerId && validUserIds.has(data.ownerId)) {
            circularUpdates.push({ userId: data.ownerId, storeId: doc.id });
        }
    });
    if (storeRecords.length > 0) {
        await db.insert(schema.stores).values(storeRecords).onConflictDoNothing();
    }
    console.log(`Successfully backfilled ${storeRecords.length} stores.`);

    // 5. Resolve User storeId circular FK locks
    console.log("Resolving circular store reference paths in users...");
    for (const update of circularUpdates) {
        try {
            await db.update(schema.users)
              .set({ storeId: update.storeId })
              .where(eq(schema.users.id, update.userId));
        } catch (err: any) {
            console.error(`Skipped circular reference update for user ${update.userId} and store ${update.storeId}:`, err.message);
        }
    }

    // 6. Backfill Catalog
    console.log("Backfilling master products...");
    const masterProductRecords: any[] = [];
    mProdSnap.forEach(doc => {
        const data = doc.data();
        const categoryId = data.category_id ? data.category_id.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'other';
        masterProductRecords.push({
            id: doc.id,
            productName: data.product_name,
            brandName: data.brand_name || null,
            upcGtin: data.upc_gtin || null,
            isSoldByWeight: data.is_sold_by_weight ?? false,
            netQuantityValue: data.net_quantity_value || null,
            netQuantityUnit: data.net_quantity_unit || null,
            packageCount: data.package_count || 1,
            primaryImageUrl: data.primary_image_url || null,
            secondaryImageUrls: data.secondary_image_urls || [],
            categoryId: categoryId,
            suggestedRetailPrice: (() => {
                if (data.suggested_retail_price === undefined || data.suggested_retail_price === null) return null;
                const s = parseFloat(data.suggested_retail_price);
                return isNaN(s) ? null : Math.round(s * 100);
            })(),
            status: ['active', 'deprecated', 'blocked'].includes(data.status) ? data.status : 'active',
            verificationStatus: ['unverified', 'verified', 'manufacturer_verified'].includes(data.verification_status) ? data.verification_status : 'unverified',
        });
    });
    if (masterProductRecords.length > 0) {
        await db.insert(schema.masterProducts).values(masterProductRecords).onConflictDoNothing();
    }
    console.log(`Successfully backfilled ${masterProductRecords.length} master products.`);

    // 7. Backfill Merchant Inventories
    console.log("Backfilling merchant inventory products...");
    // Already fetched merchantProductsSnap in orphan detector
    const merchantProductRecords: any[] = [];
    merchantProductsSnap.forEach(doc => {
        const data = doc.data();
        if (data.merchant_id && data.master_product_id) {
            // Strict relation filtering: discard merchant product link if either store or master product doesn't exist
            if (validStoreIds.has(data.merchant_id) && validMasterProductIds.has(data.master_product_id)) {
                merchantProductRecords.push({
                    storeId: data.merchant_id,
                    masterProductId: data.master_product_id,
                    price: (() => {
                        const p = parseFloat(data.price);
                        return isNaN(p) ? 0 : Math.round(p * 100);
                    })(),
                    currency: data.currency || 'CAD',
                    availableQuantity: typeof data.available_quantity === 'number' ? data.available_quantity : parseInt(data.available_quantity) || 0,
                    merchantSku: data.merchant_sku || null,
                    originalPrice: (() => {
                        if (data.original_price === undefined || data.original_price === null) return null;
                        const op = parseFloat(data.original_price);
                        return isNaN(op) ? null : Math.round(op * 100);
                    })(),
                    discountLabel: data.discount_label || null,
                    isActive: data.is_active ?? true,
                });
            }
        }
    });
    if (merchantProductRecords.length > 0) {
        await db.insert(schema.merchantProducts).values(merchantProductRecords).onConflictDoNothing();
    }
    console.log(`Successfully backfilled ${merchantProductRecords.length} merchant products.`);

    // 8. Backfill Checkout Transactions
    console.log("Backfilling orders & flattening order items...");
    // Already fetched ordersSnap in orphan detector
    let orderCount = 0;
    for (const doc of ordersSnap.docs) {
        const data = doc.data();
        try {
            const customerId = data.customerId || data.userId;
            const storeId = data.storeId;

            // Strict relation filtering: discard orders referencing deleted customers or stores
            if (!customerId || !validUserIds.has(customerId) || !storeId || !validStoreIds.has(storeId)) {
                console.log(`Skipping orphaned order ${doc.id} (Customer or Store missing)`);
                continue;
            }

            await db.insert(schema.orders).values({
                id: doc.id,
                customerId: customerId,
                storeId: storeId,
                storeName: data.storeName || 'Store name',
                customerName: data.customerName || 'Customer',
                customerEmail: data.customerEmail || 'unknown@spendigo.ca',
                subtotal: (() => {
                    const st = parseFloat(data.subtotal);
                    return isNaN(st) ? 0 : Math.round(st * 100);
                })(),
                deliveryFee: (() => {
                    const df = parseFloat(data.deliveryFee);
                    return isNaN(df) ? 0 : Math.round(df * 100);
                })(),
                tax: (() => {
                    const tx = parseFloat(data.tax);
                    return isNaN(tx) ? 0 : Math.round(tx * 100);
                })(),
                total: (() => {
                    const ttl = parseFloat(data.total);
                    return isNaN(ttl) ? 0 : Math.round(ttl * 100);
                })(),
                paymentStatus: data.paymentStatus || 'unpaid',
                status: data.status || 'placed',
                deliveryAddress: data.deliveryAddress || {},
                createdAt: safeDate(data.createdAt),
            });

            const items = data.items || [];
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                // Strict relation filtering: discard items referencing missing master products
                if (!item.productId || !validMasterProductIds.has(item.productId)) {
                    console.log(`Skipping orphaned order item ${item.productId || 'unknown'} in order ${doc.id}`);
                    continue;
                }
                await db.insert(schema.orderItems).values({
                    id: `${doc.id}_item_${i}`,
                    orderId: doc.id,
                    masterProductId: item.productId,
                    productName: item.productName || 'Unknown Product',
                    effectivePrice: (() => {
                        const ip = parseFloat(item.price);
                        return isNaN(ip) ? 0 : Math.round(ip * 100);
                    })(),
                    quantity: item.quantity || 1,
                    taxable: item.taxable ?? true,
                });
            }
            orderCount++;
        } catch (err: any) {
            console.error(`Skipped order ${doc.id} due to constraint violation:`, err.message);
        }
    }
    console.log(`Successfully backfilled ${orderCount} orders.`);

    // 9. Backfill Careers & Applications
    console.log("Backfilling careers...");
    const careersSnap = await firestore.collection('careers').get();
    const careerRecords: any[] = [];
    careersSnap.forEach(doc => {
        const data = doc.data();
        careerRecords.push({
            id: doc.id,
            title: data.title || 'Untitled Role',
            department: data.department || null,
            location: data.location || null,
            type: data.type || null,
            description: data.description || null,
            requirements: data.requirements || null,
            createdAt: safeDate(data.createdAt)
        });
    });
    if (careerRecords.length > 0) {
        await db.insert(schema.careers).values(careerRecords).onConflictDoNothing();
    }
    console.log(`Successfully backfilled ${careerRecords.length} careers.`);

    const validJobIds = new Set<string>();
    careersSnap.forEach(doc => validJobIds.add(doc.id));

    console.log("Backfilling job applications...");
    const jobAppsSnap = await firestore.collection('job_applications').get();
    const jobAppRecords: any[] = [];
    jobAppsSnap.forEach(doc => {
        const data = doc.data();
        // Strict relation filtering: discard applications referencing missing career postings
        if (data.jobId && validJobIds.has(data.jobId)) {
            jobAppRecords.push({
                id: doc.id,
                jobId: data.jobId,
                candidateName: data.candidateName || 'Unknown Candidate',
                candidateEmail: data.candidateEmail || 'unknown@example.com',
                resumeUrl: data.resumeUrl || null,
                status: ['new', 'reviewed', 'interviewing', 'rejected', 'hired'].includes(data.status) ? data.status : 'new',
                createdAt: safeDate(data.createdAt)
            });
        }
    });
    if (jobAppRecords.length > 0) {
        await db.insert(schema.jobApplications).values(jobAppRecords).onConflictDoNothing();
    }
    console.log(`Successfully backfilled ${jobAppRecords.length} job applications.`);

    // 10. Backfill Ads & Surveys
    console.log("Backfilling ads...");
    // Already fetched adsSnap in lookup builder
    const adRecords: any[] = [];
    adsSnap.forEach(doc => {
        const data = doc.data();
        // Strict relation filtering: set storeId to null if the store does not exist
        const storeId = data.storeId && validStoreIds.has(data.storeId) ? data.storeId : null;
        adRecords.push({
            id: doc.id,
            title: data.title || 'Untitled Ad',
            imageUrl: data.imageUrl || '',
            link: data.link || null,
            priority: data.priority || 0,
            status: data.status === 'inactive' ? 'inactive' : 'active',
            storeId: storeId,
            createdAt: safeDate(data.createdAt)
        });
    });
    if (adRecords.length > 0) {
        await db.insert(schema.ads).values(adRecords).onConflictDoNothing();
    }
    console.log(`Successfully backfilled ${adRecords.length} ads.`);

    console.log("Backfilling surveys...");
    const surveysSnap = await firestore.collection('surveys').get();
    const surveyRecords: any[] = [];
    surveysSnap.forEach(doc => {
        const data = doc.data();
        surveyRecords.push({
            id: doc.id,
            title: data.title || 'Untitled Survey',
            description: data.description || null,
            questions: data.questions || [],
            status: data.status === 'inactive' ? 'inactive' : 'active',
            createdAt: safeDate(data.createdAt)
        });
    });
    if (surveyRecords.length > 0) {
        await db.insert(schema.surveys).values(surveyRecords).onConflictDoNothing();
    }
    console.log(`Successfully backfilled ${surveyRecords.length} surveys.`);

    const validSurveyIds = new Set<string>();
    surveyRecords.forEach(s => validSurveyIds.add(s.id));

    console.log("Backfilling survey responses...");
    const surveyResponsesSnap = await firestore.collectionGroup('responses').get();
    const surveyResponseRecords: any[] = [];
    surveyResponsesSnap.forEach(doc => {
        const data = doc.data();
        const surveyId = doc.ref.parent.parent?.id;
        const userId = doc.id;
        // Strict relation filtering: discard survey responses referencing deleted users or surveys
        if (surveyId && userId && validSurveyIds.has(surveyId) && validUserIds.has(userId)) {
            surveyResponseRecords.push({
                surveyId: surveyId,
                userId: userId,
                answers: data.answers || {},
                createdAt: safeDate(data.createdAt)
            });
        }
    });
    if (surveyResponseRecords.length > 0) {
        await db.insert(schema.surveyResponses).values(surveyResponseRecords).onConflictDoNothing();
    }
    console.log(`Successfully backfilled ${surveyResponseRecords.length} survey responses.`);

    console.log("=== REFERENCE SEEDING & BACKFILL COMPLETED SUCCESSFULLY ===");
    await pool.end();
}

migrate().catch(console.error);
