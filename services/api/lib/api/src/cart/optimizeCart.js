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
exports.cartOptimize = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const optimizeSmartCart_1 = require("../smartcart/optimizeSmartCart");
const ALLOWED_ORIGINS = ['https://spendigo.ca', 'https://www.spendigo.ca'];
function setCorsHeaders(req, res) {
    const origin = req.headers.origin || '';
    if (ALLOWED_ORIGINS.includes(origin) || process.env.FUNCTIONS_EMULATOR === 'true') {
        res.set('Access-Control-Allow-Origin', origin);
    }
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}
exports.cartOptimize = functions.runWith({ timeoutSeconds: 120, memory: '512MB' }).https.onRequest(async (req, res) => {
    var _a;
    setCorsHeaders(req, res);
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }
    if (process.env.FUNCTIONS_EMULATOR !== 'true') {
        const appCheckToken = req.header('X-Firebase-AppCheck');
        if (!appCheckToken) {
            res.status(401).json({ error: 'App Check token required.' });
            return;
        }
        try {
            await admin.appCheck().verifyToken(appCheckToken);
        }
        catch (_b) {
            res.status(401).json({ error: 'Invalid App Check token.' });
            return;
        }
    }
    try {
        const body = req.body;
        const result = await (0, optimizeSmartCart_1.optimizeSmartCartService)(body);
        res.status(200).json(result.response);
    }
    catch (error) {
        functions.logger.error('Cart optimize request failed', error);
        res.status(400).json({
            error: (_a = error === null || error === void 0 ? void 0 : error.message) !== null && _a !== void 0 ? _a : 'Unable to optimize cart request.',
        });
    }
});
//# sourceMappingURL=optimizeCart.js.map