import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { optimizeSmartCartService } from '../smartcart/optimizeSmartCart';
import { SmartCartOptimizeRequestBody } from '../smartcart/types';

const ALLOWED_ORIGINS = ['https://spendigo.ca', 'https://www.spendigo.ca'];

function setCorsHeaders(req: functions.Request, res: functions.Response<any>) {
    const origin = req.headers.origin || '';
    if (ALLOWED_ORIGINS.includes(origin) || process.env.FUNCTIONS_EMULATOR === 'true') {
        res.set('Access-Control-Allow-Origin', origin);
    }
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export const cartOptimize = functions.runWith({ timeoutSeconds: 120, memory: '512MB' }).https.onRequest(async (req, res) => {
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
        } catch {
            res.status(401).json({ error: 'Invalid App Check token.' });
            return;
        }
    }

    try {
        const body = req.body as SmartCartOptimizeRequestBody;
        const result = await optimizeSmartCartService(body);

        res.status(200).json(result.response);
    } catch (error: any) {
        functions.logger.error('Cart optimize request failed', error);
        res.status(400).json({
            error: error?.message ?? 'Unable to optimize cart request.',
        });
    }
});
