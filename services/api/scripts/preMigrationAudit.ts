import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Load service account relative to services/api/scripts/preMigrationAudit.ts
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
const db = admin.firestore();

const VALID_ADMIN_ROLES = ['SUPER_ADMIN', 'SUPPORT', 'MODERATOR', 'AUDITOR'];
const VALID_MERCHANT_ROLES = ['OWNER', 'MANAGER', 'STAFF', 'MARKETING'];

async function runAudit() {
    console.log("=== STARTING PRE-MIGRATION INTEGRITY AUDIT ===");
    const report: any = {
        timestamp: new Date().toISOString(),
        stores: { total: 0, suspended: 0, pendingDeletion: 0, active: 0, pending: 0, invalidStatus: [] },
        users: { 
            total: 0, 
            merchants: 0, 
            consumers: 0, 
            admins: 0, 
            missingRole: [],
            invalidRole: [],
            invalidMerchantRole: [],
            invalidAdminRole: [],
            adminRoleMismatch: [], // adminRole set but role !== admin, or role === admin but missing adminRole
            unauthorizedAdminRoleChange: []
        },
        staff: {
            total: 0,
            active: 0,
            inactive: 0,
            invalidRole: [],
            invalidStatus: [],
            missingUserDoc: [], // staff exists but no user doc in users collection
            roleMismatchWithUser: [] // role in staff collection does not match adminRole in users collection
        },
        orphans: {
            merchantProductsMissingStore: [],
            merchantProductsMissingMaster: [],
            dealsMissingStore: [],
            flyersMissingStore: [],
            ordersMissingCustomer: [],
            ordersMissingStore: [],
            jobApplicationsMissingJob: [],
            scheduledIngestionsMissingStore: [],
            campaignLogsMissingStore: [],
            billingLedgerMissingStore: [],
            billingLedgerMissingUser: []
        }
    };

    // 1. Map valid entities for fast lookup
    console.log("Fetching and mapping stores...");
    const validStoreIds = new Set<string>();
    const storesSnap = await db.collection('stores').get();
    storesSnap.forEach(doc => {
        const data = doc.data();
        validStoreIds.add(doc.id);
        report.stores.total++;
        
        if (data.status === 'active') report.stores.active++;
        else if (data.status === 'pending') report.stores.pending++;
        else if (data.status === 'suspended') report.stores.suspended++;
        else if (data.status === 'pending_deletion') report.stores.pendingDeletion++;
        else report.stores.invalidStatus.push({ id: doc.id, status: data.status });
    });

    console.log("Fetching and mapping users & administrative roles...");
    const validUserIds = new Set<string>();
    const usersMap = new Map<string, any>();
    const usersSnap = await db.collection('users').get();
    usersSnap.forEach(doc => {
        const data = doc.data();
        validUserIds.add(doc.id);
        usersMap.set(doc.id, data);
        report.users.total++;
        
        const role = data.role;
        const adminRole = data.adminRole;
        const merchantRole = data.merchantRole;

        // Verify Roles
        if (!role) {
            report.users.missingRole.push(doc.id);
        } else if (role === 'merchant') {
            report.users.merchants++;
            if (merchantRole && !VALID_MERCHANT_ROLES.includes(merchantRole)) {
                report.users.invalidMerchantRole.push({ id: doc.id, merchantRole });
            }
        } else if (role === 'consumer') {
            report.users.consumers++;
            if (adminRole || merchantRole) {
                report.users.adminRoleMismatch.push({ id: doc.id, reason: "Consumer with adminRole or merchantRole set" });
            }
        } else if (role === 'admin') {
            report.users.admins++;
            if (!adminRole) {
                report.users.adminRoleMismatch.push({ id: doc.id, reason: "Admin role with missing adminRole" });
            } else if (!VALID_ADMIN_ROLES.includes(adminRole)) {
                report.users.invalidAdminRole.push({ id: doc.id, adminRole });
            }
        } else {
            report.users.invalidRole.push({ id: doc.id, role });
        }
    });

    // 2. Audit Isolated Staff Collection
    console.log("Auditing isolated staff collection...");
    const staffSnap = await db.collection('staff').get();
    const staffEmails = new Set<string>();
    
    staffSnap.forEach(doc => {
        const data = doc.data();
        const email = doc.id.toLowerCase();
        staffEmails.add(email);
        report.staff.total++;

        // Audit status
        if (data.status === 'active') report.staff.active++;
        else if (data.status === 'inactive') report.staff.inactive++;
        else report.staff.invalidStatus.push({ email: doc.id, status: data.status });

        // Audit role
        if (!VALID_ADMIN_ROLES.includes(data.role)) {
            report.staff.invalidRole.push({ email: doc.id, role: data.role });
        }

        // Search matching user in users collection by email
        let matchingUser: any = null;
        for (const uData of usersMap.values()) {
            if (uData.email && uData.email.toLowerCase() === email) {
                matchingUser = uData;
                break;
            }
        }

        if (!matchingUser) {
            report.staff.missingUserDoc.push({ email: doc.id, role: data.role });
        } else {
            // Verify roles match exactly
            if (matchingUser.role !== 'admin') {
                report.staff.roleMismatchWithUser.push({ 
                    email: doc.id, 
                    staffRole: data.role, 
                    userRole: matchingUser.role,
                    reason: "Matching user doc has non-admin role"
                });
            } else if (matchingUser.adminRole !== data.role) {
                report.staff.roleMismatchWithUser.push({ 
                    email: doc.id, 
                    staffRole: data.role, 
                    userAdminRole: matchingUser.adminRole,
                    reason: "Admin sub-role mismatch between staff and users collections"
                });
            }
        }
    });

    // Reverse check: User with admin role must exist in staff collection
    for (const [uid, uData] of usersMap.entries()) {
        if (uData.role === 'admin' && uData.email) {
            const email = uData.email.toLowerCase();
            if (!staffEmails.has(email)) {
                report.users.adminRoleMismatch.push({ 
                    id: uid, 
                    email: uData.email,
                    reason: "User has role admin, but no matching staff document exists in isolated staff collection" 
                });
            }
        }
    }

    console.log("Fetching other catalogs and directories for orphan scanning...");
    const validMasterProductIds = new Set<string>();
    const masterProductsSnap = await db.collection('master_products').get();
    masterProductsSnap.forEach(doc => validMasterProductIds.add(doc.id));

    const pendingMasterProductIds = new Set<string>();
    const pendingProductsSnap = await db.collection('pending_master_products').get();
    pendingProductsSnap.forEach(doc => pendingMasterProductIds.add(doc.id));

    const validJobIds = new Set<string>();
    const careersSnap = await db.collection('careers').get();
    careersSnap.forEach(doc => validJobIds.add(doc.id));

    // 3. Scan Merchant Products for Orphans
    console.log("Auditing merchant products...");
    const mProductsSnap = await db.collection('merchant_products').get();
    mProductsSnap.forEach(doc => {
        const data = doc.data();
        const storeId = data.merchant_id;
        const masterId = data.master_product_id;

        if (!validStoreIds.has(storeId)) {
            report.orphans.merchantProductsMissingStore.push({ id: doc.id, storeId });
        }
        if (!validMasterProductIds.has(masterId) && !pendingMasterProductIds.has(masterId)) {
            report.orphans.merchantProductsMissingMaster.push({ id: doc.id, masterId });
        }
    });

    // 4. Scan Deals and Flyers for Orphans (Collection Groups)
    console.log("Auditing deals & flyers subcollections...");
    const dealsSnap = await db.collectionGroup('deals').get();
    dealsSnap.forEach(doc => {
        const storeId = doc.ref.parent.parent?.id;
        if (!storeId || !validStoreIds.has(storeId)) {
            report.orphans.dealsMissingStore.push({ id: doc.id, storeId });
        }
    });

    const flyersSnap = await db.collectionGroup('flyers').get();
    flyersSnap.forEach(doc => {
        const storeId = doc.ref.parent.parent?.id;
        if (!storeId || !validStoreIds.has(storeId)) {
            report.orphans.flyersMissingStore.push({ id: doc.id, storeId });
        }
    });

    // 5. Scan Orders for Orphans
    console.log("Auditing orders...");
    const ordersSnap = await db.collection('orders').get();
    ordersSnap.forEach(doc => {
        const data = doc.data();
        const customerId = data.customerId;
        const storeId = data.storeId;

        if (!validUserIds.has(customerId)) {
            report.orphans.ordersMissingCustomer.push({ id: doc.id, customerId });
        }
        if (!validStoreIds.has(storeId)) {
            report.orphans.ordersMissingStore.push({ id: doc.id, storeId });
        }
    });

    // 6. Scan Administrative Collections for Orphans
    console.log("Auditing administrative and operational collections...");
    
    // Job Applications
    const jobAppsSnap = await db.collection('job_applications').get();
    jobAppsSnap.forEach(doc => {
        const jobId = doc.data().jobId;
        if (!validJobIds.has(jobId)) {
            report.orphans.jobApplicationsMissingJob.push({ id: doc.id, jobId });
        }
    });

    // Scheduled Ingestions
    const ingestionsSnap = await db.collection('scheduled_ingestion').get();
    ingestionsSnap.forEach(doc => {
        const merchantId = doc.data().merchantId;
        if (!validStoreIds.has(merchantId)) {
            report.orphans.scheduledIngestionsMissingStore.push({ id: doc.id, merchantId });
        }
    });

    // Campaign Logs
    const campaignLogsSnap = await db.collection('campaign_logs').get();
    campaignLogsSnap.forEach(doc => {
        const storeId = doc.data().storeId;
        if (!validStoreIds.has(storeId)) {
            report.orphans.campaignLogsMissingStore.push({ id: doc.id, storeId });
        }
    });

    // Billing Ledger
    const ledgerSnap = await db.collection('billing_ledger').get();
    ledgerSnap.forEach(doc => {
        const data = doc.data();
        const storeId = data.storeId;
        const userId = data.userId;

        if (storeId && storeId !== 'unknown' && !validStoreIds.has(storeId)) {
            report.orphans.billingLedgerMissingStore.push({ id: doc.id, storeId });
        }
        if (userId && !validUserIds.has(userId)) {
            report.orphans.billingLedgerMissingUser.push({ id: doc.id, userId });
        }
    });

    const reportPath = path.join(__dirname, '../pre_migration_audit_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n=== AUDIT COMPLETE. REPORT WRITTEN TO ${reportPath} ===`);
    console.log(`Total Staff: ${report.staff.total}`);
    console.log(`Active Staff: ${report.staff.active}`);
    console.log(`Staff Missing User Doc: ${report.staff.missingUserDoc.length}`);
    console.log(`Staff/User Role Mismatch: ${report.staff.roleMismatchWithUser.length}`);
    console.log(`Orphaned Merchant Products: ${report.orphans.merchantProductsMissingStore.length}`);
    console.log(`Orphaned Deals: ${report.orphans.dealsMissingStore.length}`);
    console.log(`Orphaned Orders: ${report.orphans.ordersMissingCustomer.length}`);
    console.log(`Orphaned Job Applications: ${report.orphans.jobApplicationsMissingJob.length}`);
    console.log(`Orphaned Scheduled Ingestions: ${report.orphans.scheduledIngestionsMissingStore.length}`);
    console.log(`Orphaned Campaign Logs: ${report.orphans.campaignLogsMissingStore.length}`);
    console.log(`Orphaned Billing Ledger Records: ${report.orphans.billingLedgerMissingStore.length + report.orphans.billingLedgerMissingUser.length}`);
}

runAudit().catch(console.error);
