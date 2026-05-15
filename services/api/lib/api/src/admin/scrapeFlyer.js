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
exports.scrapeFlyer = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const flippScraper_1 = require("../utils/flippScraper");
const errors_1 = require("../utils/errors");
exports.scrapeFlyer = functions.https.onCall(async (data, context) => {
    var _a;
    // Basic Authentication Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    // Check Admin Role
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    if (((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can trigger ingestion.');
    }
    const { postalCode, resetData } = data;
    if (!postalCode || typeof postalCode !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Valid postal code is required.');
    }
    try {
        const result = await (0, flippScraper_1.runIngestion)(postalCode, !!resetData);
        return result;
    }
    catch (error) {
        (0, errors_1.toHttpsError)(error, 'Failed to fetch flyers.');
    }
});
//# sourceMappingURL=scrapeFlyer.js.map