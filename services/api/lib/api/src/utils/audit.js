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
exports.logEvent = void 0;
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const db = admin.firestore();
const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
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
 * Logs a system event with tamper-evident chaining.
 * Supports optional transaction to prevent nested transaction errors.
 */
const logEvent = async (action, actor, metadata = {}, resource = '', providedTransaction) => {
    const auditRef = db.collection('audit_logs');
    const executeLogging = async (transaction) => {
        // 1. Get the last log to find the previous hash
        // Use ID tie-breaker to handle concurrent events in the same millisecond
        const lastLogSnapshot = await transaction.get(auditRef.orderBy('timestamp', 'desc').orderBy('id', 'desc').limit(1));
        let prevHash = GENESIS_HASH;
        if (!lastLogSnapshot.empty) {
            prevHash = lastLogSnapshot.docs[0].data().hash;
        }
        // 2. Prepare the new log
        const id = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
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
        // 3. Generate Hash (consistent with client-side canonicalization)
        logEntry.hash = sha256(canonicalize(logEntry));
        // 4. Commit
        transaction.set(auditRef.doc(id), logEntry);
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
    }
};
exports.logEvent = logEvent;
//# sourceMappingURL=audit.js.map