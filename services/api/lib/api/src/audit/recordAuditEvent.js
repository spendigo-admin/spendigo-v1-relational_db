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
const audit_1 = require("../utils/audit");
/**
 * Cloud Function to record audit events from the client-side.
 * This acts as a bridge for shoppers and other users to contribute
 * to the forensic ledger securely.
 */
exports.recordAuditEvent = functions.https.onCall(async (data, context) => {
    // 1. Security Check (App Check & Auth)
    if (!context.app && process.env.FUNCTIONS_EMULATOR !== 'true') {
        throw new functions.https.HttpsError('failed-precondition', 'The function must be called from an App Check verified app.');
    }
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Audit events can only be recorded for authenticated sessions.');
    }
    const { action, resource, metadata } = data;
    if (!action) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required field: action');
    }
    try {
        await (0, audit_1.logEvent)(action, {
            id: context.auth.uid,
            email: context.auth.token.email || 'unauthenticated',
            ip: context.rawRequest.ip || 'unknown'
        }, metadata || {}, resource || '');
        return { success: true };
    }
    catch (e) {
        console.error("Failed to record audit event via logEvent utility:", e);
        throw new functions.https.HttpsError('internal', 'Failed to write to audit ledger');
    }
});
//# sourceMappingURL=recordAuditEvent.js.map