import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

const HIRING_EMAIL = 'hiring@spendigo.ca';

export const onJobApplicationCreated = functions.firestore
    .document('job_applications/{applicationId}')
    .onCreate(async (snapshot, context) => {
        const app = snapshot.data();
        const applicationId = context.params.applicationId;

        const htmlContent = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; padding: 30px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; border-radius: 10px;">
        <div style="font-size: 48px; margin-bottom: 10px;">📋</div>
        <h1 style="margin: 0;">New Job Application</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">${app.jobTitle}</p>
    </div>

    <div style="padding: 30px; background: white; border: 1px solid #e5e7eb; margin-top: 20px; border-radius: 10px;">
        <h2 style="color: #6366f1; margin-top: 0;">Applicant Details</h2>
        <table style="width: 100%; border-collapse: collapse;">
            <tr>
                <td style="padding: 8px 0; color: #6b7280; width: 140px;">Name</td>
                <td style="padding: 8px 0; font-weight: bold;">${app.candidateName}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #6b7280;">Email</td>
                <td style="padding: 8px 0;"><a href="mailto:${app.candidateEmail}" style="color: #6366f1;">${app.candidateEmail}</a></td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #6b7280;">Phone</td>
                <td style="padding: 8px 0;">${app.candidatePhone || '—'}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #6b7280;">Position</td>
                <td style="padding: 8px 0;">${app.jobTitle}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #6b7280;">Applied</td>
                <td style="padding: 8px 0;">${new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
            </tr>
        </table>

        ${app.message ? `
        <h3 style="color: #374151; margin-top: 24px;">Cover Message</h3>
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; color: #374151; font-size: 14px; white-space: pre-wrap;">${app.message}</div>
        ` : ''}

        <div style="text-align: center; margin-top: 30px;">
            <a href="${app.resumeUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Download Resume</a>
        </div>
    </div>

    <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
        <p>Application ID: ${applicationId} &mdash; Spendigo Hiring System</p>
    </div>
</body>
</html>`;

        try {
            await admin.firestore().collection('mail').add({
                to: [HIRING_EMAIL],
                replyTo: app.candidateEmail,
                message: {
                    subject: `New Application: ${app.jobTitle} — ${app.candidateName}`,
                    html: htmlContent,
                },
                applicationId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            functions.logger.log(`Queued job application email for ${applicationId} (${app.jobTitle})`);

            await snapshot.ref.update({ emailQueued: true });
        } catch (error) {
            functions.logger.error('Error queuing job application email:', error);
        }
    });
