import React, { useState } from 'react';
import { useCatalog } from '../../hooks/useCatalog';
import { useNotifications } from '../../context/NotificationContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { collection, getDocs, query, where, writeBatch, doc, getCountFromServer, getDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../lib/firebase';
import { jobs as staticJobs } from '../../data/careers';

const SystemTools = () => {
    const { migrateCategories, loading: catalogLoading } = useCatalog();
    const { addNotification } = useNotifications();
    const { confirm } = useConfirmation();
    const [runningTool, setRunningTool] = useState<string | null>(null);

    const tools = [
        {
            id: 'category-migration',
            title: 'Standardize Categories',
            description: 'Converts legacy category IDs (e.g. cat-dairy) to clean names (Dairy). Updates Master and Pending products.',
            icon: '🏷️',
            action: async () => {
                if (await confirm({
                    title: 'Run Category Migration?',
                    message: 'This will update all product records in the database. Are you sure?',
                    confirmText: 'Run Migration',
                    type: 'danger'
                })) {
                    await migrateCategories();
                }
            }
        },
        {
            id: 'sync-counts',
            title: 'Repair Product Counts',
            description: 'Recalculate \'Active Products\' count for all stores. This also wipes legacy product lists for claimed stores.',
            icon: '🔄',
            action: async () => {
                if (await confirm({
                    title: 'Repair Product Counts?',
                    message: 'This will recalculate active product counts for ALL stores. It may take a few seconds.',
                    confirmText: 'Run Repair'
                })) {
                    console.log('Starting Repair Product Counts...');
                    // 1. Get all stores
                    const storesSnap = await getDocs(collection(db, 'stores'));
                    console.log(`Found ${storesSnap.size} stores.`);

                    const updates = [];

                    // 2. For each store, count products and prepare update
                    for (const storeDoc of storesSnap.docs) {
                        try {
                            // Count ALL products regardless of status to give total inventory size
                            const q = query(collection(db, 'merchant_products'), where('merchant_id', '==', storeDoc.id));
                            const snapshot = await getCountFromServer(q);
                            const count = snapshot.data().count;

                            console.log(`Store: ${storeDoc.data().name} (${storeDoc.id}) - Count: ${count}`);

                            updates.push({ ref: storeDoc.ref, data: { productCount: count, products: [] } });
                        } catch (e) {
                            console.warn(`Failed to count for store ${storeDoc.id}`, e);
                        }
                    }

                    // 3. Commit in batches of 400 (safe limit)
                    let batch = writeBatch(db);
                    let opCount = 0;
                    let batchCount = 0;

                    for (const update of updates) {
                        batch.update(update.ref, update.data);
                        opCount++;
                        if (opCount >= 400) {
                            await batch.commit();
                            batch = writeBatch(db);
                            opCount = 0;
                            batchCount++;
                        }
                    }
                    if (opCount > 0) await batch.commit();

                    addNotification({ type: 'system', title: 'Repair Complete', message: `Updated ${updates.length} stores.` });
                }
            }
        },
        {
            id: 'cleanup-catalog',
            title: 'Cleanup Master Catalog',
            description: 'Deletes master products that are NOT currently listed in any merchant store ("orphaned products").',
            icon: '🧹',
            action: async () => {
                if (await confirm({
                    title: 'Cleanup Orphans?',
                    message: 'This will DELETE all master products that are not currently sold by any store. This action is irreversible.',
                    confirmText: 'Start Cleanup',
                    type: 'danger'
                })) {
                    console.log('Starting Catalog Cleanup...');
                    addNotification({ type: 'system', title: 'Analysis Started', message: 'Identifying orphaned products...' });

                    // 1. Identify all USED Master IDs
                    const merchantProductsSnap = await getDocs(collection(db, 'merchant_products'));
                    const usedMasterIds = new Set<string>();

                    merchantProductsSnap.forEach(doc => {
                        const data = doc.data();
                        if (data.master_product_id) {
                            usedMasterIds.add(data.master_product_id);
                        }
                    });

                    console.log(`Found ${usedMasterIds.size} used master products across ${merchantProductsSnap.size} inventory items.`);

                    // 2. Identify ALL Master IDs
                    const masterProductsSnap = await getDocs(collection(db, 'master_products'));
                    console.log(`Found ${masterProductsSnap.size} total master products.`);

                    // 3. Find Orphans
                    const orphans: any[] = [];
                    masterProductsSnap.forEach(doc => {
                        if (!usedMasterIds.has(doc.id)) {
                            orphans.push(doc.ref);
                        }
                    });

                    if (orphans.length === 0) {
                        addNotification({ type: 'system', title: 'Clean', message: 'No orphaned products found.' });
                        return;
                    }

                    if (await confirm({
                        title: `Delete ${orphans.length} Orphans?`,
                        message: `Found ${orphans.length} orphaned products (out of ${masterProductsSnap.size}). Proceed with deletion?`,
                        confirmText: 'Delete Orphans',
                        type: 'danger'
                    })) {
                        // 4. Batch Delete
                        let batch = writeBatch(db);
                        let opCount = 0;
                        let deletedCount = 0;

                        for (const ref of orphans) {
                            batch.delete(ref);
                            opCount++;
                            deletedCount++;

                            if (opCount >= 400) {
                                await batch.commit();
                                batch = writeBatch(db);
                                opCount = 0;
                            }
                        }
                        if (opCount > 0) await batch.commit();

                        addNotification({ type: 'system', title: 'Cleanup Complete', message: `Deleted ${deletedCount} orphaned products.` });
                    }
                }
            }
        },
        {
            id: 'cleanup-inventory-orphans',
            title: 'Cleanup Inventory Orphans',
            description: 'Scans all merchant inventories for products linked to deleted/missing Master Products and removes them.',
            icon: '🗑️',
            action: async () => {
                if (await confirm({
                    title: 'Cleanup Inventory Orphans?',
                    message: 'This will DELETE merchant products that link to non-existent master products. This action is irreversible.',
                    confirmText: 'Start Cleanup',
                    type: 'danger'
                })) {
                    console.log('Starting Inventory Cleanup...');
                    addNotification({ type: 'system', title: 'Analysis Started', message: 'Scanning for broken inventory links...' });

                    let totalOrphans = 0;
                    let processedCount = 0;
                    const merchantProductsSnap = await getDocs(collection(db, 'merchant_products'));
                    const totalDocs = merchantProductsSnap.size;

                    console.log(`Scanning ${totalDocs} inventory items...`);

                    const orphans: any[] = [];
                    // Cache master existence to speed up
                    const validityCache: Record<string, boolean> = {};

                    for (const docSnap of merchantProductsSnap.docs) {
                        const data = docSnap.data();
                        const mid = data.master_product_id;

                        if (!mid) continue; // Skip local-only items (no master ID)

                        if (validityCache[mid] !== undefined) {
                            if (!validityCache[mid]) orphans.push(docSnap.ref);
                            continue;
                        }

                        // Check existence
                        // 1. Check Master
                        const masterRef = doc(db, 'master_products', mid);
                        const masterSnap = await getDoc(masterRef);

                        let isValid = masterSnap.exists();

                        if (!isValid) {
                            // 2. Check Pending
                            const pendingRef = doc(db, 'pending_master_products', mid);
                            const pendingSnap = await getDoc(pendingRef);
                            isValid = pendingSnap.exists();
                        }

                        validityCache[mid] = isValid;

                        if (!isValid) {
                            orphans.push(docSnap.ref);
                            totalOrphans++;
                        }

                        processedCount++;
                        if (processedCount % 100 === 0) console.log(`Processed ${processedCount}/${totalDocs}...`);
                    }

                    if (orphans.length === 0) {
                        addNotification({ type: 'system', title: 'Clean', message: 'No inventory orphans found.' });
                        return;
                    }

                    if (await confirm({
                        title: `Delete ${orphans.length} Ghost Items?`,
                        message: `Found ${orphans.length} inventory items pointing to missing master products. Delete them?`,
                        confirmText: 'Delete Ghost Items',
                        type: 'danger'
                    })) {
                        let batch = writeBatch(db);
                        let opCount = 0;
                        let deletedCount = 0;

                        for (const ref of orphans) {
                            batch.delete(ref);
                            opCount++;
                            deletedCount++;

                            if (opCount >= 400) {
                                await batch.commit();
                                batch = writeBatch(db);
                                opCount = 0;
                            }
                        }
                        if (opCount > 0) await batch.commit();

                        addNotification({ type: 'system', title: 'Cleanup Complete', message: `Deleted ${deletedCount} ghost inventory items.` });
                    }
                }
            }
        },
        {
            id: 'cleanup-orphaned-stores',
            title: 'Cleanup Deleted Stores Data',
            description: 'Scans and removes all lingering data (products, deals, flyers) belonging to previously deleted stores.',
            icon: '🏢',
            action: async () => {
                if (await confirm({
                    title: 'Clean Deleted Stores Data?',
                    message: 'This will irreversibly delete any dangling data left behind by stores deleted prior to the automatic triggers. Proceed?',
                    confirmText: 'Run Store Cleanup',
                    type: 'danger'
                })) {
                    addNotification({ type: 'system', title: 'Scan Initiated', message: 'Calling Cloud Function for heavy scan...' });
                    try {
                        const cleanupFn = httpsCallable(functions, 'cleanupOrphanedStoreData');
                        const result = await cleanupFn();
                        const { details, message } = result.data as any;
                        addNotification({ type: 'system', title: 'Cleanup Complete', message: message });
                    } catch (e: any) {
                        throw new Error(e.message || 'Error occurred while cleaning up store data.');
                    }
                }
            }
        },
        {
            id: 'seed-careers',
            title: 'Seed Careers Data',
            description: 'Migrates static job listings from code files to Firestore for dynamic management.',
            icon: '💼',
            action: async () => {
                if (await confirm({
                    title: 'Seed Careers?',
                    message: 'This will copy all current static job roles into the database. Existing database entries will NOT be overwritten but may be duplicated if IDs match. Proceed?',
                    confirmText: 'Start Seeding'
                })) {
                    console.log('Seeding Careers...');
                    const batch = writeBatch(db);
                    let count = 0;

                    for (const job of staticJobs) {
                        const jobRef = doc(db, 'careers', job.id.toString());
                        batch.set(jobRef, {
                            ...job,
                            isVisible: true,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp()
                        });
                        count++;
                    }

                    await batch.commit();
                    addNotification({ type: 'system', title: 'Seeding Complete', message: `Successfully seeded ${count} job roles.` });
                }
            }
        }
    ];

    const runTool = async (tool: typeof tools[0]) => {
        if (runningTool) return;
        setRunningTool(tool.id);
        try {
            await tool.action();
            if (tool.id === 'category-migration') {
                addNotification({ type: 'system', title: 'Success', message: `${tool.title} completed successfully.` });
            }
        } catch (err: any) {
            console.error(err);
            addNotification({ type: 'alert', title: 'Error', message: err.message || 'Tool execution failed.' });
        } finally {
            setRunningTool(null);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold text-[var(--text-main)]">System Tools</h1>
                <p className="text-sm text-[var(--text-muted)]">
                    Utilities for database maintenance, migrations, and debugging.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tools.map(tool => (
                    <div key={tool.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                            <span className={`text-3xl bg-gray-50 p-2 rounded-lg flex items-center justify-center transition-all duration-300 ${runningTool === tool.id ? 'bg-blue-50 scale-110 animate-pulse' : ''}`}>
                                {runningTool === tool.id ? '⏳' : tool.icon}
                            </span>
                            {runningTool === tool.id && <span className="text-xs font-bold text-blue-600 animate-pulse">Running...</span>}
                        </div>
                        <h3 className="font-bold text-lg mb-2 text-[var(--text-main)]">{tool.title}</h3>
                        <p className="text-sm text-[var(--text-muted)] mb-6 min-h-[3rem]">
                            {tool.description}
                        </p>
                        <button
                            onClick={() => runTool(tool)}
                            disabled={!!runningTool || catalogLoading}
                            className={`w-full py-2 rounded-lg text-sm font-bold transition-colors ${runningTool ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
                                'bg-[var(--brand-primary)] text-white hover:brightness-110 shadow-md shadow-[var(--brand-primary)]/20'
                                }`}
                        >
                            {runningTool === tool.id ? 'Processing...' : 'Run Tool'}
                        </button>
                    </div>
                ))}
            </div>

            <div className="mt-12 pt-8 border-t border-[var(--glass-border)]">
                <h2 className="text-xl font-bold text-[var(--text-main)] mb-2">Observability & Diagnostics</h2>
                <p className="text-sm text-[var(--text-muted)] mb-6">
                    External tools configured for tracking application health and running End-to-End tests.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <a href="https://sentry.io" target="_blank" rel="noreferrer" className="flex items-start gap-4 bg-white p-5 rounded-xl border border-[var(--glass-border)] hover:border-purple-300 hover:shadow-md transition-all group">
                        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                            🐞
                        </div>
                        <div>
                            <h3 className="font-bold text-[var(--text-main)] mb-1 flex items-center gap-2">
                                Sentry Error Tracking <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded font-bold">Live</span>
                            </h3>
                            <p className="text-sm text-[var(--text-muted)]">View real-time JavaScript exceptions, unhandled promises, and React crash reports.</p>
                        </div>
                    </a>

                    <div className="flex items-start gap-4 bg-white p-5 rounded-xl border border-[var(--glass-border)] hover:border-blue-300 hover:shadow-md transition-all group cursor-help" title="Run 'npx playwright test' in your terminal to execute.">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                            🎭
                        </div>
                        <div>
                            <h3 className="font-bold text-[var(--text-main)] mb-1 flex items-center gap-2">
                                Playwright E2E Suite <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded font-bold">Local</span>
                            </h3>
                            <p className="text-sm text-[var(--text-muted)]">Automated browser testing suite. View HTML test reports in your local terminal output.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemTools;
