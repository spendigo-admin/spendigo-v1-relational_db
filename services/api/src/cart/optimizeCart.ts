import * as functions from 'firebase-functions';
import { optimizeSmartCartService } from '../smartcart/optimizeSmartCart';
import { SmartCartOptimizeRequestBody } from '../smartcart/types';

function setCorsHeaders(res: functions.Response<any>) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export const cartOptimize = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
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
