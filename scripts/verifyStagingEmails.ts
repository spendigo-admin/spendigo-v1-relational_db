import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';

const serviceAccountPath = './scripts/service-account.json';
if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Error: Service account file not found at ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const auth = getAuth();

const adminEmails = [
  'admin@spendigo.ca',
  'support@spendigo.ca',
  'alishahbazsidhu@gmail.com'
];

async function verifyAdminEmails() {
  console.log('=== PROGRAMMATICALLY VERIFYING STAGING ADMIN EMAILS ===');
  
  for (const email of adminEmails) {
    try {
      const user = await auth.getUserByEmail(email);
      console.log(`Found user: ${email} (UID: ${user.uid}). Current emailVerified: ${user.emailVerified}`);
      
      if (!user.emailVerified) {
        await auth.updateUser(user.uid, {
          emailVerified: true
        });
        console.log(`[✓] Successfully marked ${email} as EMAIL VERIFIED!`);
      } else {
        console.log(`[i] ${email} is already verified.`);
      }
    } catch (err: any) {
      console.error(`Failed to verify email for ${email}:`, err.message);
    }
  }
}

verifyAdminEmails().then(() => {
  console.log('\n[✓] Programmatic verification complete. You can now register SMS MFA!');
  process.exit(0);
}).catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
