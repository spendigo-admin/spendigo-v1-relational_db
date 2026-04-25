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
exports.recordAuditEvent = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
/**
 * Canonicalize an object to a deterministic JSON string (sorted keys, recursive)
 * This must match the client-side implementation for hash consistency if needed,
 * but since all forensic logging is moving here, this becomes the source of truth.
 */
/**
 * Canonicalize an object to a deterministic JSON string (sorted keys, recursive, excludes 'hash')
 */
const canonicalize = (val) => {
    if (val === null || val === undefined)
        return 'null';
    if (typeof val !== 'object')
        return JSON.stringify(val);
    if (Array.isArray(val))
        return '[' + val.map(canonicalize).join(',') + ']';
    const sortedKeys = Object.keys(val)
        .filter(k => k !== 'hash' && val[k] !== undefined)
        .sort();
    return '{' + sortedKeys.map(k => `${JSON.stringify(k)}:${canonicalize(val[k])}`).join(',') + '}';
};
/**
 * SHA-256 Hashing Utility (Node.js)
 */
const sha256 = (message) => {
    return crypto.createHash('sha256').update(message).digest('hex');
};
const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
/**
 * recordAuditEvent
 * Securely records a forensic audit event.
 * Handles IP capture, Actor metadata, and SHA-256 linkage server-side.
 */
exports.recordAuditEvent = functions.https.onCall(async (data, context) => {
    // 1. Verify caller is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated to record audit events');
    }
    const { action, metadata = {}, resource = '' } = data;
    if (!action) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required field: action');
    }
    const db = admin.firestore();
    // Unique Trace ID
    const id = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    try {
        await db.runTransaction(async (transaction) => {
            // 2. Get the very last log to maintain the forensic chain
            // Admin SDK supports queries inside transactions
            const q = db.collection('audit_logs').orderBy('timestamp', 'desc').orderBy('id', 'desc').limit(1);
            const lastLogSnapshot = await transaction.get(q);
            let prevHash = GENESIS_HASH;
            if (!lastLogSnapshot.empty) {
                prevHash = lastLogSnapshot.docs[0].data().hash;
            }
            // 3. Construct the Log Entry
            const logEntry = {
                id,
                timestamp: new Date().toISOString(),
                actor: {
                    id: context.auth.uid,
                    email: context.auth.token.email || 'unauthenticated',
                    ip: context.rawRequest.ip || 'unknown'
                },
                action,
                resource,
                metadata,
                prevHash,
                hash: ''
            };
            // 4. Compute Tamper-Evident Hash
            const hash = sha256(canonicalize(logEntry));
            logEntry.hash = hash;
            // 5. Commit to Ledger
            transaction.set(db.collection('audit_logs').doc(id), logEntry);
        });
        return { success: true, id };
    }
    catch (error) {
        functions.logger.error('Audit logging failed:', error);
        throw new functions.https.HttpsError('internal', 'Failed to record audit event');
    }
});
//# sourceMappingURL=recordAuditEvent.js.map