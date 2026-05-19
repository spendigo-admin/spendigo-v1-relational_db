import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { getDownloadURL } from 'firebase-admin/storage';
import { createHash } from 'crypto';

const storage = admin.storage();

function isExternalFlyerUrl(url: string): boolean {
    return (
        url.startsWith('http') &&
        !url.includes('firebasestorage.googleapis.com') &&
        !url.includes(storage.bucket().name)
    );
}

function urlToStoragePath(url: string): string {
    const hash = createHash('md5').update(url).digest('hex');
    const extMatch = new URL(url).pathname.match(/\.([a-zA-Z0-9]{2,5})$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
    return `public/flyer-images/${hash}.${ext}`;
}

async function downloadAndStore(imageUrl: string): Promise<string> {
    const storagePath = urlToStoragePath(imageUrl);
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);

    const [exists] = await file.exists();
    if (exists) return getDownloadURL(file);

    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') ?? 'image/jpeg';

    await file.save(Buffer.from(buffer), {
        metadata: { contentType, cacheControl: 'public, max-age=31536000' },
    });

    return getDownloadURL(file);
}

export const onFlyerDealCreated = functions
    .runWith({ timeoutSeconds: 120, memory: '256MB' })
    .firestore
    .document('public_flyers/{flyerId}/deals/{dealId}')
    .onCreate(async (snap, context) => {
        const { flyerId, dealId } = context.params;
        const imageUrl: string | null = snap.data()?.imageUrl ?? null;

        if (!imageUrl) return null;
        if (!isExternalFlyerUrl(imageUrl)) return null;

        try {
            functions.logger.info(`[FlyerImageMirror] Mirroring ${imageUrl} for ${flyerId}/${dealId}`);
            const mirroredUrl = await downloadAndStore(imageUrl);
            await snap.ref.update({
                imageUrl: mirroredUrl,
                originalImageUrl: imageUrl,
                mirroredAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            functions.logger.info(`[FlyerImageMirror] Done → ${mirroredUrl}`);
        } catch (error) {
            // Non-fatal: deal stays usable with the original Flipp URL
            functions.logger.error(`[FlyerImageMirror] Failed for ${flyerId}/${dealId}:`, error);
        }

        return null;
    });
