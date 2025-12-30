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
exports.checkEmailStatus = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
/**
 * Check Email Status
 * Returns the last 5 email attempts from the 'mail' collection to diagnose Extension errors.
 */
exports.checkEmailStatus = functions.https.onRequest(async (req, res) => {
    try {
        const snapshot = await admin.firestore().collection('mail')
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();
        const logs = snapshot.docs.map(doc => {
            var _a;
            return ({
                id: doc.id,
                to: doc.data().to,
                createdAt: (_a = doc.data().createdAt) === null || _a === void 0 ? void 0 : _a.toDate(),
                // The Extension typically writes delivery status here
                delivery: doc.data().delivery
            });
        });
        res.status(200).json({
            success: true,
            logs: logs,
            instructions: "If 'delivery.state' is 'ERROR', check 'delivery.error' for details."
        });
    }
    catch (error) {
        console.error('Check status failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
//# sourceMappingURL=checkEmailStatus.js.map