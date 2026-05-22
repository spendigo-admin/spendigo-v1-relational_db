import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as functions from 'firebase-functions/v1';

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

// Singleton document that acts as the serialization point for concurrent chain writes.
// Every logEvent transaction reads+writes this doc, so Firestore's optimistic locking
// forces concurrent transactions to retry and pick up the latest prevHash.
const META_REF = db.collection('audit_logs_meta').doc('latest');

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
 * Builds the actor object for logEvent from a callable function context.
 * Callers must verify context.auth is present before calling this.
 */
export const buildActorFromContext = (context: functions.https.CallableContext) => {
    const xForwardedFor = context.rawRequest.headers['x-forwarded-for'];
    const ip = typeof xForwardedFor === 'string'
        ? xForwardedFor.split(',')[0].trim()
        : context.rawRequest.ip || '0.0.0.0';

    return {
        id: context.auth!.uid,
        email: context.auth!.token.email || '',
        ip
    };
};

/**
 * Logs a system event with tamper-evident chaining.
 * Supports optional transaction to prevent nested transaction errors.
 * Also supports preFetchedPrevHash to satisfy the 'Reads before Writes' rule in complex transactions.
 */
export const logEvent = async (
    action: string,
    actor: { id: string; email: string; ip: string },
    metadata: Record<string, any> = {},
    resource: string = '',
    providedTransaction?: admin.firestore.Transaction,
    preFetchedPrevHash?: string
) => {
    const auditRef = db.collection('audit_logs');
    const executeLogging = async (transaction: admin.firestore.Transaction) => {
        let prevHash = preFetchedPrevHash;

        if (!prevHash) {
            // Standalone transaction path: use META_REF as the serialization point.
            // Every concurrent standalone logEvent reads+writes this doc, forcing Firestore's
            // optimistic locking to serialize them and prevent duplicate prevHash values.
            const metaSnap = await transaction.get(META_REF);

            if (metaSnap.exists) {
                prevHash = metaSnap.data()!.latestHash;
            } else {
                // Bootstrap: META_REF doesn't exist yet (first deploy or manual deletion).
                // Fall back to a collection scan so we don't write GENESIS_HASH when real
                // logs already exist — that would silently break the chain.
                const latestSnap = await transaction.get(
                    auditRef.orderBy('timestamp', 'desc').limit(1)
                );
                prevHash = latestSnap.empty
                    ? GENESIS_HASH
                    : latestSnap.docs[0].data().hash;
            }
        }
        // When preFetchedPrevHash IS provided (e.g. placeOrder passes its own pre-read hash),
        // we skip the META_REF read entirely. That caller is already inside a larger transaction
        // that completed all its reads before us, so adding a new read here would violate
        // Firestore's "all reads before writes" constraint. We still write META_REF below
        // so it stays current for subsequent standalone calls.

        // Prepare the new log
        const id = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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

        // Generate Hash (consistent with client-side canonicalization)
        logEntry.hash = sha256(canonicalize(logEntry));

        // Commit: write the log entry AND update the meta singleton in one atomic operation.
        transaction.set(auditRef.doc(id), logEntry);
        transaction.set(META_REF, { latestHash: logEntry.hash, latestId: id });
    };

    try {
        if (providedTransaction) {
            await executeLogging(providedTransaction);
        } else {
            await db.runTransaction(executeLogging);
        }
    } catch (e) {
        console.error('[AuditLogger] Failed to log event:', e);
        throw e;
    }
};
