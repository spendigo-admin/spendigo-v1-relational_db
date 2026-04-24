import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

const db = admin.firestore();

// Standardized Log Entry
export interface AuditLog {
    id: string;
    timestamp: string;
    actor: {
        id: string;
        email: string;
        ip: string;
    };
    action: string;
    resource?: string;
    metadata?: Record<string, any>;
    prevHash: string;
    hash: string;
}

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Canonicalize an object to a deterministic JSON string
 */
const canonicalize = (value: any): string => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
    const sortedKeys = Object.keys(value).sort();
    return '{' + sortedKeys.map(k => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
};

/**
 * SHA-256 Hashing Utility
 */
const sha256 = (message: string): string => {
    return crypto.createHash('sha256').update(message).digest('hex');
};

/**
 * Logs a system event with tamper-evident chaining.
 * Uses a transaction to ensure strict sequentiality and prevent broken chains.
 */
export const logEvent = async (
    action: string, 
    actor: { id: string; email: string; ip: string },
    metadata: Record<string, any> = {}, 
    resource: string = ''
) => {
    const auditRef = db.collection('audit_logs');

    try {
        await db.runTransaction(async (transaction) => {
            // 1. Get the last log to find the previous hash
            const lastLogSnapshot = await transaction.get(
                auditRef.orderBy('timestamp', 'desc').limit(1)
            );

            let prevHash = GENESIS_HASH;
            if (!lastLogSnapshot.empty) {
                prevHash = lastLogSnapshot.docs[0].data().hash;
            }

            // 2. Prepare the new log
            const id = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const timestamp = new Date().toISOString();

            const logEntry: any = {
                id,
                timestamp,
                actor,
                action,
                resource,
                metadata,
                prevHash,
                hash: ''
            };

            // 3. Generate Hash
            const contentToHash = { ...logEntry };
            delete contentToHash.hash;
            logEntry.hash = sha256(canonicalize(contentToHash));

            // 4. Commit
            transaction.set(auditRef.doc(id), logEntry);
        });
    } catch (e) {
        console.error('[AuditLogger] Failed to log event:', e);
    }
};
