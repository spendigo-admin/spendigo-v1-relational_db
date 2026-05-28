import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { getDb } from '../db/client';
import * as schema from '../db/schema';

const db = admin.firestore();

/**
 * TRIGGER: onUserCreate
 * Replicates newly registered users directly to PostgreSQL.
 */
export const onUserCreate = functions.runWith({ secrets: ['DATABASE_URL'] }).firestore
    .document('users/{userId}')
    .onCreate(async (snap, _context) => {
        const data = snap.data();
        const userId = snap.id;
        
        functions.logger.info(`[Dual-Write] New user registered: ${userId}. Replicating to PostgreSQL...`);
        
        const sqlDb = getDb();
        try {
            await sqlDb.insert(schema.users).values({
                id: userId,
                email: data.email || `${userId}@unknown.com`,
                name: data.name || null,
                role: ['admin', 'merchant', 'consumer'].includes(data.role) ? data.role as any : 'consumer',
                adminRole: ['SUPER_ADMIN', 'SUPPORT', 'MODERATOR', 'AUDITOR'].includes(data.adminRole) ? data.adminRole as any : null,
                merchantRole: data.merchantRole || null,
                storeId: data.storeId || null,
                status: data.status === 'pending_invite' ? 'pending_invite' : 'active',
                addresses: data.addresses || [],
                totalOrders: typeof data.total_orders === 'number' ? data.total_orders : parseInt(data.total_orders) || 0,
                totalSpend: (() => {
                    const s = parseFloat(data.total_spend || 0);
                    return isNaN(s) ? 0 : Math.round(s * 100);
                })(),
                lastOrderDate: data.last_order_date ? new Date(data.last_order_date) : null,
                createdAt: new Date(),
                lastActive: new Date(),
            }).onConflictDoNothing();
            
            functions.logger.info(`[Dual-Write] Successfully replicated user ${userId} to PostgreSQL.`);
        } catch (pgError: any) {
            functions.logger.error('[Dual-Write] PostgreSQL User replication failed:', pgError.message);
        }
        return null;
    });

/**
 * TRIGGER: onUserUpdate
 * Syncs critical user profile data (subscriptionTier, name, avatar) 
 * to the public 'stores' document to ensure consistency, and replicates updates to PostgreSQL.
 */
export const onUserUpdate = functions.runWith({ secrets: ['DATABASE_URL'] }).firestore
    .document('users/{userId}')
    .onUpdate(async (change, _context) => {
        const newData = change.after.data();
        const previousData = change.before.data();
        const userId = change.after.id;

        // 1. Sync to Firestore Stores (Legacy)
        const fieldsToSync = ['subscriptionTier', 'name', 'avatar', 'email'];
        const hasChanged = fieldsToSync.some(field => newData[field] !== previousData[field]);

        if (hasChanged && newData.role === 'merchant' && newData.storeId) {
            functions.logger.log(`Syncing user data to store ${newData.storeId}...`);
            try {
                await db.collection('stores').doc(newData.storeId).set({
                    subscriptionTier: newData.subscriptionTier,
                    merchantEmail: newData.email,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                functions.logger.log(`Successfully synced subscriptionTier='${newData.subscriptionTier}' to store/${newData.storeId}`);
            } catch (error) {
                functions.logger.error('Error syncing user data to store:', error);
            }
        }

        // 2. Replicate User Update to PostgreSQL
        functions.logger.info(`[Dual-Write] Syncing user profile update for ${userId} to PostgreSQL...`);
        const sqlDb = getDb();
        try {
            await sqlDb.insert(schema.users).values({
                id: userId,
                email: newData.email || `${userId}@unknown.com`,
                name: newData.name || null,
                role: ['admin', 'merchant', 'consumer'].includes(newData.role) ? newData.role as any : 'consumer',
                adminRole: ['SUPER_ADMIN', 'SUPPORT', 'MODERATOR', 'AUDITOR'].includes(newData.adminRole) ? newData.adminRole as any : null,
                merchantRole: newData.merchantRole || null,
                storeId: newData.storeId || null,
                status: newData.status === 'pending_invite' ? 'pending_invite' : 'active',
                addresses: newData.addresses || [],
                totalOrders: typeof newData.total_orders === 'number' ? newData.total_orders : parseInt(newData.total_orders) || 0,
                totalSpend: (() => {
                    const s = parseFloat(newData.total_spend || 0);
                    return isNaN(s) ? 0 : Math.round(s * 100);
                })(),
                lastOrderDate: newData.last_order_date ? new Date(newData.last_order_date) : null,
                createdAt: new Date(),
                lastActive: new Date(),
            }).onConflictDoUpdate({
                target: schema.users.id,
                set: {
                    email: newData.email || `${userId}@unknown.com`,
                    name: newData.name || null,
                    role: ['admin', 'merchant', 'consumer'].includes(newData.role) ? newData.role as any : 'consumer',
                    adminRole: ['SUPER_ADMIN', 'SUPPORT', 'MODERATOR', 'AUDITOR'].includes(newData.adminRole) ? newData.adminRole as any : null,
                    merchantRole: newData.merchantRole || null,
                    storeId: newData.storeId || null,
                    status: newData.status === 'pending_invite' ? 'pending_invite' : 'active',
                    addresses: newData.addresses || [],
                    totalOrders: typeof newData.total_orders === 'number' ? newData.total_orders : parseInt(newData.total_orders) || 0,
                    totalSpend: (() => {
                        const s = parseFloat(newData.total_spend || 0);
                        return isNaN(s) ? 0 : Math.round(s * 100);
                    })(),
                    lastOrderDate: newData.last_order_date ? new Date(newData.last_order_date) : null,
                    lastActive: new Date(),
                }
            });
            functions.logger.info(`[Dual-Write] Replicated user ${userId} update to PostgreSQL.`);
        } catch (pgError: any) {
            functions.logger.error('[Dual-Write] PostgreSQL User replication failed:', pgError.message);
        }
        return null;
    });
