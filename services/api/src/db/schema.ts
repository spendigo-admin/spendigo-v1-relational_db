import { 
  pgTable, 
  varchar, 
  text, 
  timestamp, 
  integer, 
  boolean, 
  jsonb, 
  primaryKey, 
  uniqueIndex, 
  pgEnum, 
  customType,
  doublePrecision
} from 'drizzle-orm/pg-core';

// Custom pgvector type declaration (768 Dimensions)
const vector = customType<{ data: number[] }>({
  dataType() {
    return 'vector(768)';
  },
});

// --- ENUMS DEFINITIONS ---
export const userRoleEnum = pgEnum('user_role', ['admin', 'merchant', 'consumer']);
export const merchantSubRoleEnum = pgEnum('merchant_role', ['OWNER', 'MANAGER', 'STAFF', 'MARKETING']);
export const userStatusEnum = pgEnum('user_status', ['pending_invite', 'active', 'suspended']);
export const productStatusEnum = pgEnum('product_status', ['active', 'deprecated', 'blocked']);
export const verificationStatusEnum = pgEnum('verification_status', ['unverified', 'verified', 'manufacturer_verified']);
export const storeStatusEnum = pgEnum('store_status', ['active', 'pending', 'suspended', 'pending_deletion']);
export const jobStatusEnum = pgEnum('job_status', ['new', 'reviewed', 'interviewing', 'rejected', 'hired']);
export const activeInactiveEnum = pgEnum('active_inactive_status', ['active', 'inactive']);
export const ingestionStatusEnum = pgEnum('ingestion_status', ['pending', 'processing', 'completed', 'failed']);
export const staffRoleEnum = pgEnum('staff_role', ['SUPER_ADMIN', 'SUPPORT', 'MODERATOR', 'AUDITOR']);

// 1. SSoT REFERENCE TABLES
export const refBusinessTypes = pgTable('ref_business_types', {
  id: varchar('id', { length: 100 }).primaryKey(),
  label: varchar('label', { length: 255 }).notNull(),
  logo: text('logo'),
  cover: text('cover'),
  tagline: text('tagline').notNull(),
});

export const refCategories = pgTable('ref_categories', {
  id: varchar('id', { length: 100 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
});

export const refOrderStatuses = pgTable('ref_order_statuses', {
  id: varchar('id', { length: 50 }).primaryKey(),
});

export const refPaymentStatuses = pgTable('ref_payment_statuses', {
  id: varchar('id', { length: 50 }).primaryKey(),
});

// 2. CORE USERS & STORES
export const users = pgTable('users', {
  id: varchar('id', { length: 128 }).primaryKey(), // Firebase Auth UID
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  role: userRoleEnum('role').default('consumer').notNull(),
  adminRole: staffRoleEnum('admin_role'),
  merchantRole: merchantSubRoleEnum('merchant_role'),
  storeId: varchar('store_id', { length: 128 }),
  status: userStatusEnum('status').default('active').notNull(),
  addresses: jsonb('addresses').default([]),
  totalOrders: integer('total_orders').default(0).notNull(),
  totalSpend: integer('total_spend').default(0).notNull(), // Integer Cents
  lastOrderDate: timestamp('last_order_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastActive: timestamp('last_active').defaultNow().notNull(),
});

export const stores = pgTable('stores', {
  id: varchar('id', { length: 128 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  logo: text('logo'),
  address: text('address'),
  province: varchar('province', { length: 2 }).default('ON').notNull(),
  postalCode: varchar('postal_code', { length: 7 }),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  deliveryFee: integer('delivery_fee').default(0).notNull(), // Integer Cents
  freeDeliveryThreshold: integer('free_delivery_threshold'), // Integer Cents
  pickupEnabled: boolean('pickup_enabled').default(true).notNull(),
  deliveryEnabled: boolean('delivery_enabled').default(false).notNull(),
  maxDeliveryRadiusKm: doublePrecision('max_delivery_radius_km').default(10.0).notNull(),
  subscriptionTier: varchar('subscription_tier', { length: 50 }).default('starter').notNull(),
  status: storeStatusEnum('status').default('pending').notNull(),
  suspensionReason: text('suspension_reason'),
  ownerId: varchar('owner_id', { length: 128 }).references(() => users.id, { onDelete: 'restrict' }),
  stripeAccountId: varchar('stripe_account_id', { length: 255 }),
  stripeOnboardingStatus: varchar('stripe_onboarding_status', { length: 50 }),
  kybStatus: varchar('kyb_status', { length: 50 }).default('not_submitted').notNull(),
  kybDocuments: jsonb('kyb_documents').default([]),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 3. MASTER & MERCHANT CATALOG
export const masterProducts = pgTable('master_products', {
  id: varchar('id', { length: 128 }).primaryKey(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  brandName: varchar('brand_name', { length: 255 }),
  upcGtin: varchar('upc_gtin', { length: 50 }).unique(),
  isSoldByWeight: boolean('is_sold_by_weight').default(false).notNull(),
  netQuantityValue: doublePrecision('net_quantity_value'),
  netQuantityUnit: varchar('net_quantity_unit', { length: 50 }),
  packageCount: integer('package_count').default(1),
  primaryImageUrl: text('primary_image_url'),
  secondaryImageUrls: jsonb('secondary_image_urls').default([]),
  categoryId: varchar('category_id', { length: 100 }).references(() => refCategories.id, { onDelete: 'restrict' }).notNull(),
  productType: varchar('product_type', { length: 100 }),
  storageType: varchar('storage_type', { length: 100 }),
  taxCategoryId: varchar('tax_category_id', { length: 100 }),
  suggestedRetailPrice: integer('suggested_retail_price'), // Integer Cents
  substitutionGroupId: varchar('substitution_group_id', { length: 128 }),
  ageRestricted: boolean('age_restricted').default(false).notNull(),
  isCanadianLocal: boolean('is_canadian_local').default(false).notNull(),
  status: productStatusEnum('status').default('active').notNull(),
  verificationStatus: verificationStatusEnum('verification_status').default('unverified').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Decoupled vector table for product discovery
export const productEmbeddings = pgTable('product_embeddings', {
  id: varchar('id', { length: 128 }).primaryKey().references(() => masterProducts.id, { onDelete: 'cascade' }),
  embedding: vector('embedding').notNull(),
});

export const merchantProducts = pgTable('merchant_products', {
  storeId: varchar('store_id', { length: 128 }).references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  masterProductId: varchar('master_product_id', { length: 128 }).references(() => masterProducts.id, { onDelete: 'restrict' }).notNull(),
  price: integer('price').notNull(), // Integer Cents
  currency: varchar('currency', { length: 3 }).default('CAD').notNull(),
  availableQuantity: integer('available_quantity').default(0).notNull(),
  merchantSku: varchar('merchant_sku', { length: 100 }),
  originalPrice: integer('original_price'), // Integer Cents
  discountLabel: varchar('discount_label', { length: 255 }),
  discountValidUntil: timestamp('discount_valid_until'),
  isActive: boolean('is_active').default(true).notNull(),
  isCanadianLocal: boolean('is_canadian_local').default(false).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table: any) => {
  return {
    pk: primaryKey({ columns: [table.storeId, table.masterProductId] }),
  };
});

// 4. CHECKOUT TRANSACTION & ORDERS
export const orders = pgTable('orders', {
  id: varchar('id', { length: 128 }).primaryKey(),
  customerId: varchar('customer_id', { length: 128 }).references(() => users.id, { onDelete: 'restrict' }).notNull(),
  storeId: varchar('store_id', { length: 128 }).references(() => stores.id, { onDelete: 'restrict' }).notNull(),
  storeName: varchar('store_name', { length: 255 }).notNull(),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  customerEmail: varchar('customer_email', { length: 255 }).notNull(),
  subtotal: integer('subtotal').notNull(), // Integer Cents
  deliveryFee: integer('delivery_fee').default(0).notNull(), // Integer Cents
  tax: integer('tax').notNull(), // Integer Cents
  total: integer('total').notNull(), // Integer Cents
  paymentMethod: varchar('payment_method', { length: 50 }).default('card').notNull(),
  paymentStatus: varchar('payment_status', { length: 50 }).references(() => refPaymentStatuses.id).notNull(),
  paymentIntentId: varchar('payment_intent_id', { length: 255 }),
  deliveryAddress: jsonb('delivery_address').notNull(),
  status: varchar('status', { length: 50 }).references(() => refOrderStatuses.id).notNull(),
  rejectionReason: text('rejection_reason'),
  estimatedTime: varchar('estimated_time', { length: 100 }),
  paymentCollectedBy: varchar('payment_collected_by', { length: 50 }),
  emailQueued: boolean('email_queued').default(false).notNull(),
  emailQueuedAt: timestamp('email_queued_at'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orderItems = pgTable('order_items', {
  id: varchar('id', { length: 128 }).primaryKey(),
  orderId: varchar('order_id', { length: 128 }).references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  masterProductId: varchar('master_product_id', { length: 128 }).references(() => masterProducts.id, { onDelete: 'restrict' }).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  effectivePrice: integer('effective_price').notNull(), // Integer Cents
  quantity: integer('quantity').notNull(),
  substitutionGroupId: varchar('substitution_group_id', { length: 128 }),
  taxable: boolean('taxable').default(true).notNull(),
});

// 5. FORENSIC AUDIT LOG & COMPLIANCE
export const auditLogs = pgTable('audit_logs', {
  id: varchar('id', { length: 128 }).primaryKey(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  actorId: varchar('actor_id', { length: 128 }).notNull(),
  actorEmail: varchar('actor_email', { length: 255 }).notNull(),
  actorIp: varchar('actor_ip', { length: 45 }).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  resource: varchar('resource', { length: 255 }),
  metadata: jsonb('metadata'),
  prevHash: varchar('prev_hash', { length: 64 }).notNull(),
  hash: varchar('hash', { length: 64 }).notNull(),
}, (table: any) => {
  return {
    prevHashIdx: uniqueIndex('prev_hash_idx').on(table.prevHash),
    hashIdx: uniqueIndex('hash_idx').on(table.hash),
  };
});

export const consentLogs = pgTable('consent_logs', {
  id: varchar('id', { length: 128 }).primaryKey(),
  userId: varchar('user_id', { length: 128 }).references(() => users.id, { onDelete: 'restrict' }).notNull(),
  consentType: varchar('consent_type', { length: 100 }).notNull(),
  acceptedAt: timestamp('accepted_at').defaultNow().notNull(),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  userAgent: text('user_agent').notNull(),
});

// 6. ADVERTISING, SURVEYS, CAREERS, & STAFF POOL
export const staff = pgTable('staff', {
  email: varchar('email', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  role: staffRoleEnum('role').notNull(),
  status: varchar('status', { length: 50 }).default('active').notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

export const careers = pgTable('careers', {
  id: varchar('id', { length: 128 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  department: varchar('department', { length: 100 }),
  location: varchar('location', { length: 100 }),
  type: varchar('type', { length: 50 }),
  description: text('description'),
  requirements: text('requirements'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const jobApplications = pgTable('job_applications', {
  id: varchar('id', { length: 128 }).primaryKey(),
  jobId: varchar('job_id', { length: 128 }).references(() => careers.id, { onDelete: 'cascade' }).notNull(),
  candidateName: varchar('candidate_name', { length: 255 }).notNull(),
  candidateEmail: varchar('candidate_email', { length: 255 }).notNull(),
  resumeUrl: text('resume_url'),
  status: jobStatusEnum('status').default('new').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const ads = pgTable('ads', {
  id: varchar('id', { length: 128 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  imageUrl: text('image_url').notNull(),
  link: text('link'),
  priority: integer('priority').default(0).notNull(),
  status: activeInactiveEnum('status').default('active').notNull(),
  storeId: varchar('store_id', { length: 128 }).references(() => stores.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const surveys = pgTable('surveys', {
  id: varchar('id', { length: 128 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  questions: jsonb('questions').default([]).notNull(),
  status: activeInactiveEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const surveyResponses = pgTable('survey_responses', {
  surveyId: varchar('survey_id', { length: 128 }).references(() => surveys.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar('user_id', { length: 128 }).references(() => users.id, { onDelete: 'cascade' }).notNull(),
  answers: jsonb('answers').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table: any) => {
  return {
    pk: primaryKey({ columns: [table.surveyId, table.userId] }),
  };
});
