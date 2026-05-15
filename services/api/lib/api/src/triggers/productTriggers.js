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
exports.onMasterProductWrite = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const storage_1 = require("firebase-admin/storage");
const storage = admin.storage();
exports.onMasterProductWrite = functions.firestore
    .document('master_products/{productId}')
    .onWrite(async (change, context) => {
    // If deleted, do nothing
    if (!change.after.exists)
        return null;
    const data = change.after.data();
    const previousData = change.before.exists ? change.before.data() : null;
    const imageUrl = data === null || data === void 0 ? void 0 : data.primary_image_url;
    const productId = context.params.productId;
    // We only care if the image URL is an external web URL
    if (!imageUrl ||
        !imageUrl.startsWith('http') ||
        imageUrl.includes('firebasestorage.googleapis.com') ||
        imageUrl.includes(storage.bucket().name)) {
        return null;
    }
    // Only process if the imageUrl is newly added or changed
    if (previousData && previousData.primary_image_url === imageUrl) {
        return null;
    }
    try {
        functions.logger.info(`Downloading external image for ${productId}: ${imageUrl}`);
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        const bucket = storage.bucket();
        const urlPath = new URL(imageUrl).pathname;
        const extensionMatch = urlPath.match(/\.([^.]+)$/);
        const ext = extensionMatch ? extensionMatch[1] : 'jpg';
        const filePath = `products/${productId}.${ext}`;
        const file = bucket.file(filePath);
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        await file.save(Buffer.from(buffer), {
            metadata: {
                contentType: contentType,
                cacheControl: 'public, max-age=31536000',
            },
        });
        // Generate a persistent Firebase Storage download URL that bypasses App Check via token
        const publicUrl = await (0, storage_1.getDownloadURL)(file);
        functions.logger.info(`Successfully uploaded image to ${publicUrl}. Updating document...`);
        // Update the Firestore document
        await change.after.ref.update({
            primary_image_url: publicUrl,
            original_image_url: imageUrl,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
        return null;
    }
    catch (error) {
        functions.logger.error(`Error processing image for ${productId}:`, error);
        return null;
    }
});
//# sourceMappingURL=productTriggers.js.map