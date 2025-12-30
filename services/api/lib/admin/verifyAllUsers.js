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
exports.verifyAllUsers = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
/**
 * Emergency Migration Script: Verify All Existing Users
 *
 * Usage: Visit URL with secret key:
 * https://us-central1-YOUR-PROJECT.cloudfunctions.net/verifyAllUsers?key=MIGRATION_2025
 */
exports.verifyAllUsers = functions.https.onRequest(async (req, res) => {
    const key = req.query.key;
    // Simple security gate
    if (key !== 'MIGRATION_2025') {
        res.status(403).send('Unauthorized');
        return;
    }
    try {
        const usersRef = admin.firestore().collection('users');
        const snapshot = await usersRef.get();
        let count = 0;
        const batchSize = 500;
        let batch = admin.firestore().batch();
        const batches = [];
        for (const doc of snapshot.docs) {
            const userData = doc.data();
            // Skip if already verified
            if (userData.emailVerified === true)
                continue;
            // 1. Update Firestore
            batch.update(doc.ref, { emailVerified: true });
            count++;
            // 2. Update Firebase Auth
            try {
                await admin.auth().updateUser(doc.id, {
                    emailVerified: true
                });
            }
            catch (authError) {
                console.error(`Failed to update Auth for user ${doc.id}:`, authError);
            }
            if (count % batchSize === 0) {
                batches.push(batch.commit());
                batch = admin.firestore().batch();
            }
        }
        if (count % batchSize !== 0) {
            batches.push(batch.commit());
        }
        await Promise.all(batches);
        res.status(200).send(`Successfully verified ${count} users.`);
    }
    catch (error) {
        console.error("Migration failed", error);
        res.status(500).send(`Migration failed: ${error.message}`);
    }
});
//# sourceMappingURL=verifyAllUsers.js.map