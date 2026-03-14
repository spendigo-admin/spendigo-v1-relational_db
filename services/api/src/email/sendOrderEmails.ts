import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// No external dependencies needed! We just write to Firestore.

/**
 * Send Order Confirmation Email
 * Creates a document in the 'mail' collection which triggers the Firebase Extension
 */
export const sendOrderConfirmation = functions.firestore
    .document('orders/{orderId}')
    .onCreate(async (snapshot, context) => {
        const order = snapshot.data();
        const orderId = context.params.orderId;

        try {
            // Build the HTML content
            const itemsList = order.items
                .map((item: any) => `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.price.toFixed(2)}</td>
                    </tr>
                `)
                .join('');

            const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #6366f1; color: white !important; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .total-row { font-weight: bold; background: #f9fafb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 28px;">✅ Order Confirmed!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Thank you for shopping with ${order.storeName}</p>
        </div>
        
        <div class="content">
            <p>Hi ${order.customerName || 'there'},</p>
            <p>Great news! Your order has been confirmed and ${order.storeName} is preparing your items.</p>
            
            <h2 style="color: #6366f1; margin-top: 30px;">Order Details</h2>
            <p><strong>Order ID:</strong> #${orderId}<br>
            <strong>Date:</strong> ${new Date(order.date).toLocaleDateString()}<br>
            <strong>Status:</strong> <span style="background: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 4px; font-size: 12px;">Processing</span></p>
            
            <h3 style="margin-top: 30px;">Items</h3>
            <table>
                <thead>
                    <tr style="background: #f9fafb;">
                        <th style="padding: 10px; text-align: left;">Product</th>
                        <th style="padding: 10px; text-align: center;">Qty</th>
                        <th style="padding: 10px; text-align: right;">Price</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsList}
                    <tr class="total-row">
                        <td colspan="2" style="padding: 15px; text-align: right;">Total:</td>
                        <td style="padding: 15px; text-align: right; font-size: 18px; color: #6366f1;">$${order.total.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
            
            <div style="text-align: center;">
                <a href="https://spendigo.ca/order/${orderId}" class="button">Track Your Order</a>
            </div>
            
            <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
                <strong>Delivery Address:</strong><br>
                ${order.deliveryAddress || 'To be confirmed'}
            </p>
        </div>
        
        <div class="footer">
            <p>Need help? Reply to this email or contact <a href="mailto:support@spendigo.ca" style="color: #6366f1;">support@spendigo.ca</a></p>
            <p style="margin-top: 10px;">&copy; ${new Date().getFullYear()} Spendigo. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

            // Write to 'mail' collection (Trigger Email Extension)
            await admin.firestore().collection('mail').add({
                to: [order.customerEmail],
                message: {
                    subject: `Order Confirmation - #${orderId}`,
                    html: htmlContent,
                },
                orderId: orderId, // Metadata
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            functions.logger.log(`Queued order confirmation email for ${orderId}`);

            // Update order status
            await admin.firestore().collection('orders').doc(orderId).update({
                emailQueued: true,
                emailQueuedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return { success: true };
        } catch (error) {
            functions.logger.error('Error queuing order confirmation email:', error);
            return { success: false, error: String(error) };
        }
    });

/**
 * Send Order Status Update Email
 * Creates a document in the 'mail' collection which triggers the Firebase Extension
 */
export const sendOrderStatusUpdate = functions.firestore
    .document('orders/{orderId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        const orderId = context.params.orderId;

        // Only send if status changed
        if (before.status === after.status) {
            return null;
        }

        try {
            // Determine email content based on status
            let subject = '';
            let emoji = '';
            let message = '';
            let statusColor = '';

            switch (after.status) {
                case 'preparing':
                    emoji = '👨‍🍳';
                    subject = `Your Order is Being Prepared`;
                    message = `${after.storeName} is now preparing your order. We'll notify you when it's ready for delivery.`;
                    statusColor = '#eab308'; // yellow
                    break;
                case 'out_for_delivery':
                    emoji = '🚚';
                    subject = `Your Order is Out for Delivery`;
                    message = `Your order is on its way! Expected delivery within the next few hours.`;
                    statusColor = '#3b82f6'; // blue
                    break;
                case 'delivered':
                    emoji = '✅';
                    subject = `Your Order Has Been Delivered`;
                    message = `Your order has been successfully delivered. Thank you for shopping with ${after.storeName}!`;
                    statusColor = '#22c55e'; // green
                    break;
                case 'cancelled':
                    emoji = '❌';
                    subject = `Your Order Has Been Cancelled`;
                    message = `Your order has been cancelled. If you didn't request this, please contact support.`;
                    statusColor = '#ef4444'; // red
                    break;
                default:
                    return null;
            }

            const htmlContent = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; padding: 30px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; border-radius: 10px;">
        <div style="font-size: 48px; margin-bottom: 10px;">${emoji}</div>
        <h1 style="margin: 0;">${subject}</h1>
        <p style="margin: 10px 0 0 0;">Order #${orderId}</p>
    </div>
    
    <div style="padding: 30px; background: white; border: 1px solid #e5e7eb; margin-top: 20px; border-radius: 10px;">
        <p>Hi ${after.customerName || 'there'},</p>
        <p>${message}</p>
        
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Order ID:</strong> #${orderId}</p>
            <p style="margin: 10px 0 0 0;"><strong>Status:</strong> <span style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 14px;">${after.status.replace(/_/g, ' ').toUpperCase()}</span></p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
            <a href="https://spendigo.ca/order/${orderId}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px;">View Order Details</a>
        </div>
    </div>
    
    <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
        <p>Questions? Contact <a href="mailto:support@spendigo.ca" style="color: #6366f1;">support@spendigo.ca</a></p>
    </div>
</body>
</html>`;

            // Write to 'mail' collection
            await admin.firestore().collection('mail').add({
                to: [after.customerEmail],
                message: {
                    subject: `${subject} - Order #${orderId}`,
                    html: htmlContent,
                },
                orderId: orderId,
                status: after.status,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            functions.logger.log(`Queued order status email for ${orderId} (${after.status})`);

            return { success: true };
        } catch (error) {
            functions.logger.error('Error queuing order status email:', error);
            return { success: false, error: String(error) };
        }
    });
