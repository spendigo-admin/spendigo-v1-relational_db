# Firebase Email Trigger Extension Setup

**Status**: Verified
**Last Updated**: 2026-01-11

This guide walks you through setting up the infrastructure required to send emails from Spendigo.

## 1. Install the Extension
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Select your project (`spendigo-8540c`).
3. In the left sidebar, click **Build** -> **Extensions**.
4. Search for "Trigger Email" (published by Firebase).
5. Click **Install**.
   * *Note: This requires the Blaze (Pay as you go) plan.*

## 2. Configuration (SMTP)
You will need an SMTP service to send emails.

### Option A: SendGrid (Recommended)
1. Create a free account at [SendGrid.com](https://sendgrid.com).
2. Create an API Key with "Mail Send" permissions.
3. In the Firebase Extension configuration:
   * **SMTP Connection URI**: `smtps://apikey:YOUR_API_KEY@smtp.sendgrid.net:465`
   * Replace `YOUR_API_KEY` with the actual key string.

### Option B: Gmail (For Testing)
1. Use an App Password (NOT your login password). Go to Google Account -> Security -> 2-Step Verification -> App Passwords.
2. In Firebase Extension configuration:
   * **SMTP Connection URI**: `smtps://yourname%40gmail.com:APP_PASSWORD@smtp.gmail.com:465`
   * *Note: The `%40` replaces the `@` symbol in the username.*

## 3. Extension Settings
Configure the extension with these specific values to match the Spendigo codebase:

* **Email documents collection**: `mail` (Exact match required)
* **Default FROM address**: `noreply@spendigo.ca` (or your domain)
* **Default REPLY-TO**: `support@spendigo.ca`
* **Users collection**: `users`

## 4. Deploy & Verify
1. **Deploy your code**: The new admin features (Test Button) are in the latest web build.
   ```bash
   firebase deploy --only hosting
   ```
2. **Test**:
   * Go to **Admin Dashboard -> Settings -> System Tools**.
   * Click **📨 Send Test Email**.
   * You should see a toast "Test Email Queued".
   * Check your inbox.

## troubleshooting
* **Email Queued but not received**: Check the "Functions" logs in Firebase Console. It will show if the SMTP login failed.
* **Forgot Password Redirect**: Ensure your domain (`https://spendigo.ca` or `http://localhost:5173`) is listed in **Authentication -> Settings -> Authorized Domains** in the Firebase Console.
