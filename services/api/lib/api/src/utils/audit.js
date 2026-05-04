"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.logEvent = exports.buildActorFromContext = void 0;
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const db = admin.firestore();
const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
// Singleton document that acts as the serialization point for concurrent chain writes.
// Every logEvent transaction reads+writes this doc, so Firestore's optimistic locking
// forces concurrent transactions to retry and pick up the latest prevHash.
const META_REF = db.collection('audit_logs_meta').doc('latest');
/**
 * Canonicalize an object to a deterministic JSON string
 */
const canonicalize = (val) => {
    if (val === null || val === undefined)
        return 'null';
    if (typeof val !== 'object')
        return JSON.stringify(val);
    if (Array.isArray(val))
        return '[' + val.map(canonicalize).join(',') + ']';
    // Sort keys and explicitly exclude the 'hash' field which is being calculated
    const sortedKeys = Object.keys(val)
        .filter(k => k !== 'hash' && val[k] !== undefined)
        .sort();
    return '{' + sortedKeys.map(k => `${JSON.stringify(k)}:${canonicalize(val[k])}`).join(',') + '}';
};
/**
 * SHA-256 Hashing Utility
 */
const sha256 = (message) => {
    return crypto.createHash('sha256').update(message).digest('hex');
};
/**
 * Builds the actor object for logEvent from a callable function context.
 * Callers must verify context.auth is present before calling this.
 */
const buildActorFromContext = (context) => ({
    id: context.auth.uid,
    email: context.auth.token.email || '',
    ip: context.rawRequest.ip || ''
});
exports.buildActorFromContext = buildActorFromContext;
/**
 * Logs a system event with tamper-evident chaining.
 * Supports optional transaction to prevent nested transaction errors.
 * Also supports preFetchedPrevHash to satisfy the 'Reads before Writes' rule in complex transactions.
 */
const logEvent = async (action, actor, metadata = {}, resource = '', providedTransaction, preFetchedPrevHash) => {
    const auditRef = db.collection('audit_logs');
    const executeLogging = async (transaction) => {
        let prevHash = preFetchedPrevHash;
        if (!prevHash) {
            // Standalone transaction path: use META_REF as the serialization point.
            // Every concurrent standalone logEvent reads+writes this doc, forcing Firestore's
            // optimistic locking to serialize them and prevent duplicate prevHash values.
            const metaSnap = await transaction.get(META_REF);
            if (metaSnap.exists) {
                prevHash = metaSnap.data().latestHash;
            }
            else {
                // Bootstrap: META_REF doesn't exist yet (first deploy or manual deletion).
                // Fall back to a collection scan so we don't write GENESIS_HASH when real
                // logs already exist — that would silently break the chain.
                const latestSnap = await transaction.get(auditRef.orderBy('timestamp', 'desc').limit(1));
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
        const logEntry = {
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
        }
        else {
            await db.runTransaction(executeLogging);
        }
    }
    catch (e) {
        console.error('[AuditLogger] Failed to log event:', e);
        throw e;
    }
};
exports.logEvent = logEvent;
//# sourceMappingURL=audit.js.map