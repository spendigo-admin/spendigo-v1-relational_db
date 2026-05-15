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
exports.onUserUpdate = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
/**
 * TRIGGER: onUserUpdate
 * Syncs critical user profile data (subscriptionTier, name, avatar)
 * to the public 'stores' document to ensure consistency.
 */
exports.onUserUpdate = functions.firestore
    .document('users/{userId}')
    .onUpdate(async (change, _context) => {
    const newData = change.after.data();
    const previousData = change.before.data();
    // Critical fields to monitor
    const fieldsToSync = ['subscriptionTier', 'name', 'avatar', 'email'];
    // Check if any critical field changed
    const hasChanged = fieldsToSync.some(field => newData[field] !== previousData[field]);
    if (!hasChanged || newData.role !== 'merchant' || !newData.storeId) {
        return null;
    }
    functions.logger.log(`Syncing user data to store ${newData.storeId}...`);
    try {
        await db.collection('stores').doc(newData.storeId).set({
            subscriptionTier: newData.subscriptionTier,
            // Only update these if they exist on user profile, fallback handled by store settings usually
            merchantEmail: newData.email,
            // We typically don't overwrite store Name with User Name, but subscriptionTier is critical.
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        functions.logger.log(`Successfully synced subscriptionTier='${newData.subscriptionTier}' to store/${newData.storeId}`);
    }
    catch (error) {
        functions.logger.error('Error syncing user data to store:', error);
    }
    return null;
});
//# sourceMappingURL=userTriggers.js.map