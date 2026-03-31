import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import PDFDocument from 'pdfkit';

const db = admin.firestore();

/**
 * Generates a professional PDF receipt for a given order and returns a download URL.
 * Uses the Firebase Download Token strategy to avoid the 'client_email' signing issues
 * common in dev/local environments.
 */
export const downloadReceipt = functions.https.onCall(async (data, context) => {
    // 1. Authentication Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { orderId } = data;
    if (!orderId) {
        throw new functions.https.HttpsError('invalid-argument', 'Order ID is required.');
    }

    try {
        // 2. Fetch Order Data
        const orderSnap = await db.collection('orders').doc(orderId).get();
        if (!orderSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Order not found.');
        }

        const order = orderSnap.data() as any;
        const userId = context.auth.uid;

        // Security: Ensure requester is customer OR merchant of this store OR admin
        if (order.customerId !== userId) {
            const userSnap = await db.collection('users').doc(userId).get();
            const userData = userSnap.data();
            if (userData?.storeId !== order.storeId && userData?.role !== 'admin') {
                throw new functions.https.HttpsError('permission-denied', 'You do not have permission to access this receipt.');
            }
        }

        // 3. Generate PDF Buffer using PDFKit
        const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const chunks: Buffer[] = [];

            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('error', (err) => reject(err));
            doc.on('end', () => resolve(Buffer.concat(chunks)));

            // --- PDF Layout Design ---
            
            // Header: Company Logo/Name
            doc.fillColor('#1d4ed8').fontSize(24).text('SPENDIGO', { align: 'center' });
            doc.fontSize(10).fillColor('#6b7280').text('Hyperlocal Marketplace Receipt', { align: 'center' }).moveDown(2);

            // Receipt Info
            doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold').text(`Receipt for Order: ${orderId.substring(0, 10)}...`);
            doc.fontSize(10).font('Helvetica').fillColor('#6b7280').text(`Date: ${new Date(order.date).toLocaleString()}`);
            doc.text(`Payment Status: ${order.paymentStatus?.toUpperCase() || 'PAID'}`);
            doc.text(`Fulfillment: ${order.deliveryAddress ? 'Delivery' : 'Pickup'}`).moveDown(1.5);

            // Bill To / Sold By
            const col1 = 50;
            const col2 = 300;
            const startY = doc.y;

            doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold').text('Sold By:', col1, startY);
            doc.fontSize(10).font('Helvetica').fillColor('#374151').text(order.storeName, col1, startY + 15);
            doc.text(`${order.storeProvince || 'ON'}, Canada`, col1, startY + 30);

            doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold').text('Billed To:', col2, startY);
            doc.fontSize(10).font('Helvetica').fillColor('#374151').text(order.customerName, col2, startY + 15);
            if (order.deliveryAddress) {
                doc.text(order.deliveryAddress.street, col2, startY + 30);
                doc.text(`${order.deliveryAddress.city}, ${order.deliveryAddress.province} ${order.deliveryAddress.postalCode}`, col2, startY + 45);
            }
            
            doc.moveDown(4);

            // Table Headers
            const tableY = doc.y;
            doc.rect(50, tableY, 500, 20).fill('#f3f4f6');
            doc.fillColor('#374151').fontSize(10).text('Description', 60, tableY + 5);
            doc.text('Qty', 300, tableY + 5);
            doc.text('Price', 400, tableY + 5);
            doc.text('Total', 480, tableY + 5);
            
            doc.moveDown(1);

            // Table Body
            let currentY = tableY + 25;
            order.items.forEach((item: any) => {
                doc.fillColor('#111827').text(item.productName, 60, currentY, { width: 230 });
                doc.text(item.quantity.toString(), 300, currentY);
                doc.text(`$${item.price.toFixed(2)}`, 400, currentY);
                doc.text(`$${(item.price * item.quantity).toFixed(2)}`, 480, currentY);
                currentY += 20;
            });

            // Totals
            doc.moveTo(50, currentY + 10).lineTo(550, currentY + 10).stroke('#e5e7eb');
            currentY += 25;

            doc.fillColor('#374151').text('Subtotal:', 400, currentY);
            doc.fillColor('#111827').text(`$${order.subtotal.toFixed(2)}`, 480, currentY);
            currentY += 15;

            doc.fillColor('#374151').text('Tax:', 400, currentY);
            doc.fillColor('#111827').text(`$${order.tax.toFixed(2)}`, 480, currentY);
            currentY += 15;

            if (order.deliveryFee > 0) {
                doc.fillColor('#374151').text('Delivery Fee:', 400, currentY);
                doc.fillColor('#111827').text(`$${order.deliveryFee.toFixed(2)}`, 480, currentY);
                currentY += 15;
            }

            doc.moveDown(1);
            doc.fillColor('#1d4ed8').fontSize(14).font('Helvetica-Bold').text('Total Amount:', 350, currentY);
            doc.text(`$${order.total.toFixed(2)}`, 480, currentY);

            // Footer
            doc.fontSize(8).fillColor('#9ca3af').text('Spendigo is a marketplace facilitator. Thank you for shopping local!', 50, 750, { align: 'center' });

            doc.end();
        });

        // 4. Upload to Cloud Storage with Download Token
        const bucket = admin.storage().bucket();
        const filePath = `receipts/${orderId}_${Date.now()}.pdf`;
        const file = bucket.file(filePath);
        const downloadToken = crypto.randomUUID();

        await file.save(pdfBuffer, {
            contentType: 'application/pdf',
            metadata: {
                cacheControl: 'public, max-age=3600',
                metadata: {
                    firebaseStorageDownloadTokens: downloadToken
                }
            }
        });

        // 5. Construct Firebase Download URL
        // Format: https://firebasestorage.googleapis.com/v0/b/<BUCKET>/o/<PATH>?alt=media&token=<TOKEN>
        const bucketName = bucket.name || process.env.GCLOUD_PROJECT + '.appspot.com';
        const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`;

        return { url };

    } catch (error: any) {
        functions.logger.error('Download Receipt Error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to generate receipt.');
    }
});
