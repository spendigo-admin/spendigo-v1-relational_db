import * as functions from 'firebase-functions/v1';

export function toHttpsError(error: any, fallback: string, code: functions.https.FunctionsErrorCode = 'internal'): never {
    functions.logger.error(fallback, { message: error?.message, stack: error?.stack });
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError(code, fallback);
}
