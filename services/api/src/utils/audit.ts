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
const canonicalize = (val: any): string => {
    if (val === null || val === undefined) return 'null';
    if (typeof val !== 'object') return JSON.stringify(val);
    if (Array.isArray(val)) return '[' + val.map(canonicalize).join(',') + ']';
    
    // Sort keys and explicitly exclude the 'hash' field which is being calculated
    const sortedKeys = Object.keys(val)
        .filter(k => k !== 'hash' && val[k] !== undefined)
        .sort();
        
    return '{' + sortedKeys.map(k => `${JSON.stringify(k)}:${canonicalize(val[k])}`).join(',') + '}';
};

/**
 * SHA-256 Hashing Utility
 */
const sha256 = (message: string): string => {
    return crypto.createHash('sha256').update(message).digest('hex');
};

/**
 * Logs a system event with tamper-evident chaining.
 * Supports optional transaction to prevent nested transaction errors.
 */
export const logEvent = async (
    action: string, 
    actor: { id: string; email: string; ip: string },
    metadata: Record<string, any> = {}, 
    resource: string = '',
    providedTransaction?: admin.firestore.Transaction
) => {
    const auditRef = db.collection('audit_logs');
    const executeLogging = async (transaction: admin.firestore.Transaction) => {
        // 1. Get the last log to find the previous hash
        // Use ID tie-breaker to handle concurrent events in the same millisecond
        const lastLogSnapshot = await transaction.get(
            auditRef.orderBy('timestamp', 'desc').orderBy('id', 'desc').limit(1)
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

        // 3. Generate Hash (consistent with client-side canonicalization)
        logEntry.hash = sha256(canonicalize(logEntry));

        // 4. Commit
        transaction.set(auditRef.doc(id), logEntry);
    };

    try {
        if (providedTransaction) {
            await executeLogging(providedTransaction);
        } else {
            await db.runTransaction(executeLogging);
        }
    } catch (e) {
        console.error('[AuditLogger] Failed to log event:', e);
    }
};
