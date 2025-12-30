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
exports.sendTestEmail = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
/**
 * Test Email Function
 * Writes a document to the 'mail' collection to test the Trigger Email Extension.
 */
exports.sendTestEmail = functions.https.onRequest(async (req, res) => {
    const targetEmail = req.query.email;
    if (!targetEmail) {
        res.status(400).send('Missing email query parameter');
        return;
    }
    try {
        await admin.firestore().collection('mail').add({
            to: [targetEmail],
            message: {
                subject: 'Spendigo Email System Test',
                html: '<h1>It Works!</h1><p>The email system (Firestore -> Trigger Email Extension) is connected correctly.</p>'
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        res.status(200).json({ success: true, message: `Test email queued for ${targetEmail}. Check your inbox.` });
    }
    catch (error) {
        console.error('Test email failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
//# sourceMappingURL=testEmail.js.map