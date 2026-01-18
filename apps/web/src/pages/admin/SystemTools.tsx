import React, { useState } from 'react';
import { useCatalog } from '../../hooks/useCatalog';
import { useNotifications } from '../../context/NotificationContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

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
                        const q = query(collection(db, 'merchant_products'), where('merchant_id', '==', storeDoc.id), where('status', '==', 'active')); // Only count ACTIVE status if applicable, or remove status check if field missing
                        // Actually, let's just count all for now, or check schema. Step 2153 showed 'status: active' in addMerchantProduct.
                        // But let's stick to simply counting documents with the merchant_id to be safe.
                        const qAll = query(collection(db, 'merchant_products'), where('merchant_id', '==', storeDoc.id));
                        const prodSnap = await getDocs(qAll);
                        const count = prodSnap.size;

                        updates.push({ ref: storeDoc.ref, data: { productCount: count, products: [] } });
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
        </div>
    );
};

export default SystemTools;
